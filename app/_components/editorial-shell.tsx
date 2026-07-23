"use client";

import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  Compass,
  CircleHelp,
  House,
  Library,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { ITUNES_PREVIEW_ATTRIBUTION } from "@/lib/itunes";
import { useModalFocus } from "./editorial-accessibility";
import {
  MotionLink as Link,
  canGoBackInApp,
  transitionEditorialUI,
  useMotionRouter,
} from "./editorial-motion";
import { AlbumArtwork, type PreviewControls } from "./editorial-media";
import type { AppView, ToastMessage } from "./editorial-types";

const VIEW_META: Record<AppView, { label: string; path: string; index: string }> = {
  home: { label: "HOME", path: "/", index: "00" },
  space: { label: "SPACE", path: "/", index: "00" },
  capture: { label: "ADD", path: "/capture", index: "＋" },
  inbox: { label: "INBOX", path: "/inbox", index: "01" },
  chapters: { label: "CHAPTERS", path: "/chapters", index: "02" },
  chapter: { label: "CHAPTER", path: "/chapters", index: "02" },
  chapterShare: { label: "SHARE", path: "/chapters", index: "03" },
  memory: { label: "MEMORY", path: "/chapters", index: "03" },
  playlist: { label: "PLAYLIST", path: "/chapters", index: "03" },
  discover: { label: "DISCOVER", path: "/discover", index: "04" },
  discoverChapter: { label: "CHAPTER", path: "/discover", index: "04" },
  discoverProfile: { label: "PROFILE", path: "/discover", index: "04" },
  search: { label: "FIND", path: "/search", index: "04" },
  recap: { label: "RECAP", path: "/recap", index: "05" },
  settings: { label: "SETTINGS", path: "/settings", index: "06" },
  tags: { label: "TAGS", path: "/tags", index: "07" },
  guide: { label: "GUIDE", path: "/guide", index: "08" },
};

const MOBILE_NAV = ["home", "discover", "capture", "chapters", "search"] as const satisfies readonly AppView[];

const MOBILE_NAV_LABEL: Partial<Record<AppView, string>> = {
  home: "홈",
  chapters: "챕터",
  capture: "기록",
  discover: "탐색",
  search: "찾기",
};

const MOBILE_NAV_ICON = {
  home: House,
  chapters: Library,
  capture: Plus,
  discover: Compass,
  search: Search,
} as const;

const CONTEXTUAL_HELP: Record<AppView, { title: string; description: string }> = {
  home: { title: "내 음악 세계", description: "최근 기록을 다시 듣고, 태그와 챕터를 따라 나만의 음악 세계를 살펴보세요." },
  space: { title: "내 음악 세계", description: "최근 기록을 다시 듣고, 태그와 챕터를 따라 나만의 음악 세계를 살펴보세요." },
  capture: { title: "곡 기록하기", description: "곡을 검색하거나 음악 앱 링크를 가져온 뒤, 떠올리고 싶은 순간과 챕터를 남겨 보세요." },
  inbox: { title: "보관함", description: "아직 챕터에 넣지 않은 곡을 모아 두는 곳이에요. 여러 곡을 골라 한 챕터로 정리할 수 있어요." },
  chapters: { title: "챕터", description: "같은 장면이나 시기의 곡을 챕터로 모아 보세요. 챕터 안에서는 추가순 또는 애정도순으로 볼 수 있어요." },
  chapter: { title: "챕터", description: "이 챕터에 담긴 곡과 기억을 살펴보세요. 곡을 더 기록하거나 챕터 공개 범위를 바꿀 수도 있어요." },
  chapterShare: { title: "챕터 공유", description: "형식과 분위기를 고르고, 곡 순서를 정리한 뒤 공유용 이미지를 만들 수 있어요." },
  memory: { title: "곡 기록", description: "태그, 애정도, 메모는 모두 선택 사항이에요. 다만 곡은 하나 이상의 챕터에 담겨야 기록할 수 있어요." },
  playlist: { title: "플레이리스트", description: "챕터에 담긴 곡을 확인하고, 지원이 준비된 음악 서비스로 내보낼 수 있어요." },
  discover: { title: "탐색", description: "다른 뮤커가 공개한 챕터를 둘러보고, 마음에 드는 뮤커를 팔로우해 보세요." },
  discoverChapter: { title: "공개 챕터", description: "공개된 곡의 태그와 메모, 애정도를 살펴볼 수 있어요. 비공개 기록은 보이지 않아요." },
  discoverProfile: { title: "뮤커 프로필", description: "이 뮤커가 공개한 챕터를 보고 팔로우할 수 있어요." },
  search: { title: "기록 찾기", description: "곡명, 아티스트, 태그, 메모에 남긴 단서로 내 음악 기록을 다시 찾을 수 있어요." },
  recap: { title: "회고", description: "기간을 골라 그때 남긴 곡과 메모를 다시 읽어 보세요." },
  settings: { title: "설정", description: "계정, 앱 동작, 데이터 관리와 전체 사용 가이드를 확인할 수 있어요." },
  tags: { title: "태그", description: "나중에 다시 찾고 싶은 순간을 짧은 말로 만들어 관리하세요." },
  guide: { title: "뮤키 사용 방법", description: "곡을 가져와 태그와 챕터로 남기는 기본 흐름을 안내하고 있어요." },
};

