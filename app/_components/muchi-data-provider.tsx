"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createEmptyArchive, publicProjectionSignature, type ArchiveEnvelopeV1 } from "@/lib/archive";
import {
  createDiscoveryInteractionState,
  createEmptyPublicDiscoveryCatalog,
  type DiscoveryInteractionState,
  type PublicDiscoveryCatalog,
} from "@/lib/public-discovery";
import { ArchiveApiError, fetchArchive, saveArchive as saveArchiveRemote, type VersionedArchive } from "@/lib/client/archive-api";
import { fetchDiscoveryState, saveDiscoveryState, type VersionedDiscoveryState } from "@/lib/client/discovery-state-api";
import { fetchPublicDiscoveryCatalog } from "@/lib/client/public-discovery-api";
import {
  fetchOnboardingStatus,
  OnboardingApiError,
  saveOnboardingComplete,
  type OnboardingStatus,
} from "@/lib/client/onboarding-api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ToastMessage } from "./editorial-types";

const STALE_AFTER_MS = 60_000;

type PendingArchive = { archive: ArchiveEnvelopeV1; message?: ToastMessage; syncPublicProjection: boolean };
type PendingDiscovery = { state: DiscoveryInteractionState; message?: ToastMessage };

type MuchiDataContextValue = {
  archive: ArchiveEnvelopeV1;
  archiveReady: boolean;
  authRequired: boolean;
  remoteError: string | null;
  catalog: PublicDiscoveryCatalog;
  discoveryState: DiscoveryInteractionState;
  discoveryReady: boolean;
  discoveryLoading: boolean;
  discoveryError: string | null;
  onboarding: OnboardingStatus | null;
  onboardingSaving: boolean;
  onboardingError: string | null;
  online: boolean;
  ensureDiscoveryData: (force?: boolean) => Promise<void>;
  saveArchive: (next: ArchiveEnvelopeV1, message?: ToastMessage) => boolean;
  saveDiscovery: (next: DiscoveryInteractionState, message?: ToastMessage) => boolean;
  completeOnboarding: (nickname: string) => Promise<boolean>;
};

const MuchiDataContext = createContext<MuchiDataContextValue | null>(null);

function isAppRoute(pathname: string) {
  return !pathname.startsWith("/auth/");
}

