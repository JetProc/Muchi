"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { ChevronRight, X } from "lucide-react";
import {
  createEmptyArchive,
  searchArchive,
  selectRecap,
  serializeArchive,
  type ArchiveEnvelopeV1,
  type ArchiveSearchResult,
  type MotionPreference,
  type RecapEntry,
  type RecapMode,
} from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";
import type { MotionRouter } from "./editorial-motion";
import { useModalFocus } from "./editorial-accessibility";
import { EmptyState, PageHeader, TrackLine } from "./editorial-ui";
import { AlbumArtwork } from "./editorial-media";
import {
  formatChapterTitle,
  formatCalendarDate,
  formatDate,
} from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { TagPicker } from "./editorial-tag-picker";

function SearchResultLine({
  result,
  index,
  onTagClick,
}: {
  result: ArchiveSearchResult;
  index: number;
  onTagClick: (tagId: string) => void;
}) {
  const rowStyle = { "--track-delay": `${Math.min(index, 6) * 24}ms` } as CSSProperties;
  if (result.kind === "inbox") {
    return (
      <article className="search-track-row" style={rowStyle}>
        <Link className="search-track-main" href="/inbox" intent="forward">
          <AlbumArtwork track={result.track} decorative />
          <span className="search-track-copy">
            <strong>{result.track.title}</strong>
            <small>{result.track.artist}</small>
            <em>보관함 · 아직 미분류</em>
          </span>
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      </article>
    );
  }
  const isUnassigned = result.cube.kind === "capture";
  const uniqueTags = result.tags.filter(
    (tag, tagIndex, tags) => tags.findIndex((candidate) => candidate.id === tag.id) === tagIndex,
  );
  const context = [
    isUnassigned ? "챕터로 옮기기 전 기억" : formatChapterTitle(result.cube),
    result.matchedNote?.body,
  ].filter(Boolean).join(" · ");
  return (
    <article className="search-track-row" style={rowStyle}>
      <Link
        className="search-track-main"
        href={`/memory?id=${encodeURIComponent(result.cubeTrack.id)}`}
        intent="shared"
        sharedId={result.cubeTrack.id}
      >
        <AlbumArtwork track={result.track} sharedId={result.cubeTrack.id} decorative />
        <span className="search-track-copy">
          <strong>{result.track.title}</strong>
          <small>{result.track.artist}</small>
          {context ? <em>{context}</em> : null}
        </span>
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
      {uniqueTags.length ? (
        <div className="search-track-tags" aria-label={`${result.track.title} 태그`}>
          {uniqueTags.slice(0, 4).map((tag) => (
            <button className="tag" type="button" key={tag.id} onClick={() => onTagClick(tag.id)}>
              #{tag.label}
            </button>
          ))}
          {uniqueTags.length > 4 ? <span className="tag">+{uniqueTags.length - 4}</span> : null}
        </div>
      ) : null}
    </article>
  );
}

function rawSearchHref(
  query: string,
  tagIds: string[],
  fromMemoryId?: string | null,
): string {
  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  [...new Set(tagIds)].forEach((tagId) => params.append("tag", tagId));
  if (fromMemoryId) params.set("fromMemory", fromMemoryId);
  const serialized = params.toString();
  return serialized ? `/search?${serialized}` : "/search";
}

