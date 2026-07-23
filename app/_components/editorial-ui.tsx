"use client";

import { useState, type CSSProperties, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { Check, Plus, X } from "lucide-react";
import {
  ARCHIVE_LIMITS,
  type ArchiveEnvelopeV1,
  type AffectionLevel,
  type Cube,
  type TagDefinition,
  type TrackReference,
} from "@/lib/archive";
import {
  AlbumArtwork,
  ChapterCover,
} from "./editorial-media";
import { formatChapterPath, formatTrackArtist } from "./editorial-format";

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

export function CenteredEmptyMessage({
  children,
}: {
  children: ReactNode;
}) {
  return <div className="centered-empty-message">{children}</div>;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header-copy">
        {eyebrow ? <span className="section-label">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {description ? <p className="page-header-description">{description}</p> : null}
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
  showSelectionLabel = true,
}: {
  archive: ArchiveEnvelopeV1;
  chapter: Cube;
  index: number;
  detail: ReactNode;
  onSelect: (chapterId: string) => void;
  showSelectionLabel?: boolean;
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
      {showSelectionLabel ? <em>선택</em> : null}
    </button>
  );
}

export function InlineChapterCreate({
  onCreate,
}: {
  onCreate: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    onCreate(trimmedName);
    setName("");
    setOpen(false);
  }

  if (!open) {
    return (
      <button className="tag-picker-inline-create-trigger chapter-picker-inline-create-trigger" type="button" onClick={() => setOpen(true)}>
        <Plus size={15} aria-hidden="true" />
        <span>새 챕터</span>
      </button>
    );
  }

  return (
    <form className="tag-picker-inline-create chapter-picker-inline-create" onSubmit={submit}>
      <label className="sr-only" htmlFor="inline-chapter-name">새 챕터 이름</label>
      <input id="inline-chapter-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={ARCHIVE_LIMITS.cubeName} placeholder="예: 비 오는 날의 음악" autoFocus />
      <button type="submit" aria-label="챕터 만들기" disabled={!name.trim()}><Check size={15} aria-hidden="true" /></button>
      <button type="button" aria-label="챕터 만들기 취소" onClick={() => { setName(""); setOpen(false); }}><X size={15} aria-hidden="true" /></button>
    </form>
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
  selected = false,
  selectable = false,
  showAlbum = true,
  showIndex = true,
  onRowClick,
  affection = null,
}: {
  track: TrackReference;
  index: number;
  tags?: TagDefinition[];
  context?: string;
  actions?: ReactNode;
  sharedId?: string;
  maxTags?: number;
  onTagClick?: (tag: TagDefinition) => void;
  selected?: boolean;
  selectable?: boolean;
  showAlbum?: boolean;
  showIndex?: boolean;
  onRowClick?: () => void;
  affection?: AffectionLevel | null;
}) {
  function onRowKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (!selectable || !onRowClick || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onRowClick();
  }

  return (
    <article
      className={`track-line${selectable ? " is-selectable" : ""}${selected ? " is-selected" : ""}`}
      onClick={onRowClick}
      onKeyDown={onRowKeyDown}
      role={selectable ? "button" : undefined}
      tabIndex={selectable ? 0 : undefined}
      aria-pressed={selectable ? selected : undefined}
      data-selected={selectable ? selected : undefined}
      style={{ "--track-delay": `${Math.min(index, 6) * 24}ms` } as CSSProperties}
    >
      {showIndex ? <span className="track-number">{String(index + 1).padStart(2, "0")}</span> : null}
      <AlbumArtwork track={track} sharedId={sharedId} decorative />
      <div className="track-info">
        <strong>{track.title}{affection ? <AffectionDot affection={affection} /> : null}</strong>
        <small>{formatTrackArtist(track)}{showAlbum && track.album ? ` · ${track.album}` : ""}</small>
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

const AFFECTION_LABELS: Record<AffectionLevel, string> = {
  red: "최애",
  orange: "자주 찾음",
  yellow: "좋아함",
};

export function AffectionDot({ affection }: { affection: AffectionLevel }) {
  return <span className={`affection-dot is-${affection}`} title={AFFECTION_LABELS[affection]} aria-label={`애정도: ${AFFECTION_LABELS[affection]}`} />;
}

export function AffectionSelector({
  value,
  onChange,
}: {
  value: AffectionLevel | null;
  onChange: (value: AffectionLevel | null) => void;
}) {
  const options: Array<{ value: AffectionLevel; label: string }> = [
    { value: "red", label: "최애" },
    { value: "orange", label: "자주 찾음" },
    { value: "yellow", label: "좋아함" },
  ];
  return (
    <section className="affection-selector" aria-labelledby="affection-title">
      <div className="affection-selector-heading">
        <h2 id="affection-title" className="field-label">애정도</h2>
      </div>
      <div className="affection-options" role="group" aria-label="곡 애정도">
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <button
              className={`affection-option${selected ? " is-selected" : ""} is-${option.value}`}
              type="button"
              key={option.value}
              onClick={() => onChange(selected ? null : option.value)}
              aria-pressed={selected}
            >
              <AffectionDot affection={option.value} />
              {option.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
