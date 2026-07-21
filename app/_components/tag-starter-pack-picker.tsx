"use client";

import { Check } from "lucide-react";
import { normalizeTagLabel } from "@/lib/archive";
import {
  TAG_STARTER_PACKS,
  type TagStarterPackId,
} from "@/lib/tag-starter-packs";

export function TagStarterPackPicker({
  selectedPackIds,
  onToggle,
  existingLabels,
}: {
  selectedPackIds: readonly TagStarterPackId[];
  onToggle: (packId: TagStarterPackId) => void;
  existingLabels?: ReadonlySet<string>;
}) {
  return (
    <div className="tag-starter-pack-grid">
      {TAG_STARTER_PACKS.map((pack) => {
        const selected = selectedPackIds.includes(pack.id);
        const availableCount = pack.tags.filter((tag) => !existingLabels?.has(normalizeTagLabel(tag))).length;
        const disabled = availableCount === 0;
        return (
          <button
            className="tag-starter-pack"
            type="button"
            key={pack.id}
            onClick={() => onToggle(pack.id)}
            aria-pressed={selected}
            disabled={disabled}
          >
            <span className="tag-starter-pack-head">
              <span><strong>{pack.title}</strong><small>{pack.description}</small></span>
              <span className="tag-starter-pack-state" aria-hidden="true">{selected ? <Check size={15} /> : disabled ? "완료" : `${availableCount}개`}</span>
            </span>
            <span className="tag-starter-pack-tags" aria-label={`${pack.title} 추천 태그`}>
              {pack.tags.map((tag) => {
                const existing = existingLabels?.has(normalizeTagLabel(tag));
                return <span className={`tag${existing ? " is-existing" : ""}`} key={tag}>#{tag}</span>;
              })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
