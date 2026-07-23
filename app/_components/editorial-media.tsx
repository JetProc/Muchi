"use client";

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import {
  getCubeTracks,
  type ArchiveEnvelopeV1,
  type Cube,
  type CubeColor,
  type TrackReference,
} from "@/lib/archive";
import { createOwnedRecordPhotoUrl } from "@/lib/record-photo-contract";
import { sharedArtworkKey, sharedArtworkStyle } from "./editorial-motion";
import {
  chapterColorStyle,
  formatChapterTitle,
  formatTrackArtist,
} from "./editorial-format";

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

export const getOwnedRecordPhotoUrl = createOwnedRecordPhotoUrl;

export function AlbumArtwork({
  track,
  customImageUrl,
  sharedId,
  className = "",
  priority = false,
  decorative = false,
}: {
  track: TrackReference;
  customImageUrl?: string | null;
  sharedId?: string;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  const preferredSource = customImageUrl ?? track.artworkUrl;
  return (
    <AlbumArtworkFrame
      key={preferredSource ?? "__default-art__"}
      track={track}
      customImageUrl={customImageUrl}
      sharedId={sharedId}
      className={className}
      priority={priority}
      decorative={decorative}
    />
  );
}

function AlbumArtworkFrame({
  track,
  customImageUrl,
  sharedId,
  className = "",
  priority = false,
  decorative = false,
}: {
  track: TrackReference;
  customImageUrl?: string | null;
  sharedId?: string;
  className?: string;
  priority?: boolean;
  decorative?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const preferredSource = customImageUrl ?? track.artworkUrl;
  const source = preferredSource && !failed
    ? preferredSource
    : "/assets/default-album.jpg";
  return (
    <div
      className={`track-art ${loaded ? "is-loaded" : "is-loading"} ${className}`.trim()}
      data-shared-transition-id={sharedArtworkKey(sharedId)}
      style={sharedArtworkStyle(sharedId)}
    >
      {/* Remote promotional artwork is intentionally never cached by the service worker. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={source}
        alt={decorative ? "" : `${formatTrackArtist(track)}의 ${track.title} 앨범 아트`}
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
  tracks,
  sharedId,
  title,
  color,
  className = "",
}: {
  archive?: ArchiveEnvelopeV1;
  chapter?: Cube;
  tracks?: TrackReference[];
  sharedId?: string;
  title?: string;
  color?: CubeColor;
  className?: string;
}) {
  const artworkKeys = new Set<string>();
  const coverTracks = tracks ?? (archive && chapter ? getCubeTracks(archive, chapter.id).map(({ track }) => track) : []);
  const entries = coverTracks
    .filter((track) => {
      const artworkKey = track.artworkUrl ?? "__default-artwork__";
      if (artworkKeys.has(artworkKey)) return false;
      artworkKeys.add(artworkKey);
      return true;
    })
    .slice(0, 4);
  const coverId = sharedId ?? chapter?.id;
  const coverTitle = title ?? (chapter ? formatChapterTitle(chapter) : "챕터");
  const coverColor = color ?? chapter?.color;
  const customCover = chapter?.coverImageUrl ?? null;
  return (
    <div
      className={`chapter-artwork ${customCover ? "chapter-artwork-custom" : `chapter-artwork-${Math.max(1, entries.length)}`} ${className}`.trim()}
      data-shared-transition-id={sharedArtworkKey(coverId)}
      style={{
        ...(coverColor ? chapterColorStyle(coverColor) : {}),
        ...sharedArtworkStyle(coverId),
      }}
      role="img"
      aria-label={customCover ? `${coverTitle} 대표 이미지` : `${coverTitle} 대표 앨범 아트 모음`}
    >
      {customCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="chapter-custom-cover" src={customCover} alt="" />
      ) : entries.length ? entries.map((track) => (
        <AlbumArtwork
          key={track.id}
          track={track}
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
  const previewLabel = !track.previewUrl
    ? "미리듣기 없음"
    : playing
      ? `${track.title} 미리듣기 정지`
      : `${track.title} 30초 미리듣기`;
  return (
    <button
      className="play-button preview-icon-button"
      type="button"
      disabled={!track.previewUrl}
      onClick={() => (playing ? preview.pause() : preview.play(track))}
      aria-label={previewLabel}
      title={!track.previewUrl ? "미리듣기 없음" : playing ? "미리듣기 정지" : "30초 미리듣기"}
    >
      {playing ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
    </button>
  );
}