const scrollPositions = new Map<string, number>();

export type ContextBackAction =
  | { label: string; fallbackHref: string; sharedId?: string; onActivate?: never }
  | { label: string; onActivate: () => void; sharedId?: never };

function ContextBackControl({ action }: { action: ContextBackAction }) {
  const router = useMotionRouter();
  const content = (
    <>
      <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
      <span>{action.label}</span>
    </>
  );
  return (
    <div className="content-back-row">
      {"fallbackHref" in action ? (
        <button
          className="content-back-button"
          type="button"
          onClick={() => (canGoBackInApp() ? router.back() : router.replace(action.fallbackHref, "back", action.sharedId))}
          aria-label={action.label}
        >
          {content}
        </button>
      ) : (
        <button className="content-back-button" type="button" onClick={action.onActivate} aria-label={action.label}>
          {content}
        </button>
      )}
    </div>
  );
}

function safeExternalHref(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function safeInternalHref(value: string): string | null {
  return value.startsWith("/") && !value.startsWith("//") ? value : null;
}

export function TextNavigation({ view }: { view: AppView }) {
  const searchParams = useSearchParams();
  const discoverPlaylist = view === "playlist" && searchParams.get("source") === "discover";
  return (
    <nav className="text-navigation icon-label-nav" aria-label="주요 메뉴">
      {MOBILE_NAV.map((item) => {
        const meta = VIEW_META[item];
        const Icon = MOBILE_NAV_ICON[item];
        const active = item === view || (
          item === "chapters" && (view === "chapter" || view === "chapterShare" || view === "memory" || (view === "playlist" && !discoverPlaylist))
          || item === "discover" && (view === "discoverChapter" || view === "discoverProfile" || discoverPlaylist)
        );
        return (
          <Link
            key={item}
            href={meta.path}
            intent={item === "capture" ? "modal" : "tab"}
            className={`${active ? "is-active" : ""}${item === "capture" ? " nav-add" : ""}`}
            aria-label={item === "capture" ? "새 음악 기록" : item === "search" ? "내 기록 찾기" : meta.label}
            aria-current={active ? "page" : undefined}
            onClick={item === "capture" ? () => {
              window.sessionStorage.removeItem("muchi:capture-draft:v1");
              window.dispatchEvent(new Event("muchi:reset-capture"));
            } : undefined}
          >
            <Icon aria-hidden="true" size={24} strokeWidth={1.8} />
            <span className="icon-label-nav-label">{MOBILE_NAV_LABEL[item] ?? meta.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function MiniPlayer({
  preview,
  onOpen,
  shareArtwork,
}: {
  preview: PreviewControls;
  onOpen: () => void;
  shareArtwork: boolean;
}) {
  if (!preview.state) return null;
  return (
    <section className="mini-player" aria-label="미리듣기 플레이어">
      <button
        className="mini-player-open"
        type="button"
        onClick={onOpen}
        aria-label={`${preview.state.track.title} 플레이어 크게 열기`}
      >
        <AlbumArtwork
          track={preview.state.track}
          sharedId={shareArtwork ? `player-${preview.state.track.id}` : undefined}
          priority
        />
        <span className="mini-player-copy">
          <strong>{preview.state.track.title}</strong>
          <span>{preview.state.track.artist}</span>
        </span>
      </button>
      <button
        className="player-text-control"
        type="button"
        onClick={() => preview.state?.playing
          ? preview.pause()
          : preview.play(preview.state!.track)}
        aria-label={preview.state.playing ? "일시정지" : "재생"}
      >
        {preview.state.playing ? "정지" : "재생"}
      </button>
      <span
        className="mini-player-progress"
        style={{
          "--player-progress": Math.min(1, preview.state.currentTime / 30),
        } as CSSProperties}
        aria-hidden="true"
      />
    </section>
  );
}

export function FullPlayer({
  preview,
  onClose,
  onDismiss,
}: {
  preview: PreviewControls;
  onClose: () => void;
  onDismiss: () => void;
}) {
  const playerDragStart = useRef<number | null>(null);
  const dialogRef = useModalFocus<HTMLElement>(true, onClose);
  if (!preview.state) return null;
  const externalHref = safeExternalHref(preview.state.track.externalUrl);
  return (
    <div className="player-backdrop" role="presentation" onClick={onClose}>
      <section
        ref={dialogRef}
        className="full-player"
        role="dialog"
        aria-modal="true"
        aria-label={`${preview.state.track.title} 전체 플레이어`}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => { playerDragStart.current = event.clientY; }}
        onPointerUp={(event) => {
          if (
            playerDragStart.current !== null
            && event.clientY - playerDragStart.current > 72
          ) onClose();
          playerDragStart.current = null;
        }}
      >
        <button className="text-button player-dismiss-control" type="button" onClick={onDismiss}>플레이어 종료</button>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="full-player-art">
          <AlbumArtwork
            track={preview.state.track}
            sharedId={`player-${preview.state.track.id}`}
            priority
          />
        </div>
        <div className="full-player-copy">
          <span>미리듣기 · {Math.floor(preview.state.currentTime).toString().padStart(2, "0")}:30</span>
          <h2>{preview.state.track.title}</h2>
          <p>
            {preview.state.track.artist}
            {preview.state.track.album ? ` · ${preview.state.track.album}` : ""}
          </p>
        </div>
        <div className="full-player-actions">
          <button
            className="button button-primary"
            type="button"
            onClick={() => preview.state?.playing
              ? preview.pause()
              : preview.play(preview.state!.track)}
          >
            {preview.state.playing ? "미리듣기 정지" : "30초 미리듣기"}
          </button>
          {externalHref ? (
            <a
              className="button"
              href={externalHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              원본 열기
            </a>
          ) : null}
          <button className="text-button" type="button" onClick={onClose}>닫기</button>
        </div>
        <p className="legal-note">{ITUNES_PREVIEW_ATTRIBUTION}</p>
      </section>
    </div>
  );
}

export function ToastRegion({ toast, onDismiss }: { toast: ToastMessage | null; onDismiss: () => void }) {
  if (!toast) return null;
  const notice = typeof toast === "string" ? { text: toast } : toast;
  const isError = notice.kind === "error";
  const actionHref = notice.action?.href
    ? notice.action.external
      ? safeExternalHref(notice.action.href)
      : safeInternalHref(notice.action.href)
    : null;
  return (
    <div className={`toast${notice.action || notice.persistent ? " toast-with-action" : ""} is-${notice.kind ?? "success"}`} role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} aria-atomic="true">
      <span className="toast-copy">{notice.text}</span>
      {notice.action && notice.action.onActivate ? (
        <button className="toast-action" type="button" onClick={notice.action.onActivate}>{notice.action.label}</button>
      ) : notice.action && actionHref ? (
        notice.action.external ? (
          <a
            className="toast-action"
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {notice.action.label}
          </a>
        ) : (
          <Link className="toast-action" href={actionHref} intent="forward">
            {notice.action.label}
          </Link>
        )
      ) : null}
      {notice.action || notice.persistent ? <button className="toast-dismiss" type="button" onClick={onDismiss} aria-label="알림 닫기"><X size={16} aria-hidden="true" /></button> : null}
    </div>
  );
}

export function EditorialShell({
  view,
  inboxCount,
  children,
  preview,
  toast,
  onToastDismiss,
  online,
  scrollReady,
  backAction,
}: {
  view: AppView;
  inboxCount: number;
  children: ReactNode;
  preview: PreviewControls;
  toast: ToastMessage | null;
  onToastDismiss: () => void;
  online: boolean;
  scrollReady: boolean;
  backAction: ContextBackAction | null;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const scrollViewportRef = useRef<HTMLElement>(null);
  const restoredRouteKeyRef = useRef<string | null>(null);
  const playerOpen = Boolean(preview.state);
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false);
  const [contextHelpOpen, setContextHelpOpen] = useState(false);
  const contextHelpRef = useModalFocus<HTMLDivElement>(contextHelpOpen, () => setContextHelpOpen(false));
  const contextHelp = CONTEXTUAL_HELP[view];

  useLayoutEffect(() => {
    const viewport = scrollViewportRef.current;
    if (!viewport || !scrollReady || restoredRouteKeyRef.current === routeKey) return;

    viewport.scrollTop = document.documentElement.dataset.motionIntent === "back"
      ? scrollPositions.get(routeKey) ?? 0
      : 0;
    restoredRouteKeyRef.current = routeKey;
  }, [routeKey, scrollReady]);

  function setPlayerVisibility(open: boolean) {
    transitionEditorialUI(() => {
      flushSync(() => setFullPlayerOpen(open));
    }, "modal", preview.state ? `player-${preview.state.track.id}` : undefined);
  }

  function dismissPlayer() {
    transitionEditorialUI(() => {
      flushSync(() => {
        setFullPlayerOpen(false);
        preview.close();
      });
      window.requestAnimationFrame(() => scrollViewportRef.current?.focus({ preventScroll: true }));
    }, "modal", preview.state ? `player-${preview.state.track.id}` : undefined);
  }

  function setContextHelpVisibility(open: boolean) {
    transitionEditorialUI(() => {
      flushSync(() => setContextHelpOpen(open));
    }, "modal", "context-help");
  }

  return (
    <div className="device-stage">
      <div className={`app-shell editorial-shell${playerOpen ? " has-player" : ""}`}>
        <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
        <header className="editorial-header">
          <div className="header-leading">
            <Link className="brand-lockup" href="/" intent="tab" aria-label="뮤키 홈">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="brand-lockup-mark" src="/assets/brand/muchi-logo.png" alt="" width={28} height={28} decoding="async" />
              <strong>뮤키</strong>
              <span>PERSONAL MUSIC ARCHIVE</span>
            </Link>
          </div>
          <div className="header-index" aria-hidden="true">
            <span>{VIEW_META[view].index}</span>
            <i />
            <span>{VIEW_META[view].label}</span>
          </div>
          <div className="header-links">
            <Link
              className="inbox-link"
              href="/inbox"
              intent="tab"
              aria-label={inboxCount ? `정리할 곡 ${inboxCount}곡 남음` : "정리할 곡 없음"}
            >
              <span>보관함</span>
              {inboxCount ? (
                <span className="inbox-count" aria-hidden="true">{inboxCount}</span>
              ) : null}
            </Link>
            <Link
              className="settings-link"
              href="/settings"
              intent="tab"
              aria-label="환경 설정"
            >
              <Settings aria-hidden="true" size={17} strokeWidth={1.8} />
            </Link>
            <button
              className="help-link"
              type="button"
              onClick={() => setContextHelpVisibility(true)}
              aria-label={`${contextHelp.title} 도움말`}
              aria-haspopup="dialog"
            >
              <CircleHelp aria-hidden="true" size={18} strokeWidth={1.8} />
            </button>
          </div>
        </header>

        <main
          ref={scrollViewportRef}
          className="shell-main"
          id="main-content"
          tabIndex={-1}
          onScroll={(event) => scrollPositions.set(routeKey, event.currentTarget.scrollTop)}
        >
          <div className="page-status" aria-live="polite">
            {!online ? "OFFLINE ARCHIVE" : null}
          </div>
          {backAction ? <ContextBackControl action={backAction} /> : null}
          {children}
        </main>

        <footer className="footer-band">
          <TextNavigation view={view} />
        </footer>
        <MiniPlayer
          preview={preview}
          onOpen={() => setPlayerVisibility(true)}
          shareArtwork={!fullPlayerOpen}
        />
        {fullPlayerOpen && preview.state ? (
          <FullPlayer
            preview={preview}
            onClose={() => setPlayerVisibility(false)}
            onDismiss={dismissPlayer}
          />
        ) : null}
        {contextHelpOpen ? (
          <div className="dialog-backdrop" role="presentation" onClick={() => setContextHelpVisibility(false)}>
            <section
              ref={contextHelpRef}
              className="dialog context-help-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="context-help-title"
              onClick={(event) => event.stopPropagation()}
            >
              <span className="section-label">도움말</span>
              <h2 id="context-help-title">{contextHelp.title}</h2>
              <p>{contextHelp.description}</p>
              <div className="dialog-actions">
                <Link className="button button-primary" href="/guide" intent="forward" onClick={() => setContextHelpVisibility(false)}>
                  전체 사용 가이드
                </Link>
                <button className="text-button" type="button" onClick={() => setContextHelpVisibility(false)} data-modal-autofocus>닫기</button>
              </div>
            </section>
          </div>
        ) : null}
        <ToastRegion toast={toast} onDismiss={onToastDismiss} />
      </div>
    </div>
  );
}
