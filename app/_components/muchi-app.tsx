"use client";

import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createEmptyArchive,
  type ArchiveEnvelopeV1,
  type TrackId,
  type TrackReference,
} from "@/lib/archive";
import {
  createDiscoveryInteractionState,
  createEmptyPublicDiscoveryCatalog,
  getPublicChapter,
  markActivityRead,
  toPlaylistSource,
  toggleFollow,
  toggleLike,
  type DiscoveryInteractionState,
  type PublicDiscoveryCatalog,
} from "@/lib/public-discovery";
import { ArchiveApiError, fetchArchive, saveArchive, type VersionedArchive } from "@/lib/client/archive-api";
import { fetchDiscoveryState, saveDiscoveryState, type VersionedDiscoveryState } from "@/lib/client/discovery-state-api";
import { fetchPublicDiscoveryCatalog, PublicDiscoveryApiError } from "@/lib/client/public-discovery-api";
import {
  fetchOnboardingStatus,
  OnboardingApiError,
  saveOnboardingComplete,
  type OnboardingStatus,
} from "@/lib/client/onboarding-api";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  EditorialShell,
  type ContextBackAction,
} from "./editorial-shell";
import {
  type PreviewControls,
  type PreviewState,
} from "./editorial-media";
import {
  MotionProvider,
  RouteStage,
  useMotionRouter,
} from "./editorial-motion";
import {
  Capture,
  Inbox,
} from "./editorial-views-primary";
import { PersonalSpace, VisitorSpace } from "./editorial-personal-space";
import {
  ChapterDetail,
  Chapters,
  Memory,
} from "./editorial-views-chapters";
import {
  Recap,
  Search,
  Settings,
} from "./editorial-views-discovery";
import { TagManager } from "./editorial-views-tags";
import {
  PlaylistBuilder,
  type PlaylistStep,
} from "./editorial-views-playlist";
import {
  Discover,
  PublicChapterDetail,
  PublicProfileDetail,
} from "./editorial-views-public-discovery";
import type { AppView, ToastMessage } from "./editorial-types";
import { AuthGate } from "./auth-gate";
import { OnboardingScreen } from "./onboarding-screen";

export type { AppView } from "./editorial-types";

const LOADING_ITEMS = [0, 1, 2];

function LoadingStatus({ children, className }: { children: React.ReactNode; className: string }) {
  return (
    <div className={`${className} archive-skeleton`} role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">음악 기록을 불러오는 중입니다.</span>
      <div className="archive-skeleton-content" aria-hidden="true">{children}</div>
    </div>
  );
}

function HomeLoadingSkeleton() {
  return (
    <LoadingStatus className="page-content personal-space-view music-room-frame home-loading-skeleton">
      <section className="personal-space-intro">
        <div>
          <span className="archive-skeleton-shape archive-skeleton-eyebrow" />
          <span className="archive-skeleton-shape archive-skeleton-title" />
        </div>
        <span className="archive-skeleton-shape archive-skeleton-action" />
      </section>
      <section className="music-room-owner">
        <span className="archive-skeleton-shape archive-skeleton-avatar" />
        <span className="archive-skeleton-shape archive-skeleton-owner" />
      </section>
      <div className="personal-space-shelf archive-skeleton-shelf">
        {LOADING_ITEMS.map((item) => (
          <div className="personal-space-chapter" key={item}>
            <span className="personal-space-chapter-art archive-skeleton-shape" />
            <span className="personal-space-chapter-copy">
              <span className="archive-skeleton-shape archive-skeleton-index" />
              <span className="archive-skeleton-shape archive-skeleton-name" />
              <span className="archive-skeleton-shape archive-skeleton-count" />
            </span>
          </div>
        ))}
      </div>
    </LoadingStatus>
  );
}

