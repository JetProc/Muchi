"use client";

import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
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
} from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";
import type { PreviewControls } from "./editorial-media";
import { EmptyState, PageHeader, TrackLine } from "./editorial-ui";
import { formatMemory } from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";

function SearchResultLine({
  result,
  index,
  preview,
}: {
  result: ArchiveSearchResult;
  index: number;
  preview: PreviewControls;
}) {
  if (result.kind === "inbox") {
    return (
      <TrackLine
        track={result.track}
        index={index}
        preview={preview}
        context="임시 보관함 · 아직 미분류"
        actions={<Link className="button" href="/inbox">기록하기</Link>}
      />
    );
  }
  return (
    <TrackLine
      track={result.track}
      index={index}
      preview={preview}
      sharedId={result.cubeTrack.id}
      tags={result.tags}
      context={`${result.cube.name} · ${result.cubeTrack.character || formatMemory(result.cubeTrack.memoryPeriod)}`}
      actions={<Link className="button" href={`/memory?id=${encodeURIComponent(result.cubeTrack.id)}`} intent="shared" sharedId={result.cubeTrack.id}>OPEN MEMORY</Link>}
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
  const tags = Object.values(archive.data.tags).sort((a, b) => a.label.localeCompare(b.label, "ko"));
  const results = searchArchive(archive, { query, tagIds, includeInbox: true });
  function toggle(id: string) {
    setTagIds((current) => current.includes(id)
      ? current.filter((item) => item !== id)
      : [...current, id]);
  }
  return (
    <div className="page-content search-view">
      <header className="search-workspace-header">
        <div className="search-title-row">
          <span className="section-label">SEARCH</span>
          <h1>기록 검색</h1>
        </div>
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
              className="text-button search-reset"
              type="button"
              onClick={() => {
                setQuery("");
                setTagIds([]);
              }}
            >
              초기화
            </button>
          ) : null}
        </div>
        {tags.length ? (
          <div className="search-tag-rail">
            <span className="field-label">TAG</span>
            <div className="search-tag-list" role="group" aria-label="태그 필터">
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  className={`tag${tagIds.includes(tag.id) ? " is-selected" : ""}`}
                  type="button"
                  onClick={() => toggle(tag.id)}
                  aria-pressed={tagIds.includes(tag.id)}
                >
                  #{tag.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </header>

      <section className="search-results-section" aria-labelledby="search-results-title">
        <div className="search-results-head">
          <h2 id="search-results-title">검색 결과</h2>
          <span className="section-label" aria-live="polite">{String(results.length).padStart(2, "0")}</span>
        </div>
        {results.length ? (
          <div className="track-list">
            {results.map((result, index) => (
              <SearchResultLine
                result={result}
                key={result.kind === "inbox" ? `inbox:${result.track.id}` : result.cubeTrack.id}
                index={index}
                preview={preview}
              />
            ))}
          </div>
        ) : <EmptyState icon="" title="검색 결과 없음" />}
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
      sharedId={entry.cubeTrack.id}
      tags={entry.tags}
      context={`${reason} · ${entry.cube.name} · ${formatMemory(entry.cubeTrack.memoryPeriod)}`}
      actions={<Link className="button" href={`/memory?id=${encodeURIComponent(entry.cubeTrack.id)}`} intent="shared" sharedId={entry.cubeTrack.id}>OPEN MEMORY</Link>}
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
  const entries = useMemo(() => selectRecap(archive, { mode, limit: 12 }), [archive, mode]);
  const label: Record<RecapMode, string> = {
    "this-time": "이맘때의 음악",
    timeline: "지난 계절의 나",
    random: "무작위 기억",
  };
  return (
    <div className="page-content recap-view">
      <PageHeader eyebrow="ARCHIVE RECAP" title="음악을 통해 과거의 나를 만나요" />
      <div className="filter-row" role="group" aria-label="회고 방식">{(["this-time", "timeline", "random"] as RecapMode[]).map((item) => <button key={item} className={`button${mode === item ? " button-primary" : ""}`} type="button" aria-pressed={mode === item} onClick={() => setMode(item)}>{label[item]}</button>)}</div>
      <RecapSpread entries={entries} preview={preview} />
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
      <PageHeader eyebrow="SETTINGS" title="내 음악 아카이브 설정" />
      {storageBlocked ? <div className="notice notice-danger" style={{ marginBottom: 18 }}>저장소 보호 모드가 켜져 있습니다. 백업할 수 있다면 먼저 원본 브라우저 데이터를 보존한 뒤 초기화하세요.</div> : null}
      <section className="panel settings-list">
        <div className="setting-row"><h3>태그 칩 관리</h3><Link className="button" href="/tags" intent="tab">{Object.keys(archive.data.tags).length}개 관리</Link></div>
        <div className="setting-row"><h3>모션 강도</h3><select className="select" style={{ width: 190 }} value={archive.data.preferences.motion} onChange={(event) => setMotion(event.target.value as MotionPreference)} aria-label="모션 강도"><option value="system">시스템 설정 따르기</option><option value="reduce">모션 줄이기</option><option value="full">감성 모션 사용</option></select></div>
        <div className="setting-row"><h3>이맘때의 음악</h3><button className={`toggle${archive.data.preferences.recapEnabled ? " is-on" : ""}`} type="button" role="switch" aria-checked={archive.data.preferences.recapEnabled} onClick={() => setRecap(!archive.data.preferences.recapEnabled)}><span className="sr-only">회고 {archive.data.preferences.recapEnabled ? "끄기" : "켜기"}</span></button></div>
        <div className="setting-row"><h3>내 기록 백업</h3><div className="track-actions"><button className="button" type="button" onClick={exportData}>백업 내보내기</button><button className="button" type="button" onClick={() => importInputRef.current?.click()}>백업 불러오기</button><input ref={importInputRef} className="sr-only" id="backup-import" type="file" accept="application/json,.json" onChange={importData} tabIndex={-1} /></div></div>
        <div className="setting-row"><h3>샘플 기록만 제거</h3><button className="button" type="button" onClick={() => commit(removeSeedData(archive), "샘플 기록을 제거했어요.", true)}>샘플 제거</button></div>
        <div className="setting-row"><h3>데모 초기화</h3><div className="track-actions"><button className="button" type="button" onClick={() => replace("seed")}>샘플로 초기화</button><button className="button button-danger" type="button" onClick={() => replace("empty")}>모든 기록 지우기</button></div></div>
      </section>
      <div className="notice notice-warning" style={{ marginTop: 18 }}><span aria-hidden="true">!</span><div><strong>이 기기에만 저장되는 데모입니다.</strong><br />브라우저 데이터 삭제, 비공개 모드 종료, 기기 변경 시 기록이 사라질 수 있습니다. 민감한 개인정보는 입력하지 마세요.</div></div>
    </div>
  );
}
