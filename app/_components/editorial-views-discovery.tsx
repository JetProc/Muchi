"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { X } from "lucide-react";
import {
  removeSeedData,
  resetArchive,
  searchArchive,
  selectRecap,
  serializeArchive,
  validateArchiveEnvelope,
  type ArchiveEnvelopeV1,
  type ArchiveSearchResult,
  type MotionPreference,
  type RecapEntry,
  type RecapMode,
  type TagCategory,
} from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";
import type { PreviewControls } from "./editorial-media";
import { useModalFocus } from "./editorial-accessibility";
import { EmptyState, PageHeader, TrackLine } from "./editorial-ui";
import { formatMemory, TAG_CATEGORY_LABEL } from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";

const SEARCH_TAG_CATEGORIES = ["period", "genre", "emotion", "situation", "custom"] as const;
type SearchTagCategory = (typeof SEARCH_TAG_CATEGORIES)[number];

function normalizeSearchTagCategory(category: TagCategory): SearchTagCategory {
  return category === "energy" || category === "texture" ? "emotion" : category;
}

function SearchResultLine({
  result,
  index,
  preview,
  onTagClick,
}: {
  result: ArchiveSearchResult;
  index: number;
  preview: PreviewControls;
  onTagClick: (tagId: string) => void;
}) {
  if (result.kind === "inbox") {
    return (
      <TrackLine
        track={result.track}
        index={index}
        preview={preview}
        showPreview={false}
        context="임시 보관함 · 아직 미분류"
        actions={<Link className="button" href="/inbox">정리하기</Link>}
      />
    );
  }
  return (
    <TrackLine
      track={result.track}
      index={index}
      preview={preview}
      showPreview={false}
      sharedId={result.cubeTrack.id}
      tags={result.tags}
      maxTags={2}
      onTagClick={(tag) => onTagClick(tag.id)}
      context={`${result.cube.name} · ${result.cubeTrack.character || formatMemory(result.cubeTrack.memoryPeriod)}`}
      actions={<Link className="button" href={`/memory?id=${encodeURIComponent(result.cubeTrack.id)}`} intent="shared" sharedId={result.cubeTrack.id}>기억 열기</Link>}
    />
  );
}

