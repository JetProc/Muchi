"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { X } from "lucide-react";
import {
  removeSeedData,
  restoreSeedData,
  resetArchive,
  getCubeTrackNotes,
  getTagGroupResults,
  parseArchive,
  searchArchive,
  selectRecap,
  serializeArchive,
  type ArchiveEnvelopeV1,
  type ArchiveSearchResult,
  type ContextualMemory,
  type MotionPreference,
  type RecapEntry,
  type RecapMode,
} from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";
import type { MotionRouter } from "./editorial-motion";
import { useModalFocus } from "./editorial-accessibility";
import { EmptyState, PageHeader, TrackLine } from "./editorial-ui";
import {
  formatChapterTitle,
  formatCalendarDate,
  formatDate,
} from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { TagPicker } from "./editorial-tag-picker";
import { TagLink, tagGroupHref } from "./editorial-tag-link";

const LAST_BACKUP_AT_KEY = "music-world:last-backup-at:v1";

function SearchResultLine({
  result,
  index,
  onTagClick,
}: {
  result: ArchiveSearchResult;
  index: number;
  onTagClick: (tagId: string) => void;
}) {
  if (result.kind === "inbox") {
    return (
      <TrackLine
        track={result.track}
        index={index}
        context="임시 보관함 · 아직 미분류"
        actions={<Link className="button" href="/inbox">정리하기</Link>}
      />
    );
  }
  const tagContext = result.tags.slice(0, 2).map((tag) => `#${tag.label}`).join(" · ");
  const noteContext = result.matchedNote
    ? `${result.matchedNote.listenedOn ? formatCalendarDate(result.matchedNote.listenedOn) : "날짜 미지정"} · ${result.matchedNote.body}`
    : tagContext || `${result.track.artist}${result.track.album ? ` · ${result.track.album}` : ""}`;
  const isUnassigned = result.cube.kind === "capture";
  return (
    <TrackLine
      track={result.track}
      index={index}
      sharedId={result.cubeTrack.id}
      tags={result.tags}
      maxTags={2}
      onTagClick={(tag) => onTagClick(tag.id)}
      context={`${isUnassigned ? "챕터로 옮기기 전 기억" : formatChapterTitle(result.cube)} · ${noteContext}`}
      actions={<Link className="button" href={`/memory?id=${encodeURIComponent(result.cubeTrack.id)}`} intent="shared" sharedId={result.cubeTrack.id}>기억 열기</Link>}
    />
  );
}

