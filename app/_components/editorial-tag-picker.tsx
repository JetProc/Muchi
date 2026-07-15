"use client";

import { useMemo, useState } from "react";
import { Check, ChevronRight, Plus, Search, X } from "lucide-react";
import {
  ARCHIVE_LIMITS,
  type TagCategory,
  type TagDefinition,
} from "@/lib/archive";
import { useModalFocus } from "./editorial-accessibility";
import { MotionLink as Link } from "./editorial-motion";

const TAG_PICKER_CATEGORIES = ["mood", "genre", "custom"] as const;

type TagPickerCategory = (typeof TAG_PICKER_CATEGORIES)[number];
export type EditableTagCategory = "emotion" | "situation" | "genre" | "custom";

const CATEGORY_LABEL: Record<TagPickerCategory, string> = {
  mood: "감정·상황",
  genre: "장르",
  custom: "직접 만든 태그",
};

function normalizeCategory(category: TagCategory): TagPickerCategory {
  if (category === "emotion" || category === "situation" || category === "energy" || category === "texture") {
    return "mood";
  }
  return category;
}

function categoryForNewTag(category: TagPickerCategory): EditableTagCategory {
  return category === "mood" ? "emotion" : category;
}

interface TagPickerProps {
  tags: TagDefinition[];
  selectedTagIds: string[];
  onToggle: (tagId: string) => void;
  usageCounts?: Record<string, number>;
  label?: string;
  maxSelected?: number;
  onCreate?: (category: EditableTagCategory, label: string) => boolean;
  manageHref?: string;
}

export function TagPicker({
  tags,
  selectedTagIds,
  onToggle,
  usageCounts = {},
  label = "태그",
  maxSelected = ARCHIVE_LIMITS.tagsPerCubeTrack,
  onCreate,
  manageHref = "/tags",
}: TagPickerProps) {
  const [activeCategory, setActiveCategory] = useState<TagPickerCategory | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState("");
  const open = activeCategory !== null;
  const panelRef = useModalFocus<HTMLDivElement>(open, close);
  const tagsByCategory = useMemo(() => TAG_PICKER_CATEGORIES.reduce<Record<TagPickerCategory, TagDefinition[]>>(
    (groups, category) => {
      groups[category] = tags
        .filter((tag) => normalizeCategory(tag.category) === category)
        .sort((left, right) => {
          const selectedDifference = Number(selectedTagIds.includes(right.id)) - Number(selectedTagIds.includes(left.id));
          const usageDifference = (usageCounts[right.id] ?? 0) - (usageCounts[left.id] ?? 0);
          return selectedDifference || usageDifference || left.label.localeCompare(right.label, "ko");
        });
      return groups;
    },
    { mood: [], genre: [], custom: [] },
  ), [selectedTagIds, tags, usageCounts]);
  const visibleTags = useMemo(() => {
    if (!activeCategory) return [];
    const normalizedQuery = query.trim().toLocaleLowerCase("ko");
    if (!normalizedQuery) return tagsByCategory[activeCategory];
    return tagsByCategory[activeCategory].filter((tag) => (
      tag.label.toLocaleLowerCase("ko").includes(normalizedQuery)
    ));
  }, [activeCategory, query, tagsByCategory]);

  function openCategory(category: TagPickerCategory) {
    setActiveCategory(category);
    setQuery("");
    setCreating(false);
  }

  function close() {
    setActiveCategory(null);
    setQuery("");
    setCreating(false);
    setDraft("");
  }

  function submitTag() {
    const labelText = draft.trim();
    if (!activeCategory || !labelText || !onCreate?.(categoryForNewTag(activeCategory), labelText)) return;
    setDraft("");
    setCreating(false);
  }

  return (
    <div className="tag-picker">
      <div className="tag-picker-heading">
        <span className="field-label">{label}</span>
        {selectedTagIds.length ? <span className="tag-picker-total">{selectedTagIds.length} / {maxSelected}</span> : null}
      </div>

      <div className="tag-picker-category-list">
        {TAG_PICKER_CATEGORIES.map((category) => {
          const categoryTags = tagsByCategory[category];
          const selectedTags = categoryTags.filter((tag) => selectedTagIds.includes(tag.id));
          return (
            <button
              className="tag-picker-category-row"
              key={category}
              type="button"
              onClick={() => openCategory(category)}
              aria-haspopup="dialog"
              aria-expanded={activeCategory === category}
            >
              <span className="tag-picker-category-copy">
                <strong>{CATEGORY_LABEL[category]}</strong>
                <span>{selectedTags.length ? selectedTags.map((tag) => `#${tag.label}`).join(" · ") : "선택"}</span>
              </span>
              <span className="tag-picker-category-meta">
                {selectedTags.length ? <em>{selectedTags.length}</em> : null}
                <ChevronRight size={16} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>

      {open && activeCategory ? (
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
                <strong id="tag-picker-title">{CATEGORY_LABEL[activeCategory]}</strong>
                <span>{selectedTagIds.length} / {maxSelected}</span>
              </div>
              <button className="icon-button" type="button" onClick={close} aria-label="닫기">
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <label className="tag-picker-search">
              <Search size={15} aria-hidden="true" />
              <span className="sr-only">{CATEGORY_LABEL[activeCategory]} 태그 검색</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={`${CATEGORY_LABEL[activeCategory]} 태그 검색`}
                autoComplete="off"
              />
              {query ? (
                <button type="button" onClick={() => setQuery("")} aria-label="태그 검색어 지우기">
                  <X size={13} aria-hidden="true" />
                </button>
              ) : null}
            </label>

            <div className="tag-picker-options" role="listbox" aria-label={`${CATEGORY_LABEL[activeCategory]} 태그 목록`} aria-multiselectable="true">
              {visibleTags.map((tag) => {
                const selected = selectedTagIds.includes(tag.id);
                const disabled = !selected && selectedTagIds.length >= maxSelected;
                return (
                  <button
                    className={`tag-picker-option${selected ? " is-selected" : ""}`}
                    key={tag.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
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
                      placeholder={`새 ${CATEGORY_LABEL[activeCategory]} 태그`}
                      aria-label="새 태그 이름"
                    />
                    <button type="button" onClick={submitTag} disabled={!draft.trim()} aria-label="새 태그 추가">
                      <Plus size={15} aria-hidden="true" />
                    </button>
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