function DiscoverLoadingSkeleton() {
  return (
    <LoadingStatus className="page-content discover-view discover-loading-skeleton">
      <header className="archive-skeleton-page-header">
        <div>
          <span className="archive-skeleton-shape archive-skeleton-eyebrow" />
          <span className="archive-skeleton-shape archive-skeleton-heading" />
          <span className="archive-skeleton-shape archive-skeleton-description" />
        </div>
        <span className="archive-skeleton-shape archive-skeleton-round-action" />
      </header>
      <section className="public-chapter-feed archive-skeleton-feed">
        {LOADING_ITEMS.map((item) => (
          <div className="public-chapter-line archive-skeleton-feed-line" key={item}>
            <span className="archive-skeleton-shape archive-skeleton-index" />
            <span className="archive-skeleton-shape archive-skeleton-feed-art" />
            <span className="archive-skeleton-feed-copy">
              <span className="archive-skeleton-shape archive-skeleton-profile" />
              <span className="archive-skeleton-shape archive-skeleton-name" />
              <span className="archive-skeleton-shape archive-skeleton-description" />
              <span className="archive-skeleton-shape archive-skeleton-count" />
            </span>
          </div>
        ))}
      </section>
    </LoadingStatus>
  );
}

function CaptureLoadingSkeleton() {
  return (
    <LoadingStatus className="page-content capture-view capture-loading-skeleton">
      <header className="capture-search-header">
        <span className="archive-skeleton-shape archive-skeleton-display-title" />
      </header>
      <section className="capture-search-compact">
        <span className="archive-skeleton-shape archive-skeleton-search-field" />
      </section>
      <span className="archive-skeleton-shape archive-skeleton-link-action" />
      <section className="capture-results archive-skeleton-track-list">
        {LOADING_ITEMS.map((item) => (
          <div className="archive-skeleton-track-row" key={item}>
            <span className="archive-skeleton-shape archive-skeleton-track-art" />
            <span className="archive-skeleton-track-copy">
              <span className="archive-skeleton-shape archive-skeleton-name" />
              <span className="archive-skeleton-shape archive-skeleton-count" />
            </span>
            <span className="archive-skeleton-shape archive-skeleton-round-action" />
          </div>
        ))}
      </section>
    </LoadingStatus>
  );
}

function ChaptersLoadingSkeleton() {
  return (
    <LoadingStatus className="page-content chapters-view chapter-library-view chapters-loading-skeleton">
      <nav className="chapter-library-tabs">
        <span className="archive-skeleton-shape archive-skeleton-tab" />
        <span className="archive-skeleton-shape archive-skeleton-tab" />
      </nav>
      <div className="chapter-library-toolbar">
        <span className="archive-skeleton-shape archive-skeleton-section-title" />
        <span className="archive-skeleton-shape archive-skeleton-action" />
      </div>
      <section className="chapter-library-grid archive-skeleton-chapter-grid">
        {LOADING_ITEMS.map((item) => (
          <div className="chapter-library-card" key={item}>
            <span className="chapter-library-cover archive-skeleton-shape" />
            <span className="chapter-library-copy">
              <span className="archive-skeleton-shape archive-skeleton-name" />
              <span className="archive-skeleton-shape archive-skeleton-count" />
            </span>
          </div>
        ))}
      </section>
    </LoadingStatus>
  );
}

function SearchLoadingSkeleton() {
  return (
    <LoadingStatus className="page-content search-view search-loading-skeleton">
      <header className="search-workspace-header archive-find-header">
        <span className="archive-skeleton-shape archive-skeleton-heading" />
        <span className="archive-skeleton-shape archive-skeleton-search-field" />
        <div className="archive-skeleton-chip-row">
          {LOADING_ITEMS.map((item) => <span className="archive-skeleton-shape archive-skeleton-chip" key={item} />)}
        </div>
      </header>
      <section className="search-results-section archive-find-results archive-skeleton-track-list">
        <span className="archive-skeleton-shape archive-skeleton-section-title" />
        {LOADING_ITEMS.map((item) => (
          <div className="archive-skeleton-track-row" key={item}>
            <span className="archive-skeleton-shape archive-skeleton-track-art" />
            <span className="archive-skeleton-track-copy">
              <span className="archive-skeleton-shape archive-skeleton-name" />
              <span className="archive-skeleton-shape archive-skeleton-description" />
            </span>
          </div>
        ))}
      </section>
    </LoadingStatus>
  );
}