export function Search({
  archive,
  preview,
}: {
  archive: ArchiveEnvelopeV1;
  preview: PreviewControls;
}) {
  const [query, setQuery] = useState("");
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [tagMatch, setTagMatch] = useState<"all" | "any">("all");
  const [tagCategory, setTagCategory] = useState<SearchTagCategory>("period");
  const tags = useMemo(() => Object.values(archive.data.tags), [archive.data.tags]);
  const categoryTags = tags
    .filter((tag) => normalizeSearchTagCategory(tag.category) === tagCategory)
    .sort((left, right) => {
      const selectedDifference = Number(tagIds.includes(right.id)) - Number(tagIds.includes(left.id));
      return selectedDifference || left.label.localeCompare(right.label, "ko");
    });
  const hasSearch = Boolean(query.trim() || tagIds.length);
  const results = hasSearch
    ? searchArchive(archive, { query, tagIds, tagMatch, includeInbox: true })
    : [];
  function toggle(id: string) {
    setTagIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }
  function resetSearch() {
    setQuery("");
    setTagIds([]);
    setTagMatch("all");
  }
  return (
    <div className="page-content search-view">
      <header className="search-workspace-header">
        <h1 className="sr-only">기록 검색</h1>
        <div className="search-query-row">
          <label className="sr-only" htmlFor="archive-query">곡, 아티스트, 챕터, 등록 월, 기억 검색</label>
          <input
            id="archive-query"
            className="input search-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="곡, 아티스트, 챕터, 기억 검색"
            enterKeyHint="search"
            autoComplete="off"
          />
          {query || tagIds.length ? (
            <button
              className="search-reset"
              type="button"
              onClick={resetSearch}
              aria-label="검색 초기화"
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
        {tags.length ? (
          <div className="search-tag-rail">
            <div className="search-tag-categories" role="group" aria-label="태그 카테고리">
              {SEARCH_TAG_CATEGORIES.map((category) => {
                const selectedCount = tags.filter((tag) => (
                  normalizeSearchTagCategory(tag.category) === category && tagIds.includes(tag.id)
                )).length;
                return (
                  <button
                    key={category}
                    className={`search-tag-category${tagCategory === category ? " is-active" : ""}`}
                    type="button"
                    onClick={() => setTagCategory(category)}
                    aria-pressed={tagCategory === category}
                  >
                    <span>{TAG_CATEGORY_LABEL[category]}</span>
                    {selectedCount ? <span className="search-tag-category-count">{selectedCount}</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="search-tag-list" role="group" aria-label="태그 필터">
              {categoryTags.map((tag) => (
                <button
                  key={tag.id}
                  className={`tag${tagIds.includes(tag.id) ? " is-selected" : ""}`}
                  type="button"
                  onClick={() => toggle(tag.id)}
                  aria-pressed={tagIds.includes(tag.id)}
                >
                  #{tag.label}
                  {tagIds.includes(tag.id) ? <X size={10} aria-hidden="true" /> : null}
                </button>
              ))}
              {!categoryTags.length ? <span className="search-tag-empty">등록된 태그가 없습니다.</span> : null}
            </div>
            {tagIds.length > 1 ? (
              <select
                className="search-tag-match"
                value={tagMatch}
                onChange={(event) => setTagMatch(event.target.value as "all" | "any")}
                aria-label="태그 조합 방식"
              >
                <option value="all">모두</option>
                <option value="any">하나 이상</option>
              </select>
            ) : null}
          </div>
        ) : null}
      </header>

      <section className="search-results-section" aria-labelledby="search-results-title">
        <div className="search-results-head">
          <h2 id="search-results-title" aria-live="polite">
            {hasSearch ? `${results.length}개의 기록` : "찾고 싶은 기억을 입력하세요"}
          </h2>
        </div>
        {results.length ? (
          <div className="track-list track-list-unified">
            {results.map((result, index) => (
              <SearchResultLine
                result={result}
                key={result.kind === "inbox" ? `inbox:${result.track.id}` : result.cubeTrack.id}
                index={index}
                preview={preview}
                onTagClick={(tagId) => {
                  const tag = archive.data.tags[tagId];
                  if (tag) setTagCategory(normalizeSearchTagCategory(tag.category));
                  setTagIds((current) => current.includes(tagId) ? current : [...current, tagId]);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="search-empty">
            {hasSearch ? "검색 결과가 없습니다." : "곡, 아티스트, 챕터 또는 태그로 찾을 수 있어요."}
          </div>
        )}
      </section>

    </div>
  );
}

function RecapLine({
  entry,
  index,
  preview,
}: {
  entry: RecapEntry;
  index: number;
  preview: PreviewControls;
}) {
  const reason = {
    "same-month": "몇 년 전 같은 달",
    "same-season": "같은 계절의 기억",
    "saved-date": "저장했던 이맘때",
    random: "우연히 꺼낸 기억",
  }[entry.reason];
  return (
    <TrackLine
      track={entry.track}
      index={index}
      preview={preview}
      showPreview={false}
      sharedId={entry.cubeTrack.id}
      tags={entry.tags}
      context={`${reason} · ${entry.cube.name} · ${formatMemory(entry.cubeTrack.memoryPeriod)}`}
      actions={<Link className="button" href={`/memory?id=${encodeURIComponent(entry.cubeTrack.id)}`} intent="shared" sharedId={entry.cubeTrack.id}>기억 열기</Link>}
    />
  );
}

export function RecapSpread({
  entries,
  preview,
}: {
  entries: RecapEntry[];
  preview: PreviewControls;
}) {
  return (
    <section className="recap-spread">
      {entries.length ? (
        <div className="track-list">
          {entries.map((entry, index) => (
            <RecapLine key={entry.cubeTrack.id} entry={entry} index={index} preview={preview} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon=""
          title="아직 돌아올 기억이 부족해요"
          action={<Link className="button button-primary" href="/chapters">곡에 기억 남기기</Link>}
        />
      )}
    </section>
  );
}

export function Recap({
  archive,
  preview,
}: {
  archive: ArchiveEnvelopeV1;
  preview: PreviewControls;
}) {
  const [mode, setMode] = useState<RecapMode>("this-time");
  const [createOpen, setCreateOpen] = useState(false);
  const createDialogRef = useModalFocus<HTMLDivElement>(createOpen, () => setCreateOpen(false));
  const entries = useMemo(() => selectRecap(archive, { mode, limit: 12 }), [archive, mode]);
  const label: Record<RecapMode, string> = {
    "this-time": "이맘때의 음악",
    timeline: "지난 계절의 나",
    random: "무작위 기억",
  };
  return (
    <div className="page-content recap-view">
      <div className="recap-create-action">
        <button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>회고 만들기</button>
      </div>
      <RecapSpread entries={entries} preview={preview} />
      {createOpen ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setCreateOpen(false)}>
          <div ref={createDialogRef} className="dialog recap-create-dialog" role="dialog" aria-modal="true" aria-labelledby="recap-create-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="recap-create-title">회고 만들기</h2>
            <div className="filter-row" role="group" aria-label="회고 방식">
              {(["this-time", "timeline", "random"] as RecapMode[]).map((item) => (
                <button
                  key={item}
                  className={`button${mode === item ? " button-primary" : ""}`}
                  type="button"
                  aria-pressed={mode === item}
                  onClick={() => {
                    setMode(item);
                    setCreateOpen(false);
                  }}
                >
                  {label[item]}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Settings({
  archive,
  commit,
  notify,
  storageBlocked,
  setStorageBlocked,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
  storageBlocked: string | null;
  setStorageBlocked: (value: string | null) => void;
}) {
  const importInputRef = useRef<HTMLInputElement>(null);

  function setMotion(motion: MotionPreference) {
    commit({
      ...archive,
      updatedAt: new Date().toISOString(),
      data: {
        ...archive.data,
        preferences: { ...archive.data.preferences, motion },
      },
    }, "모션 설정을 저장했어요.");
  }

  function setRecap(enabled: boolean) {
    commit({
      ...archive,
      updatedAt: new Date().toISOString(),
      data: {
        ...archive.data,
        preferences: { ...archive.data.preferences, recapEnabled: enabled },
      },
    }, enabled ? "회고 화면을 켰어요." : "회고 화면을 껐어요.");
  }

  function exportData() {
    const blob = new Blob([serializeArchive(archive)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mumu-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("현재 음악 기록을 JSON 파일로 백업했어요.");
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((raw) => {
      try {
        const value: unknown = JSON.parse(raw);
        if (!validateArchiveEnvelope(value)) throw new Error("MUMU 백업 파일 형식이 아닙니다.");
        if (window.confirm("현재 기록을 이 백업으로 교체할까요? 이 작업은 되돌릴 수 없습니다.")) {
          commit(value, "백업한 음악 기록을 복원했어요.", true);
        }
      } catch (error) {
        notify(error instanceof Error ? error.message : "백업 파일을 읽지 못했어요.");
      }
    }).catch(() => notify("백업 파일을 읽지 못했어요."));
    event.target.value = "";
  }

  function replace(mode: "seed" | "empty") {
    const message = mode === "seed"
      ? "현재 기록을 지우고 샘플 아카이브로 초기화할까요?"
      : "모든 기록을 지우고 빈 아카이브로 시작할까요?";
    if (!window.confirm(message)) return;
    commit(
      resetArchive(mode),
      mode === "seed" ? "샘플 기록을 복원했어요." : "빈 아카이브로 초기화했어요.",
      true,
    );
    setStorageBlocked(null);
  }

  return (
    <div className="page-content settings-view">
      <PageHeader eyebrow="설정" title="내 음악 아카이브" />
      {storageBlocked ? <div className="notice notice-danger" style={{ marginBottom: 18 }}>저장소 보호 모드가 켜져 있습니다. 백업할 수 있다면 먼저 원본 브라우저 데이터를 보존한 뒤 초기화하세요.</div> : null}
      <section className="settings-group" aria-labelledby="settings-display-title">
        <h2 id="settings-display-title">표시</h2>
        <div className="panel settings-list">
          <div className="setting-row"><h3>모션 강도</h3><select className="select" style={{ width: 190 }} value={archive.data.preferences.motion} onChange={(event) => setMotion(event.target.value as MotionPreference)} aria-label="모션 강도"><option value="system">시스템 설정 따르기</option><option value="reduce">모션 줄이기</option><option value="full">감성 모션 사용</option></select></div>
          <div className="setting-row"><h3>이맘때의 음악</h3><button className={`toggle${archive.data.preferences.recapEnabled ? " is-on" : ""}`} type="button" role="switch" aria-checked={archive.data.preferences.recapEnabled} onClick={() => setRecap(!archive.data.preferences.recapEnabled)}><span className="toggle-label" aria-hidden="true">{archive.data.preferences.recapEnabled ? "켬" : "끔"}</span><span className="sr-only">회고 {archive.data.preferences.recapEnabled ? "끄기" : "켜기"}</span></button></div>
        </div>
      </section>
      <section className="settings-group" aria-labelledby="settings-data-title">
        <h2 id="settings-data-title">데이터</h2>
        <div className="panel settings-list">
          <div className="setting-row"><h3>태그 관리</h3><Link className="button" href="/tags" intent="tab">{Object.keys(archive.data.tags).length}개 보기</Link></div>
          <div className="setting-row"><h3>내 기록 백업</h3><div className="track-actions"><button className="button" type="button" onClick={exportData}>내보내기</button><button className="button" type="button" onClick={() => importInputRef.current?.click()}>불러오기</button><input ref={importInputRef} className="sr-only" id="backup-import" type="file" accept="application/json,.json" onChange={importData} tabIndex={-1} /></div></div>
          <div className="setting-row"><h3>샘플 기록</h3><button className="button" type="button" onClick={() => commit(removeSeedData(archive), "샘플 기록을 제거했어요.", true)}>샘플만 제거</button></div>
        </div>
      </section>
      <section className="settings-group settings-danger" aria-labelledby="settings-danger-title">
        <h2 id="settings-danger-title">위험 영역</h2>
        <div className="panel settings-list">
          <div className="setting-row"><div><h3>아카이브 초기화</h3><p>현재 기록을 다른 데이터로 교체합니다.</p></div><div className="track-actions"><button className="button" type="button" onClick={() => replace("seed")}>샘플로 초기화</button><button className="button button-danger" type="button" onClick={() => replace("empty")}>모든 기록 지우기</button></div></div>
        </div>
      </section>
      <div className="notice notice-warning" style={{ marginTop: 18 }}><span aria-hidden="true">!</span><div><strong>이 기기에만 저장되는 데모입니다.</strong><br />브라우저 데이터 삭제, 비공개 모드 종료, 기기 변경 시 기록이 사라질 수 있습니다. 민감한 개인정보는 입력하지 마세요.</div></div>
    </div>
  );
}