function memorySummary(memory: ContextualMemory): string {
  const note = getCubeTrackNotes(memory.cubeTrack)[0];
  if (note) {
    const date = note.listenedOn ? formatCalendarDate(note.listenedOn) : "날짜 미지정";
    return `${date} · ${note.body}`;
  }
  return memory.tags.slice(0, 2).map((tag) => `#${tag.label}`).join(" · ")
    || formatChapterTitle(memory.cube);
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
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const tags = useMemo(() => Object.values(archive.data.tags), [archive.data.tags]);
  const tagUsageCounts = useMemo(() => Object.values(archive.data.cubeTracks)
    .reduce<Record<string, number>>((counts, item) => {
      item.tagIds.forEach((tagId) => {
        counts[tagId] = (counts[tagId] ?? 0) + 1;
      });
      return counts;
    }, {}), [archive.data.cubeTracks]);
  const groupView = requestedView === "group" && validRequestedTagIds.length > 0;
  const groupResults = useMemo(
    () => groupView ? getTagGroupResults(archive, validRequestedTagIds) : [],
    [archive, groupView, validRequestedTagIds],
  );
  const groupTags = validRequestedTagIds.map((tagId) => archive.data.tags[tagId]);
  const hasSearch = Boolean(query.trim() || tagIds.length);
  const results = hasSearch
    ? searchArchive(archive, { query, tagIds, tagMatch, includeInbox: true })
    : [];

  useEffect(() => {
    const containsInvalidOrDuplicate = requestedKey !== validRequestedKey;
    const emptyGroup = requestedView === "group" && validRequestedTagIds.length === 0;
    if (!containsInvalidOrDuplicate && !emptyGroup) return;
    router.replace(
      requestedView === "group"
        ? tagGroupHref(validRequestedTagIds, { fromMemoryId: fromMemoryId ?? undefined })
        : rawSearchHref(initialQuery, validRequestedTagIds, fromMemoryId),
    );
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

  if (groupView) {
    return (
      <div className="page-content search-view tag-group-view">
        <PageHeader
          eyebrow="내 태그"
          title={groupTags.map((tag) => tag.label).join(" + ")}
          action={<Link className="button" href="/search" intent="back">전체 검색</Link>}
        />
        <div className="tag-row" aria-label="선택한 태그">
          {groupTags.map((tag) => <TagLink tag={tag} key={tag.id} />)}
        </div>
        <section className="search-results-section" aria-labelledby="tag-group-results-title">
          <div className="search-results-head">
            <h2 id="tag-group-results-title">{groupResults.length}곡을 다시 찾았어요</h2>
          </div>
          {groupResults.length ? (
            <div className="track-list track-list-unified">
              {groupResults.map((result, index) => {
                const expanded = expandedTrackId === result.track.id;
                return (
                  <div key={result.track.id}>
                    <TrackLine
                      track={result.track}
                      index={index}
                      tags={groupTags}
                      context={`${result.memories.length}개의 독립된 기억`}
                      actions={(
                        <button
                          className="button"
                          type="button"
                          aria-expanded={expanded}
                          onClick={() => setExpandedTrackId(expanded ? null : result.track.id)}
                        >
                          {expanded ? "접기" : `${result.memories.length}개 기억`}
                        </button>
                      )}
                    />
                    {expanded ? (
                      <div className="tag-manager-list" aria-label={`${result.track.title}의 기억`}>
                        {result.memories.map((memory) => {
                          const unassigned = memory.cube.kind === "capture";
                          return (
                            <article className="tag-manager-row" key={memory.cubeTrack.id}>
                              <div className="tag-manager-copy">
                                <strong>{unassigned ? "챕터로 옮기기 전 기억" : formatChapterTitle(memory.cube)}</strong>
                                <small>{memorySummary(memory)}</small>
                              </div>
                              <div className="tag-manager-actions">
                                {!unassigned ? (
                                  <Link className="text-link" href={`/chapter?id=${encodeURIComponent(memory.cube.id)}`}>챕터</Link>
                                ) : null}
                                <Link className="button" href={`/memory?id=${encodeURIComponent(memory.cubeTrack.id)}`} intent="shared" sharedId={memory.cubeTrack.id}>기억 열기</Link>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="이 태그에 담긴 음악이 아직 없어요" action={<Link className="button button-primary" href="/capture">곡 기록하기</Link>} />
          )}
        </section>
      </div>
    );
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
          <div className="search-tag-controls">
            <TagPicker
              label="태그 필터"
              tags={tags}
              selectedTagIds={tagIds}
              usageCounts={tagUsageCounts}
              onToggle={toggle}
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
                onTagClick={(tagId) => {
                  router.push(tagGroupHref([tagId], { fromMemoryId: fromMemoryId ?? undefined }));
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
    : `MUMU 최초 기록 · ${formatDate(entry.cubeTrack.createdAt)}`;
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
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        setLastBackupAt(window.localStorage.getItem(LAST_BACKUP_AT_KEY));
      } catch {
        // Backup status is helpful but not required to use the archive.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
    const exportedAt = new Date().toISOString();
    try {
      window.localStorage.setItem(LAST_BACKUP_AT_KEY, exportedAt);
      setLastBackupAt(exportedAt);
    } catch {
      // The backup file was already created even if status storage fails.
    }
    notify("현재 음악 기록을 JSON 파일로 백업했어요.");
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    file.text().then((raw) => {
      try {
        const parsed = parseArchive(raw);
        if (parsed.status === "future-version") throw new Error(`더 새로운 MUMU 백업(v${parsed.schemaVersion})은 이 버전에서 열 수 없습니다.`);
        if (parsed.status !== "ok") throw new Error("MUMU 백업 파일 형식이 아니거나 손상되었습니다.");
        if (window.confirm("현재 기록을 이 백업으로 교체할까요? 이 작업은 되돌릴 수 없습니다.")) {
          commit(parsed.archive, parsed.migrated ? "이전 형식의 백업을 안전하게 변환해 복원했어요." : "백업한 음악 기록을 복원했어요.", true);
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
        <div className="notice notice-warning settings-storage-notice"><span aria-hidden="true">!</span><div><strong>현재 기록은 이 브라우저에만 저장됩니다.</strong><br />기기 변경이나 브라우저 데이터 삭제 전에 JSON 백업을 보관해 주세요.</div></div>
        <div className="panel settings-list">
          <div className="setting-row"><h3>태그 관리</h3><Link className="button" href="/tags" intent="tab">{Object.keys(archive.data.tags).length}개 보기</Link></div>
          <div className="setting-row"><div><h3>내 기록 백업</h3><p>{lastBackupAt ? `마지막 백업 · ${new Intl.DateTimeFormat("ko-KR", { dateStyle: "medium", timeZone: "Asia/Seoul" }).format(new Date(lastBackupAt))}` : "아직 백업한 기록이 없어요."}</p></div><div className="track-actions"><button className="button" type="button" onClick={exportData}>내보내기</button><button className="button" type="button" onClick={() => importInputRef.current?.click()}>불러오기</button><input ref={importInputRef} className="sr-only" id="backup-import" type="file" accept="application/json,.json" onChange={importData} tabIndex={-1} /></div></div>
          <div className="setting-row"><h3>샘플 기록</h3><div className="track-actions"><button className="button" type="button" onClick={() => commit(restoreSeedData(archive, new Date().toISOString(), true), "새 샘플 기록을 추가했어요.", true)}>샘플 다시 추가</button><button className="button" type="button" onClick={() => commit(removeSeedData(archive), "샘플 기록을 제거했어요.", true)}>샘플만 제거</button></div></div>
        </div>
      </section>
      <section className="settings-group settings-danger" aria-labelledby="settings-danger-title">
        <h2 id="settings-danger-title">위험 영역</h2>
        <div className="panel settings-list">
          <div className="setting-row"><div><h3>아카이브 초기화</h3><p>현재 기록을 다른 데이터로 교체합니다.</p></div><div className="track-actions"><button className="button" type="button" onClick={() => replace("seed")}>샘플로 초기화</button><button className="button button-danger" type="button" onClick={() => replace("empty")}>모든 기록 지우기</button></div></div>
        </div>
      </section>
    </div>
  );
}
