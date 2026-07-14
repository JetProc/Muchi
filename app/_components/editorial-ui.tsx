"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  getCubeTracks,
  type ArchiveEnvelopeV1,
  type Cube,
  type TagDefinition,
  type TrackReference,
} from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";
import {
  AlbumArtwork,
  ChapterCover,
  PreviewButton,
  type PreviewControls,
} from "./editorial-media";
import { chapterColorStyle, formatDate } from "./editorial-format";

export function EmptyState({
  title,
  action,
}: {
  icon?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div>
        <span className="section-label">ARCHIVE NOTE</span>
        <h2>{title}</h2>
        {action}
      </div>
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        <span className="section-label">{eyebrow}</span>
        <h1>{title}</h1>
      </div>
      {action}
    </div>
  );
}

export function ChapterIndex({
  archive,
  chapter,
  index,
  onDelete,
}: {
  archive: ArchiveEnvelopeV1;
  chapter: Cube;
  index: number;
  onDelete?: (chapter: Cube) => void;
}) {
  const entries = getCubeTracks(archive, chapter.id);
  const tagCount = new Set(entries.flatMap((entry) => entry.cubeTrack.tagIds)).size;
  return (
    <article className="chapter-index-item" style={chapterColorStyle(chapter.color)}>
      <Link
        className="chapter-index-link"
        href={`/chapter?id=${encodeURIComponent(chapter.id)}`}
        intent="shared"
        sharedId={chapter.id}
      >
        <span className="chapter-number">{String(index + 1).padStart(2, "0")}</span>
        <ChapterCover archive={archive} chapter={chapter} shared />
        <div className="chapter-index-copy">
          <span className="section-label">CHAPTER {String(index + 1).padStart(2, "0")}</span>
          <h2>{chapter.name}</h2>
          {chapter.description ? <p>{chapter.description}</p> : null}
          <div className="meta-row">
            <span>{entries.length} TRACKS</span>
            <span>{tagCount} TAGS</span>
            <span>{formatDate(chapter.updatedAt)}</span>
          </div>
        </div>
      </Link>
      {onDelete ? (
        <button
          className="text-button chapter-delete"
          type="button"
          onClick={() => onDelete(chapter)}
          aria-label={`${chapter.name} 삭제`}
        >
          DELETE
        </button>
      ) : null}
    </article>
  );
}

export function TrackLine({
  track,
  index,
  preview,
  tags = [],
  context,
  actions,
  sharedId,
}: {
  track: TrackReference;
  index: number;
  preview: PreviewControls;
  tags?: TagDefinition[];
  context?: string;
  actions?: ReactNode;
  sharedId?: string;
}) {
  return (
    <article
      className="track-line"
      style={{ "--track-delay": `${Math.min(index, 6) * 24}ms` } as CSSProperties}
    >
      <span className="track-number">{String(index + 1).padStart(2, "0")}</span>
      <AlbumArtwork track={track} index={index} sharedId={sharedId} />
      <div className="track-info">
        <strong>{track.title}</strong>
        <small>{track.artist}{track.album ? ` · ${track.album}` : ""}</small>
        {context ? <em>{context}</em> : null}
        {tags.length ? (
          <div className="tag-row" style={{ marginTop: 7 }}>
            {tags.slice(0, 5).map((tag) => <span className="tag" key={tag.id}>#{tag.label}</span>)}
          </div>
        ) : null}
      </div>
      <div className="track-actions">
        <PreviewButton track={track} preview={preview} />
        {actions}
      </div>
    </article>
  );
}
