"use client";

import { Check } from "lucide-react";
import { normalizeTagLabel } from "@/lib/archive";
import { TAG_STARTER_PACKS } from "@/lib/tag-starter-packs";

export function TagStarterPackPicker({
  selectedLabels,
  onToggle,
  existingLabels,
}: {
  selectedLabels: readonly string[];
  onToggle: (label: string) => void;
  existingLabels?: ReadonlySet<string>;
}) {
  const selected = new Set(selectedLabels.map(normalizeTagLabel));

  return (
    <div className="tag-starter-pack-grid">
      {TAG_STARTER_PACKS.map((pack) => {
        const availableCount = pack.tags.filter((tag) => !existingLabels?.has(normalizeTagLabel(tag))).length;
        const selectedCount = pack.tags.filter((tag) => selected.has(normalizeTagLabel(tag))).length;
        const disabled = availableCount === 0;
        return (
          <section
            className="tag-starter-pack"
            key={pack.id}
            data-selected={selectedCount > 0}
            aria-labelledby={`tag-starter-pack-${pack.id}`}
          >
            <span className="tag-starter-pack-head">
              <span><strong id={`tag-starter-pack-${pack.id}`}>{pack.title}</strong><small>{pack.description}</small></span>
              <span className="tag-starter-pack-state" aria-hidden="true">{disabled ? "완료" : selectedCount ? `${selectedCount}/${availableCount}` : `${availableCount}개`}</span>
            </span>
            <span className="tag-starter-pack-tags" aria-label={`${pack.title} 추천 태그`}>
              {pack.tags.map((tag) => {
                const existing = existingLabels?.has(normalizeTagLabel(tag));
                const isSelected = selected.has(normalizeTagLabel(tag));
                return (
                  <button
                    className={`tag tag-starter-pack-tag${existing ? " is-existing" : ""}`}
                    type="button"
                    key={tag}
                    onClick={() => onToggle(tag)}
                    aria-pressed={isSelected}
                    aria-label={existing ? `${tag}, 이미 추가됨` : tag}
                    disabled={existing}
                  >
                    {isSelected ? <Check size={13} aria-hidden="true" /> : null}#{tag}
                  </button>
                );
              })}
            </span>
          </section>
        );
      })}
    </div>
  );
}
