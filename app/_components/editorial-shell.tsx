"use client";

import {
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { flushSync } from "react-dom";
import { ITUNES_PREVIEW_ATTRIBUTION } from "@/lib/itunes";
import { useModalFocus } from "./editorial-accessibility";
import {
  MotionLink as Link,
  transitionEditorialUI,
} from "./editorial-motion";
import { AlbumArtwork, type PreviewControls } from "./editorial-media";
import type { AppView } from "./editorial-types";

const VIEW_META: Record<AppView, { label: string; path: string; index: string }> = {
  home: { label: "HOME", path: "/", index: "00" },
  capture: { label: "ADD", path: "/capture", index: "＋" },
  inbox: { label: "INBOX", path: "/inbox", index: "01" },
  chapters: { label: "CHAPTERS", path: "/chapters", index: "02" },
  chapter: { label: "CHAPTER", path: "/chapters", index: "02" },
  memory: { label: "MEMORY", path: "/chapters", index: "03" },
  search: { label: "SEARCH", path: "/search", index: "04" },
  recap: { label: "RECAP", path: "/recap", index: "05" },
  settings: { label: "SETTINGS", path: "/settings", index: "06" },
};

const MOBILE_NAV: AppView[] = ["home", "chapters", "capture", "search"];

const MOBILE_NAV_LABEL: Partial<Record<AppView, string>> = {
  home: "HOME",
  chapters: "CHAPTERS",
  capture: "ADD",
  search: "SEARCH",
};

export function TextNavigation({ view }: { view: AppView }) {
  return (
    <nav className="text-navigation" aria-label="주요 메뉴">
      {MOBILE_NAV.map((item) => {
        const meta = VIEW_META[item];
        const active = item === view || (
          item === "chapters" && (view === "chapter" || view === "memory")
        );
        return (
          <Link
            key={item}
            href={meta.path}
            intent={item === "capture" ? "modal" : "tab"}
            className={`${active ? "is-active" : ""}${item === "capture" ? " nav-add" : ""}`}
            aria-label={item === "capture" ? "새 음악 기록" : meta.label}
            aria-current={active ? "page" : undefined}
          >
            <span>{MOBILE_NAV_LABEL[item] ?? meta.label}</span>
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
        {preview.state.playing ? "PAUSE" : "PLAY"}
      </button>
      <span
        className="mini-player-progress"
        style={{
          "--player-progress": `${Math.min(100, preview.state.currentTime / 30 * 100)}%`,
        } as CSSProperties}
        aria-hidden="true"
      />
    </section>
  );
}

export function FullPlayer({
  preview,
  onClose,
}: {
  preview: PreviewControls;
  onClose: () => void;
}) {
  const playerDragStart = useRef<number | null>(null);
  const dialogRef = useModalFocus<HTMLElement>(true, onClose);
  if (!preview.state) return null;
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
        <div className="sheet-handle" aria-hidden="true" />
        <div className="full-player-art">
          <AlbumArtwork
            track={preview.state.track}
            sharedId={`player-${preview.state.track.id}`}
            priority
          />
        </div>
        <div className="full-player-copy">
          <span>
            NOW PLAYING · {Math.floor(preview.state.currentTime).toString().padStart(2, "0")}:30
          </span>
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
            {preview.state.playing ? "PAUSE PREVIEW" : "PLAY 30 SEC"}
          </button>
          {preview.state.track.externalUrl ? (
            <a
              className="button"
              href={preview.state.track.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              OPEN ORIGINAL
            </a>
          ) : null}
          <button className="text-button" type="button" onClick={onClose}>CLOSE</button>
        </div>
        <p className="legal-note">{ITUNES_PREVIEW_ATTRIBUTION}</p>
      </section>
    </div>
  );
}

export function ToastRegion({ toast }: { toast: string | null }) {
  return toast ? (
    <div className="toast" role="status" aria-live="polite">{toast}</div>
  ) : null;
}

export function EditorialShell({
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
  const [fullPlayerOpen, setFullPlayerOpen] = useState(false);

  function setPlayerVisibility(open: boolean) {
    transitionEditorialUI(() => {
      flushSync(() => setFullPlayerOpen(open));
    }, "modal");
  }

  return (
    <div className={`app-shell editorial-shell${playerOpen ? " has-player" : ""}`}>
      <a className="skip-link" href="#main-content">본문으로 건너뛰기</a>
      <header className="editorial-header">
        <Link className="brand-lockup" href="/" intent="tab" aria-label="MUMU 홈">
          <strong>MUMU</strong>
          <span>PERSONAL MUSIC ARCHIVE</span>
        </Link>
        <div className="header-index" aria-hidden="true">
          <span>{VIEW_META[view].index}</span>
          <i />
          <span>{VIEW_META[view].label}</span>
        </div>
        <div className="header-links">
          <Link href="/inbox" intent="tab">
            INBOX{inboxCount ? ` ${String(inboxCount).padStart(2, "0")}` : ""}
          </Link>
          <Link href="/settings" intent="tab">SETTINGS</Link>
        </div>
      </header>

      <main className="shell-main" id="main-content" tabIndex={-1}>
        <div className="page-status" aria-live="polite">
          {!online ? "OFFLINE ARCHIVE" : null}
        </div>
        {children}
      </main>

      <TextNavigation view={view} />
      <MiniPlayer
        preview={preview}
        onOpen={() => setPlayerVisibility(true)}
        shareArtwork={!fullPlayerOpen}
      />
      {fullPlayerOpen && preview.state ? (
        <FullPlayer preview={preview} onClose={() => setPlayerVisibility(false)} />
      ) : null}
      <ToastRegion toast={toast} />
    </div>
  );
}
