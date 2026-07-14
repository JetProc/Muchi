"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ARCHIVE_STORAGE_KEY,
  CUBE_COLORS,
  addTrackToCube,
  captureTrack,
  captureTrackToInbox,
  createCube,
  createEmptyArchive,
  createSeedArchive,
  deleteCube,
  getCubeTracks,
  moveInboxTrackToCube,
  normalizeTagLabel,
  parseArchive,
  removeCubeTrack,
  removeInboxTrack,
  removeSeedData,
  reorderCubeTracks,
  resetArchive,
  searchArchive,
  selectRecap,
  serializeArchive,
  setCubeTrackTags,
  updateCube,
  updateCubeTrack,
  validateArchiveEnvelope,
  type ArchiveEnvelopeV1,
  type ArchiveSearchResult,
  type Cube,
  type CubeColor,
  type CubeTrack,
  type MemoryPeriod,
  type MotionPreference,
  type RecapEntry,
  type RecapMode,
  type TagCategory,
  type TagDefinition,
  type TrackId,
  type TrackReference,
} from "@/lib/archive";
import {
  ITUNES_PREVIEW_ATTRIBUTION,
  ITUNES_PREVIEW_USAGE_NOTICE,
  ItunesSearchError,
  searchItunesTracks,
} from "@/lib/itunes";
import {
  completeManualTrack,
  type ManualTrackFallback,
  type MusicMetadataApiResponse,
} from "@/lib/music-links";

export type AppView =
  | "home"
  | "capture"
  | "inbox"
  | "cubes"
  | "cube"
  | "context"
  | "search"
  | "recap"
  | "world"
  | "settings";

const ONBOARDING_KEY = "music-world:onboarding:v1";

const VIEW_META: Record<AppView, { label: string; icon: string; path: string }> = {
  home: { label: "홈", icon: "⌂", path: "/" },
  capture: { label: "곡 저장", icon: "+", path: "/capture" },
  inbox: { label: "임시 보관함", icon: "⌄", path: "/inbox" },
  cubes: { label: "내 큐브", icon: "◇", path: "/cubes" },
  cube: { label: "큐브", icon: "◇", path: "/cubes" },
  context: { label: "곡의 순간", icon: "✦", path: "/cubes" },
  search: { label: "내 기록 검색", icon: "⌕", path: "/search" },
  recap: { label: "회고", icon: "◷", path: "/recap" },
  world: { label: "음악 세계", icon: "✣", path: "/world" },
  settings: { label: "설정", icon: "⚙", path: "/settings" },
};

const DESKTOP_NAV: AppView[] = [
  "home",
  "inbox",
  "cubes",
  "search",
  "recap",
  "world",
];

const MOBILE_NAV: AppView[] = ["home", "inbox", "capture", "cubes", "search"];

const MOBILE_NAV_LABEL: Partial<Record<AppView, string>> = {
  home: "홈",
  inbox: "보관함",
  cubes: "큐브",
  search: "검색",
};

const COLOR_HEX: Record<CubeColor, string> = {
  violet: "#9b8cff",
  cyan: "#6fe7e8",
  coral: "#ff8fa3",
  amber: "#f7c873",
  mint: "#94e9c8",
  blue: "#6ca8ff",
};

const COLOR_LABEL: Record<CubeColor, string> = {
  violet: "꿈빛 라벤더",
  cyan: "새벽 시안",
  coral: "기억 코랄",
  amber: "노을 앰버",
  mint: "여름 민트",
  blue: "밤공기 블루",
};

const TAG_SUGGESTIONS: Array<{ label: string; category: TagCategory }> = [
  { label: "그리운", category: "emotion" },
  { label: "따뜻한", category: "emotion" },
  { label: "불안한", category: "emotion" },
  { label: "질주하는", category: "energy" },
  { label: "몽환적인", category: "texture" },
  { label: "차가운", category: "texture" },
  { label: "도시적인", category: "situation" },
  { label: "새벽", category: "period" },
  { label: "드라이브", category: "situation" },
  { label: "여름밤", category: "period" },
  { label: "인디 록", category: "genre" },
  { label: "청춘", category: "custom" },
];

const TAG_CATEGORY_LABEL: Record<TagCategory, string> = {
  genre: "장르",
  emotion: "감정",
  energy: "에너지",
  texture: "질감",
  situation: "상황",
  period: "시기",
  custom: "나만의 언어",
};

const WORLD_COLUMNS = 4;
const WORLD_COLUMN_GAP = 165;
const WORLD_ROW_GAP = 176;

function worldPosition(index: number) {
  const row = Math.floor(index / WORLD_COLUMNS);
  const column = index % WORLD_COLUMNS;
  return {
    left: 50 + column * WORLD_COLUMN_GAP + (row % 2 ? 55 : 0),
    top: 42 + row * WORLD_ROW_GAP,
  };
}

const SEASON_LABEL = {
  spring: "봄",
  summer: "여름",
  autumn: "가을",
  winter: "겨울",
} as const;

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function formatMemory(period: MemoryPeriod): string {
  if (!period) return "시기 미기록";
  const year = period.year ? `${period.year}년 ` : "";
  return period.kind === "month"
    ? `${year}${period.month}월`
    : `${year}${SEASON_LABEL[period.season]}`;
}

function cubeStyle(color: CubeColor): CSSProperties & { "--cube-color": string } {
  return { "--cube-color": COLOR_HEX[color] };
}

function artStyle(index: number): CSSProperties & { "--art-a": string; "--art-b": string } {
  const pairs = [
    ["#7b68de", "#293568"],
    ["#55cbd6", "#275065"],
    ["#e87995", "#62334f"],
    ["#e0b86f", "#5c4936"],
  ];
  const pair = pairs[index % pairs.length];
  return { "--art-a": pair[0], "--art-b": pair[1] };
}

