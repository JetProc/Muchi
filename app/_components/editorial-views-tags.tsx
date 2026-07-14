"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  TAG_CATEGORIES,
  createTags,
  deleteTag,
  normalizeTagLabel,
  updateTag,
  type ArchiveEnvelopeV1,
  type TagCategory,
  type TagDefinition,
} from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";
import { TAG_CATEGORY_LABEL } from "./editorial-format";
import { EmptyState, PageHeader } from "./editorial-ui";
import type { ArchiveCommit, Notify } from "./editorial-types";

function parseBulkTags(value: string): string[] {
  const seen = new Set<string>();
  return value
    .split(/[\n,;]+/)
    .map((label) => label.trim())
    .filter((label) => {
      const normalized = normalizeTagLabel(label);
      if (!normalized || seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    });
}

export function TagManager({
  archive,
  commit,
  notify,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
}) {
  const [bulkValue, setBulkValue] = useState("");
  const [bulkCategory, setBulkCategory] = useState<TagCategory>("custom");
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editCategory, setEditCategory] = useState<TagCategory>("custom");
  const allTags = useMemo(
    () => Object.values(archive.data.tags).sort((left, right) => left.label.localeCompare(right.label, "ko")),
    [archive.data.tags],
  );
  const candidates = useMemo(() => parseBulkTags(bulkValue), [bulkValue]);
  const existingLabels = useMemo(
    () => new Set(allTags.map((tag) => tag.normalizedLabel)),
    [allTags],
  );
  const newCandidates = candidates.filter((label) => !existingLabels.has(normalizeTagLabel(label)));
  const duplicateCount = candidates.length - newCandidates.length;
  const normalizedQuery = normalizeTagLabel(query);
  const visibleTags = normalizedQuery
    ? allTags.filter((tag) => tag.normalizedLabel.includes(normalizedQuery))
    : allTags;
  const usageByTag = useMemo(() => {
    const usage = new Map<string, number>();
    Object.values(archive.data.cubeTracks).forEach((entry) => {
      entry.tagIds.forEach((tagId) => usage.set(tagId, (usage.get(tagId) ?? 0) + 1));
    });
    return usage;
  }, [archive.data.cubeTracks]);
  const inUseCount = allTags.filter((tag) => usageByTag.has(tag.id)).length;

  function submitBulk(event: FormEvent) {
    event.preventDefault();
    if (!newCandidates.length) return;
    try {
      const result = createTags(
        archive,
        newCandidates.map((label) => ({ label, category: bulkCategory })),
      );
      if (commit(result.archive, `${result.created}개의 태그 칩을 추가했어요.`)) {
        setBulkValue("");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "태그를 추가하지 못했어요.");
    }
  }

  function beginEdit(tag: TagDefinition) {
    setEditingId(tag.id);
    setEditLabel(tag.label);
    setEditCategory(tag.category);
  }

  function saveEdit(event: FormEvent, tagId: string) {
    event.preventDefault();
    try {
      if (commit(updateTag(archive, tagId, { label: editLabel, category: editCategory }), "태그 칩을 수정했어요.")) {
        setEditingId(null);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "태그를 수정하지 못했어요.");
    }
  }

  function remove(tag: TagDefinition) {
    const usage = usageByTag.get(tag.id) ?? 0;
    const detail = usage
      ? ` 이 태그는 ${usage}개의 곡 기억에서 함께 제거됩니다.`
      : " 아직 사용하지 않은 태그입니다.";
    if (!window.confirm(`‘${tag.label}’ 태그를 삭제할까요?${detail}`)) return;
    commit(deleteTag(archive, tag.id), "태그 칩을 삭제했어요.");
  }

  return (
    <div className="page-content tag-manager-view">
      <PageHeader
        eyebrow="TAG LIBRARY"
        title="기억에 쓸 언어를 미리 정리하세요"
        action={<Link className="button" href="/settings" intent="back">설정으로</Link>}
      />

      <div className="tag-manager-stats" aria-label="태그 현황">
        <span><strong>{allTags.length}</strong> 전체 태그</span>
        <span><strong>{inUseCount}</strong> 사용 중</span>
        <span><strong>{allTags.length - inUseCount}</strong> 미사용</span>
      </div>

      <div className="tag-manager-grid">
        <form className="panel tag-bulk-panel form-stack" onSubmit={submitBulk}>
          <div><span className="section-label">BULK CREATE</span><h2>한 번에 태그 만들기</h2></div>
          <div className="field"><label htmlFor="bulk-category">카테고리</label><select id="bulk-category" className="select" value={bulkCategory} onChange={(event) => setBulkCategory(event.target.value as TagCategory)}>{TAG_CATEGORIES.map((category) => <option value={category} key={category}>{TAG_CATEGORY_LABEL[category]}</option>)}</select></div>
          <div className="field"><label htmlFor="bulk-tags">태그 이름</label><textarea id="bulk-tags" className="textarea tag-bulk-input" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder={"새벽, 드라이브, 비 오는 날\n오래된 친구\n퇴근길"} /><span className="field-hint">{newCandidates.length}개 추가 예정{duplicateCount ? ` · 기존 태그 ${duplicateCount}개 제외` : ""}</span></div>
          {newCandidates.length ? <div className="tag-preview" aria-label="추가할 태그 미리보기">{newCandidates.slice(0, 24).map((label) => <span className="tag" key={normalizeTagLabel(label)}>#{label}</span>)}{newCandidates.length > 24 ? <span className="tag">+{newCandidates.length - 24}</span> : null}</div> : null}
          <button className="button button-primary" type="submit" disabled={!newCandidates.length}>{newCandidates.length ? `${newCandidates.length}개 태그 추가` : "추가할 태그 입력"}</button>
        </form>

        <section className="tag-library" aria-labelledby="tag-library-title">
          <div className="tag-library-head"><div><span className="section-label">YOUR CHIPS</span><h2 id="tag-library-title">등록된 태그</h2></div><label className="field tag-library-search" htmlFor="tag-search"><span className="sr-only">태그 검색</span><input id="tag-search" className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="태그 검색" /></label></div>
          {visibleTags.length ? TAG_CATEGORIES.map((category) => {
            const categoryTags = visibleTags.filter((tag) => tag.category === category);
            if (!categoryTags.length) return null;
            return (
              <section className="tag-category-section" key={category}>
                <div className="tag-category-head"><h3>{TAG_CATEGORY_LABEL[category]}</h3><span>{categoryTags.length}</span></div>
                <div className="tag-manager-list">
                  {categoryTags.map((tag) => editingId === tag.id ? (
                    <form className="tag-manager-row tag-manager-edit" key={tag.id} onSubmit={(event) => saveEdit(event, tag.id)}>
                      <input className="input" value={editLabel} onChange={(event) => setEditLabel(event.target.value)} maxLength={40} aria-label="태그 이름" autoFocus />
                      <select className="select" value={editCategory} onChange={(event) => setEditCategory(event.target.value as TagCategory)} aria-label="태그 카테고리">{TAG_CATEGORIES.map((item) => <option value={item} key={item}>{TAG_CATEGORY_LABEL[item]}</option>)}</select>
                      <div className="tag-manager-actions"><button className="button button-primary" type="submit">저장</button><button className="button" type="button" onClick={() => setEditingId(null)}>취소</button></div>
                    </form>
                  ) : (
                    <div className="tag-manager-row" key={tag.id}>
                      <div className="tag-manager-copy"><span className="tag">#{tag.label}</span><small>{usageByTag.get(tag.id) ?? 0}개 기억에서 사용</small></div>
                      <div className="tag-manager-actions"><button className="text-button" type="button" onClick={() => beginEdit(tag)}>수정</button><button className="text-button" type="button" onClick={() => remove(tag)}>삭제</button></div>
                    </div>
                  ))}
                </div>
              </section>
            );
          }) : <EmptyState icon="#" title={query ? "검색 결과가 없어요" : "아직 등록한 태그가 없어요"} />}
        </section>
      </div>
    </div>
  );
}