export function Search({
  archive,
  initialQuery,
  requestedTagIds,
  requestedView,
  fromMemoryId = null,
  router,
}: {
  archive: ArchiveEnvelopeV1;
  initialQuery: string;
  requestedTagIds: string[];
  requestedView: string | null;
  fromMemoryId?: string | null;
  router: MotionRouter;
}) {
  const validRequestedTagIds = useMemo(
    () => [...new Set(requestedTagIds)].filter((tagId) => Boolean(archive.data.tags[tagId])),
    [archive.data.tags, requestedTagIds],
  );
  const requestedKey = requestedTagIds.join("\u0000");
  const validRequestedKey = validRequestedTagIds.join("\u0000");
  const [query, setQuery] = useState(initialQuery);
  const [tagIds, setTagIds] = useState<string[]>(validRequestedTagIds);
  const [tagMatch, setTagMatch] = useState<"all" | "any">("all");
  const tags = useMemo(() => Object.values(archive.data.tags), [archive.data.tags]);
  const tagUsageCounts = useMemo(() => Object.values(archive.data.cubeTracks)
    .reduce<Record<string, number>>((counts, item) => {
      item.tagIds.forEach((tagId) => {
        counts[tagId] = (counts[tagId] ?? 0) + 1;
      });
      return counts;
    }, {}), [archive.data.cubeTracks]);
  const quickTagIds = useMemo(() => tags
    .filter((tag) => !tagIds.includes(tag.id))
    .sort((left, right) => (
      (tagUsageCounts[right.id] ?? 0) - (tagUsageCounts[left.id] ?? 0)
      || left.label.localeCompare(right.label, "ko")
    ))
    .slice(0, 5)
    .map((tag) => tag.id), [tagIds, tagUsageCounts, tags]);
  const hasSearch = Boolean(query.trim() || tagIds.length);
  const results = hasSearch
    ? searchArchive(archive, { query, tagIds, tagMatch, includeInbox: true })
    : [];

  useEffect(() => {
    const containsInvalidOrDuplicate = requestedKey !== validRequestedKey;
    const legacyGroupView = requestedView === "group";
    if (!containsInvalidOrDuplicate && !legacyGroupView) return;
    router.replace(rawSearchHref(initialQuery, validRequestedTagIds, fromMemoryId));
  }, [fromMemoryId, initialQuery, requestedKey, requestedView, router, validRequestedKey, validRequestedTagIds]);

  function toggle(id: string) {
    setTagIds((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      router.replace(rawSearchHref(query, next, fromMemoryId));
      return next;
    });
  }
  function resetSearch() {
    setQuery("");
    setTagIds([]);
    setTagMatch("all");
    router.replace("/search");
  }

  function searchByTag(tagId: string) {
    setQuery("");
    setTagIds([tagId]);
    setTagMatch("all");
    router.push(rawSearchHref("", [tagId], fromMemoryId));
  }

  return (
    <div className="page-content search-view">
      <header className="search-workspace-header archive-find-header">
        <h1 className="archive-find-title">내 기록 찾기</h1>
        <div className="search-query-row">
          <label className="sr-only" htmlFor="archive-query">내 음악 기록에서 찾기</label>
          <input
            id="archive-query"
            className="input search-input archive-find-input"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="곡, 챕터, 태그, 메모로 찾기"
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
          <div className="search-tag-controls">
            <TagPicker
              label="태그로 찾기"
              tags={tags}
              selectedTagIds={tagIds}
              suggestedTagIds={quickTagIds}
              usageCounts={tagUsageCounts}
              onToggle={toggle}
              suggestionsLabel="빠른 찾기"
              actionLabel="태그로 찾기"
              emptyText="자주 쓰는 태그를 빠르게 선택하세요"
              panelTitle="태그 찾기"
              manageHref={null}
            />
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

      <section className="search-results-section archive-find-results" aria-labelledby="search-results-title">
        <div className="search-results-head">
          <h2 id="search-results-title" aria-live="polite">
            {hasSearch ? `${results.length}개의 기록` : "내 음악 세계에서 찾고 싶은 것을 입력하세요"}
          </h2>
        </div>
        {results.length ? (
          <div className="track-list track-list-unified">
            {results.map((result, index) => (
              <SearchResultLine
                result={result}
                key={result.kind === "inbox" ? `inbox:${result.track.id}` : result.cubeTrack.id}
                index={index}
                onTagClick={searchByTag}
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
}: {
  entry: RecapEntry;
  index: number;
}) {
  const reason = {
    "same-month": "몇 년 전 같은 달",
    "same-season": "같은 계절의 기억",
    "saved-date": "지난 감상",
    random: "우연히 꺼낸 기억",
  }[entry.reason];
  const dateContext = entry.note.listenedOn
    ? `감상 날짜 · ${formatCalendarDate(entry.note.listenedOn)}`
    : `MUCHI 최초 기록 · ${formatDate(entry.cubeTrack.createdAt)}`;
  return (
    <TrackLine
      track={entry.track}
      index={index}
      sharedId={entry.cubeTrack.id}
      tags={entry.tags}
      context={`${reason} · ${dateContext} · ${formatChapterTitle(entry.cube)}`}
      actions={<Link className="button" href={`/memory?id=${encodeURIComponent(entry.cubeTrack.id)}`} intent="shared" sharedId={entry.cubeTrack.id}>기억 열기</Link>}
    />
  );
}

export function RecapSpread({ entries }: {
  entries: RecapEntry[];
}) {
  return (
    <section className="recap-spread">
      {entries.length ? (
        <div className="track-list">
          {entries.map((entry, index) => (
            <RecapLine key={`${entry.cubeTrack.id}:${entry.note.id}`} entry={entry} index={index} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="아직 돌아올 기억이 부족해요"
          action={<Link className="button button-primary" href="/chapters">곡에 기억 남기기</Link>}
        />
      )}
    </section>
  );
}

export function Recap({ archive }: {
  archive: ArchiveEnvelopeV1;
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
      <PageHeader
        eyebrow="회고"
        title={label[mode]}
        action={<button className="button button-primary" type="button" onClick={() => setCreateOpen(true)}>회고 만들기</button>}
      />
      <RecapSpread entries={entries} />
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
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
}) {
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
    anchor.download = `muchi-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("현재 음악 기록을 JSON 파일로 백업했어요.");
  }

  function replace() {
    if (!window.confirm("모든 음악 기록을 지우고 빈 아카이브로 시작할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    commit(createEmptyArchive(), "빈 아카이브로 초기화했어요.", true);
  }

  return (
    <div className="page-content settings-view">
      <PageHeader eyebrow="설정" title="내 음악 아카이브" />
      <section className="settings-group" aria-labelledby="settings-display-title">
        <h2 id="settings-display-title">표시</h2>
        <div className="panel settings-list">
          <div className="setting-row"><h3>모션 강도</h3><select className="select setting-motion-select" value={archive.data.preferences.motion} onChange={(event) => setMotion(event.target.value as MotionPreference)} aria-label="모션 강도"><option value="system">시스템 설정 따르기</option><option value="reduce">모션 줄이기</option><option value="full">감성 모션 사용</option></select></div>
          <div className="setting-row"><h3>이맘때의 음악</h3><button className={`toggle${archive.data.preferences.recapEnabled ? " is-on" : ""}`} type="button" role="switch" aria-checked={archive.data.preferences.recapEnabled} onClick={() => setRecap(!archive.data.preferences.recapEnabled)}><span className="toggle-label" aria-hidden="true">{archive.data.preferences.recapEnabled ? "켬" : "끔"}</span><span className="sr-only">회고 {archive.data.preferences.recapEnabled ? "끄기" : "켜기"}</span></button></div>
        </div>
      </section>
      <section className="settings-group" aria-labelledby="settings-data-title">
        <h2 id="settings-data-title">데이터</h2>
        <div className="notice notice-warning settings-storage-notice"><span aria-hidden="true">!</span><div><strong>기록은 로그인한 계정에 저장돼요.</strong><span> 필요하면 JSON으로 백업할 수 있습니다.</span></div></div>
        <div className="panel settings-list">
          <div className="setting-row"><h3>태그 관리</h3><Link className="button" href="/tags" intent="tab">{Object.keys(archive.data.tags).length}개 보기</Link></div>
          <div className="setting-row"><h3>내 기록 백업</h3><button className="button" type="button" onClick={exportData}>내보내기</button></div>
        </div>
      </section>
      <section className="settings-group settings-danger" aria-labelledby="settings-danger-title">
        <h2 id="settings-danger-title">위험 영역</h2>
        <div className="panel settings-list">
          <div className="setting-row"><h3>아카이브 초기화</h3><button className="button button-danger" type="button" onClick={replace}>초기화</button></div>
          <div className="setting-row"><h3>로그아웃</h3><form action="/auth/signout" method="post"><button className="button" type="submit">로그아웃</button></form></div>
        </div>
      </section>
    </div>
  );
}
