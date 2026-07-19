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
  House,
  Library,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { ITUNES_PREVIEW_ATTRIBUTION } from "@/lib/itunes";
import { useModalFocus } from "./editorial-accessibility";
import {
  MotionLink as Link,
  transitionEditorialUI,
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
  memory: { label: "MEMORY", path: "/chapters", index: "03" },
  playlist: { label: "PLAYLIST", path: "/chapters", index: "03" },
  discover: { label: "DISCOVER", path: "/discover", index: "04" },
  discoverChapter: { label: "CHAPTER", path: "/discover", index: "04" },
  discoverProfile: { label: "PROFILE", path: "/discover", index: "04" },
  search: { label: "FIND", path: "/search", index: "04" },
  recap: { label: "RECAP", path: "/recap", index: "05" },
  settings: { label: "SETTINGS", path: "/settings", index: "06" },
  tags: { label: "TAGS", path: "/tags", index: "07" },
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

const scrollPositions = new Map<string, number>();

export type ContextBackAction =
  | { label: string; href: string; sharedId?: string; onActivate?: never }
  | { label: string; onActivate: () => void; href?: never; sharedId?: never };

function ContextBackControl({ action }: { action: ContextBackAction }) {
  const content = (
    <>
      <ChevronLeft aria-hidden="true" size={16} strokeWidth={2} />
      <span>{action.label}</span>
    </>
  );
  return (
    <div className="content-back-row">
      {action.href ? (
        <Link className="content-back-button" href={action.href} intent="back" sharedId={action.sharedId} aria-label={action.label}>
          {content}
        </Link>
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
          item === "chapters" && (view === "chapter" || view === "memory" || (view === "playlist" && !discoverPlaylist))
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
              window.sessionStorage.removeItem("music-world:capture-draft:v1");
              window.dispatchEvent(new Event("music-world:reset-capture"));
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

export function ToastRegion({ toast }: { toast: ToastMessage | null }) {
  if (!toast) return null;
  if (typeof toast === "string") {
    return (
      <div className="toast" role="status" aria-live="polite">{toast}</div>
    );
  }
  const actionHref = toast.action
    ? toast.action.external
      ? safeExternalHref(toast.action.href)
      : safeInternalHref(toast.action.href)
    : null;
  return (
    <div className="toast toast-with-action" role="status" aria-live="polite">
      <span className="toast-copy">{toast.text}</span>
      {toast.action && actionHref ? (
        toast.action.external ? (
          <a
            className="toast-action"
            href={actionHref}
            target="_blank"
            rel="noopener noreferrer"
          >
            {toast.action.label}
          </a>
        ) : (
          <Link className="toast-action" href={actionHref} intent="forward">
            {toast.action.label}
          </Link>
        )
      ) : null}
    </div>
  );
}

export function EditorialShell({
  view,
  inboxCount,
  children,
  preview,
  toast,
  online,
  scrollReady,
  backAction,
}: {
  view: AppView;
  inboxCount: number;
  children: ReactNode;
  preview: PreviewControls;
  toast: ToastMessage | null;
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

  return (
    <div className="device-stage">
      <div className={`app-shell editorial-shell${playerOpen ? " has-player" : ""}`}>
        <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
        <header className="editorial-header">
          <div className="header-leading">
            <Link className="brand-lockup" href="/" intent="tab" aria-label="MUMU 홈">
              <strong>MUMU</strong>
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
        <ToastRegion toast={toast} />
      </div>
    </div>
  );
}
