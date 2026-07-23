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
import { applyArchivePatch, createArchivePatch, type ArchivePatchOperation } from "@/lib/archive-patch";
import {
  createDiscoveryInteractionState,
  createEmptyPublicDiscoveryCatalog,
  type DiscoveryInteractionState,
  type PublicDiscoveryCatalog,
  withPublicChapterLike,
  withPublicProfileFollow,
} from "@/lib/public-discovery";
import { ArchiveApiError, fetchArchive, saveArchivePatch, type VersionedArchive } from "@/lib/client/archive-api";
import { fetchDiscoveryState, saveDiscoveryState, type VersionedDiscoveryState } from "@/lib/client/discovery-state-api";
import { fetchPublicDiscoveryCatalog, type PublicDiscoveryTarget } from "@/lib/client/public-discovery-api";
import {
  fetchOnboardingStatus,
  OnboardingApiError,
  saveOnboardingComplete,
  type OnboardingStatus,
} from "@/lib/client/onboarding-api";
import { updateProfile as updateProfileRemote, type ProfileUpdate } from "@/lib/client/profile-api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ToastMessage, ToastNotice } from "./editorial-types";

const STALE_AFTER_MS = 60_000;
const ARCHIVE_SAVE_DEBOUNCE_MS = 250;
const MAX_ARCHIVE_OPERATIONS_PER_REQUEST = 250;

type PendingArchive = { operations: ArchivePatchOperation[]; syncPublicProjection: boolean };
type PendingDiscovery = { state: DiscoveryInteractionState };
type CachedDiscoveryCatalog = { catalog: PublicDiscoveryCatalog; updatedAt: number };

type MuchiDataContextValue = {
  archive: ArchiveEnvelopeV1;
  archiveReady: boolean;
  authenticated: boolean;
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
  ensureDiscoveryData: (force?: boolean, target?: PublicDiscoveryTarget) => Promise<void>;
  updatePublicChapterLike: (chapterId: string, liked: boolean) => void;
  updatePublicProfileFollow: (profileId: string, followed: boolean) => void;
  saveArchive: (next: ArchiveEnvelopeV1, message?: ToastMessage) => boolean;
  saveDiscovery: (next: DiscoveryInteractionState, message?: ToastMessage) => boolean;
  completeOnboarding: (nickname: string) => Promise<boolean>;
  updateProfile: (update: ProfileUpdate) => Promise<boolean>;
};

const MuchiDataContext = createContext<MuchiDataContextValue | null>(null);

function isAppRoute(pathname: string) {
  return !pathname.startsWith("/auth/");
}

function isPublicDiscoveryRoute(pathname: string) {
  return pathname === "/discover" || pathname.startsWith("/discover/");
}

function optimisticNotice(message: ToastMessage): ToastNotice {
  return typeof message === "string"
    ? { text: message, kind: "success", replacePersistent: true }
    : { ...message, kind: message.kind ?? "success", replacePersistent: true };
}