function TrackArtwork({ track, index = 0 }: { track: TrackReference; index?: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="track-art" style={artStyle(index)} aria-hidden="true">
      {track.artworkUrl && !failed ? (
        // A remote promotional image is intentionally not cached by the service worker.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={track.artworkUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="track-art-fallback">♪</span>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="loading-dots" aria-label="불러오는 중">
      <span />
      <span />
      <span />
    </span>
  );
}

interface PreviewState {
  track: TrackReference;
  playing: boolean;
  currentTime: number;
}

interface PreviewControls {
  state: PreviewState | null;
  play: (track: TrackReference) => void;
  pause: () => void;
  close: () => void;
}

function PreviewButton({ track, preview }: { track: TrackReference; preview: PreviewControls }) {
  const isCurrent = preview.state?.track.id === track.id;
  const playing = isCurrent && preview.state?.playing;
  return (
    <button
      className="play-button"
      type="button"
      disabled={!track.previewUrl}
      onClick={() => (playing ? preview.pause() : preview.play(track))}
      aria-label={track.previewUrl ? `${track.title} 30초 미리듣기` : "미리듣기 없음"}
      title={track.previewUrl ? "30초 미리듣기" : "미리듣기 없음"}
    >
      {playing ? "Ⅱ" : "▶"}
    </button>
  );
}

function AppShell({
  view,
  inboxCount,
  children,
  preview,
  toast,
  online,
}: {
  view: AppView;
  inboxCount: number;
  children: ReactNode;
  preview: PreviewControls;
  toast: string | null;
  online: boolean;
}) {
  const playerOpen = Boolean(preview.state);
  return (
    <div className={`app-shell${playerOpen ? " has-player" : ""}`}>
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="MUMU 홈">
          <span className="brand-mark" aria-hidden="true" />
          <span className="brand-copy">
            <strong>MUMU</strong>
            <span>my music universe</span>
          </span>
        </Link>
        <nav className="nav-list" aria-label="주요 메뉴">
          {DESKTOP_NAV.map((item) => {
            const meta = VIEW_META[item];
            const active = item === view || (view === "cube" && item === "cubes") || (view === "context" && item === "cubes");
            return (
              <Link key={item} href={meta.path} className={`nav-link${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
                <span className="nav-icon" aria-hidden="true">{meta.icon}</span>
                {meta.label}
                {item === "inbox" && inboxCount > 0 ? <span className="nav-badge">{inboxCount}</span> : null}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-spacer" />
        <Link href="/settings" className={`nav-link${view === "settings" ? " is-active" : ""}`} aria-current={view === "settings" ? "page" : undefined}>
          <span className="nav-icon" aria-hidden="true">⚙</span>
          설정
        </Link>
        <div className="privacy-note">
          <strong>나만의 비밀 보관함</strong>
          기록은 이 브라우저 안에만 저장돼요.
        </div>
      </aside>

      <main className="shell-main" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <div className="topbar-kicker">
            <strong>{VIEW_META[view].label}</strong>
            {!online ? " · 오프라인" : " · 오늘의 음악 세계"}
          </div>
          <div className="topbar-actions">
            <Link className="button button-primary" href="/capture">＋ 곡 저장</Link>
            <Link className="button icon-button button-ghost" href="/settings" aria-label="설정">⚙</Link>
          </div>
        </header>
        {children}
      </main>

      <nav className="mobile-nav" aria-label="모바일 메뉴">
        {MOBILE_NAV.map((item) => {
          const meta = VIEW_META[item];
          const active = item === view || (item === "cubes" && (view === "cube" || view === "context"));
          return (
            <Link
              key={item}
              href={meta.path}
              className={`${active ? "is-active" : ""}${item === "capture" ? " mobile-add" : ""}`}
              aria-label={meta.label}
              aria-current={active ? "page" : undefined}
            >
              <span aria-hidden="true">{meta.icon}</span>
              {item === "capture" ? null : MOBILE_NAV_LABEL[item] ?? meta.label}
            </Link>
          );
        })}
      </nav>

      {preview.state ? (
        <div className="player" role="region" aria-label="미리듣기 플레이어">
          <TrackArtwork track={preview.state.track} />
          <div className="player-copy">
            <strong>{preview.state.track.title}</strong>
            <span>{preview.state.track.artist} · {Math.floor(preview.state.currentTime)}초 / 30초</span>
            <span>{ITUNES_PREVIEW_ATTRIBUTION}</span>
          </div>
          <div className="player-controls">
            <button className="play-button" type="button" onClick={() => preview.state?.playing ? preview.pause() : preview.play(preview.state!.track)} aria-label={preview.state.playing ? "일시정지" : "재생"}>
              {preview.state.playing ? "Ⅱ" : "▶"}
            </button>
            {preview.state.track.externalUrl ? (
              <a className="button icon-button button-ghost" href={preview.state.track.externalUrl} target="_blank" rel="noopener noreferrer" aria-label="Apple Music에서 열기">↗</a>
            ) : null}
            <button className="button icon-button button-ghost" type="button" onClick={preview.close} aria-label="플레이어 닫기">×</button>
          </div>
        </div>
      ) : null}
      {toast ? <div className="toast" role="status" aria-live="polite">{toast}</div> : null}
    </div>
  );
}

function EmptyState({ icon, title, copy, action }: { icon: string; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <div>
        <span className="empty-icon" aria-hidden="true">{icon}</span>
        <h2>{title}</h2>
        <p>{copy}</p>
        {action}
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return (
    <div className="page-header">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{copy}</p>
      </div>
      {action}
    </div>
  );
}

function CubeCard({ archive, cube, onDelete }: { archive: ArchiveEnvelopeV1; cube: Cube; onDelete?: (cube: Cube) => void }) {
  const entries = getCubeTracks(archive, cube.id);
  const tagCount = new Set(entries.flatMap((entry) => entry.cubeTrack.tagIds)).size;
  return (
    <article className="cube-card" style={cubeStyle(cube.color)}>
      <div className="cube-card-top">
        <div className="cube-mini-art" aria-hidden="true"><span /><span /><span /><span /></div>
        {cube.source === "seed" ? <span className="tag">샘플</span> : null}
      </div>
      <h3>{cube.name}</h3>
      <p>{cube.description || "아직 설명이 없는 나만의 음악 순간"}</p>
      <div className="meta-row">
        <span>{entries.length}곡</span><span className="dot" /><span>{tagCount}개 태그</span><span className="dot" /><span>{formatDate(cube.updatedAt)} 수정</span>
      </div>
      <div className="track-actions" style={{ marginTop: 18 }}>
        <Link className="button" href={`/cube?id=${encodeURIComponent(cube.id)}`}>큐브 열기 →</Link>
        {onDelete ? <button className="button button-ghost" type="button" onClick={() => onDelete(cube)} aria-label={`${cube.name} 삭제`}>삭제</button> : null}
      </div>
    </article>
  );
}

function TrackRow({
  track,
  index,
  preview,
  tags = [],
  context,
  actions,
}: {
  track: TrackReference;
  index: number;
  preview: PreviewControls;
  tags?: TagDefinition[];
  context?: string;
  actions?: ReactNode;
}) {
  return (
    <article className="track-row">
      <TrackArtwork track={track} index={index} />
      <div className="track-info">
        <strong>{track.title}</strong>
        <small>{track.artist}{track.album ? ` · ${track.album}` : ""}</small>
        {context ? <em>{context}</em> : null}
        {tags.length ? <div className="tag-row" style={{ marginTop: 7 }}>{tags.slice(0, 5).map((tag) => <span className="tag" key={tag.id}>#{tag.label}</span>)}</div> : null}
      </div>
      <div className="track-actions">
        <PreviewButton track={track} preview={preview} />
        {actions}
      </div>
    </article>
  );
}

export function MusicWorldApp({ view }: { view: AppView }) {
  const pathname = usePathname();
  const router = useRouter();
  const [archive, setArchive] = useState<ArchiveEnvelopeV1>(() => createSeedArchive());
  const [hydrated, setHydrated] = useState(false);
  const [storageBlocked, setStorageBlocked] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [systemReduce, setSystemReduce] = useState(false);
  const [queryId, setQueryId] = useState<string | null>(null);
  const [pendingTrackId, setPendingTrackId] = useState<TrackId | null>(null);
  const [previewState, setPreviewState] = useState<PreviewState | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const inboxEntries = useMemo(
    () => Object.values(archive.data.inbox).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt)),
    [archive],
  );
  const reduceMotion = archive.data.preferences.motion === "reduce" || (archive.data.preferences.motion === "system" && systemReduce);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMotion = () => setSystemReduce(media.matches);
    media.addEventListener("change", updateMotion);
    const updateOnline = () => setOnline(window.navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    const syncArchive = (event: StorageEvent) => {
      if (event.key !== ARCHIVE_STORAGE_KEY || !event.newValue) return;
      const parsed = parseArchive(event.newValue);
      if (parsed.status !== "ok") return;
      setArchive(parsed.archive);
      setToast("다른 탭에서 바뀐 음악 세계를 불러왔어요.");
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
    };
    window.addEventListener("storage", syncArchive);
    if ("serviceWorker" in navigator) {
      const localDevelopment = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
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
        setStorageBlocked(parsed.status === "future-version" ? `더 새로운 저장 형식(v${parsed.schemaVersion})을 발견했어요. 초기화 전에는 변경하지 않습니다.` : "저장된 데이터를 읽을 수 없어 보호 모드로 열었어요.");
      }
      setShowWelcome(!onboardingDone);
      setOnline(window.navigator.onLine);
      const searchParams = new URLSearchParams(window.location.search);
      setQueryId(searchParams.get("id"));
      setPendingTrackId(searchParams.get("trackId") as TrackId | null);
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
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reduceMotion = reduceMotion ? "true" : "false";
  }, [reduceMotion]);

  useEffect(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    const resetTimer = window.setTimeout(() => setPreviewState(null), 0);
    return () => window.clearTimeout(resetTimer);
  }, [pathname]);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
  }, []);

  function notify(message: string) {
    setToast(message);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3200);
  }

  function commit(next: ArchiveEnvelopeV1, message?: string, force = false): boolean {
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

  const preview: PreviewControls = {
    state: previewState,
    play(track) {
      if (!track.previewUrl) {
        notify("이 곡은 30초 미리듣기를 제공하지 않아요.");
        return;
      }
      if (audioRef.current && previewState?.track.id === track.id) {
        audioRef.current.play().then(() => setPreviewState((current) => current ? { ...current, playing: true } : null)).catch(() => notify("미리듣기를 재생할 수 없어요. Apple Music 링크를 이용해 주세요."));
        return;
      }
      audioRef.current?.pause();
      const audio = new Audio(track.previewUrl);
      audio.preload = "none";
      audioRef.current = audio;
      setPreviewState({ track, playing: false, currentTime: 0 });
      audio.addEventListener("timeupdate", () => setPreviewState((current) => current?.track.id === track.id ? { ...current, currentTime: Math.min(30, audio.currentTime) } : current));
      audio.addEventListener("ended", () => setPreviewState((current) => current?.track.id === track.id ? { ...current, playing: false, currentTime: 0 } : current));
      audio.addEventListener("error", () => {
        setPreviewState((current) => current?.track.id === track.id ? { ...current, playing: false } : current);
        notify("미리듣기 링크가 만료됐거나 재생할 수 없어요. 기록은 그대로 유지됩니다.");
      });
      audio.play().then(() => setPreviewState({ track, playing: true, currentTime: 0 })).catch(() => notify("재생을 시작하지 못했어요. 다시 눌러 주세요."));
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
      <AppShell view={view} inboxCount={0} preview={preview} toast={null} online={online}>
        <div className="page-content">
          <div className="archive-boot" role="status" aria-live="polite">
            <span className="brand-mark" aria-hidden="true" />
            <div>
              <strong>음악 세계를 불러오고 있어요</strong>
              <span>이 브라우저에 저장된 큐브와 기억을 확인하는 중입니다.</span>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  const content = (() => {
    switch (view) {
      case "capture": return <CaptureView archive={archive} commit={commit} preview={preview} online={online} router={router} />;
      case "inbox": return <InboxView archive={archive} commit={commit} notify={notify} preview={preview} router={router} />;
      case "cubes": return <CubesView archive={archive} commit={commit} notify={notify} router={router} pendingTrackId={pendingTrackId} />;
      case "cube": return <CubeView archive={archive} cubeId={queryId} commit={commit} notify={notify} preview={preview} router={router} hydrated={hydrated} />;
      case "context": return <ContextView archive={archive} cubeTrackId={queryId} commit={commit} notify={notify} preview={preview} router={router} hydrated={hydrated} />;
      case "search": return <ArchiveSearchView archive={archive} preview={preview} />;
      case "recap": return <RecapView archive={archive} preview={preview} />;
      case "world": return <WorldView archive={archive} reduceMotion={reduceMotion} router={router} />;
      case "settings": return <SettingsView archive={archive} commit={commit} notify={notify} storageBlocked={storageBlocked} setStorageBlocked={setStorageBlocked} />;
      default: return <HomeView archive={archive} preview={preview} />;
    }
  })();

  return (
    <AppShell view={view} inboxCount={inboxEntries.length} preview={preview} toast={toast} online={online}>
      {storageBlocked ? (
        <div className="notice notice-danger" style={{ margin: "18px clamp(18px, 4vw, 64px) 0" }} role="alert">
          <span aria-hidden="true">!</span><div><strong>저장 데이터 보호 모드</strong><br />{storageBlocked}</div>
        </div>
      ) : null}
      {!online ? (
        <div className="notice notice-warning" style={{ margin: "18px clamp(18px, 4vw, 64px) 0" }} role="status">
          <span aria-hidden="true">⌁</span><div>오프라인이에요. 기존 기록은 볼 수 있지만 새 음악 검색과 미리듣기는 잠시 쉬어갑니다.</div>
        </div>
      ) : null}
      {content}
      {showWelcome ? (
        <div className="welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
          <div className="welcome-card">
            <span className="eyebrow">Welcome to MUMU</span>
            <h2 id="welcome-title">좋아했던 음악으로<br />나만의 세계를 만들어보세요.</h2>
            <p>완벽하게 정리하지 않아도 괜찮아요. 먼저 포착하고, 나중에 당신의 언어를 덧붙이면 됩니다.</p>
            <div className="welcome-steps" aria-label="서비스 이용 단계">
              <div className="welcome-step"><strong>01 · 포착</strong><span>마음에 남은 곡 저장</span></div>
              <div className="welcome-step"><strong>02 · 해석</strong><span>태그와 기억 덧붙이기</span></div>
              <div className="welcome-step"><strong>03 · 재발견</strong><span>그 시절의 나 다시 만나기</span></div>
            </div>
            <div className="dialog-actions">
              <button className="button button-ghost" type="button" onClick={() => {
                const empty = createEmptyArchive();
                commit(empty, "빈 음악 세계에서 시작합니다.", true);
                setOnboardingDone();
              }}>빈 세계로 시작</button>
              <button className="button" type="button" onClick={setOnboardingDone}>샘플 세계 둘러보기</button>
              <button className="button button-primary" type="button" onClick={() => { setOnboardingDone(); router.push("/capture"); }}>내 첫 곡 저장하기</button>
            </div>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function HomeView({ archive, preview }: { archive: ArchiveEnvelopeV1; preview: PreviewControls }) {
  const cubes = Object.values(archive.data.cubes).sort((a, b) => a.sortOrder - b.sortOrder);
  const inbox = Object.values(archive.data.inbox).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  const recap = selectRecap(archive, { mode: "this-time", limit: 3 });
  const contextCount = Object.keys(archive.data.cubeTracks).length;
  const tagCount = Object.keys(archive.data.tags).length;
  return (
    <div className="page-content">
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">Your music, your universe</span>
          <h1>노래가 기억이 되고,<br /><span>기억이 세계가 되는 곳.</span></h1>
          <p>좋아했던 음악을 놓치지 말고 먼저 담아두세요. 한 곡에 여러 감정과 순간을 붙일수록 당신만의 음악 세계가 선명해집니다.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/capture">＋ 새로운 곡 포착하기</Link>
            <Link className="button" href="/world">음악 세계 산책하기 →</Link>
          </div>
        </div>
        <div className="hero-world" aria-hidden="true">
          <span className="hero-path" />
          <span className="hero-cube cube-one" />
          <span className="hero-cube cube-two" />
          <span className="hero-cube cube-three" />
          <span className="hero-avatar" />
        </div>
      </section>

      <div className="stats-grid" aria-label="아카이브 요약">
        <div className="stat-card"><span>나의 큐브</span><strong>{cubes.length}</strong></div>
        <div className="stat-card"><span>기억한 순간</span><strong>{contextCount}</strong></div>
        <div className="stat-card"><span>나만의 태그</span><strong>{tagCount}</strong></div>
        <div className="stat-card"><span>기다리는 곡</span><strong>{inbox.length}</strong></div>
      </div>

      <section className="section">
        <div className="section-head"><div><h2>내 음악 큐브</h2><p>시기와 감정마다 다른 음악의 표정</p></div><Link className="text-link" href="/cubes">전체 보기 →</Link></div>
        {cubes.length ? <div className="card-grid">{cubes.slice(0, 3).map((cube) => <CubeCard key={cube.id} archive={archive} cube={cube} />)}</div> : <EmptyState icon="◇" title="아직 큐브가 없어요" copy="첫 번째 음악 순간의 이름을 지어보세요." action={<Link className="button button-primary" href="/cubes">첫 큐브 만들기</Link>} />}
      </section>

      <section className="section">
        <div className="section-head"><div><h2>이어서 기록하기</h2><p>먼저 포착해둔 곡은 천천히 정리해도 괜찮아요.</p></div><Link className="text-link" href="/inbox">보관함 열기 →</Link></div>
        {inbox.length ? <div className="track-list">{inbox.slice(0, 2).map((entry, index) => {
          const track = archive.data.tracks[entry.trackId];
          return track ? <TrackRow key={entry.trackId} track={track} index={index} preview={preview} context={`${formatDate(entry.capturedAt)}에 포착 · 아직 미분류`} actions={<Link className="button" href="/inbox">기록 채우기</Link>} /> : null;
        })}</div> : <EmptyState icon="✓" title="기다리는 곡이 없어요" copy="모든 곡이 저마다의 큐브를 찾았습니다." />}
      </section>

      <section className="section">
        <div className="section-head"><div><h2>이맘때의 음악</h2><p>시간을 건너 다시 도착한 그 시절의 노래</p></div><Link className="text-link" href="/recap">회고 더 보기 →</Link></div>
        {recap.length ? <div className="track-list">{recap.map((entry, index) => <TrackRow key={entry.cubeTrack.id} track={entry.track} index={index + 2} preview={preview} tags={entry.tags} context={`${entry.cube.name} · ${formatMemory(entry.cubeTrack.memoryPeriod)}`} actions={<Link className="button" href={`/context?id=${encodeURIComponent(entry.cubeTrack.id)}`}>기억 보기</Link>} />)}</div> : <EmptyState icon="◷" title="아직 돌아올 기억이 적어요" copy="곡에 시기나 계절을 남기면 이곳에서 다시 만날 수 있어요." />}
      </section>
    </div>
  );
}

function CaptureView({ archive, commit, preview, online, router }: { archive: ArchiveEnvelopeV1; commit: (next: ArchiveEnvelopeV1, message?: string) => boolean; preview: PreviewControls; online: boolean; router: ReturnType<typeof useRouter> }) {
  const [musicUrl, setMusicUrl] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<TrackReference | null>(null);
  const [manualFallback, setManualFallback] = useState<ManualTrackFallback | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualAlbum, setManualAlbum] = useState("");
  const [resultSource, setResultSource] = useState<"link" | "search" | null>(null);
  const cubes = Object.values(archive.data.cubes).sort((a, b) => a.sortOrder - b.sortOrder);

  async function importLink(event: FormEvent) {
    event.preventDefault();
    if (!online) {
      setError("오프라인에서는 새 음악 링크를 가져올 수 없어요.");
      return;
    }
    setLinkLoading(true);
    setError(null);
    setManualFallback(null);
    try {
      const response = await fetch(`/api/music-metadata?url=${encodeURIComponent(musicUrl.trim())}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as MusicMetadataApiResponse;
      if (payload.status === "error") {
        setError(payload.error.message);
        return;
      }
      if (payload.status === "manual") {
        setManualFallback(payload.fallback);
        setManualTitle(payload.fallback.suggested.title);
        setManualArtist(payload.fallback.suggested.artist);
        setManualAlbum(payload.fallback.suggested.album);
        return;
      }
      setResults([payload.track]);
      setResultSource("link");
    } catch {
      setError("링크 정보를 가져오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setLinkLoading(false);
    }
  }

  function finishManualImport(event: FormEvent) {
    event.preventDefault();
    if (!manualFallback) return;
    const track = completeManualTrack(manualFallback, {
      title: manualTitle,
      artist: manualArtist,
      album: manualAlbum,
    });
    setResults([track]);
    setResultSource("link");
    setManualFallback(null);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!online) {
      setError("오프라인에서는 새 음악을 검색할 수 없어요.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setResults(await searchItunesTracks(query));
      setResultSource("search");
    } catch (cause) {
      if (cause instanceof ItunesSearchError && cause.code === "stale") return;
      setError(cause instanceof Error ? cause.message : "검색 중 문제가 생겼어요.");
    } finally {
      setLoading(false);
    }
  }

  function saveInbox(track: TrackReference) {
    const already = Boolean(archive.data.inbox[track.id]);
    const next = captureTrackToInbox(archive, track);
    commit(next, already ? "이미 임시 보관함에 있는 곡이에요." : "임시 보관함에 곡을 담았어요.");
  }

  function saveCube(track: TrackReference, cubeId: string) {
    const captured = captureTrack(archive, track);
    const result = captured.data.inbox[track.id]
      ? moveInboxTrackToCube(captured, track.id, cubeId)
      : addTrackToCube(captured, track.id, cubeId);
    if (commit(result.archive, result.added ? "새로운 순간으로 큐브에 담았어요." : "이미 있던 순간을 열었어요.")) {
      setAssigning(null);
      router.push(`/context?id=${encodeURIComponent(result.cubeTrack.id)}`);
    }
  }

  function createCubeForTrack(track: TrackReference) {
    const captured = captureTrackToInbox(archive, track);
    if (commit(captured, "곡을 잃지 않도록 먼저 보관했어요. 이제 큐브 이름만 정해 주세요.")) {
      setAssigning(null);
      router.push(`/cubes?trackId=${encodeURIComponent(track.id)}`);
    }
  }

  return (
    <div className="page-content">
      <PageHeader eyebrow="Capture" title="마음에 남은 곡을 포착하세요" copy="듣고 있던 음악 링크만 붙여넣으세요. 태그와 기억은 지금 쓰지 않아도 됩니다." />
      <section className="search-panel">
        <span className="eyebrow">Quick link capture</span>
        <h2 style={{ margin: 0, fontSize: "clamp(24px, 4vw, 38px)" }}>음악 링크로 먼저 저장하세요</h2>
        <form className="search-form" onSubmit={importLink}>
          <label className="sr-only" htmlFor="music-url">음악 공유 링크</label>
          <input id="music-url" className="input" type="url" value={musicUrl} onChange={(event) => setMusicUrl(event.target.value)} placeholder="Spotify · Apple Music · YouTube · Melon 링크" required autoComplete="url" />
          <button className="button button-cyan" type="submit" disabled={linkLoading || !online}>{linkLoading ? <LoadingDots /> : "링크 가져오기"}</button>
        </form>
        <p className="legal-note">Apple Music·YouTube는 정보를 자동으로 채웁니다. Spotify·Melon에서 정보가 부족하면 원본 링크를 보존한 채 곡명과 아티스트만 확인받아요.</p>
      </section>

      {manualFallback ? <form className="panel form-stack manual-import" onSubmit={finishManualImport} aria-labelledby="manual-import-title"><div><span className="eyebrow">링크는 안전하게 보관했어요</span><h2 id="manual-import-title">부족한 곡 정보만 채워주세요</h2><p className="field-hint">메타데이터를 불러오지 못해도 입력한 원본 링크와 이후의 기억은 유지됩니다.</p></div><div className="form-grid"><div className="field"><label htmlFor="manual-title">곡명 *</label><input id="manual-title" className="input" value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} maxLength={200} required /></div><div className="field"><label htmlFor="manual-artist">아티스트 *</label><input id="manual-artist" className="input" value={manualArtist} onChange={(event) => setManualArtist(event.target.value)} maxLength={200} required /></div></div><div className="field"><label htmlFor="manual-album">앨범 · 선택</label><input id="manual-album" className="input" value={manualAlbum} onChange={(event) => setManualAlbum(event.target.value)} maxLength={200} /></div><div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setManualFallback(null)}>취소</button><button className="button button-primary" type="submit">이 곡 확인하기</button></div></form> : null}

      <section className="panel capture-search-panel">
        <span className="eyebrow">iTunes music search</span>
        <h2 style={{ margin: 0, fontSize: "clamp(22px, 3vw, 30px)" }}>링크가 없다면 곡명으로 찾아보세요</h2>
        <form className="search-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="itunes-query">곡명 또는 아티스트</label>
          <input id="itunes-query" className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: The Volunteers Radio" minLength={2} />
          <button className="button button-cyan" type="submit" disabled={loading || !online}>{loading ? <LoadingDots /> : "음악 찾기"}</button>
        </form>
        <p className="legal-note">검색 결과와 30초 미리듣기는 iTunes에서 제공됩니다. 검색은 버튼을 눌렀을 때만 실행됩니다.</p>
      </section>

      {error ? <div className="notice notice-danger" style={{ marginTop: 18 }} role="alert">! {error}</div> : null}

      <section className="section">
        <div className="section-head"><div><h2>{results.length ? `${resultSource === "link" ? "가져온 음악" : "검색 결과"} ${results.length}곡` : "가져온 음악"}</h2><p>일단 저장하거나 바로 큐브를 골라 당신의 언어를 덧붙일 수 있어요.</p></div></div>
        {results.length ? <div className="track-list">{results.map((track, index) => {
          const contexts = Object.values(archive.data.cubeTracks).filter((entry) => entry.trackId === track.id);
          return <TrackRow key={track.id} track={track} index={index} preview={preview} context={contexts.length ? `이미 ${contexts.length}개의 순간에 기록됨` : track.genre || "장르 정보 없음"} actions={<>{!track.previewUrl && track.externalUrl ? <a className="button button-ghost" href={track.externalUrl} target="_blank" rel="noopener noreferrer">원본 열기 ↗</a> : null}<button className="button" type="button" onClick={() => saveInbox(track)}>일단 저장</button><button className="button button-primary" type="button" onClick={() => setAssigning(track)}>큐브에 담기</button></>} />;
        })}</div> : <EmptyState icon="⌕" title="기억하고 싶은 음악 링크를 붙여넣어 보세요" copy="링크가 없다면 곡명과 아티스트로 검색할 수도 있어요." />}
      </section>

      {assigning ? (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="assign-title">
          <div className="dialog">
            <span className="eyebrow">새로운 순간</span>
            <h2 id="assign-title">어느 큐브에 담을까요?</h2>
            <p>{assigning.artist} · {assigning.title}</p>
            <div className="track-list" style={{ marginTop: 22 }}>
              {cubes.map((cube) => <button key={cube.id} className="track-row" type="button" onClick={() => saveCube(assigning, cube.id)} style={{ textAlign: "left", cursor: "pointer" }}><span className="cube-mini-art" style={cubeStyle(cube.color)} aria-hidden="true"><span /><span /><span /><span /></span><span className="track-info"><strong>{cube.name}</strong><small>{cube.description || "설명 없음"}</small></span><span>→</span></button>)}
            </div>
            {!cubes.length ? <p className="notice notice-warning">먼저 큐브를 하나 만들어 주세요.</p> : null}
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setAssigning(null)}>취소</button><button className="button" type="button" onClick={() => createCubeForTrack(assigning)}>새 큐브 만들기</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InboxView({ archive, commit, notify, preview, router }: { archive: ArchiveEnvelopeV1; commit: (next: ArchiveEnvelopeV1, message?: string) => boolean; notify: (message: string) => void; preview: PreviewControls; router: ReturnType<typeof useRouter> }) {
  const entries = Object.values(archive.data.inbox).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)).sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const cubes = Object.values(archive.data.cubes).sort((a, b) => a.sortOrder - b.sortOrder);
  const [selectedTrack, setSelectedTrack] = useState<TrackId | null>(null);

  function assign(trackId: TrackId, cubeId: string) {
    try {
      const result = moveInboxTrackToCube(archive, trackId, cubeId);
      if (commit(result.archive, result.added ? "곡이 큐브에서 새로운 순간을 찾았어요." : "이미 이 큐브에 있는 곡이라 보관함에서만 정리했어요.")) {
        setSelectedTrack(null);
        router.push(`/context?id=${encodeURIComponent(result.cubeTrack.id)}`);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "곡을 이동하지 못했어요.");
    }
  }

  return (
    <div className="page-content">
      <PageHeader eyebrow="Inbox" title="먼저 담아둔 음악" copy="지금은 분류하지 않아도 괜찮아요. 여유가 생겼을 때 한 곡씩 의미를 붙여보세요." action={<Link className="button button-primary" href="/capture">＋ 곡 더 담기</Link>} />
      {entries.length ? <div className="track-list">{entries.map((entry, index) => {
        const track = archive.data.tracks[entry.trackId];
        return track ? <TrackRow key={entry.trackId} track={track} index={index} preview={preview} context={`${formatDate(entry.capturedAt)} 포착 · 아직 미분류`} actions={<><button className="button button-primary" type="button" onClick={() => setSelectedTrack(track.id)}>기록 채우기</button><button className="button button-ghost" type="button" onClick={() => commit(removeInboxTrack(archive, track.id), "임시 보관함에서 곡을 꺼냈어요.")}>제거</button></>} /> : null;
      })}</div> : <EmptyState icon="⌄" title="아직 기다리는 곡이 없어요" copy="마음에 남는 노래를 발견하면 완벽하게 정리하지 말고 먼저 담아두세요." action={<Link className="button button-primary" href="/capture">첫 곡 포착하기</Link>} />}

      {selectedTrack ? (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="inbox-assign-title">
          <div className="dialog">
            <span className="eyebrow">큐브 선택</span><h2 id="inbox-assign-title">이 곡이 머물 순간은?</h2><p>큐브를 고른 뒤 태그와 기억은 천천히 채울 수 있어요.</p>
            <div className="track-list" style={{ marginTop: 22 }}>{cubes.map((cube) => <button key={cube.id} className="track-row" type="button" onClick={() => assign(selectedTrack, cube.id)} style={{ textAlign: "left", cursor: "pointer" }}><span className="cube-mini-art" style={cubeStyle(cube.color)} aria-hidden="true"><span /><span /><span /><span /></span><span className="track-info"><strong>{cube.name}</strong><small>{getCubeTracks(archive, cube.id).length}곡</small></span><span>→</span></button>)}</div>
            {!cubes.length ? <div className="notice notice-warning">먼저 큐브를 만들어 주세요.</div> : null}
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setSelectedTrack(null)}>취소</button><Link className="button" href={`/cubes?trackId=${encodeURIComponent(selectedTrack)}`}>새 큐브 만들기</Link></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CubesView({ archive, commit, notify, router, pendingTrackId }: { archive: ArchiveEnvelopeV1; commit: (next: ArchiveEnvelopeV1, message?: string) => boolean; notify: (message: string) => void; router: ReturnType<typeof useRouter>; pendingTrackId: TrackId | null }) {
  const cubes = Object.values(archive.data.cubes).sort((a, b) => a.sortOrder - b.sortOrder);
  const pendingTrack = pendingTrackId ? archive.data.tracks[pendingTrackId] : null;
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<CubeColor>("violet");
  const [deleteTarget, setDeleteTarget] = useState<Cube | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = createCube(archive, { name, description, color });
      const linked = pendingTrack
        ? (result.archive.data.inbox[pendingTrack.id]
          ? moveInboxTrackToCube(result.archive, pendingTrack.id, result.cube.id)
          : addTrackToCube(result.archive, pendingTrack.id, result.cube.id))
        : null;
      const next = linked?.archive ?? result.archive;
      if (commit(next, pendingTrack ? `‘${result.cube.name}’에 곡을 담았어요. 이제 이 곡의 표정을 남겨보세요.` : `‘${result.cube.name}’ 큐브를 만들었어요.`)) {
        setName(""); setDescription(""); setColor("violet"); setShowForm(false);
        if (linked) router.push(`/context?id=${encodeURIComponent(linked.cubeTrack.id)}`);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "큐브를 만들지 못했어요.");
    }
  }

  return (
    <div className="page-content">
      <PageHeader eyebrow="My cubes" title="내 음악 큐브" copy="플레이리스트 제목 하나로는 담기 어려웠던 시기, 장소, 감정의 이름을 붙여보세요." action={<button className="button button-primary" type="button" onClick={() => setShowForm(true)}>＋ 새 큐브</button>} />
      {cubes.length ? <div className="card-grid">{cubes.map((cube) => <CubeCard key={cube.id} archive={archive} cube={cube} onDelete={setDeleteTarget} />)}</div> : <EmptyState icon="◇" title="첫 큐브의 이름을 지어주세요" copy="‘새벽 드라이브’, ‘2018년 겨울’, ‘첫 자취방’처럼 음악이 머문 장면이면 충분해요." action={<button className="button button-primary" type="button" onClick={() => setShowForm(true)}>첫 큐브 만들기</button>} />}

      {showForm || pendingTrack ? (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-cube-title">
          <form className="dialog" onSubmit={submit}>
            <span className="eyebrow">New cube</span><h2 id="create-cube-title">{pendingTrack ? `‘${pendingTrack.title}’이 머물 순간은?` : "이 순간의 이름은?"}</h2><p>{pendingTrack ? "큐브를 만들면 곧바로 태그와 기억을 남기는 화면으로 이어집니다." : "이름만 정하면 바로 시작할 수 있어요."}</p>
            <div className="form-stack" style={{ marginTop: 24 }}>
              <div className="field"><label htmlFor="cube-name">큐브 이름 *</label><input id="cube-name" className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="예: 비 오는 날의 버스" autoFocus /></div>
              <div className="field"><label htmlFor="cube-description">짧은 설명</label><textarea id="cube-description" className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} placeholder="이 큐브에 담고 싶은 음악의 장면" /></div>
              <div className="field"><span className="field-label">분위기 색상</span><div className="filter-row">{CUBE_COLORS.map((item) => <button key={item} className={`tag${color === item ? " is-selected" : ""}`} type="button" onClick={() => setColor(item)} style={{ borderColor: COLOR_HEX[item] }} aria-pressed={color === item}>{COLOR_LABEL[item]}</button>)}</div></div>
            </div>
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => { setShowForm(false); if (pendingTrack) router.replace("/cubes"); }}>취소</button><button className="button button-primary" type="submit">{pendingTrack ? "큐브 만들고 기록하기" : "큐브 만들기"}</button></div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="dialog-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="delete-cube-title">
          <div className="dialog"><span className="eyebrow">Delete cube</span><h2 id="delete-cube-title">‘{deleteTarget.name}’을 지울까요?</h2><p>이 큐브의 {getCubeTracks(archive, deleteTarget.id).length}개 맥락 기록은 삭제되지만 다른 큐브의 같은 곡은 그대로 남습니다.</p><div className="dialog-actions"><button className="button" type="button" onClick={() => setDeleteTarget(null)}>취소</button><button className="button button-danger" type="button" onClick={() => { commit(deleteCube(archive, deleteTarget.id), "큐브를 삭제했어요."); setDeleteTarget(null); }}>삭제하기</button></div></div>
        </div>
      ) : null}
    </div>
  );
}

function CubeView({ archive, cubeId, commit, notify, preview, router, hydrated }: { archive: ArchiveEnvelopeV1; cubeId: string | null; commit: (next: ArchiveEnvelopeV1, message?: string) => boolean; notify: (message: string) => void; preview: PreviewControls; router: ReturnType<typeof useRouter>; hydrated: boolean }) {
  const cube = cubeId ? archive.data.cubes[cubeId] : null;
  const entries = cube ? getCubeTracks(archive, cube.id) : [];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<CubeColor>("violet");

  if (!hydrated || !cubeId) return <div className="page-content"><EmptyState icon="…" title="큐브를 불러오고 있어요" copy="잠시만 기다려 주세요." /></div>;
  if (!cube) return <div className="page-content"><EmptyState icon="?" title="큐브를 찾을 수 없어요" copy="삭제됐거나 이 기기에 없는 큐브입니다." action={<Link className="button" href="/cubes">큐브 목록으로</Link>} /></div>;
  const activeCube = cube;

  const allTags = entries.flatMap((entry) => entry.tags);
  const topTags = [...new Map(allTags.map((tag) => [tag.id, tag])).values()].slice(0, 8);

  function saveCube(event: FormEvent) {
    event.preventDefault();
    try {
      const next = updateCube(archive, activeCube.id, { name, description, color });
      if (commit(next, "큐브의 분위기를 저장했어요.")) setEditing(false);
    } catch (error) { notify(error instanceof Error ? error.message : "큐브를 수정하지 못했어요."); }
  }

  function openEditor() {
    setName(activeCube.name);
    setDescription(activeCube.description);
    setColor(activeCube.color);
    setEditing(true);
  }

  function move(entry: CubeTrack, direction: -1 | 1) {
    const ids = entries.map((item) => item.cubeTrack.id);
    const from = ids.indexOf(entry.id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    commit(reorderCubeTracks(archive, activeCube.id, ids), "곡 순서를 바꿨어요.");
  }

  function removeEntry(entry: CubeTrack, title: string) {
    if (!window.confirm(`‘${title}’의 이 큐브 태그와 기억을 삭제할까요? 다른 큐브의 기록은 남습니다.`)) return;
    commit(removeCubeTrack(archive, entry.id), "이 큐브에서 곡과 맥락 기록을 삭제했어요.");
  }

  return (
    <div className="page-content">
      <PageHeader eyebrow="Inside the cube" title={cube.name} copy={cube.description || "이 순간에 담긴 음악과 기억"} action={<div className="track-actions"><button className="button" type="button" onClick={openEditor}>큐브 꾸미기</button><Link className="button button-primary" href="/capture">＋ 곡 추가</Link></div>} />
      <div className="stats-grid"><div className="stat-card"><span>담긴 곡</span><strong>{entries.length}</strong></div><div className="stat-card"><span>남긴 태그</span><strong>{new Set(allTags.map((tag) => tag.id)).size}</strong></div><div className="stat-card"><span>기억 메모</span><strong>{entries.filter((entry) => entry.cubeTrack.memo).length}</strong></div><div className="stat-card"><span>다른 순간</span><strong>{entries.filter((entry) => Object.values(archive.data.cubeTracks).filter((item) => item.trackId === entry.track.id).length > 1).length}</strong></div></div>
      {topTags.length ? <div className="filter-row" style={{ marginTop: 18 }}>{topTags.map((tag) => <span className="tag" key={tag.id}>#{tag.label}</span>)}</div> : null}
      <section className="section">
        <div className="section-head"><div><h2>이 큐브의 음악</h2><p>같은 곡도 이 큐브 안에서는 고유한 태그와 기억을 가집니다.</p></div></div>
        {entries.length ? <div className="track-list">{entries.map((entry, index) => {
          const otherMoments = Object.values(archive.data.cubeTracks).filter((item) => item.trackId === entry.track.id && item.id !== entry.cubeTrack.id).length;
          return <TrackRow key={entry.cubeTrack.id} track={entry.track} index={index} preview={preview} tags={entry.tags} context={entry.cubeTrack.character || `${formatMemory(entry.cubeTrack.memoryPeriod)}${otherMoments ? ` · 다른 순간 ${otherMoments}개` : ""}`} actions={<><Link className="button" href={`/context?id=${encodeURIComponent(entry.cubeTrack.id)}`}>맥락 편집</Link><button className="button icon-button button-ghost" type="button" disabled={index === 0} onClick={() => move(entry.cubeTrack, -1)} aria-label="위로 이동">↑</button><button className="button icon-button button-ghost" type="button" disabled={index === entries.length - 1} onClick={() => move(entry.cubeTrack, 1)} aria-label="아래로 이동">↓</button><button className="button icon-button button-ghost" type="button" onClick={() => removeEntry(entry.cubeTrack, entry.track.title)} aria-label="이 큐브의 곡과 맥락 삭제">×</button></>} />;
        })}</div> : <EmptyState icon="♪" title="이 순간의 첫 곡을 담아보세요" copy="곡을 담는 것만으로 시작할 수 있어요. 태그와 기억은 나중에 추가하세요." action={<Link className="button button-primary" href="/capture">곡 찾기</Link>} />}
      </section>

      {editing ? <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-cube-title"><form className="dialog" onSubmit={saveCube}><span className="eyebrow">Edit cube</span><h2 id="edit-cube-title">큐브의 분위기</h2><div className="form-stack" style={{ marginTop: 24 }}><div className="field"><label htmlFor="edit-name">이름</label><input className="input" id="edit-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /></div><div className="field"><label htmlFor="edit-description">설명</label><textarea className="textarea" id="edit-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} /></div><div className="field"><span className="field-label">색상</span><div className="filter-row">{CUBE_COLORS.map((item) => <button key={item} className={`tag${color === item ? " is-selected" : ""}`} type="button" onClick={() => setColor(item)} aria-pressed={color === item}>{COLOR_LABEL[item]}</button>)}</div></div></div><div className="dialog-actions"><button className="button" type="button" onClick={() => setEditing(false)}>취소</button><button className="button button-primary" type="submit">저장</button></div></form></div> : null}
      <button className="button button-ghost" style={{ marginTop: 38 }} type="button" onClick={() => router.push("/cubes")}>← 큐브 목록으로</button>
    </div>
  );
}

function ContextView({ archive, cubeTrackId, commit, notify, preview, router, hydrated }: { archive: ArchiveEnvelopeV1; cubeTrackId: string | null; commit: (next: ArchiveEnvelopeV1, message?: string) => boolean; notify: (message: string) => void; preview: PreviewControls; router: ReturnType<typeof useRouter>; hydrated: boolean }) {
  const cubeTrack = cubeTrackId ? archive.data.cubeTracks[cubeTrackId] : null;
  const track = cubeTrack ? archive.data.tracks[cubeTrack.trackId] : null;
  const cube = cubeTrack ? archive.data.cubes[cubeTrack.cubeId] : null;
  const currentTags = cubeTrack ? cubeTrack.tagIds.map((id) => archive.data.tags[id]).filter((tag): tag is TagDefinition => Boolean(tag)) : [];
  const [labels, setLabels] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [character, setCharacter] = useState("");
  const [periodKind, setPeriodKind] = useState<"none" | "month" | "season">("none");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("1");
  const [season, setSeason] = useState<keyof typeof SEASON_LABEL>("spring");
  const [place, setPlace] = useState("");
  const [people, setPeople] = useState("");
  const [memo, setMemo] = useState("");
  const [assigning, setAssigning] = useState(false);
  const recentTags = useMemo(() => {
    const seen = new Set<string>();
    const tags: TagDefinition[] = [];
    Object.values(archive.data.cubeTracks)
      .filter((item) => item.id !== cubeTrackId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .forEach((item) => item.tagIds.forEach((tagId) => {
        const tag = archive.data.tags[tagId];
        if (!tag || seen.has(tag.normalizedLabel)) return;
        seen.add(tag.normalizedLabel);
        tags.push(tag);
      }));
    return tags.slice(0, 8);
  }, [archive, cubeTrackId]);
  const matchingTags = useMemo(() => {
    const needle = normalizeTagLabel(customTag);
    if (!needle) return [];
    return Object.values(archive.data.tags)
      .filter((tag) => tag.normalizedLabel.includes(needle) && !labels.some((label) => normalizeTagLabel(label) === tag.normalizedLabel))
      .slice(0, 6);
  }, [archive.data.tags, customTag, labels]);

  useEffect(() => {
    if (!cubeTrack) return;
    const hydrationTimer = window.setTimeout(() => {
      setLabels(currentTags.map((tag) => tag.label));
      setCharacter(cubeTrack.character);
      setPlace(cubeTrack.place);
      setPeople(cubeTrack.people);
      setMemo(cubeTrack.memo);
      if (cubeTrack.memoryPeriod) {
        setPeriodKind(cubeTrack.memoryPeriod.kind);
        setYear(cubeTrack.memoryPeriod.year?.toString() ?? "");
        if (cubeTrack.memoryPeriod.kind === "month") setMonth(String(cubeTrack.memoryPeriod.month));
        else setSeason(cubeTrack.memoryPeriod.season);
      } else setPeriodKind("none");
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubeTrackId]);

  if (!hydrated || !cubeTrackId) return <div className="page-content"><EmptyState icon="…" title="곡의 기억을 불러오고 있어요" copy="잠시만 기다려 주세요." /></div>;
  if (!cubeTrack || !track || !cube) return <div className="page-content"><EmptyState icon="?" title="곡의 맥락을 찾을 수 없어요" copy="삭제됐거나 이 기기에 없는 기록입니다." action={<Link className="button" href="/cubes">큐브 목록으로</Link>} /></div>;
  const activeCubeTrack = cubeTrack;
  const activeTrack = track;
  const activeCube = cube;

  function toggleTag(label: string) {
    setLabels((current) => current.includes(label) ? current.filter((item) => item !== label) : [...current, label].slice(0, 20));
  }

  function addCustomTag() {
    const clean = customTag.trim();
    if (!clean) return;
    if (!labels.some((item) => item.normalize("NFKC").toLocaleLowerCase("ko-KR") === clean.normalize("NFKC").toLocaleLowerCase("ko-KR"))) setLabels((current) => [...current, clean].slice(0, 20));
    setCustomTag("");
  }

  function save(event: FormEvent) {
    event.preventDefault();
    let memoryPeriod: MemoryPeriod = null;
    const parsedYear = year ? Number(year) : null;
    if (periodKind === "month") memoryPeriod = { kind: "month", year: parsedYear, month: Number(month) };
    if (periodKind === "season") memoryPeriod = { kind: "season", year: parsedYear, season };
    try {
      const withDetails = updateCubeTrack(archive, activeCubeTrack.id, { character, memoryPeriod, place, people, memo });
      const tagInputs = labels.map((label) => {
        const normalized = normalizeTagLabel(label);
        const existing = Object.values(archive.data.tags).find((tag) => tag.normalizedLabel === normalized);
        const suggestion = TAG_SUGGESTIONS.find((tag) => normalizeTagLabel(tag.label) === normalized);
        return { label, category: existing?.category ?? suggestion?.category ?? "custom" };
      });
      const withTags = setCubeTrackTags(withDetails, activeCubeTrack.id, tagInputs);
      if (commit(withTags, "이 곡의 새로운 표정을 저장했어요.")) router.push(`/cube?id=${encodeURIComponent(activeCube.id)}`);
    } catch (error) { notify(error instanceof Error ? error.message : "기억을 저장하지 못했어요."); }
  }

  function addToOtherCube(targetCubeId: string) {
    const result = addTrackToCube(archive, activeTrack.id, targetCubeId);
    if (commit(result.archive, result.added ? "같은 곡을 새로운 순간에 담았어요. 태그는 빈 상태로 시작합니다." : "이미 있던 순간을 열었어요.")) {
      setAssigning(false);
      router.push(`/context?id=${encodeURIComponent(result.cubeTrack.id)}`);
    }
  }

  return (
    <div className="page-content">
      <PageHeader eyebrow={cube.name} title={`‘${track.title}’은 이 순간 어떤 음악인가요?`} copy="같은 곡도 순간마다 다르게 느껴집니다. 이 기록은 다른 큐브에 영향을 주지 않아요." />
      <div className="split-layout">
        <form className="panel form-stack" onSubmit={save}>
          <div className="field"><span className="field-label">추천 태그 · 여러 개 선택 가능</span><div className="filter-row">{TAG_SUGGESTIONS.map(({ label, category }) => <button key={label} className={`tag${labels.includes(label) ? " is-selected" : ""}`} type="button" onClick={() => toggleTag(label)} aria-pressed={labels.includes(label)}>#{label}<small className="tag-kind">{TAG_CATEGORY_LABEL[category]}</small></button>)}</div></div>
          {recentTags.length ? <div className="field"><span className="field-label">최근에 쓴 나의 태그</span><div className="filter-row">{recentTags.map((tag) => <button key={tag.id} className={`tag${labels.some((label) => normalizeTagLabel(label) === tag.normalizedLabel) ? " is-selected" : ""}`} type="button" onClick={() => toggleTag(tag.label)} aria-pressed={labels.some((label) => normalizeTagLabel(label) === tag.normalizedLabel)}>#{tag.label}</button>)}</div></div> : null}
          {labels.length ? <div className="field"><span className="field-label">선택한 나의 태그</span><div className="tag-row">{labels.map((label) => <span className="tag" key={label}>#{label}<button className="tag-remove" type="button" onClick={() => toggleTag(label)} aria-label={`${label} 태그 제거`}>×</button></span>)}</div></div> : null}
          <div className="field"><label htmlFor="custom-tag">나만의 태그</label><div className="search-form" style={{ marginTop: 0 }}><input id="custom-tag" className="input" value={customTag} onChange={(event) => setCustomTag(event.target.value)} maxLength={40} placeholder="예: 불안했던 청춘" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomTag(); } }} /><button className="button" type="button" onClick={addCustomTag}>태그 추가</button></div>{matchingTags.length ? <div className="filter-row" style={{ marginTop: 8 }} aria-label="비슷한 기존 태그">{matchingTags.map((tag) => <button className="tag" type="button" key={tag.id} onClick={() => toggleTag(tag.label)}>기존 #{tag.label}</button>)}</div> : null}</div>
          <div className="field"><label htmlFor="character">성격 문장</label><input id="character" className="input" value={character} onChange={(event) => setCharacter(event.target.value)} maxLength={100} placeholder="예: 차갑지만 이상하게 나를 안심시키는 곡" /></div>
          <div className="field"><span className="field-label">기억한 시기</span><div className="form-grid"><select className="select" value={periodKind} onChange={(event) => setPeriodKind(event.target.value as typeof periodKind)} aria-label="기억한 시기 종류"><option value="none">시기 없음</option><option value="month">연도 + 월</option><option value="season">연도 + 계절</option></select>{periodKind !== "none" ? <input className="input" value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="연도 (선택)" aria-label="기억한 연도" /> : null}{periodKind === "month" ? <select className="select" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="기억한 월">{Array.from({ length: 12 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}월</option>)}</select> : null}{periodKind === "season" ? <select className="select" value={season} onChange={(event) => setSeason(event.target.value as keyof typeof SEASON_LABEL)} aria-label="기억한 계절">{Object.entries(SEASON_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select> : null}</div></div>
          <div className="form-grid"><div className="field"><label htmlFor="place">장소</label><input id="place" className="input" value={place} onChange={(event) => setPlace(event.target.value)} maxLength={60} placeholder="첫 자취방, 한강변…" /></div><div className="field"><label htmlFor="people">함께한 사람</label><input id="people" className="input" value={people} onChange={(event) => setPeople(event.target.value)} maxLength={60} placeholder="친구, 혼자, 가족…" /></div></div>
          <div className="field"><label htmlFor="memo">기억 메모</label><textarea id="memo" className="textarea" value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={1000} placeholder="이 곡을 들으면 떠오르는 장면을 자유롭게 남겨보세요." /><span className="field-hint">{memo.length} / 1,000</span></div>
          <div className="dialog-actions"><button className="button" type="button" onClick={() => router.push(`/cube?id=${encodeURIComponent(cube.id)}`)}>취소</button><button className="button" type="button" onClick={() => setAssigning(true)}>다른 큐브에도 담기</button><button className="button button-primary" type="submit">이 순간 저장하기</button></div>
        </form>
        <aside className="panel sticky-panel context-track-panel"><TrackArtwork track={track} /><h2 style={{ marginBottom: 3 }}>{track.title}</h2><p style={{ margin: 0, color: "var(--muted)" }}>{track.artist}{track.album ? ` · ${track.album}` : ""}</p><div style={{ marginTop: 18 }}><PreviewButton track={track} preview={preview} /></div>{track.provider === "itunes" ? <p className="legal-note">{ITUNES_PREVIEW_USAGE_NOTICE}</p> : null}{track.externalUrl ? <a className="text-link" href={track.externalUrl} target="_blank" rel="noopener noreferrer">원본 음악에서 열기 ↗</a> : null}<div className="notice" style={{ marginTop: 20 }}><span>이 페이지의 태그와 기억은 <strong>{cube.name}</strong> 큐브에만 저장됩니다.</span></div></aside>
      </div>

      {assigning ? <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="other-cube-title"><div className="dialog"><span className="eyebrow">Another moment</span><h2 id="other-cube-title">새로운 순간을 고르세요</h2><p>곡 정보만 공유하고 태그와 기억은 빈 상태로 시작합니다.</p><div className="track-list" style={{ marginTop: 22 }}>{Object.values(archive.data.cubes).filter((item) => item.id !== cube.id).map((item) => <button className="track-row" key={item.id} type="button" onClick={() => addToOtherCube(item.id)} style={{ textAlign: "left", cursor: "pointer" }}><span className="cube-mini-art" style={cubeStyle(item.color)} aria-hidden="true"><span /><span /><span /><span /></span><span className="track-info"><strong>{item.name}</strong><small>{getCubeTracks(archive, item.id).length}곡</small></span><span>→</span></button>)}</div><div className="dialog-actions"><button className="button" type="button" onClick={() => setAssigning(false)}>닫기</button></div></div></div> : null}
    </div>
  );
}

function ArchiveSearchView({ archive, preview }: { archive: ArchiveEnvelopeV1; preview: PreviewControls }) {
  const [query, setQuery] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const tags = Object.values(archive.data.tags).sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const results = searchArchive(archive, { query, tagIds, includeInbox: true });
  function toggle(id: string) { setTagIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]); }
  return (
    <div className="page-content">
      <PageHeader eyebrow="Search my archive" title="내 언어로 음악을 다시 찾기" copy="곡명보다 감정과 장면이 먼저 떠오를 때, 여러 태그를 겹쳐 검색해보세요." />
      <div className="panel form-stack">
        <div className="field"><label htmlFor="archive-query">곡명, 아티스트, 큐브, 기억 검색</label><input id="archive-query" className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="예: 겨울, 새벽, Radio" /></div>
        <div className="field"><span className="field-label">태그 필터 · 선택한 태그를 모두 포함</span><div className="filter-row">{tags.length ? tags.map((tag) => <button key={tag.id} className={`tag${tagIds.includes(tag.id) ? " is-selected" : ""}`} type="button" onClick={() => toggle(tag.id)} aria-pressed={tagIds.includes(tag.id)}>#{tag.label}</button>) : <span className="field-hint">기록한 태그가 아직 없어요.</span>}</div></div>
        {(query || tagIds.length) ? <button className="button button-ghost" type="button" onClick={() => { setQuery(""); setTagIds([]); }}>필터 초기화</button> : null}
      </div>
      <section className="section"><div className="section-head"><div><h2>검색 결과 {results.length}</h2><p>같은 곡이라도 큐브별 맥락을 각각 보여줍니다.</p></div></div>{results.length ? <div className="track-list">{results.map((result, index) => <SearchResultRow result={result} key={result.kind === "inbox" ? `inbox:${result.track.id}` : result.cubeTrack.id} index={index} preview={preview} />)}</div> : <EmptyState icon="⌕" title="조건에 맞는 기억을 찾지 못했어요" copy="검색어를 줄이거나 태그를 하나씩 해제해보세요." />}</section>
    </div>
  );
}

function SearchResultRow({ result, index, preview }: { result: ArchiveSearchResult; index: number; preview: PreviewControls }) {
  if (result.kind === "inbox") return <TrackRow track={result.track} index={index} preview={preview} context="임시 보관함 · 아직 미분류" actions={<Link className="button" href="/inbox">기록하기</Link>} />;
  return <TrackRow track={result.track} index={index} preview={preview} tags={result.tags} context={`${result.cube.name} · ${result.cubeTrack.character || formatMemory(result.cubeTrack.memoryPeriod)}`} actions={<Link className="button" href={`/context?id=${encodeURIComponent(result.cubeTrack.id)}`}>이 순간 열기</Link>} />;
}

function RecapView({ archive, preview }: { archive: ArchiveEnvelopeV1; preview: PreviewControls }) {
  const [mode, setMode] = useState<RecapMode>("this-time");
  const entries = useMemo(() => selectRecap(archive, { mode, limit: 12 }), [archive, mode]);
  const label: Record<RecapMode, string> = { "this-time": "이맘때의 음악", timeline: "지난 계절의 나", random: "무작위 기억" };
  return (
    <div className="page-content">
      <PageHeader eyebrow="Recap" title="음악을 통해 과거의 나를 만나요" copy="저장한 곡이 아니라, 그 곡에 남겨둔 시기와 감정이 다시 돌아옵니다." />
      <div className="filter-row" role="group" aria-label="회고 방식">{(["this-time", "timeline", "random"] as RecapMode[]).map((item) => <button key={item} className={`button${mode === item ? " button-primary" : ""}`} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>{label[item]}</button>)}</div>
      <section className="section">{entries.length ? <div className="track-list">{entries.map((entry, index) => <RecapRow key={entry.cubeTrack.id} entry={entry} index={index} preview={preview} />)}</div> : <EmptyState icon="◷" title="아직 돌아올 기억이 부족해요" copy="곡의 맥락 편집에서 연도와 월 또는 계절을 남겨보세요." action={<Link className="button button-primary" href="/cubes">곡에 기억 남기기</Link>} />}</section>
    </div>
  );
}

function RecapRow({ entry, index, preview }: { entry: RecapEntry; index: number; preview: PreviewControls }) {
  const reason = { "same-month": "몇 년 전 같은 달", "same-season": "같은 계절의 기억", "saved-date": "저장했던 이맘때", random: "우연히 꺼낸 기억" }[entry.reason];
  return <TrackRow track={entry.track} index={index} preview={preview} tags={entry.tags} context={`${reason} · ${entry.cube.name} · ${formatMemory(entry.cubeTrack.memoryPeriod)}`} actions={<Link className="button" href={`/context?id=${encodeURIComponent(entry.cubeTrack.id)}`}>기억 열기</Link>} />;
}

function WorldView({ archive, reduceMotion, router }: { archive: ArchiveEnvelopeV1; reduceMotion: boolean; router: ReturnType<typeof useRouter> }) {
  const cubes = Object.values(archive.data.cubes).sort((a, b) => a.sortOrder - b.sortOrder);
  const initial = archive.data.preferences.lastCubeId && archive.data.cubes[archive.data.preferences.lastCubeId] ? archive.data.preferences.lastCubeId : cubes[0]?.id ?? null;
  const [selected, setSelected] = useState<string | null>(initial);
  const [zoom, setZoom] = useState(1);
  const timerRef = useRef<number | null>(null);
  const selectedId = selected && archive.data.cubes[selected] ? selected : cubes[0]?.id ?? null;
  const selectedIndex = Math.max(0, cubes.findIndex((cube) => cube.id === selectedId));
  const avatarPosition = worldPosition(selectedIndex);
  const selectedCube = selectedId ? archive.data.cubes[selectedId] : null;
  const worldHeight = Math.max(620, Math.ceil(cubes.length / WORLD_COLUMNS) * WORLD_ROW_GAP + 140);

  useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

  function visit(cube: Cube) {
    setSelected(cube.id);
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => router.push(`/cube?id=${encodeURIComponent(cube.id)}`), reduceMotion ? 20 : 720);
  }

  return (
    <div className="page-content">
      <PageHeader eyebrow="My music universe" title="당신의 음악 세계를 걸어보세요" copy="큐브를 누르면 캐릭터가 그 순간까지 걸어갑니다. 빠르게 찾고 싶을 때는 오른쪽 목록을 이용하세요." />
      <div className="world-layout">
        <div className="world-stage">
          <div className="world-toolbar"><button className="button" type="button" onClick={() => setZoom((value) => Math.max(.7, value - .1))} aria-label="축소">−</button><button className="button" type="button" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button><button className="button" type="button" onClick={() => setZoom((value) => Math.min(1.3, value + .1))} aria-label="확대">＋</button></div>
          <div className="world-board" style={{ scale: String(zoom), height: worldHeight }}>
            {cubes.map((cube, index) => {
              const position = worldPosition(index);
              return <button className={`world-cube-button${selectedId === cube.id ? " is-selected" : ""}`} key={cube.id} type="button" style={{ ...cubeStyle(cube.color), left: position.left, top: position.top }} onClick={() => visit(cube)} aria-label={`${cube.name} 큐브로 이동`}><span className="world-cube-visual" aria-hidden="true"><span className="world-cube-top" /><span className="world-cube-left" /><span className="world-cube-right" /></span><span className="world-cube-label">{cube.name}</span></button>;
            })}
            {cubes.length ? <span className="world-avatar" style={{ left: avatarPosition.left + 108, top: avatarPosition.top + 62 }} aria-label="내 캐릭터" /> : null}
          </div>
        </div>
        <aside className="world-panel"><span className="eyebrow">World map</span><h2>{selectedCube?.name ?? "아직 큐브가 없어요"}</h2><p>{selectedCube?.description ?? "첫 큐브를 만들면 이곳에 새로운 행성이 생겨납니다."}</p>{selectedCube ? <div className="meta-row"><span>{getCubeTracks(archive, selectedCube.id).length}곡</span><span className="dot" /><span>{formatDate(selectedCube.updatedAt)} 수정</span></div> : null}<div className="track-list" style={{ marginTop: 24 }}>{cubes.map((cube) => <button key={cube.id} className="track-row" type="button" onClick={() => router.push(`/cube?id=${encodeURIComponent(cube.id)}`)} style={{ gridTemplateColumns: "42px 1fr auto", minHeight: 66, textAlign: "left", cursor: "pointer" }}><span className="cube-mini-art" style={{ ...cubeStyle(cube.color), width: 42, height: 42, flexBasis: 42 }} aria-hidden="true"><span /><span /><span /><span /></span><span className="track-info"><strong>{cube.name}</strong><small>{getCubeTracks(archive, cube.id).length}곡</small></span><span>↗</span></button>)}</div>{!cubes.length ? <Link className="button button-primary" href="/cubes">첫 큐브 만들기</Link> : null}</aside>
      </div>
    </div>
  );
}

function SettingsView({ archive, commit, notify, storageBlocked, setStorageBlocked }: { archive: ArchiveEnvelopeV1; commit: (next: ArchiveEnvelopeV1, message?: string, force?: boolean) => boolean; notify: (message: string) => void; storageBlocked: string | null; setStorageBlocked: (value: string | null) => void }) {
  const importInputRef = useRef<HTMLInputElement>(null);

  function setMotion(motion: MotionPreference) {
    commit({ ...archive, updatedAt: new Date().toISOString(), data: { ...archive.data, preferences: { ...archive.data.preferences, motion } } }, "모션 설정을 저장했어요.");
  }
  function setRecap(enabled: boolean) {
    commit({ ...archive, updatedAt: new Date().toISOString(), data: { ...archive.data, preferences: { ...archive.data.preferences, recapEnabled: enabled } } }, enabled ? "회고 화면을 켰어요." : "회고 화면을 껐어요.");
  }
  function exportData() {
    const blob = new Blob([serializeArchive(archive)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mumu-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("현재 음악 세계를 JSON 파일로 백업했어요.");
  }
  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((raw) => {
      try {
        const value: unknown = JSON.parse(raw);
        if (!validateArchiveEnvelope(value)) throw new Error("MUMU 백업 파일 형식이 아닙니다.");
        if (window.confirm("현재 기록을 이 백업으로 교체할까요? 이 작업은 되돌릴 수 없습니다.")) commit(value, "백업한 음악 세계를 복원했어요.", true);
      } catch (error) { notify(error instanceof Error ? error.message : "백업 파일을 읽지 못했어요."); }
    }).catch(() => notify("백업 파일을 읽지 못했어요."));
    event.target.value = "";
  }
  function replace(mode: "seed" | "empty") {
    const message = mode === "seed" ? "현재 기록을 지우고 샘플 세계로 초기화할까요?" : "모든 기록을 지우고 빈 세계로 시작할까요?";
    if (!window.confirm(message)) return;
    commit(resetArchive(mode), mode === "seed" ? "샘플 세계를 복원했어요." : "빈 음악 세계로 초기화했어요.", true);
    setStorageBlocked(null);
  }
  return (
    <div className="page-content">
      <PageHeader eyebrow="Settings" title="내 음악 세계 설정" copy="모션, 회고, 이 기기에 저장된 데이터를 관리합니다." />
      {storageBlocked ? <div className="notice notice-danger" style={{ marginBottom: 18 }}>저장소 보호 모드가 켜져 있습니다. 백업할 수 있다면 먼저 원본 브라우저 데이터를 보존한 뒤 초기화하세요.</div> : null}
      <section className="panel settings-list">
        <div className="setting-row"><div><h3>모션 강도</h3><p>시스템 설정을 따르거나 캐릭터·배경 움직임을 직접 줄입니다.</p></div><select className="select" style={{ width: 190 }} value={archive.data.preferences.motion} onChange={(event) => setMotion(event.target.value as MotionPreference)} aria-label="모션 강도"><option value="system">시스템 설정 따르기</option><option value="reduce">모션 줄이기</option><option value="full">감성 모션 사용</option></select></div>
        <div className="setting-row"><div><h3>이맘때의 음악</h3><p>기억 시기와 저장 날짜를 기준으로 과거 음악을 다시 보여줍니다.</p></div><button className={`toggle${archive.data.preferences.recapEnabled ? " is-on" : ""}`} type="button" role="switch" aria-checked={archive.data.preferences.recapEnabled} onClick={() => setRecap(!archive.data.preferences.recapEnabled)}><span className="sr-only">회고 {archive.data.preferences.recapEnabled ? "끄기" : "켜기"}</span></button></div>
        <div className="setting-row"><div><h3>내 기록 백업</h3><p>이 브라우저의 음악 세계를 JSON 파일로 내보내거나 복원합니다.</p></div><div className="track-actions"><button className="button" type="button" onClick={exportData}>백업 내보내기</button><button className="button" type="button" onClick={() => importInputRef.current?.click()}>백업 불러오기</button><input ref={importInputRef} className="sr-only" id="backup-import" type="file" accept="application/json,.json" onChange={importData} tabIndex={-1} /></div></div>
        <div className="setting-row"><div><h3>샘플 기록만 제거</h3><p>직접 만든 큐브와 기록은 남기고 처음 제공된 샘플만 지웁니다.</p></div><button className="button" type="button" onClick={() => commit(removeSeedData(archive), "샘플 기록을 제거했어요.", true)}>샘플 제거</button></div>
        <div className="setting-row"><div><h3>데모 초기화</h3><p>현재 기록을 모두 교체합니다. 먼저 백업하는 것을 권장합니다.</p></div><div className="track-actions"><button className="button" type="button" onClick={() => replace("seed")}>샘플로 초기화</button><button className="button button-danger" type="button" onClick={() => replace("empty")}>모든 기록 지우기</button></div></div>
      </section>
      <div className="notice notice-warning" style={{ marginTop: 18 }}><span aria-hidden="true">!</span><div><strong>이 기기에만 저장되는 데모입니다.</strong><br />브라우저 데이터 삭제, 비공개 모드 종료, 기기 변경 시 기록이 사라질 수 있습니다. 민감한 개인정보는 입력하지 마세요.</div></div>
    </div>
  );
}
