"use client";

import { useMemo, useState, type FormEvent } from "react";
import {
  createTags,
  deleteTag,
  getTagGroups,
  normalizeTagLabel,
  updateTag,
  type ArchiveEnvelopeV1,
  type TagDefinition,
} from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";
import { useModalFocus } from "./editorial-accessibility";
import { EmptyState, PageHeader } from "./editorial-ui";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { formatDate } from "./editorial-format";
import { TagLink } from "./editorial-tag-link";

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
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const createDialogRef = useModalFocus<HTMLFormElement>(createOpen, () => setCreateOpen(false));
  const tagGroups = useMemo(() => getTagGroups(archive), [archive]);
  const allTags = useMemo(() => tagGroups.map((group) => group.tag), [tagGroups]);
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
  const groupByTagId = useMemo(
    () => new Map(tagGroups.map((group) => [group.tag.id, group])),
    [tagGroups],
  );
  const usageByTag = useMemo(() => {
    const usage = new Map<string, number>();
    Object.values(archive.data.cubeTracks).forEach((entry) => {
      entry.tagIds.forEach((tagId) => usage.set(tagId, (usage.get(tagId) ?? 0) + 1));
    });
    return usage;
  }, [archive.data.cubeTracks]);

  function submitBulk(event: FormEvent) {
    event.preventDefault();
    if (!newCandidates.length) return;
    try {
      const result = createTags(
        archive,
        newCandidates.map((label) => label),
      );
      if (commit(result.archive, `${result.created}개의 태그를 추가했어요.`)) {
        setBulkValue("");
        setCreateOpen(false);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "태그를 추가하지 못했어요.");
    }
  }

  function beginEdit(tag: TagDefinition) {
    setEditingId(tag.id);
    setEditLabel(tag.label);
  }

  function saveEdit(event: FormEvent, tagId: string) {
    event.preventDefault();
    try {
      if (commit(updateTag(archive, tagId, { label: editLabel }), "태그를 수정했어요.")) {
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
    commit(deleteTag(archive, tag.id), "태그를 삭제했어요.");
  }

  return (
    <div className="page-content tag-manager-view">
      <PageHeader
        title="키워드"
        action={<div className="page-header-actions"><button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>새 태그</button><Link className="button" href="/settings" intent="back">설정</Link></div>}
      />

      <section className="tag-library" aria-labelledby="tag-library-title">
        <div className="tag-library-head"><div><h2 id="tag-library-title">키워드</h2></div><label className="field tag-library-search" htmlFor="tag-search"><span className="sr-only">키워드 검색</span><input id="tag-search" className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="키워드 검색" /></label></div>
        {visibleTags.length ? (
          <div className="tag-manager-list">
            {visibleTags.map((tag) => editingId === tag.id ? (
              <form className="tag-manager-row tag-manager-edit" key={tag.id} onSubmit={(event) => saveEdit(event, tag.id)}>
                <input className="input" value={editLabel} onChange={(event) => setEditLabel(event.target.value)} maxLength={40} aria-label="태그 이름" autoFocus />
                <div className="tag-manager-actions"><button className="button button-primary" type="submit">완료</button><button className="button" type="button" onClick={() => setEditingId(null)}>취소</button></div>
              </form>
            ) : (
              <div className="tag-manager-row" key={tag.id}>
                <TagLink tag={tag} className="tag-manager-copy">
                  <span className="tag">#{tag.label}</span>
                  <small>
                    {groupByTagId.get(tag.id)?.trackCount ?? 0}곡
                    {groupByTagId.get(tag.id)?.updatedAt
                      ? ` · ${formatDate(groupByTagId.get(tag.id)!.updatedAt!)}`
                      : ""}
                  </small>
                </TagLink>
                <details className="tag-manager-menu"><summary className="button">관리</summary><div className="tag-manager-actions"><button className="button" type="button" onClick={() => beginEdit(tag)}>수정</button><button className="button button-danger" type="button" onClick={() => remove(tag)}>삭제</button></div></details>
              </div>
            ))}
          </div>
        ) : <EmptyState title={query ? "검색 결과가 없어요" : "아직 등록한 태그가 없어요"} />}
      </section>

      {createOpen ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setCreateOpen(false)}>
          <form ref={createDialogRef} className="dialog tag-bulk-panel form-stack" role="dialog" aria-modal="true" aria-labelledby="create-tags-title" onSubmit={submitBulk} onClick={(event) => event.stopPropagation()}>
            <div><span className="section-label">새 태그</span><h2 id="create-tags-title">한 번에 만들기</h2></div>
            <div className="field"><label htmlFor="bulk-tags">태그 이름</label><textarea id="bulk-tags" className="textarea tag-bulk-input" value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder={"운동할 때\n과거에 좋아했던 재즈\n첫 자취방에서"} /><span className="field-hint">쉼표나 줄바꿈으로 구분 · {newCandidates.length}개 추가 예정{duplicateCount ? ` · 기존 태그 ${duplicateCount}개 제외` : ""}</span></div>
            {newCandidates.length ? <div className="tag-preview" aria-label="추가할 태그 미리보기">{newCandidates.slice(0, 24).map((label) => <span className="tag" key={normalizeTagLabel(label)}>#{label}</span>)}{newCandidates.length > 24 ? <span className="tag">+{newCandidates.length - 24}</span> : null}</div> : null}
            <div className="dialog-actions"><button className="button" type="button" onClick={() => setCreateOpen(false)}>취소</button><button className="button button-primary" type="submit" disabled={!newCandidates.length}>{newCandidates.length ? `${newCandidates.length}개 추가` : "태그 입력"}</button></div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
