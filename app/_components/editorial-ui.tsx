"use client";

import type { CSSProperties, ReactNode } from "react";
import {
  type ArchiveEnvelopeV1,
  type Cube,
  type TagDefinition,
  type TrackReference,
} from "@/lib/archive";
import {
  AlbumArtwork,
  ChapterCover,
} from "./editorial-media";
import { formatChapterPath } from "./editorial-format";

export function EmptyState({
  title,
  action,
}: {
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

export function ChapterChoice({
  archive,
  chapter,
  index,
  detail,
  onSelect,
}: {
  archive: ArchiveEnvelopeV1;
  chapter: Cube;
  index: number;
  detail: ReactNode;
  onSelect: (chapterId: string) => void;
}) {
  return (
    <button
      className="chapter-choice"
      type="button"
      onClick={() => onSelect(chapter.id)}
    >
      <span>{String(index + 1).padStart(2, "0")}</span>
      <ChapterCover archive={archive} chapter={chapter} />
      <span className="track-info">
        <strong>{formatChapterPath(archive, chapter)}</strong>
        <small>{detail}</small>
      </span>
      <em>선택</em>
    </button>
  );
}

export function TrackLine({
  track,
  index,
  tags = [],
  context,
  actions,
  sharedId,
  maxTags = 2,
  onTagClick,
}: {
  track: TrackReference;
  index: number;
  tags?: TagDefinition[];
  context?: string;
  actions?: ReactNode;
  sharedId?: string;
  maxTags?: number;
  onTagClick?: (tag: TagDefinition) => void;
}) {
  return (
    <article
      className="track-line"
      style={{ "--track-delay": `${Math.min(index, 6) * 24}ms` } as CSSProperties}
    >
      <span className="track-number">{String(index + 1).padStart(2, "0")}</span>
      <AlbumArtwork track={track} sharedId={sharedId} decorative />
      <div className="track-info">
        <strong>{track.title}</strong>
        <small>{track.artist}{track.album ? ` · ${track.album}` : ""}</small>
        {context ? <em>{context}</em> : null}
        {tags.length ? (
          <div className="tag-row" style={{ marginTop: 7 }}>
            {tags.slice(0, maxTags).map((tag) => onTagClick ? (
              <button
                className="tag"
                key={tag.id}
                type="button"
                onClick={() => onTagClick(tag)}
                aria-label={`${tag.label} 태그로 검색`}
              >
                #{tag.label}
              </button>
            ) : <span className="tag" key={tag.id}>#{tag.label}</span>)}
          </div>
        ) : null}
      </div>
      <div className="track-actions">
        {actions}
      </div>
    </article>
  );
}