function LoadingSpinner({ label = "화면을 불러오는 중입니다." }: { label?: string }) {
  return (
    <div className="page-content loading-spinner-screen" role="status" aria-live="polite" aria-busy="true">
      <span className="search-loading-spinner" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

function ArchiveLoadingState({ view }: { view: AppView }) {
  switch (view) {
    case "home":
    case "space":
      return <HomeLoadingSkeleton />;
    case "discover":
      return <DiscoverLoadingSkeleton />;
    case "capture":
      return <CaptureLoadingSkeleton />;
    case "chapters":
      return <ChaptersLoadingSkeleton />;
    case "search":
      return <SearchLoadingSkeleton />;
    default:
      return <LoadingSpinner />;
  }
}

export function MusicWorldApp({ view }: { view: AppView }) {
  const searchParams = useSearchParams();
  const router = useMotionRouter();
  const [archive, setArchive] = useState<ArchiveEnvelopeV1>(() => createEmptyArchive());
  const [catalog, setCatalog] = useState(() => createEmptyPublicDiscoveryCatalog());
  const [discoveryState, setDiscoveryState] = useState<DiscoveryInteractionState>(() => createDiscoveryInteractionState());
  const [hydrated, setHydrated] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingStatus | null>(null);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const [onboardingError, setOnboardingError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [online, setOnline] = useState(true);
  const [systemReduce, setSystemReduce] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [playlistProgress, setPlaylistProgress] = useState<{
    routeKey: string;
    step: PlaylistStep;
  }>({ routeKey: "", step: 1 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const archiveRevisionRef = useRef(0);
  const discoveryRevisionRef = useRef(0);
  const savingArchiveRef = useRef(false);
  const savingDiscoveryRef = useRef(false);

  const inboxEntries = useMemo(
    () => Object.values(archive.data.inbox)
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
    [archive],
  );
  const reduceMotion = archive.data.preferences.motion === "reduce"
    || (archive.data.preferences.motion === "system" && systemReduce);
  const queryId = searchParams.get("id");
  const pendingTrackId = searchParams.get("trackId") as TrackId | null;
  const pendingRecordMode = searchParams.get("recordMode") === "quick" ? "quick" : "detail";
  const recordMode = searchParams.get("mode") === "quick" ? "quick" : "detail";
  const sharedUrl = searchParams.get("url") ?? searchParams.get("text");
  const searchQuery = searchParams.get("q") ?? "";
  const searchTagIds = searchParams.getAll("tag");
  const searchView = searchParams.get("view");
  const fromMemoryId = searchParams.get("fromMemory");
  const requestedChapter = queryId ? archive.data.cubes[queryId] : null;
  const requestedMemory = queryId ? archive.data.cubeTracks[queryId] : null;
  const requestedPublicChapter = getPublicChapter(catalog, queryId);
  const requestedMemoryChapter = requestedMemory ? archive.data.cubes[requestedMemory.cubeId] : null;
  const hiddenChapterDestination = "/tags";
  const hiddenChapterRoute = view === "chapter"
    && requestedChapter?.kind === "capture";
  const monthlyMemoryRoute = view === "memory"
    && requestedMemoryChapter?.kind === "monthly";
  const playlistRouteKey = `${searchParams.get("source") ?? "local"}:${queryId ?? ""}:${searchParams.get("service") ?? ""}`;
  const playlistStep = playlistProgress.routeKey === playlistRouteKey
    ? playlistProgress.step
    : 1;
  const publicPlaylistSource = searchParams.get("source") === "discover" && requestedPublicChapter
    ? { ...toPlaylistSource(requestedPublicChapter), returnHref: `/discover/chapter?id=${encodeURIComponent(requestedPublicChapter.id)}` }
    : null;

  function handlePlaylistStepChange(step: PlaylistStep) {
    setPlaylistProgress({ routeKey: playlistRouteKey, step });
  }

  const contextBackAction: ContextBackAction | null = (() => {
    switch (view) {
      case "inbox":
      case "recap":
      case "settings":
        return { label: "홈으로", href: "/" };
      case "space":
        return { label: "내 공간으로", href: "/" };
      case "chapter":
        return requestedChapter?.parentId
          ? {
            label: "상위 챕터로",
            href: `/chapter?id=${encodeURIComponent(requestedChapter.parentId)}`,
            sharedId: requestedChapter.parentId,
          }
          : { label: "챕터로", href: "/chapters" };
      case "memory":
        if (!requestedMemoryChapter) return { label: "챕터로", href: "/chapters" };
        if (requestedMemoryChapter.kind === "capture") return { label: "미분류 기록으로", href: "/tags" };
        return {
          label: "챕터로",
          href: `/chapter?id=${encodeURIComponent(requestedMemoryChapter.id)}`,
          sharedId: requestedMemoryChapter.id,
        };
      case "search":
        if (fromMemoryId && archive.data.cubeTracks[fromMemoryId]) {
          return {
            label: "곡 기록으로",
            href: `/memory?id=${encodeURIComponent(fromMemoryId)}`,
            sharedId: fromMemoryId,
          };
        }
        return null;
      case "playlist":
        if (typeof playlistStep === "number" && playlistStep > 1) {
          return {
            label: "이전 단계",
            onActivate: () => handlePlaylistStepChange(playlistStep === 3 ? 2 : 1),
          };
        }
        return {
          label: "챕터로",
          href: publicPlaylistSource?.returnHref
            ?? (queryId ? `/chapter?id=${encodeURIComponent(queryId)}` : "/chapters"),
          sharedId: queryId ?? undefined,
        };
      case "discoverChapter":
      case "discoverProfile":
        return { label: "탐색으로", href: "/discover" };
      case "tags":
        if (fromMemoryId && archive.data.cubeTracks[fromMemoryId]) {
          return {
            label: "곡 기록으로",
            href: `/memory?id=${encodeURIComponent(fromMemoryId)}`,
            sharedId: fromMemoryId,
          };
        }
        return { label: "설정으로", href: "/settings" };
      default:
        return null;
    }
  })();

  const notify = useCallback((message: ToastMessage) => {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setSystemReduce(media.matches);
    media.addEventListener("change", updateMotion);
    const updateOnline = () => setOnline(window.navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    if ("serviceWorker" in navigator) {
      const localDevelopment = window.location.hostname === "localhost"
        || window.location.hostname === "127.0.0.1";
      if (localDevelopment) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations.forEach((registration) => registration.unregister().catch(() => false));
        }).catch(() => undefined);
      } else {
        navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
      }
    }
    const hydrationTimer = window.setTimeout(() => {
      async function hydrateFromRemote() {
        const { data } = await createSupabaseBrowserClient().auth.getSession() as {
          data: { session: unknown };
        };
        if (!data.session) {
          setAuthRequired(true);
          return;
        }
        const [archiveResult, catalogResult, discoveryResult, onboardingResult]: [
          VersionedArchive,
          PublicDiscoveryCatalog,
          VersionedDiscoveryState,
          OnboardingStatus,
        ] = await Promise.all([fetchArchive(), fetchPublicDiscoveryCatalog(), fetchDiscoveryState(), fetchOnboardingStatus()]);
        archiveRevisionRef.current = archiveResult.revision;
        discoveryRevisionRef.current = discoveryResult.revision;
        setArchive(archiveResult.archive);
        setCatalog(catalogResult);
        setDiscoveryState(discoveryResult.state);
        setOnboarding(onboardingResult);
        setOnline(window.navigator.onLine);
        setSystemReduce(media.matches);
        setHydrated(true);
      }
      hydrateFromRemote().catch((cause: unknown) => {
          if (
            cause instanceof ArchiveApiError && cause.code === "unauthenticated"
            || cause instanceof PublicDiscoveryApiError && cause.code === "unauthenticated"
          ) setAuthRequired(true);
          else setRemoteError(cause instanceof Error ? cause.message : "음악 기록을 불러오지 못했어요.");
        });
    }, 0);
    return () => {
      window.clearTimeout(hydrationTimer);
      media.removeEventListener("change", updateMotion);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, [notify]);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
  }, [reduceMotion]);

  useEffect(() => {
    if (!hydrated || !hiddenChapterRoute || !requestedChapter) return;
    router.replace(hiddenChapterDestination);
  }, [hiddenChapterDestination, hiddenChapterRoute, hydrated, requestedChapter, router]);

  useEffect(() => {
    if (!hydrated || !monthlyMemoryRoute || !requestedMemoryChapter) return;
    router.replace(`/chapter?id=${encodeURIComponent(requestedMemoryChapter.id)}`);
  }, [hydrated, monthlyMemoryRoute, requestedMemoryChapter, router]);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  function commit(
    next: ArchiveEnvelopeV1,
    message?: ToastMessage,
    force = false,
  ): boolean {
    if (savingArchiveRef.current && !force) {
      notify("이전 저장을 처리하고 있어요. 잠시 후 다시 시도해 주세요.");
      return false;
    }
    savingArchiveRef.current = true;
    setArchive(next);
    void saveArchive(next, archiveRevisionRef.current)
      .then((result) => {
        archiveRevisionRef.current = result.revision;
        setArchive(result.archive);
        if (message) notify(message);
      })
      .catch((cause) => {
        if (cause instanceof ArchiveApiError && cause.code === "conflict" && cause.latest) {
          archiveRevisionRef.current = cause.latest.revision;
          setArchive(cause.latest.archive);
          notify("다른 기기에서 변경됐어요. 최신 기록을 불러왔습니다.");
        } else if (cause instanceof ArchiveApiError && cause.code === "unauthenticated") {
          setAuthRequired(true);
        } else notify(cause instanceof Error ? cause.message : "음악 기록을 저장하지 못했어요.");
      })
      .finally(() => { savingArchiveRef.current = false; });
    return true;
  }

  async function handleOnboardingComplete() {
    setOnboardingSaving(true);
    setOnboardingError(null);
    try {
      setOnboarding(await saveOnboardingComplete());
    } catch (cause) {
      if (cause instanceof OnboardingApiError && cause.code === "unauthenticated") {
        setHydrated(false);
        setAuthRequired(true);
      } else {
        setOnboardingError(cause instanceof Error ? cause.message : "온보딩을 완료하지 못했어요.");
      }
    } finally {
      setOnboardingSaving(false);
    }
  }

  function commitDiscovery(next: DiscoveryInteractionState, message: string) {
    if (savingDiscoveryRef.current) return;
    savingDiscoveryRef.current = true;
    setDiscoveryState(next);
    void saveDiscoveryState(next, discoveryRevisionRef.current)
      .then((result) => { discoveryRevisionRef.current = result.revision; setDiscoveryState(result.state); if (message) notify(message); })
      .catch((cause) => notify(cause instanceof Error ? cause.message : "탐색 상태를 저장하지 못했어요."))
      .finally(() => { savingDiscoveryRef.current = false; });
  }

  function handleToggleFollow(profileId: string) {
    const following = discoveryState.followedProfileIds.includes(profileId);
    commitDiscovery(toggleFollow(discoveryState, profileId), following ? "팔로우를 취소했어요." : "새 챕터 소식을 받아볼게요.");
  }

  function handleToggleLike(chapterId: string) {
    const liked = discoveryState.likedChapterIds.includes(chapterId);
    commitDiscovery(toggleLike(discoveryState, chapterId), liked ? "좋아요를 취소했어요." : "이 챕터를 좋아해요.");
  }

  function handleActivityRead(activityId: string) {
    commitDiscovery(markActivityRead(discoveryState, activityId), "");
  }

  const discoveryActions = {
    onToggleFollow: handleToggleFollow,
    onToggleLike: handleToggleLike,
    onActivityRead: handleActivityRead,
  };

  const preview: PreviewControls = {
    state: previewState,
    play(track: TrackReference) {
      if (!track.previewUrl) {
        notify("이 곡은 30초 미리듣기를 제공하지 않아요.");
        return;
      }
      if (audioRef.current && previewState?.track.id === track.id) {
        audioRef.current.play()
          .then(() => setPreviewState((current) => current
            ? { ...current, playing: true }
            : null))
          .catch(() => notify("미리듣기를 재생할 수 없어요. Apple Music 링크를 이용해 주세요."));
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(track.previewUrl);
      audio.preload = "none";
      audioRef.current = audio;
      setPreviewState({ track, playing: false, currentTime: 0 });
      audio.addEventListener("timeupdate", () => setPreviewState((current) => (
        current?.track.id === track.id
          ? { ...current, currentTime: Math.min(30, audio.currentTime) }
          : current
      )));
      audio.addEventListener("ended", () => setPreviewState((current) => (
        current?.track.id === track.id
          ? { ...current, playing: false, currentTime: 0 }
          : current
      )));
      audio.addEventListener("error", () => {
        setPreviewState((current) => current?.track.id === track.id
          ? { ...current, playing: false }
          : current);
        notify("미리듣기 링크가 만료됐거나 재생할 수 없어요. 기록은 그대로 유지됩니다.");
      });
      audio.play()
        .then(() => setPreviewState({ track, playing: true, currentTime: 0 }))
        .catch(() => notify("재생을 시작하지 못했어요. 다시 눌러 주세요."));
    },
    pause() {
      audioRef.current?.pause();
      setPreviewState((current) => current ? { ...current, playing: false } : null);
    },
    close() {
      audioRef.current?.pause();
      audioRef.current = null;
      setPreviewState(null);
    },
  };

  if (!hydrated) {
    if (authRequired) return <AuthGate />;
    if (remoteError) return <AuthGate message={remoteError} />;
    return (
      <MotionProvider>
        <EditorialShell
          view={view}
          inboxCount={0}
          preview={preview}
          toast={null}
          online={online}
          scrollReady={false}
          backAction={contextBackAction}
        >
          <ArchiveLoadingState view={view} />
        </EditorialShell>
      </MotionProvider>
    );
  }

  if (onboarding && !onboarding.completed) {
    return (
      <OnboardingScreen
        displayName={onboarding.displayName}
        loading={onboardingSaving}
        error={onboardingError}
        onComplete={() => { void handleOnboardingComplete(); }}
      />
    );
  }

  const content = (() => {
    switch (view) {
      case "capture":
        return <Capture archive={archive} commit={commit} notify={notify} online={online} router={router} sharedUrl={sharedUrl} />;
      case "space":
        return searchParams.get("view") === "visitor"
          ? <VisitorSpace archive={archive} chapterId={queryId} />
          : <PersonalSpace archive={archive} commit={commit} notify={notify} />;
      case "inbox":
        return <Inbox archive={archive} commit={commit} notify={notify} router={router} />;
      case "chapters":
        return <Chapters archive={archive} commit={commit} notify={notify} router={router} pendingTrackId={pendingTrackId} pendingRecordMode={pendingRecordMode} />;
      case "chapter":
        if (hiddenChapterRoute) {
          return <LoadingSpinner label="안전한 음악 목록으로 이동하는 중입니다." />;
        }
        return <ChapterDetail archive={archive} chapterId={queryId} commit={commit} notify={notify} router={router} />;
      case "memory":
        if (monthlyMemoryRoute) {
          return <LoadingSpinner label="월별 기록으로 이동하는 중입니다." />;
        }
        return <Memory archive={archive} cubeTrackId={queryId} commit={commit} notify={notify} recordMode={recordMode} openChapterMove={searchParams.get("move") === "chapter"} router={router} />;
      case "playlist":
        return (
          <PlaylistBuilder
            archive={archive}
            chapterId={queryId}
            playlistSource={publicPlaylistSource}
            initialServiceId={searchParams.get("service")}
            step={playlistStep}
            onStepChange={handlePlaylistStepChange}
          />
        );
      case "discover":
        return <Discover archive={archive} catalog={catalog} state={discoveryState} activityOnly={searchParams.get("activity") === "1"} actions={discoveryActions} />;
      case "discoverChapter":
        return <PublicChapterDetail catalog={catalog} state={discoveryState} chapterId={queryId} actions={discoveryActions} />;
      case "discoverProfile":
        return <PublicProfileDetail catalog={catalog} state={discoveryState} profileId={queryId} showAll={searchParams.get("view") === "all"} actions={discoveryActions} />;
      case "search":
        return (
          <Search
            archive={archive}
            initialQuery={searchQuery}
            requestedTagIds={searchTagIds}
            requestedView={searchView}
            fromMemoryId={fromMemoryId}
            router={router}
          />
        );
      case "recap":
        return <Recap archive={archive} />;
      case "settings":
        return <Settings archive={archive} commit={commit} notify={notify} />;
      case "tags":
        return <TagManager archive={archive} commit={commit} notify={notify} />;
      default:
        return <PersonalSpace archive={archive} commit={commit} notify={notify} />;
    }
  })();

  return (
    <MotionProvider>
      <EditorialShell
        view={view}
        inboxCount={inboxEntries.length}
        preview={preview}
        toast={toast}
        online={online}
        scrollReady={hydrated}
        backAction={contextBackAction}
      >
      {!online ? (
        <div
          className="notice notice-warning"
          style={{ margin: "18px clamp(18px, 4cqw, 24px) 0" }}
          role="status"
        >
          <div>오프라인이에요. 기존 기록은 볼 수 있지만 새 음악 검색과 미리듣기는 잠시 쉬어갑니다.</div>
        </div>
      ) : null}
      <RouteStage
        view={view}
        queryKey={view === "search" || view === "discover" ? searchParams.toString() : queryId}
      >
        {content}
      </RouteStage>
      </EditorialShell>
    </MotionProvider>
  );
}