export function MuchiDataProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [archive, setArchive] = useState<ArchiveEnvelopeV1>(() => createEmptyArchive());
  const [archiveReady, setArchiveReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
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
  const localArchiveRef = useRef<ArchiveEnvelopeV1>(archive);
  const pendingArchiveRef = useRef<PendingArchive[]>([]);
  const pendingDiscoveryRef = useRef<PendingDiscovery | null>(null);
  const writingArchiveRef = useRef(false);
  const writingDiscoveryRef = useRef(false);
  const discoveryCacheRef = useRef(new Map<string, CachedDiscoveryCatalog>());
  const discoveryPromisesRef = useRef(new Map<string, Promise<void>>());
  const activeDiscoveryKeyRef = useRef("");
  const discoveryStateRequestIdRef = useRef(0);
  const archiveUpdatedAtRef = useRef(0);
  const discoveryStateUpdatedAtRef = useRef(0);
  const archiveRetryTimerRef = useRef<number | null>(null);
  const archiveFlushTimerRef = useRef<number | null>(null);
  const drainArchiveRef = useRef<() => void>(() => undefined);
  const publishNotice = useCallback((message: ToastMessage) => {
    window.dispatchEvent(new CustomEvent<ToastMessage>("muchi:save-notice", { detail: message }));
  }, []);

  const setLocalArchive = useCallback((value: ArchiveEnvelopeV1) => {
    localArchiveRef.current = value;
    setArchive(value);
  }, []);

  const refreshArchive = useCallback(async () => {
    if (pendingArchiveRef.current.length) return;
    const value = await fetchArchive();
    archiveRevisionRef.current = value.revision;
    archiveUpdatedAtRef.current = Date.now();
    setLocalArchive(value.archive);
  }, [setLocalArchive]);

  useEffect(() => {
    if (!isAppRoute(pathname)) return;
    const publicDiscoveryRoute = isPublicDiscoveryRoute(pathname);
    if (archiveReady) return;
    let cancelled = false;
    const bootstrap = async () => {
      const { data } = await createSupabaseBrowserClient().auth.getSession() as { data: { session: unknown } };
      if (!data.session) {
        if (!cancelled) {
          setAuthenticated(false);
          setAuthRequired(!publicDiscoveryRoute);
          setOnline(window.navigator.onLine);
          setArchiveReady(true);
        }
        return;
      }
      const [archiveResult, onboardingResult]: [VersionedArchive, OnboardingStatus] = await Promise.all([
        fetchArchive(),
        fetchOnboardingStatus(),
      ]);
      if (cancelled) return;
      archiveRevisionRef.current = archiveResult.revision;
      archiveUpdatedAtRef.current = Date.now();
      setLocalArchive(archiveResult.archive);
      setOnboarding(onboardingResult);
      setOnline(window.navigator.onLine);
      setAuthenticated(true);
      setArchiveReady(true);
    };
    void bootstrap().catch((cause: unknown) => {
      if (cancelled) return;
      if (cause instanceof ArchiveApiError && cause.code === "unauthenticated") {
        setAuthenticated(false);
        setAuthRequired(!publicDiscoveryRoute);
        setArchiveReady(true);
      }
      else setRemoteError(cause instanceof Error ? cause.message : "음악 기록을 불러오지 못했어요.");
    });
    return () => { cancelled = true; };
  }, [archiveReady, authenticated, pathname, setLocalArchive]);

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
    void navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => registration.update())
      .catch(() => undefined);
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

  const ensureDiscoveryData = useCallback((force = false, target: PublicDiscoveryTarget = {}): Promise<void> => {
    const targetKey = target.chapterId
      ? `chapter:${target.chapterId}`
      : target.profileId
        ? `profile:${target.profileId}`
        : "feed";
    activeDiscoveryKeyRef.current = targetKey;
    const now = Date.now();
    const cached = discoveryCacheRef.current.get(targetKey);
    if (!force && cached && now - cached.updatedAt < STALE_AFTER_MS) {
      setCatalog(cached.catalog);
      setDiscoveryReady(true);
      setDiscoveryLoading(false);
      setDiscoveryError(null);
      return Promise.resolve();
    }

    const existingRequest = discoveryPromisesRef.current.get(targetKey);
    if (existingRequest) return existingRequest;

    const hasCachedCatalog = Boolean(cached);
    if (cached) {
      setCatalog(cached.catalog);
      setDiscoveryReady(true);
    } else {
      setCatalog(createEmptyPublicDiscoveryCatalog());
      setDiscoveryReady(false);
      setDiscoveryLoading(true);
    }
    setDiscoveryError(null);
    const refreshDiscoveryState = authenticated
      && (force || now - discoveryStateUpdatedAtRef.current >= STALE_AFTER_MS);
    const discoveryStateRequestId = refreshDiscoveryState ? discoveryStateRequestIdRef.current + 1 : 0;
    if (refreshDiscoveryState) discoveryStateRequestIdRef.current = discoveryStateRequestId;
    const discoveryStateRequest = refreshDiscoveryState
      ? fetchDiscoveryState()
      : Promise.resolve<VersionedDiscoveryState | null>(null);
    const request = Promise.all([fetchPublicDiscoveryCatalog(target), discoveryStateRequest])
      .then(([catalogResult, stateResult]: [PublicDiscoveryCatalog, VersionedDiscoveryState | null]) => {
        discoveryCacheRef.current.set(targetKey, { catalog: catalogResult, updatedAt: Date.now() });
        if (stateResult && discoveryStateRequestId === discoveryStateRequestIdRef.current) {
          discoveryRevisionRef.current = stateResult.revision;
          discoveryStateUpdatedAtRef.current = Date.now();
          setDiscoveryState(stateResult.state);
        }
        if (activeDiscoveryKeyRef.current !== targetKey) return;
        setCatalog(catalogResult);
        setDiscoveryReady(true);
      })
      .catch((cause: unknown) => {
        const message = cause instanceof Error ? cause.message : "탐색 정보를 불러오지 못했어요.";
        if (activeDiscoveryKeyRef.current === targetKey) {
          if (hasCachedCatalog) publishNotice(message);
          else setDiscoveryError(message);
        }
        throw cause;
      })
      .finally(() => {
        discoveryPromisesRef.current.delete(targetKey);
        if (activeDiscoveryKeyRef.current === targetKey) setDiscoveryLoading(false);
      });
    discoveryPromisesRef.current.set(targetKey, request);
    return request;
  }, [authenticated, publishNotice]);

  const updatePublicChapterLike = useCallback((chapterId: string, liked: boolean) => {
    setCatalog((current) => {
      const next = withPublicChapterLike(current, chapterId, liked);
      const activeKey = activeDiscoveryKeyRef.current;
      if (activeKey) discoveryCacheRef.current.set(activeKey, { catalog: next, updatedAt: Date.now() });
      return next;
    });
  }, []);

  const updatePublicProfileFollow = useCallback((profileId: string, followed: boolean) => {
    setCatalog((current) => {
      const next = withPublicProfileFollow(current, profileId, followed);
      const activeKey = activeDiscoveryKeyRef.current;
      if (activeKey) discoveryCacheRef.current.set(activeKey, { catalog: next, updatedAt: Date.now() });
      return next;
    });
  }, []);

  const drainArchive = useCallback(async () => {
    if (writingArchiveRef.current) return;
    writingArchiveRef.current = true;
    while (pendingArchiveRef.current.length) {
      const batch: PendingArchive[] = [];
      let operationCount = 0;
      for (const pending of pendingArchiveRef.current) {
        if (batch.length && operationCount + pending.operations.length > MAX_ARCHIVE_OPERATIONS_PER_REQUEST) break;
        batch.push(pending);
        operationCount += pending.operations.length;
      }
      if (!batch.length) break;
      const operations = batch.flatMap((pending) => pending.operations);
      const syncPublicProjection = batch.some((pending) => pending.syncPublicProjection);
      try {
        const result = await saveArchivePatch(
          operations,
          archiveRevisionRef.current,
          syncPublicProjection,
        );
        pendingArchiveRef.current.splice(0, batch.length);
        archiveRevisionRef.current = result.revision;
        archiveUpdatedAtRef.current = Date.now();
      } catch (cause) {
        if (cause instanceof ArchiveApiError && cause.code === "conflict" && cause.latest) {
          archiveRevisionRef.current = cause.latest.revision;
          try {
            const rebased = pendingArchiveRef.current.reduce(
              (current, entry) => applyArchivePatch(current, entry.operations),
              cause.latest.archive,
            );
            setLocalArchive(rebased);
            publishNotice({ text: "다른 기기 변경 위에 내 변경사항을 다시 적용했어요.", kind: "info", replacePersistent: true });
            continue;
          } catch {
            pendingArchiveRef.current = [];
            setLocalArchive(cause.latest.archive);
            publishNotice({ text: "변경사항을 자동으로 합치지 못했어요. 최신 기록을 불러왔습니다.", kind: "error", persistent: true });
            break;
          }
        }
        if (cause instanceof ArchiveApiError && cause.code === "unauthenticated") {
          pendingArchiveRef.current = [];
          setAuthRequired(true);
          break;
        }
        publishNotice({
          text: cause instanceof Error
            ? `${cause.message} 연결되면 다시 저장할게요.`
            : "음악 기록 변경사항을 연결되면 다시 저장할게요.",
          kind: "error",
          persistent: true,
          action: {
            label: "다시 시도",
            onActivate: () => window.setTimeout(() => drainArchiveRef.current(), 0),
          },
        });
        if (archiveRetryTimerRef.current !== null) window.clearTimeout(archiveRetryTimerRef.current);
        archiveRetryTimerRef.current = window.setTimeout(() => {
          archiveRetryTimerRef.current = null;
          drainArchiveRef.current();
        }, 3_000);
        break;
      }
    }
    writingArchiveRef.current = false;
  }, [publishNotice, setLocalArchive]);

  useEffect(() => {
    drainArchiveRef.current = () => { void drainArchive(); };
  }, [drainArchive]);

  const scheduleArchiveDrain = useCallback((immediate = false) => {
    if (archiveFlushTimerRef.current !== null) {
      window.clearTimeout(archiveFlushTimerRef.current);
      archiveFlushTimerRef.current = null;
    }
    if (immediate) {
      drainArchiveRef.current();
      return;
    }
    archiveFlushTimerRef.current = window.setTimeout(() => {
      archiveFlushTimerRef.current = null;
      drainArchiveRef.current();
    }, ARCHIVE_SAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const retryWhenOnline = () => {
      if (window.navigator.onLine && pendingArchiveRef.current.length) scheduleArchiveDrain(true);
    };
    const flushBeforeUnload = () => {
      if (pendingArchiveRef.current.length) scheduleArchiveDrain(true);
    };
    window.addEventListener("online", retryWhenOnline);
    window.addEventListener("pagehide", flushBeforeUnload);
    return () => {
      window.removeEventListener("online", retryWhenOnline);
      window.removeEventListener("pagehide", flushBeforeUnload);
      if (archiveRetryTimerRef.current !== null) window.clearTimeout(archiveRetryTimerRef.current);
      if (archiveFlushTimerRef.current !== null) window.clearTimeout(archiveFlushTimerRef.current);
    };
  }, [scheduleArchiveDrain]);

  const saveArchive = useCallback((next: ArchiveEnvelopeV1, message?: ToastMessage) => {
    if (!archiveReady || authRequired) return false;
    const operations = createArchivePatch(archive, next);
    if (!operations.length) return true;
    let rebased: ArchiveEnvelopeV1;
    try {
      rebased = applyArchivePatch(localArchiveRef.current, operations);
    } catch {
      rebased = next;
    }
    const syncPublicProjection = publicProjectionSignature(localArchiveRef.current) !== publicProjectionSignature(rebased);
    pendingArchiveRef.current.push({ operations, syncPublicProjection });
    setLocalArchive(rebased);
    if (message) publishNotice(optimisticNotice(message));
    scheduleArchiveDrain();
    return true;
  }, [archive, archiveReady, authRequired, publishNotice, scheduleArchiveDrain, setLocalArchive]);

  const saveDiscovery = useCallback((next: DiscoveryInteractionState, message?: ToastMessage) => {
    if (!discoveryReady) return false;
    pendingDiscoveryRef.current = { state: next };
    setDiscoveryState(next);
    if (message) publishNotice(optimisticNotice(message));
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
        } catch (cause) {
          pendingDiscoveryRef.current = null;
          if (cause instanceof ArchiveApiError && cause.code === "conflict") {
            void fetchDiscoveryState().then((latest) => {
              discoveryRevisionRef.current = latest.revision;
              setDiscoveryState(latest.state);
            }).catch(() => undefined);
          }
          publishNotice({ text: cause instanceof Error ? cause.message : "탐색 상태를 저장하지 못했어요.", kind: "error" });
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

  const updateProfile = useCallback(async (update: ProfileUpdate) => {
    setOnboardingSaving(true);
    setOnboardingError(null);
    try {
      setOnboarding(await updateProfileRemote(update));
      return true;
    } catch (cause) {
      setOnboardingError(cause instanceof Error ? cause.message : "프로필을 저장하지 못했어요.");
      return false;
    } finally {
      setOnboardingSaving(false);
    }
  }, []);

  const value = useMemo<MuchiDataContextValue>(() => ({
    archive,
    archiveReady,
    authenticated,
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
    updatePublicChapterLike,
    updatePublicProfileFollow,
    saveArchive,
    saveDiscovery,
    completeOnboarding,
    updateProfile,
  }), [
    archive, archiveReady, authenticated, authRequired, remoteError, catalog, discoveryState, discoveryReady,
    discoveryLoading, discoveryError, onboarding, onboardingSaving, onboardingError, online,
    ensureDiscoveryData, updatePublicChapterLike, updatePublicProfileFollow, saveArchive, saveDiscovery, completeOnboarding, updateProfile,
  ]);

  return <MuchiDataContext.Provider value={value}>{children}</MuchiDataContext.Provider>;
}

export function useMuchiData() {
  const value = useContext(MuchiDataContext);
  if (!value) throw new Error("MuchiDataProvider 내부에서만 사용할 수 있어요.");
  return value;
}
