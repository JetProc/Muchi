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
  ARCHIVE_STORAGE_KEY,
  createEmptyArchive,
  createSeedArchive,
  parseArchive,
  serializeArchive,
  type ArchiveEnvelopeV1,
  type TrackId,
  type TrackReference,
} from "@/lib/archive";
import {
  DISCOVERY_STORAGE_KEY,
  createDiscoveryInteractionState,
  createPublicDiscoveryCatalog,
  getPublicChapter,
  markActivityRead,
  parseDiscoveryInteractionState,
  serializeDiscoveryInteractionState,
  toPlaylistSource,
  toggleFollow,
  toggleLike,
  type DiscoveryInteractionState,
} from "@/lib/public-discovery";
import {
  EditorialShell,
} from "./editorial-shell";
import { useModalFocus } from "./editorial-accessibility";
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
  Home,
  Inbox,
} from "./editorial-views-primary";
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
import type { AppView } from "./editorial-types";

export type { AppView } from "./editorial-types";

const ONBOARDING_KEY = "music-world:onboarding:v1";

export function MusicWorldApp({ view }: { view: AppView }) {
  const searchParams = useSearchParams();
  const router = useMotionRouter();
  const [archive, setArchive] = useState<ArchiveEnvelopeV1>(() => createSeedArchive());
  const catalog = useMemo(() => createPublicDiscoveryCatalog(), []);
  const [discoveryState, setDiscoveryState] = useState<DiscoveryInteractionState>(() => createDiscoveryInteractionState());
  const [hydrated, setHydrated] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [systemReduce, setSystemReduce] = useState(false);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const [playlistProgress, setPlaylistProgress] = useState<{
    routeKey: string;
    step: PlaylistStep;
  }>({ routeKey: "", step: 1 });
  const welcomeDialogRef = useModalFocus<HTMLDivElement>(
    showWelcome,
    () => setShowWelcome(false),
  );
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

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

  function handleShellBack() {
    if (view === "playlist" && typeof playlistStep === "number" && playlistStep > 1) {
      handlePlaylistStepChange(playlistStep === 3 ? 2 : 1);
      return;
    }
    router.back();
  }

  const notify = useCallback((message: string) => {
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
    const syncArchive = (event: StorageEvent) => {
      if (!event.newValue) return;
      if (event.key === ARCHIVE_STORAGE_KEY) {
        const parsed = parseArchive(event.newValue);
        if (parsed.status !== "ok") return;
        setArchive(parsed.archive);
        notify("다른 탭에서 바뀐 음악 기록을 불러왔어요.");
      }
      if (event.key === DISCOVERY_STORAGE_KEY) {
        setDiscoveryState(parseDiscoveryInteractionState(event.newValue, catalog));
      }
    };
    window.addEventListener("storage", syncArchive);
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
      let rawArchive: string | null = null;
      let onboardingDone = false;
      try {
        rawArchive = window.localStorage.getItem(ARCHIVE_STORAGE_KEY);
        setDiscoveryState(parseDiscoveryInteractionState(window.localStorage.getItem(DISCOVERY_STORAGE_KEY), catalog));
        onboardingDone = window.localStorage.getItem(ONBOARDING_KEY) === "done";
      } catch {
        setStorageBlocked("기기 저장소 접근이 차단되어 변경 사항을 저장하지 않는 보호 모드로 열었어요.");
      }
      const parsed = parseArchive(rawArchive);
      if (parsed.status === "ok") {
        setArchive(parsed.archive);
      } else if (parsed.status === "empty") {
        const seed = createSeedArchive();
        try {
          window.localStorage.setItem(ARCHIVE_STORAGE_KEY, serializeArchive(seed));
        } catch {
          setStorageBlocked("기기 저장소를 사용할 수 없어 변경 사항을 저장하지 않는 보호 모드로 열었어요.");
        }
      } else {
        setStorageBlocked(
          parsed.status === "future-version"
            ? `더 새로운 저장 형식(v${parsed.schemaVersion})을 발견했어요. 초기화 전에는 변경하지 않습니다.`
            : "저장된 데이터를 읽을 수 없어 보호 모드로 열었어요.",
        );
      }
      setShowWelcome(!onboardingDone);
      setOnline(window.navigator.onLine);
      setSystemReduce(media.matches);
      setHydrated(true);
    }, 0);
    return () => {
      window.clearTimeout(hydrationTimer);
      media.removeEventListener("change", updateMotion);
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
      window.removeEventListener("storage", syncArchive);
    };
  }, [catalog, notify]);

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
    message?: string,
    force = false,
  ): boolean {
    if (storageBlocked && !force) {
      notify("보호 모드에서는 먼저 설정에서 데이터를 초기화해 주세요.");
      return false;
    }
    try {
      const stored = parseArchive(window.localStorage.getItem(ARCHIVE_STORAGE_KEY));
      if (!force && stored.status === "ok" && stored.archive.updatedAt !== archive.updatedAt) {
        setArchive(stored.archive);
        notify("다른 탭의 최신 변경을 먼저 불러왔어요. 확인한 뒤 다시 저장해 주세요.");
        return false;
      }
      window.localStorage.setItem(ARCHIVE_STORAGE_KEY, serializeArchive(next));
      setArchive(next);
      setStorageBlocked(null);
      if (message) notify(message);
      return true;
    } catch {
      notify("기기 저장 공간 때문에 변경사항을 저장하지 못했어요.");
      return false;
    }
  }

  function setOnboardingDone() {
    try {
      window.localStorage.setItem(ONBOARDING_KEY, "done");
    } catch {
      notify("이 브라우저에서는 시작 안내 상태를 저장하지 못했어요.");
    }
    setShowWelcome(false);
  }

  function commitDiscovery(next: DiscoveryInteractionState, message: string) {
    setDiscoveryState(next);
    try {
      window.localStorage.setItem(DISCOVERY_STORAGE_KEY, serializeDiscoveryInteractionState(next));
      if (message) notify(message);
    } catch {
      notify("이 브라우저에서는 탐색 활동을 저장하지 못했어요.");
    }
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
    return (
      <MotionProvider>
        <EditorialShell
          view={view}
          inboxCount={0}
          preview={preview}
          toast={null}
          online={online}
          scrollReady={false}
          onBack={handleShellBack}
        >
          <div className="page-content">
            <div className="archive-boot" role="status" aria-live="polite">
              <div>
                <strong>나의 음악 기록을 펼치고 있어요</strong>
                <span>이 브라우저에 저장된 챕터와 기억을 확인하는 중입니다.</span>
              </div>
            </div>
          </div>
        </EditorialShell>
      </MotionProvider>
    );
  }

  const content = (() => {
    switch (view) {
      case "capture":
        return <Capture archive={archive} commit={commit} notify={notify} online={online} router={router} sharedUrl={sharedUrl} />;
      case "inbox":
        return <Inbox archive={archive} commit={commit} notify={notify} router={router} />;
      case "chapters":
        return <Chapters archive={archive} commit={commit} notify={notify} router={router} pendingTrackId={pendingTrackId} pendingRecordMode={pendingRecordMode} />;
      case "chapter":
        if (hiddenChapterRoute) {
          return <div className="page-content"><div className="archive-boot" role="status">안전한 음악 목록으로 이동하고 있어요.</div></div>;
        }
        return <ChapterDetail archive={archive} chapterId={queryId} commit={commit} notify={notify} router={router} />;
      case "memory":
        if (monthlyMemoryRoute) {
          return <div className="page-content"><div className="archive-boot" role="status">월별 기록으로 이동하고 있어요.</div></div>;
        }
        return <Memory archive={archive} cubeTrackId={queryId} commit={commit} notify={notify} preview={preview} recordMode={recordMode} openChapterMove={searchParams.get("move") === "chapter"} router={router} />;
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
        return <PublicProfileDetail catalog={catalog} state={discoveryState} profileId={queryId} actions={discoveryActions} />;
      case "search":
        return (
          <Search
            archive={archive}
            initialQuery={searchQuery}
            requestedTagIds={searchTagIds}
            requestedView={searchView}
            router={router}
          />
        );
      case "recap":
        return <Recap archive={archive} />;
      case "settings":
        return <Settings archive={archive} commit={commit} notify={notify} storageBlocked={storageBlocked} setStorageBlocked={setStorageBlocked} />;
      case "tags":
        return <TagManager archive={archive} commit={commit} notify={notify} />;
      default:
        return <Home archive={archive} />;
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
        onBack={handleShellBack}
      >
      {storageBlocked ? (
        <div
          className="notice notice-danger"
          style={{ margin: "18px clamp(18px, 4cqw, 24px) 0" }}
          role="alert"
        >
          <div><strong>저장 데이터 보호 모드</strong><br />{storageBlocked}</div>
        </div>
      ) : null}
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
      {showWelcome ? (
        <div className="welcome-backdrop" role="presentation">
          <div ref={welcomeDialogRef} className="welcome-card" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
            <h2 id="welcome-title">음악을 기록하세요.</h2>
            <div className="dialog-actions">
              <button
                className="button button-ghost"
                type="button"
                onClick={() => {
                  const empty = createEmptyArchive();
                  commit(empty, "빈 아카이브에서 시작합니다.", true);
                  setOnboardingDone();
                }}
              >
                빈 아카이브
              </button>
              <button className="button" type="button" onClick={setOnboardingDone}>
                샘플 보기
              </button>
              <button
                className="button button-primary"
                type="button"
                onClick={() => {
                  setOnboardingDone();
                  router.push("/capture");
                }}
              >
                첫 곡 기록
              </button>
            </div>
          </div>
        </div>
      ) : null}
      </EditorialShell>
    </MotionProvider>
  );
}
