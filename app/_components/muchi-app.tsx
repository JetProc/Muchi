"use client";

import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  createTags,
  type ArchiveEnvelopeV1,
  type TrackId,
  type TrackReference,
} from "@/lib/archive";
import {
  getPublicChapter,
  toPlaylistSource,
  markActivityRead,
} from "@/lib/public-discovery";
import { saveChapterLike, saveProfileFollow } from "@/lib/client/public-discovery-api";
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
import type { PlaylistStep } from "./editorial-views-playlist";
import type { AppView, ToastKind, ToastMessage, ToastNotice } from "./editorial-types";
import { AuthGate, startGoogleSignIn } from "./auth-gate";
import { OnboardingScreen } from "./onboarding-screen";
import { useMuchiData } from "./muchi-data-provider";
import { PersonalSpace } from "./editorial-personal-space";

export type { AppView } from "./editorial-types";

// Home is part of the first mobile render. Secondary views stay code-split and
// always render an intentional interim state instead of a blank content area.
const Capture = dynamic(() => import("./editorial-views-primary").then((module) => module.Capture), { loading: () => <CaptureLoadingSkeleton /> });
const Inbox = dynamic(() => import("./editorial-views-primary").then((module) => module.Inbox), { loading: () => <LoadingSpinner /> });
const VisitorSpace = dynamic(() => import("./editorial-personal-space").then((module) => module.VisitorSpace), { loading: () => <HomeLoadingSkeleton /> });
const ChapterDetail = dynamic(() => import("./editorial-views-chapters").then((module) => module.ChapterDetail), { loading: () => <ChaptersLoadingSkeleton /> });
const ChapterShareEditor = dynamic(() => import("./editorial-chapter-share").then((module) => module.ChapterShareEditor), { loading: () => <LoadingSpinner /> });
const Chapters = dynamic(() => import("./editorial-views-chapters").then((module) => module.Chapters), { loading: () => <ChaptersLoadingSkeleton /> });
const Memory = dynamic(() => import("./editorial-views-chapters").then((module) => module.Memory), { loading: () => <LoadingSpinner /> });
const Recap = dynamic(() => import("./editorial-views-discovery").then((module) => module.Recap), { loading: () => <LoadingSpinner /> });
const Search = dynamic(() => import("./editorial-views-discovery").then((module) => module.Search), { loading: () => <SearchLoadingSkeleton /> });
const Settings = dynamic(() => import("./editorial-views-discovery").then((module) => module.Settings), { loading: () => <LoadingSpinner /> });
const TagManager = dynamic(() => import("./editorial-views-tags").then((module) => module.TagManager), { loading: () => <LoadingSpinner /> });
const Guide = dynamic(() => import("./editorial-views-guide").then((module) => module.Guide), { loading: () => <LoadingSpinner /> });
const PlaylistBuilder = dynamic(() => import("./editorial-views-playlist").then((module) => module.PlaylistBuilder), { loading: () => <LoadingSpinner /> });
const Discover = dynamic(() => import("./editorial-views-public-discovery").then((module) => module.Discover), { loading: () => <DiscoverLoadingSkeleton /> });
const PublicChapterDetail = dynamic(() => import("./editorial-views-public-discovery").then((module) => module.PublicChapterDetail), { loading: () => <DiscoverLoadingSkeleton /> });
const PublicProfileDetail = dynamic(() => import("./editorial-views-public-discovery").then((module) => module.PublicProfileDetail), { loading: () => <DiscoverLoadingSkeleton /> });

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

function DiscoveryLoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="page-content discover-load-error" role="alert">
      <span className="section-label">탐색 연결 오류</span>
      <h1>공개 챕터를 불러오지 못했어요</h1>
      <p>{message}</p>
      <button className="button button-primary" type="button" onClick={onRetry}>다시 시도</button>
    </div>
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
  const {
    archive,
    archiveReady: hydrated,
    authenticated,
    authRequired,
    remoteError,
    catalog,
    discoveryState,
    discoveryReady,
    discoveryError,
    onboarding,
    onboardingSaving,
    onboardingError,
    online,
    ensureDiscoveryData,
    updatePublicChapterLike,
    updatePublicProfileFollow,
    saveArchive: saveArchiveState,
    saveDiscovery: saveDiscoveryState,
    completeOnboarding,
    updateProfile,
  } = useMuchiData();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [systemReduce, setSystemReduce] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [playlistProgress, setPlaylistProgress] = useState<{
    routeKey: string;
    step: PlaylistStep;
  }>({ routeKey: "", step: 1 });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const toastRef = useRef<ToastNotice | null>(null);
  const pendingLikeChapterIdsRef = useRef(new Set<string>());

  const inboxEntries = useMemo(
    () => Object.values(archive.data.inbox)
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
    [archive],
  );
  const reduceMotion = archive.data.preferences.motion === "reduce"
    || (archive.data.preferences.motion === "system" && systemReduce);
  const queryId = searchParams.get("id");
  const pendingTrackIds = searchParams.getAll("trackId") as TrackId[];
  const pendingTrackId = pendingTrackIds[0] ?? null;
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
        return { label: "홈으로", fallbackHref: "/" };
      case "guide":
        return { label: "설정으로", fallbackHref: "/settings" };
      case "space":
        return { label: "내 공간으로", fallbackHref: "/" };
      case "chapter":
        return requestedChapter?.parentId
          ? {
            label: "상위 챕터로",
            fallbackHref: `/chapter?id=${encodeURIComponent(requestedChapter.parentId)}`,
            sharedId: requestedChapter.parentId,
          }
          : { label: "챕터로", fallbackHref: "/chapters" };
      case "chapterShare":
        return queryId
          ? {
            label: "챕터로",
            fallbackHref: `/chapter?id=${encodeURIComponent(queryId)}`,
            sharedId: queryId,
          }
          : { label: "챕터로", fallbackHref: "/chapters" };
      case "memory":
        if (!requestedMemoryChapter) return { label: "챕터로", fallbackHref: "/chapters" };
        if (requestedMemoryChapter.kind === "capture") return { label: "미분류 기록으로", fallbackHref: "/tags" };
        return {
          label: "챕터로",
          fallbackHref: `/chapter?id=${encodeURIComponent(requestedMemoryChapter.id)}`,
          sharedId: requestedMemoryChapter.id,
        };
      case "search":
        if (fromMemoryId && archive.data.cubeTracks[fromMemoryId]) {
          return {
            label: "곡 기록으로",
            fallbackHref: `/memory?id=${encodeURIComponent(fromMemoryId)}`,
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
          fallbackHref: publicPlaylistSource?.returnHref
            ?? (queryId ? `/chapter?id=${encodeURIComponent(queryId)}` : "/chapters"),
          sharedId: queryId ?? undefined,
        };
      case "discoverChapter":
      case "discoverProfile":
        return { label: "탐색으로", fallbackHref: "/discover" };
      case "tags":
        if (fromMemoryId && archive.data.cubeTracks[fromMemoryId]) {
          return {
            label: "곡 기록으로",
            fallbackHref: `/memory?id=${encodeURIComponent(fromMemoryId)}`,
            sharedId: fromMemoryId,
          };
        }
        return { label: "설정으로", fallbackHref: "/settings" };
      default:
        return null;
    }
  })();

  const notify = useCallback((message: ToastMessage) => {
    const text = typeof message === "string" ? message : message.text;
    const inferredKind: ToastKind = /못했|실패|오류|만료|없어요|입력해|선택해/.test(text)
      ? "error"
      : "success";
    const next: ToastNotice = typeof message === "string"
      ? { text, kind: inferredKind }
      : { ...message, kind: message.kind ?? inferredKind };
    if (toastRef.current?.persistent && !next.persistent && !next.replacePersistent) return;
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastRef.current = next;
    setToast(next);
    if (next.persistent) return;
    toastTimerRef.current = window.setTimeout(() => {
      toastRef.current = null;
      setToast(null);
    }, next.durationMs ?? (next.action ? 8_000 : 3_200));
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = null;
    toastRef.current = null;
    setToast(null);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setSystemReduce(media.matches);
    updateMotion();
    media.addEventListener("change", updateMotion);
    return () => {
      media.removeEventListener("change", updateMotion);
    };
  }, []);

  const discoveryRoute = view === "discover"
    || view === "discoverChapter"
    || view === "discoverProfile"
    || (view === "playlist" && searchParams.get("source") === "discover");
  const publicDiscoveryRoute = view === "discover"
    || view === "discoverChapter"
    || view === "discoverProfile";
  const discoveryTarget = useMemo(() => {
    if (view === "discoverChapter" && queryId) return { chapterId: queryId };
    if (view === "discoverProfile" && queryId) return { profileId: queryId };
    return {};
  }, [queryId, view]);

  useEffect(() => {
    if (!hydrated || !discoveryRoute) return;
    void ensureDiscoveryData(false, discoveryTarget).catch(() => undefined);
  }, [discoveryRoute, discoveryTarget, ensureDiscoveryData, hydrated]);

  useEffect(() => {
    const handleSaveNotice = (event: Event) => {
      const message = (event as CustomEvent<ToastMessage>).detail;
      if (message) notify(message);
    };
    window.addEventListener("muchi:save-notice", handleSaveNotice);
    return () => window.removeEventListener("muchi:save-notice", handleSaveNotice);
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
  ): boolean {
    return saveArchiveState(next, message);
  }

  function handleToggleFollow(profileId: string) {
    if (!authenticated) {
      void startGoogleSignIn().catch((error: unknown) => notify(error instanceof Error ? error.message : "로그인을 시작하지 못했어요."));
      return;
    }
    const profile = catalog.profiles[profileId];
    if (!profile) return;
    const following = profile.followedByViewer;
    updatePublicProfileFollow(profileId, !following);
    void saveProfileFollow(profileId, !following)
      .then(() => {
        notify(following ? "팔로우를 취소했어요." : "새 챕터 소식을 받아볼게요.");
        return ensureDiscoveryData(true, discoveryTarget);
      })
      .catch((error: unknown) => {
        updatePublicProfileFollow(profileId, following);
        notify(error instanceof Error ? error.message : "팔로우를 저장하지 못했어요.");
      });
  }

  function handleToggleLike(chapterId: string) {
    if (!authenticated) {
      void startGoogleSignIn().catch((error: unknown) => notify(error instanceof Error ? error.message : "로그인을 시작하지 못했어요."));
      return;
    }
    const chapter = getPublicChapter(catalog, chapterId);
    if (!chapter || pendingLikeChapterIdsRef.current.has(chapterId)) return;
    const liked = chapter.likedByViewer;
    const nextLiked = !liked;
    pendingLikeChapterIdsRef.current.add(chapterId);
    updatePublicChapterLike(chapterId, nextLiked);
    void saveChapterLike(chapter.profileId, chapterId.replace(`public:${chapter.profileId}:`, ""), nextLiked)
      .catch((error: unknown) => {
        updatePublicChapterLike(chapterId, liked);
        notify(error instanceof Error ? error.message : "좋아요를 저장하지 못했어요.");
      })
      .finally(() => pendingLikeChapterIdsRef.current.delete(chapterId));
  }

  function handleMarkActivityRead(activityId: string) {
    if (discoveryState.readActivityIds.includes(activityId)) return;
    saveDiscoveryState(markActivityRead(discoveryState, activityId));
  }

  const discoveryActions = {
    onToggleFollow: handleToggleFollow,
    onToggleLike: handleToggleLike,
    onMarkActivityRead: handleMarkActivityRead,
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
    if (authRequired && !publicDiscoveryRoute) return <AuthGate />;
    if (remoteError) return <AuthGate message={remoteError} />;
    return (
      <MotionProvider>
        <EditorialShell
          view={view}
          inboxCount={0}
          preview={preview}
          toast={null}
          onToastDismiss={dismissToast}
          online={online}
          scrollReady={false}
          backAction={contextBackAction}
        >
          <ArchiveLoadingState view={view} />
        </EditorialShell>
      </MotionProvider>
    );
  }

  if (!authenticated && !publicDiscoveryRoute) return <AuthGate />;

  if (authenticated && onboarding && !onboarding.completed && !publicDiscoveryRoute) {
    return (
      <OnboardingScreen
        displayName={onboarding.displayName}
        avatarUrl={onboarding.avatarUrl}
        loading={onboardingSaving}
        error={onboardingError}
        onComplete={(nickname, starterTags, destination) => {
          if (starterTags.length) {
            const result = createTags(archive, starterTags);
            if (!saveArchiveState(result.archive)) return;
          }
          void completeOnboarding(nickname).then((completed) => {
            if (completed && destination === "capture") router.replace("/capture?guide=1", "replace");
          });
        }}
      />
    );
  }

  const content = (() => {
    switch (view) {
      case "capture":
        return <Capture archive={archive} commit={commit} notify={notify} online={online} router={router} sharedUrl={sharedUrl} guideMode={searchParams.get("guide") === "1"} />;
      case "space":
        return searchParams.get("view") === "visitor"
          ? <VisitorSpace archive={archive} chapterId={queryId} />
          : <PersonalSpace archive={archive} commit={commit} notify={notify} profile={onboarding} />;
      case "inbox":
        return <Inbox archive={archive} commit={commit} notify={notify} router={router} />;
      case "chapters":
        return <Chapters archive={archive} commit={commit} notify={notify} router={router} pendingTrackId={pendingTrackId} pendingTrackIds={pendingTrackIds} pendingRecordMode={pendingRecordMode} />;
      case "chapter":
        if (hiddenChapterRoute) {
          return <LoadingSpinner label="안전한 음악 목록으로 이동하는 중입니다." />;
        }
        return <ChapterDetail archive={archive} chapterId={queryId} commit={commit} notify={notify} router={router} />;
      case "chapterShare":
        return <ChapterShareEditor archive={archive} chapterId={queryId} commit={commit} notify={notify} authorName={onboarding?.displayName ?? null} />;
      case "memory":
        if (monthlyMemoryRoute) {
          return <LoadingSpinner label="월별 기록으로 이동하는 중입니다." />;
        }
        return <Memory archive={archive} cubeTrackId={queryId} commit={commit} notify={notify} recordMode={recordMode} openChapterMove={searchParams.get("move") === "chapter"} router={router} />;
      case "playlist":
        if (searchParams.get("source") === "discover" && !discoveryReady) {
          return <LoadingSpinner label="공개 챕터를 불러오는 중입니다." />;
        }
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
        if (discoveryError && !discoveryReady) return <DiscoveryLoadError message={discoveryError} onRetry={() => { void ensureDiscoveryData(true, discoveryTarget).catch(() => undefined); }} />;
        if (!discoveryReady) return <DiscoverLoadingSkeleton />;
        return <Discover archive={archive} catalog={catalog} state={discoveryState} activityOnly={searchParams.get("activity") === "1"} actions={discoveryActions} />;
      case "discoverChapter":
        if (discoveryError && !discoveryReady) return <DiscoveryLoadError message={discoveryError} onRetry={() => { void ensureDiscoveryData(true, discoveryTarget).catch(() => undefined); }} />;
        if (!discoveryReady) return <DiscoverLoadingSkeleton />;
        return <PublicChapterDetail catalog={catalog} chapterId={queryId} actions={discoveryActions} />;
      case "discoverProfile":
        if (discoveryError && !discoveryReady) return <DiscoveryLoadError message={discoveryError} onRetry={() => { void ensureDiscoveryData(true, discoveryTarget).catch(() => undefined); }} />;
        if (!discoveryReady) return <DiscoverLoadingSkeleton />;
        return <PublicProfileDetail catalog={catalog} profileId={queryId} showAll={searchParams.get("view") === "all"} actions={discoveryActions} />;
      case "search":
        return (
          <Search
            archive={archive}
            commit={commit}
            notify={notify}
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
        return <Settings archive={archive} commit={commit} notify={notify} profile={onboarding} profileSaving={onboardingSaving} profileError={onboardingError} onUpdateProfile={updateProfile} />;
      case "guide":
        return <Guide />;
      case "tags":
        return <TagManager archive={archive} commit={commit} notify={notify} />;
      default:
        return <PersonalSpace archive={archive} commit={commit} notify={notify} profile={onboarding} />;
    }
  })();

  return (
    <MotionProvider>
      <EditorialShell
        view={view}
        inboxCount={inboxEntries.length}
        preview={preview}
        toast={toast}
        onToastDismiss={dismissToast}
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
        queryKey={view === "search" || view === "discover" || view === "capture" ? searchParams.toString() : queryId}
      >
        {content}
      </RouteStage>
      </EditorialShell>
    </MotionProvider>
  );
}
