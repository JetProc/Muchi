"use client";

import { useState, type CSSProperties } from "react";
import {
  getCubeTracks,
  type ArchiveEnvelopeV1,
  type Cube,
  type TrackReference,
} from "@/lib/archive";
import { sharedArtworkStyle } from "./editorial-motion";
import { chapterColorStyle } from "./editorial-format";

function artworkFallbackStyle(
  index: number,
): CSSProperties & { "--art-a": string; "--art-b": string } {
  const pairs = [
    ["#8e2f25", "#17130f"],
    ["#ef5a37", "#6d241d"],
    ["#7b7264", "#2c2822"],
    ["#b58f5c", "#453627"],
  ];
  const pair = pairs[index % pairs.length];
  return { "--art-a": pair[0], "--art-b": pair[1] };
}

export interface PreviewState {
  track: TrackReference;
  playing: boolean;
  currentTime: number;
}

export interface PreviewControls {
  state: PreviewState | null;
  play: (track: TrackReference) => void;
  pause: () => void;
  close: () => void;
}

export function AlbumArtwork({
  track,
  index = 0,
  sharedId,
  className = "",
  priority = false,
  decorative = false,
}: {
  track: TrackReference;
  index?: number;
  sharedId?: string;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const source = track.artworkUrl && !failed
    ? track.artworkUrl
    : "/assets/default-album.jpg";
  return (
    <div
      className={`track-art ${loaded ? "is-loaded" : "is-loading"} ${className}`.trim()}
      style={{ ...artworkFallbackStyle(index), ...sharedArtworkStyle(sharedId) }}
    >
      {/* Remote promotional artwork is intentionally never cached by the service worker. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={source}
        alt={decorative ? "" : `${track.artist}의 ${track.title} 앨범 아트`}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (!failed) setFailed(true);
        }}
      />
    </div>
  );
}

export function ChapterCover({
  archive,
  chapter,
  shared = false,
}: {
  archive: ArchiveEnvelopeV1;
  chapter: Cube;
  shared?: boolean;
}) {
  const artworkKeys = new Set<string>();
  const entries = getCubeTracks(archive, chapter.id)
    .filter(({ track }) => {
      const artworkKey = track.artworkUrl ?? "__default-artwork__";
      if (artworkKeys.has(artworkKey)) return false;
      artworkKeys.add(artworkKey);
      return true;
    })
    .slice(0, 3);
  return (
    <div
      className={`chapter-artwork chapter-artwork-${Math.max(1, entries.length)}`}
      style={{
        ...chapterColorStyle(chapter.color),
        ...sharedArtworkStyle(shared ? chapter.id : undefined),
      }}
      role="img"
      aria-label={`${chapter.name} 대표 앨범 아트 모음`}
    >
      {entries.length ? entries.map((entry, index) => (
        <AlbumArtwork
          key={entry.cubeTrack.id}
          track={entry.track}
          index={index}
          className="chapter-artwork-tile"
          decorative
        />
      )) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="chapter-empty-art" src="/assets/default-album.jpg" alt="" loading="lazy" decoding="async" />
      )}
    </div>
  );
}

export function LoadingDots() {
  return (
    <span className="loading-line" role="status">
      <span className="sr-only">불러오는 중</span>
      <span aria-hidden="true" />
    </span>
  );
}

export function PreviewButton({
  track,
  preview,
}: {
  track: TrackReference;
  preview: PreviewControls;
}) {
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
      {playing ? "PAUSE" : "PLAY"}
    </button>
  );
}
