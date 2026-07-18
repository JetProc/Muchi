"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Plus, Search, X } from "lucide-react";
import { ARCHIVE_LIMITS, type TagDefinition } from "@/lib/archive";
import { useModalFocus } from "./editorial-accessibility";
import { MotionLink as Link } from "./editorial-motion";

interface TagPickerProps {
  tags: TagDefinition[];
  selectedTagIds: string[];
  suggestedTagIds?: string[];
  onToggle: (tagId: string) => void;
  usageCounts?: Record<string, number>;
  label?: string;
  maxSelected?: number;
  onCreate?: (label: string) => boolean;
  manageHref?: string;
}

function editDistance(left: string, right: string): number {
  const row = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let previous = row[0];
    row[0] = leftIndex;
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = row[rightIndex];
      row[rightIndex] = Math.min(
        row[rightIndex] + 1,
        row[rightIndex - 1] + 1,
        previous + Number(left[leftIndex - 1] !== right[rightIndex - 1]),
      );
      previous = above;
    }
  }
  return row[right.length];
}

export function TagPicker({
  tags,
  selectedTagIds,
  suggestedTagIds = [],
  onToggle,
  usageCounts = {},
  label = "어떤 순간에 다시 찾고 싶나요?",
  maxSelected = ARCHIVE_LIMITS.tagsPerCubeTrack,
  onCreate,
  manageHref = "/tags",
}: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const panelRef = useModalFocus<HTMLDivElement>(open, close);
  const sortedTags = useMemo(() => [...tags].sort((left, right) => {
    const selectedDifference = Number(selectedTagIds.includes(right.id)) - Number(selectedTagIds.includes(left.id));
    const usageDifference = (usageCounts[right.id] ?? 0) - (usageCounts[left.id] ?? 0);
    return selectedDifference || usageDifference || left.label.localeCompare(right.label, "ko");
  }), [selectedTagIds, tags, usageCounts]);
  const visibleTags = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("ko");
    if (!normalizedQuery) return sortedTags;
    return sortedTags.filter((tag) => (
      tag.label.toLocaleLowerCase("ko").includes(normalizedQuery)
    ));
  }, [query, sortedTags]);
  const selectedTags = useMemo(() => selectedTagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is TagDefinition => Boolean(tag)), [selectedTagIds, tags]);
  const suggestedTags = useMemo(() => suggestedTagIds
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is TagDefinition => Boolean(tag))
    .filter((tag) => !selectedTagIds.includes(tag.id))
    .slice(0, 5), [selectedTagIds, suggestedTagIds, tags]);
  const similarTags = useMemo(() => {
    const normalizedDraft = draft.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
    if (normalizedDraft.length < 2) return [];
    return tags.filter((tag) => {
      if (tag.normalizedLabel === normalizedDraft) return true;
      if (Math.abs(tag.normalizedLabel.length - normalizedDraft.length) > 2) return false;
      return tag.normalizedLabel.includes(normalizedDraft)
        || normalizedDraft.includes(tag.normalizedLabel)
        || editDistance(tag.normalizedLabel, normalizedDraft) <= 2;
    }).slice(0, 3);
  }, [draft, tags]);

  function showPicker() {
    setOpen(true);
    setQuery("");
    setCreating(false);
  }

  function close() {
    setOpen(false);
    setQuery("");
    setCreating(false);
    setDraft("");
  }

  function submitTag() {
    const labelText = draft.trim();
    if (!labelText || !onCreate?.(labelText)) return;
    setDraft("");
    setCreating(false);
  }

  return (
    <div className="tag-picker">
      <div className="tag-picker-heading">
        <span className="field-label">{label}</span>
        {selectedTagIds.length ? <span className="tag-picker-total">{selectedTagIds.length} / {maxSelected}</span> : null}
      </div>

      {suggestedTags.length ? (
        <div className="tag-picker-suggestions" aria-label="자주 쓰거나 최근에 쓴 태그">
          <span>빠른 선택</span>
          <div>
            {suggestedTags.map((tag) => (
              <button
                className="tag-picker-touch-target"
                type="button"
                key={tag.id}
                aria-pressed="false"
                onClick={() => onToggle(tag.id)}
              >#{tag.label}</button>
            ))}
          </div>
        </div>
      ) : null}

      <button
        className="tag-picker-open"
        type="button"
        onClick={showPicker}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className="tag-picker-open-copy">
          <strong>태그 선택</strong>
          <span>{selectedTagIds.length
            ? selectedTags.map((tag) => `#${tag.label}`).join(" · ")
            : "운동할 때, 과거에 좋아했던 음악처럼 남겨보세요"}</span>
        </span>
        <span className="tag-picker-open-meta">
          {selectedTagIds.length ? <em>{selectedTagIds.length}</em> : null}
          <ChevronRight size={16} aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <>
          <button className="tag-picker-backdrop" type="button" onClick={close} aria-label="태그 선택 닫기" />
          <div
            ref={panelRef}
            className="tag-picker-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tag-picker-title"
          >
            <div className="tag-picker-panel-handle" aria-hidden="true" />
            <div className="tag-picker-panel-head">
              <div>
                <strong id="tag-picker-title">경험 태그</strong>
                <span>{selectedTagIds.length} / {maxSelected}</span>
              </div>
              <button className="icon-button" type="button" onClick={close} aria-label="닫기">
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <label className="tag-picker-search">
              <Search size={15} aria-hidden="true" />
              <span className="sr-only">태그 검색 또는 새 태그 만들기</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="태그 검색 또는 새 태그 만들기"
                autoComplete="off"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="태그 검색어 지우기">
                  <X size={13} aria-hidden="true" />
                </button>
              ) : null}
            </label>

            <div className="tag-picker-options" role="group" aria-label="경험 태그 목록">
              {visibleTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                const disabled = !selected && selectedTagIds.length >= maxSelected;
                return (
                  <button
                    className={`tag-picker-option${selected ? " is-selected" : ""}`}
                    key={tag.id}
                    type="button"
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => onToggle(tag.id)}
                  >
                    <span>#{tag.label}</span>
                    {selected ? <Check size={16} aria-hidden="true" /> : null}
                  </button>
                );
              })}
              {!visibleTags.length ? <p className="tag-picker-empty">일치하는 태그가 없습니다.</p> : null}
            </div>

            <div className="tag-picker-footer">
              {onCreate ? (
                creating ? (
                  <div className="tag-picker-create">
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        submitTag();
                      }}
                      maxLength={ARCHIVE_LIMITS.tagLabel}
                      placeholder="예: 운동할 때, 첫 자취방에서"
                      aria-label="새 태그 이름"
                    />
                    <button type="button" onClick={submitTag} disabled={!draft.trim()} aria-label="새 태그 추가">
                      <Plus size={15} aria-hidden="true" />
                    </button>
                    {similarTags.length ? (
                      <div className="tag-picker-similar" role="status">
                        <span>비슷한 기존 태그</span>
                        {similarTags.map((tag) => (
                          <button
                            type="button"
                            key={tag.id}
                            onClick={() => {
                              if (!selectedTagIds.includes(tag.id)) onToggle(tag.id);
                              setDraft("");
                              setCreating(false);
                            }}
                          >#{tag.label} 쓰기</button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <button className="tag-picker-create-trigger" type="button" onClick={() => setCreating(true)}>
                    <Plus size={14} aria-hidden="true" /> 새 태그
                  </button>
                )
              ) : <span />}
              <Link className="text-link" href={manageHref} intent="tab">태그 관리</Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