export function MuchiDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [archive, setArchive] = useState<ArchiveEnvelopeV1>(() => createEmptyArchive());
  const [archiveReady, setArchiveReady] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [catalog, setCatalog] = useState(() => createEmptyPublicDiscoveryCatalog());
  const [discoveryState, setDiscoveryState] = useState<DiscoveryInteractionState>(() => createDiscoveryInteractionState());
  const [discoveryReady, setDiscoveryReady] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const archiveRevisionRef = useRef(0);
  const discoveryRevisionRef = useRef(0);
  const confirmedArchiveRef = useRef<ArchiveEnvelopeV1 | null>(null);
  const pendingArchiveRef = useRef<PendingArchive | null>(null);
  const pendingDiscoveryRef = useRef<PendingDiscovery | null>(null);
  const writingArchiveRef = useRef(false);
  const writingDiscoveryRef = useRef(false);
  const discoveryPromiseRef = useRef<Promise<void> | null>(null);
  const archiveUpdatedAtRef = useRef(0);
  const discoveryUpdatedAtRef = useRef(0);
  const publishNotice = useCallback((message: ToastMessage) => {
    window.dispatchEvent(new CustomEvent<ToastMessage>("muchi:save-notice", { detail: message }));
  }, []);

  const refreshArchive = useCallback(async () => {
    const value = await fetchArchive();
    archiveRevisionRef.current = value.revision;
    confirmedArchiveRef.current = value.archive;
    archiveUpdatedAtRef.current = Date.now();
    setArchive(value.archive);
  }, []);

  useEffect(() => {
    if (!isAppRoute(pathname) || archiveReady || authRequired || remoteError) return;
    let cancelled = false;
    const bootstrap = async () => {
      const { data } = await createSupabaseBrowserClient().auth.getSession() as { data: { session: unknown } };
      if (!data.session) {
        if (!cancelled) setAuthRequired(true);
        return;
      }
      const [archiveResult, onboardingResult]: [VersionedArchive, OnboardingStatus] = await Promise.all([
        fetchArchive(),
        fetchOnboardingStatus(),
      ]);
      if (cancelled) return;
      archiveRevisionRef.current = archiveResult.revision;
      confirmedArchiveRef.current = archiveResult.archive;
      archiveUpdatedAtRef.current = Date.now();
      setArchive(archiveResult.archive);
      setOnboarding(onboardingResult);
      setOnline(window.navigator.onLine);
      setArchiveReady(true);
    };
    void bootstrap().catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ArchiveApiError && cause.code === "unauthenticated") setAuthRequired(true);
      else setRemoteError(cause instanceof Error ? cause.message : "음악 기록을 불러오지 못했어요.");
    });
    return () => { cancelled = true; };
  }, [archiveReady, authRequired, pathname, remoteError]);

  useEffect(() => {
    const updateOnline = () => setOnline(window.navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    const refreshIfStale = () => {
      if (
        document.visibilityState === "visible"
        && archiveReady
        && !writingArchiveRef.current
        && Date.now() - archiveUpdatedAtRef.current > STALE_AFTER_MS
      ) void refreshArchive().catch(() => undefined);
    };
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [archiveReady, refreshArchive]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const localDevelopment = window.location.hostname === "localhost"
      || window.location.hostname === "127.0.0.1";
    if (localDevelopment) {
      void navigator.serviceWorker.getRegistrations()
        .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
        .catch(() => undefined);
      return;
    }
    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    let focusTimer: number | null = null;

    const updateKeyboardInset = () => {
      const inset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      document.documentElement.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    };
    const keepFocusedFieldVisible = (event: FocusEvent) => {
      if (!(event.target instanceof HTMLElement) || !event.target.matches("input, textarea, select")) return;
      const field = event.target;
      if (!field.closest(".dialog, .tag-picker-panel")) return;
      if (focusTimer !== null) window.clearTimeout(focusTimer);
      focusTimer = window.setTimeout(() => {
        field.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 180);
    };

    updateKeyboardInset();
    viewport?.addEventListener("resize", updateKeyboardInset);
    viewport?.addEventListener("scroll", updateKeyboardInset);
    window.addEventListener("resize", updateKeyboardInset);
    document.addEventListener("focusin", keepFocusedFieldVisible);
    return () => {
      if (focusTimer !== null) window.clearTimeout(focusTimer);
      viewport?.removeEventListener("resize", updateKeyboardInset);
      viewport?.removeEventListener("scroll", updateKeyboardInset);
      window.removeEventListener("resize", updateKeyboardInset);
      document.removeEventListener("focusin", keepFocusedFieldVisible);
      document.documentElement.style.removeProperty("--keyboard-inset");
    };
  }, []);

  const ensureDiscoveryData = useCallback((force = false): Promise<void> => {
    if (discoveryPromiseRef.current) return discoveryPromiseRef.current;
    if (!force && discoveryReady && Date.now() - discoveryUpdatedAtRef.current < STALE_AFTER_MS) return Promise.resolve();
    const initialLoad = !discoveryReady;
    if (initialLoad) setDiscoveryLoading(true);
    setDiscoveryError(null);
    const request = Promise.all([fetchPublicDiscoveryCatalog(), fetchDiscoveryState()])
      .then(([catalogResult, stateResult]: [PublicDiscoveryCatalog, VersionedDiscoveryState]) => {
        discoveryRevisionRef.current = stateResult.revision;
        discoveryUpdatedAtRef.current = Date.now();
        setCatalog(catalogResult);
        setDiscoveryState(stateResult.state);
        setDiscoveryReady(true);
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "탐색 정보를 불러오지 못했어요.";
        setDiscoveryError(message);
        if (!initialLoad) publishNotice(message);
        throw cause;
      })
      .finally(() => {
        discoveryPromiseRef.current = null;
        setDiscoveryLoading(false);
      });
    discoveryPromiseRef.current = request;
    return request;
  }, [discoveryReady, publishNotice]);

  const saveArchive = useCallback((next: ArchiveEnvelopeV1, message?: ToastMessage) => {
    if (!archiveReady || authRequired) return false;
    const syncPublicProjection = publicProjectionSignature(archive) !== publicProjectionSignature(next);
    pendingArchiveRef.current = { archive: next, message, syncPublicProjection };
    setArchive(next);
    if (writingArchiveRef.current) return true;

    const drain = async () => {
      writingArchiveRef.current = true;
      while (pendingArchiveRef.current) {
        const pending = pendingArchiveRef.current;
        pendingArchiveRef.current = null;
        try {
          const result = await saveArchiveRemote(pending.archive, archiveRevisionRef.current, pending.syncPublicProjection);
          archiveRevisionRef.current = result.revision;
          confirmedArchiveRef.current = result.archive;
          archiveUpdatedAtRef.current = Date.now();
          if (!pendingArchiveRef.current) setArchive(result.archive);
          if (pending.message) publishNotice(pending.message);
        } catch (cause) {
          if (cause instanceof ArchiveApiError && cause.code === "conflict" && cause.latest) {
            archiveRevisionRef.current = cause.latest.revision;
            confirmedArchiveRef.current = cause.latest.archive;
            if (pendingArchiveRef.current) {
              publishNotice("최신 기록 위에 변경사항을 다시 저장할게요.");
            } else {
              setArchive(cause.latest.archive);
              publishNotice("다른 기기에서 변경됐어요. 최신 기록을 불러왔습니다.");
            }
          } else if (cause instanceof ArchiveApiError && cause.code === "unauthenticated") {
            pendingArchiveRef.current = null;
            setAuthRequired(true);
          } else {
            pendingArchiveRef.current ??= pending;
            publishNotice(cause instanceof Error
              ? `${cause.message} 변경사항을 보존하고 다시 저장할게요.`
              : "음악 기록 변경사항을 보존하고 다시 저장할게요.");
            writingArchiveRef.current = false;
            window.setTimeout(() => { if (!writingArchiveRef.current && pendingArchiveRef.current) void drain(); }, 3_000);
            return;
          }
        }
      }
      writingArchiveRef.current = false;
    };
    void drain();
    return true;
  }, [archive, archiveReady, authRequired, publishNotice]);

  const saveDiscovery = useCallback((next: DiscoveryInteractionState, message?: ToastMessage) => {
    if (!discoveryReady) return false;
    pendingDiscoveryRef.current = { state: next, message };
    setDiscoveryState(next);
    if (writingDiscoveryRef.current) return true;
    const drain = async () => {
      writingDiscoveryRef.current = true;
      while (pendingDiscoveryRef.current) {
        const pending = pendingDiscoveryRef.current;
        pendingDiscoveryRef.current = null;
        try {
          const result = await saveDiscoveryState(pending.state, discoveryRevisionRef.current);
          discoveryRevisionRef.current = result.revision;
          if (!pendingDiscoveryRef.current) setDiscoveryState(result.state);
          if (pending.message) publishNotice(pending.message);
        } catch (cause) {
          pendingDiscoveryRef.current = null;
          if (cause instanceof ArchiveApiError && cause.code === "conflict") {
            void fetchDiscoveryState().then((latest) => {
              discoveryRevisionRef.current = latest.revision;
              setDiscoveryState(latest.state);
            }).catch(() => undefined);
          }
          publishNotice(cause instanceof Error ? cause.message : "탐색 상태를 저장하지 못했어요.");
        }
      }
      writingDiscoveryRef.current = false;
    };
    void drain();
    return true;
  }, [discoveryReady, publishNotice]);

  const completeOnboarding = useCallback(async (nickname: string) => {
    setOnboardingSaving(true);
    setOnboardingError(null);
    try {
      setOnboarding(await saveOnboardingComplete(nickname));
      return true;
    } catch (cause) {
      if (cause instanceof OnboardingApiError && cause.code === "unauthenticated") setAuthRequired(true);
      else setOnboardingError(cause instanceof Error ? cause.message : "온보딩을 완료하지 못했어요.");
      return false;
    } finally {
      setOnboardingSaving(false);
    }
  }, []);

  const value = useMemo<MuchiDataContextValue>(() => ({
    archive,
    archiveReady,
    authRequired,
    remoteError,
    catalog,
    discoveryState,
    discoveryReady,
    discoveryLoading,
    discoveryError,
    onboarding,
    onboardingSaving,
    onboardingError,
    online,
    ensureDiscoveryData,
    saveArchive,
    saveDiscovery,
    completeOnboarding,
  }), [
    archive, archiveReady, authRequired, remoteError, catalog, discoveryState, discoveryReady,
    discoveryLoading, discoveryError, onboarding, onboardingSaving, onboardingError, online,
    ensureDiscoveryData, saveArchive, saveDiscovery, completeOnboarding,
  ]);

  return <MuchiDataContext.Provider value={value}>{children}</MuchiDataContext.Provider>;
}

export function useMuchiData() {
  const value = useContext(MuchiDataContext);
  if (!value) throw new Error("MuchiDataProvider 내부에서만 사용할 수 있어요.");
  return value;
}
