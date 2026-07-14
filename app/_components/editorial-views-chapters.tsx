"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  CUBE_COLORS,
  addTrackToCube,
  createCube,
  deleteCube,
  getCubeTracks,
  moveInboxTrackToCube,
  normalizeTagLabel,
  removeCubeTrack,
  reorderCubeTracks,
  setCubeTrackTags,
  updateCube,
  updateCubeTrack,
  type ArchiveEnvelopeV1,
  type Cube,
  type CubeColor,
  type CubeTrack,
  type MemoryPeriod,
  type TagDefinition,
  type TrackId,
  type TrackReference,
} from "@/lib/archive";
import { ITUNES_PREVIEW_USAGE_NOTICE } from "@/lib/itunes";
import {
  MotionLink as Link,
  type MotionRouter,
} from "./editorial-motion";
import {
  AlbumArtwork,
  ChapterCover,
  PreviewButton,
  type PreviewControls,
} from "./editorial-media";
import {
  EmptyState,
  PageHeader,
  TrackLine,
} from "./editorial-ui";
import {
  COLOR_HEX,
  COLOR_LABEL,
  SEASON_LABEL,
  TAG_CATEGORY_LABEL,
  TAG_SUGGESTIONS,
  chapterColorStyle,
  formatDate,
  formatMemory,
} from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { useModalFocus } from "./editorial-accessibility";

export function Chapters({
  archive,
  commit,
  notify,
  router,
  pendingTrackId,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
  router: MotionRouter;
  pendingTrackId: TrackId | null;
}) {
  const chapters = Object.values(archive.data.cubes).sort((a, b) => a.sortOrder - b.sortOrder);
  const pendingTrack = pendingTrackId ? archive.data.tracks[pendingTrackId] : null;
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<CubeColor>("violet");
  const [deleteTarget, setDeleteTarget] = useState<Cube | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeIndex = chapters.length
    ? Math.min(selectedIndex, chapters.length - 1)
    : 0;
  const stageTouchStart = useRef<{ x: number; y: number } | null>(null);
  const activeChapter = chapters[activeIndex] ?? chapters[0] ?? null;
  const activeEntries = activeChapter ? getCubeTracks(archive, activeChapter.id) : [];
  const previousChapter = chapters.length > 1
    ? chapters[(activeIndex - 1 + chapters.length) % chapters.length]
    : null;
  const nextChapter = chapters.length > 1
    ? chapters[(activeIndex + 1) % chapters.length]
    : null;
  const createDialogRef = useModalFocus<HTMLDivElement>(
    showForm || Boolean(pendingTrack),
    () => {
      setShowForm(false);
      if (pendingTrack) router.replace("/chapters");
    },
  );
  const deleteDialogRef = useModalFocus<HTMLDivElement>(
    Boolean(deleteTarget),
    () => setDeleteTarget(null),
  );

  function moveStage(direction: -1 | 1) {
    if (chapters.length < 2) return;
    setSelectedIndex((current) => (
      Math.min(current, chapters.length - 1) + direction + chapters.length
    ) % chapters.length);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const result = createCube(archive, { name, description, color });
      const linked = pendingTrack
        ? (result.archive.data.inbox[pendingTrack.id]
          ? moveInboxTrackToCube(result.archive, pendingTrack.id, result.cube.id)
          : addTrackToCube(result.archive, pendingTrack.id, result.cube.id))
        : null;
      const next = linked?.archive ?? result.archive;
      if (commit(
        next,
        pendingTrack
          ? `‘${result.cube.name}’에 곡을 담았어요. 이제 이 곡의 표정을 남겨보세요.`
          : `‘${result.cube.name}’ 챕터를 만들었어요.`,
      )) {
        setName("");
        setDescription("");
        setColor("violet");
        setShowForm(false);
        if (linked) {
          router.push(
            `/memory?id=${encodeURIComponent(linked.cubeTrack.id)}`,
            "shared",
            linked.cubeTrack.id,
          );
        }
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터를 만들지 못했어요.");
    }
  }

  return (
    <div className="page-content chapters-view">
      <header className="chapter-stage-header">
        <div>
          <span className="section-label">YOUR INDEX</span>
          <h1>나의 음악 챕터</h1>
          <p>한 시절의 음악을 골라 그때의 장면으로 들어가 보세요.</p>
        </div>
        <button className="button button-primary" type="button" onClick={() => setShowForm(true)}>새 챕터</button>
      </header>
      {activeChapter ? (
        <>
          <section
            className="chapter-stage"
            id="active-chapter-stage"
            role="tabpanel"
            aria-label={`${activeChapter.name} 챕터`}
            tabIndex={0}
            style={chapterColorStyle(activeChapter.color)}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveStage(-1);
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                moveStage(1);
              }
            }}
            onTouchStart={(event) => {
              const touch = event.touches[0];
              stageTouchStart.current = { x: touch.clientX, y: touch.clientY };
            }}
            onTouchEnd={(event) => {
              const start = stageTouchStart.current;
              const touch = event.changedTouches[0];
              stageTouchStart.current = null;
              if (!start || !touch) return;
              const deltaX = touch.clientX - start.x;
              const deltaY = touch.clientY - start.y;
              if (Math.abs(deltaX) > 52 && Math.abs(deltaX) > Math.abs(deltaY) * 1.25) {
                moveStage(deltaX > 0 ? -1 : 1);
              }
            }}
          >
            <span className="sr-only" aria-live="polite">
              {chapters.length}개 중 {activeIndex + 1}번째, {activeChapter.name}
            </span>
            <div className="chapter-stage-inner">
              <div className="chapter-stage-copy">
                <span className="chapter-stage-number">{String(activeIndex + 1).padStart(2, "0")}</span>
                <h2>{activeChapter.name}</h2>
                <p>{activeChapter.description || "아직 문장이 붙지 않은 나의 음악 장면"}</p>
              </div>

              <ChapterCover archive={archive} chapter={activeChapter} shared />

              <div className="chapter-stage-details">
                {activeEntries.length ? (
                  <ol className="chapter-stage-tracks" aria-label="대표 수록곡">
                    {activeEntries.slice(0, 3).map(({ cubeTrack, track }, index) => (
                      <li key={cubeTrack.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{track.title}</strong></li>
                    ))}
                  </ol>
                ) : <p className="chapter-stage-empty">아직 담긴 곡이 없어요.</p>}
                <div className="chapter-stage-meta">
                  <strong>{activeEntries.length}곡</strong>
                  <span>최근 업데이트 {formatDate(activeChapter.updatedAt)}</span>
                  <span>{activeIndex + 1} / {chapters.length}</span>
                </div>
                <Link
                  className="chapter-stage-enter"
                  href={`/chapter?id=${encodeURIComponent(activeChapter.id)}`}
                  intent="shared"
                  sharedId={activeChapter.id}
                >
                  챕터 들어가기
                </Link>
                <button className="text-button chapter-stage-manage" type="button" onClick={() => setDeleteTarget(activeChapter)}>챕터 삭제</button>
              </div>

              <div className="chapter-stage-navigation" aria-label="챕터 순서 이동">
                <button type="button" onClick={() => moveStage(-1)} disabled={!previousChapter}>
                  <strong>이전 챕터</strong>
                  <span>{previousChapter?.name ?? "없음"}</span>
                </button>
                <button type="button" onClick={() => moveStage(1)} disabled={!nextChapter}>
                  <strong>다음 챕터</strong>
                  <span>{nextChapter?.name ?? "없음"}</span>
                </button>
              </div>
            </div>
          </section>

          <div className="chapter-stage-switcher" role="tablist" aria-label="음악 챕터 선택">
            {chapters.map((chapter, index) => {
              const entries = getCubeTracks(archive, chapter.id);
              const selected = index === activeIndex;
              return (
                <button
                  className={`chapter-stage-switch${selected ? " is-active" : ""}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="active-chapter-stage"
                  tabIndex={selected ? 0 : -1}
                  key={chapter.id}
                  onClick={() => setSelectedIndex(index)}
                  style={chapterColorStyle(chapter.color)}
                >
                  <span className="chapter-stage-switch-copy">
                    <small>{String(index + 1).padStart(2, "0")}</small>
                    <strong>{chapter.name}</strong>
                    <span>{entries.length}곡</span>
                  </span>
                  <ChapterCover archive={archive} chapter={chapter} />
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState
          icon=""
          title="첫 챕터의 이름을 지어주세요"
          copy="‘새벽 드라이브’, ‘2018년 겨울’, ‘첫 자취방’처럼 음악이 머문 장면이면 충분해요."
          action={<button className="button button-primary" type="button" onClick={() => setShowForm(true)}>첫 챕터 만들기</button>}
        />
      )}

      {showForm || pendingTrack ? (
        <div ref={createDialogRef} className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="create-chapter-title">
          <form className="dialog" onSubmit={submit}>
            <span className="section-label">NEW CHAPTER</span>
            <h2 id="create-chapter-title">
              {pendingTrack ? `‘${pendingTrack.title}’이 머물 순간은?` : "이 순간의 이름은?"}
            </h2>
            <p>{pendingTrack ? "챕터를 만들면 곧바로 태그와 기억을 남기는 화면으로 이어집니다." : "이름만 정하면 바로 시작할 수 있어요."}</p>
            <div className="form-stack" style={{ marginTop: 24 }}>
              <div className="field"><label htmlFor="chapter-name">챕터 이름 *</label><input id="chapter-name" className="input" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="예: 비 오는 날의 버스" /></div>
              <div className="field"><label htmlFor="chapter-description">짧은 설명</label><textarea id="chapter-description" className="textarea" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} placeholder="이 챕터에 담고 싶은 음악의 장면" /></div>
              <div className="field"><span className="field-label">분위기 색상</span><div className="filter-row">{CUBE_COLORS.map((item) => <button key={item} className={`tag${color === item ? " is-selected" : ""}`} type="button" onClick={() => setColor(item)} style={{ borderColor: COLOR_HEX[item] }} aria-pressed={color === item}>{COLOR_LABEL[item]}</button>)}</div></div>
            </div>
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => { setShowForm(false); if (pendingTrack) router.replace("/chapters"); }}>취소</button><button className="button button-primary" type="submit">{pendingTrack ? "챕터 만들고 기록하기" : "챕터 만들기"}</button></div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div ref={deleteDialogRef} className="dialog-backdrop" role="alertdialog" aria-modal="true" aria-labelledby="delete-chapter-title">
          <div className="dialog"><span className="section-label">DELETE CHAPTER</span><h2 id="delete-chapter-title">‘{deleteTarget.name}’을 지울까요?</h2><p>이 챕터의 {getCubeTracks(archive, deleteTarget.id).length}개 기억은 삭제되지만 다른 챕터의 같은 곡은 그대로 남습니다.</p><div className="dialog-actions"><button className="button" type="button" onClick={() => setDeleteTarget(null)}>취소</button><button className="button button-danger" type="button" onClick={() => { commit(deleteCube(archive, deleteTarget.id), "챕터를 삭제했어요."); setDeleteTarget(null); }}>삭제하기</button></div></div>
        </div>
      ) : null}
    </div>
  );
}

export function ChapterDetail({
  archive,
  chapterId,
  commit,
  notify,
  preview,
  router,
  hydrated,
}: {
  archive: ArchiveEnvelopeV1;
  chapterId: string | null;
  commit: ArchiveCommit;
  notify: Notify;
  preview: PreviewControls;
  router: MotionRouter;
  hydrated: boolean;
}) {
  const chapter = chapterId ? archive.data.cubes[chapterId] : null;
  const entries = chapter ? getCubeTracks(archive, chapter.id) : [];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<CubeColor>("violet");
  const editDialogRef = useModalFocus<HTMLDivElement>(
    editing,
    () => setEditing(false),
  );

  if (!hydrated || !chapterId) return <div className="page-content"><EmptyState icon="" title="챕터를 불러오고 있어요" copy="잠시만 기다려 주세요." /></div>;
  if (!chapter) return <div className="page-content"><EmptyState icon="" title="챕터를 찾을 수 없어요" copy="삭제됐거나 이 기기에 없는 챕터입니다." action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
  const activeChapter = chapter;

  const allTags = entries.flatMap((entry) => entry.tags);
  const topTags = [...new Map(allTags.map((tag) => [tag.id, tag])).values()].slice(0, 8);

  function saveChapter(event: FormEvent) {
    event.preventDefault();
    try {
      const next = updateCube(archive, activeChapter.id, { name, description, color });
      if (commit(next, "챕터의 분위기를 저장했어요.")) setEditing(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터를 수정하지 못했어요.");
    }
  }

  function openEditor() {
    setName(activeChapter.name);
    setDescription(activeChapter.description);
    setColor(activeChapter.color);
    setEditing(true);
  }

  function move(entry: CubeTrack, direction: -1 | 1) {
    const ids = entries.map((item) => item.cubeTrack.id);
    const from = ids.indexOf(entry.id);
    const to = from + direction;
    if (to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    commit(reorderCubeTracks(archive, activeChapter.id, ids), "곡 순서를 바꿨어요.");
  }

  function removeEntry(entry: CubeTrack, title: string) {
    if (!window.confirm(`‘${title}’의 이 챕터 태그와 기억을 삭제할까요? 다른 챕터의 기록은 남습니다.`)) return;
    commit(removeCubeTrack(archive, entry.id), "이 챕터에서 곡과 기억을 삭제했어요.");
  }

  return (
    <div className="page-content chapter-view">
      <Link className="text-link chapter-back" href="/chapters" intent="back">BACK TO INDEX</Link>
      <section className="chapter-hero" style={chapterColorStyle(chapter.color)}>
        <ChapterCover archive={archive} chapter={chapter} shared />
        <div className="chapter-hero-copy">
          <span className="section-label">CHAPTER · {formatDate(chapter.updatedAt)}</span>
          <h1>{chapter.name}</h1>
          <p>{chapter.description || "이 순간에 담긴 음악과 기억"}</p>
          <div className="chapter-actions"><button className="text-button" type="button" onClick={openEditor}>EDIT CHAPTER</button><Link className="button button-primary" href="/capture" intent="modal">ADD TRACK</Link></div>
        </div>
      </section>
      <div className="chapter-stats"><span><strong>{String(entries.length).padStart(2, "0")}</strong> TRACKS</span><span><strong>{String(new Set(allTags.map((tag) => tag.id)).size).padStart(2, "0")}</strong> TAGS</span><span><strong>{String(entries.filter((entry) => entry.cubeTrack.memo).length).padStart(2, "0")}</strong> NOTES</span></div>
      {topTags.length ? <div className="filter-row" style={{ marginTop: 18 }}>{topTags.map((tag) => <span className="tag" key={tag.id}>#{tag.label}</span>)}</div> : null}
      <section className="section">
        <div className="section-head"><div><span className="section-label">TRACK LIST</span><h2>이 챕터의 음악</h2><p>같은 곡도 이 챕터 안에서는 고유한 태그와 기억을 가집니다.</p></div></div>
        {entries.length ? (
          <div className="track-list">
            {entries.map((entry, index) => {
              const otherMoments = Object.values(archive.data.cubeTracks).filter((item) => item.trackId === entry.track.id && item.id !== entry.cubeTrack.id).length;
              return <TrackLine key={entry.cubeTrack.id} track={entry.track} index={index} preview={preview} sharedId={entry.cubeTrack.id} tags={entry.tags} context={entry.cubeTrack.character || `${formatMemory(entry.cubeTrack.memoryPeriod)}${otherMoments ? ` · 다른 순간 ${otherMoments}개` : ""}`} actions={<><Link className="button" href={`/memory?id=${encodeURIComponent(entry.cubeTrack.id)}`} intent="shared" sharedId={entry.cubeTrack.id}>EDIT MEMORY</Link><button className="text-button" type="button" disabled={index === 0} onClick={() => move(entry.cubeTrack, -1)} aria-label="위로 이동">UP</button><button className="text-button" type="button" disabled={index === entries.length - 1} onClick={() => move(entry.cubeTrack, 1)} aria-label="아래로 이동">DOWN</button><button className="text-button" type="button" onClick={() => removeEntry(entry.cubeTrack, entry.track.title)} aria-label="이 챕터에서 곡과 기억 삭제">REMOVE</button></>} />;
            })}
          </div>
        ) : <EmptyState icon="♪" title="이 순간의 첫 곡을 담아보세요" copy="곡을 담는 것만으로 시작할 수 있어요. 태그와 기억은 나중에 추가하세요." action={<Link className="button button-primary" href="/capture">곡 찾기</Link>} />}
      </section>

      {editing ? (
        <div ref={editDialogRef} className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="edit-chapter-title">
          <form className="dialog" onSubmit={saveChapter}>
            <span className="section-label">EDIT CHAPTER</span>
            <h2 id="edit-chapter-title">챕터의 분위기</h2>
            <div className="form-stack" style={{ marginTop: 24 }}>
              <div className="field"><label htmlFor="edit-name">이름</label><input className="input" id="edit-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={40} /></div>
              <div className="field"><label htmlFor="edit-description">설명</label><textarea className="textarea" id="edit-description" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} /></div>
              <div className="field"><span className="field-label">색상</span><div className="filter-row">{CUBE_COLORS.map((item) => <button key={item} className={`tag${color === item ? " is-selected" : ""}`} type="button" onClick={() => setColor(item)} aria-pressed={color === item}>{COLOR_LABEL[item]}</button>)}</div></div>
            </div>
            <div className="dialog-actions"><button className="button" type="button" onClick={() => setEditing(false)}>취소</button><button className="button button-primary" type="submit">저장</button></div>
          </form>
        </div>
      ) : null}
      <button className="text-button" style={{ marginTop: 38 }} type="button" onClick={() => router.push("/chapters", "back")}>BACK TO INDEX</button>
    </div>
  );
}

export function MemoryPanel({
  cube,
  cubeTrack,
  track,
  preview,
}: {
  cube: Cube;
  cubeTrack: CubeTrack;
  track: TrackReference;
  preview: PreviewControls;
}) {
  return (
    <aside className="memory-art-panel">
      <AlbumArtwork track={track} sharedId={cubeTrack.id} priority />
      <div className="memory-art-copy"><span className="section-label">{formatMemory(cubeTrack.memoryPeriod)}</span><h2>{track.title}</h2><p>{track.artist}{track.album ? ` · ${track.album}` : ""}</p></div>
      <PreviewButton track={track} preview={preview} />
      {track.provider === "itunes" ? <p className="legal-note">{ITUNES_PREVIEW_USAGE_NOTICE}</p> : null}
      {track.externalUrl ? <a className="text-link" href={track.externalUrl} target="_blank" rel="noopener noreferrer">OPEN ORIGINAL</a> : null}
      <div className="notice"><span>이 페이지의 태그와 기억은 <strong>{cube.name}</strong> 챕터에만 저장됩니다.</span></div>
    </aside>
  );
}

interface TagEditorProps {
  labels: string[];
  recentTags: TagDefinition[];
  customTag: string;
  matchingTags: TagDefinition[];
  character: string;
  periodKind: "none" | "month" | "season";
  year: string;
  month: string;
  season: keyof typeof SEASON_LABEL;
  place: string;
  people: string;
  memo: string;
  toggleTag: (label: string) => void;
  addCustomTag: () => void;
  setCustomTag: (value: string) => void;
  setCharacter: (value: string) => void;
  setPeriodKind: (value: "none" | "month" | "season") => void;
  setYear: (value: string) => void;
  setMonth: (value: string) => void;
  setSeason: (value: keyof typeof SEASON_LABEL) => void;
  setPlace: (value: string) => void;
  setPeople: (value: string) => void;
  setMemo: (value: string) => void;
}

export function TagEditor(props: TagEditorProps) {
  const {
    labels,
    recentTags,
    customTag,
    matchingTags,
    character,
    periodKind,
    year,
    month,
    season,
    place,
    people,
    memo,
    toggleTag,
    addCustomTag,
    setCustomTag,
    setCharacter,
    setPeriodKind,
    setYear,
    setMonth,
    setSeason,
    setPlace,
    setPeople,
    setMemo,
  } = props;
  return (
    <>
      <div className="field"><span className="field-label">추천 태그 · 여러 개 선택 가능</span><div className="filter-row">{TAG_SUGGESTIONS.map(({ label, category }) => <button key={label} className={`tag${labels.includes(label) ? " is-selected" : ""}`} type="button" onClick={() => toggleTag(label)} aria-pressed={labels.includes(label)}>#{label}<small className="tag-kind">{TAG_CATEGORY_LABEL[category]}</small></button>)}</div></div>
      {recentTags.length ? <div className="field"><span className="field-label">최근에 쓴 나의 태그</span><div className="filter-row">{recentTags.map((tag) => <button key={tag.id} className={`tag${labels.some((label) => normalizeTagLabel(label) === tag.normalizedLabel) ? " is-selected" : ""}`} type="button" onClick={() => toggleTag(tag.label)} aria-pressed={labels.some((label) => normalizeTagLabel(label) === tag.normalizedLabel)}>#{tag.label}</button>)}</div></div> : null}
      {labels.length ? <div className="field"><span className="field-label">선택한 나의 태그</span><div className="tag-row">{labels.map((label) => <span className="tag" key={label}>#{label}<button className="tag-remove" type="button" onClick={() => toggleTag(label)} aria-label={`${label} 태그 제거`}>REMOVE</button></span>)}</div></div> : null}
      <div className="field"><label htmlFor="custom-tag">나만의 태그</label><div className="search-form" style={{ marginTop: 0 }}><input id="custom-tag" className="input" value={customTag} onChange={(event) => setCustomTag(event.target.value)} maxLength={40} placeholder="예: 불안했던 청춘" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addCustomTag(); } }} /><button className="button" type="button" onClick={addCustomTag}>태그 추가</button></div>{matchingTags.length ? <div className="filter-row" style={{ marginTop: 8 }} aria-label="비슷한 기존 태그">{matchingTags.map((tag) => <button className="tag" type="button" key={tag.id} onClick={() => toggleTag(tag.label)}>기존 #{tag.label}</button>)}</div> : null}</div>
      <div className="field"><label htmlFor="character">성격 문장</label><input id="character" className="input" value={character} onChange={(event) => setCharacter(event.target.value)} maxLength={100} placeholder="예: 차갑지만 이상하게 나를 안심시키는 곡" /></div>
      <div className="field"><span className="field-label">기억한 시기</span><div className="form-grid"><select className="select" value={periodKind} onChange={(event) => setPeriodKind(event.target.value as typeof periodKind)} aria-label="기억한 시기 종류"><option value="none">시기 없음</option><option value="month">연도 + 월</option><option value="season">연도 + 계절</option></select>{periodKind !== "none" ? <input className="input" value={year} onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="연도 (선택)" aria-label="기억한 연도" /> : null}{periodKind === "month" ? <select className="select" value={month} onChange={(event) => setMonth(event.target.value)} aria-label="기억한 월">{Array.from({ length: 12 }, (_, index) => <option value={index + 1} key={index + 1}>{index + 1}월</option>)}</select> : null}{periodKind === "season" ? <select className="select" value={season} onChange={(event) => setSeason(event.target.value as keyof typeof SEASON_LABEL)} aria-label="기억한 계절">{Object.entries(SEASON_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select> : null}</div></div>
      <div className="form-grid"><div className="field"><label htmlFor="place">장소</label><input id="place" className="input" value={place} onChange={(event) => setPlace(event.target.value)} maxLength={60} placeholder="첫 자취방, 한강변…" /></div><div className="field"><label htmlFor="people">함께한 사람</label><input id="people" className="input" value={people} onChange={(event) => setPeople(event.target.value)} maxLength={60} placeholder="친구, 혼자, 가족…" /></div></div>
      <div className="field"><label htmlFor="memo">기억 메모</label><textarea id="memo" className="textarea" value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={1000} placeholder="이 곡을 들으면 떠오르는 장면을 자유롭게 남겨보세요." /><span className="field-hint">{memo.length} / 1,000</span></div>
    </>
  );
}

export function Memory({
  archive,
  cubeTrackId,
  commit,
  notify,
  preview,
  router,
  hydrated,
}: {
  archive: ArchiveEnvelopeV1;
  cubeTrackId: string | null;
  commit: ArchiveCommit;
  notify: Notify;
  preview: PreviewControls;
  router: MotionRouter;
  hydrated: boolean;
}) {
  const cubeTrack = cubeTrackId ? archive.data.cubeTracks[cubeTrackId] : null;
  const track = cubeTrack ? archive.data.tracks[cubeTrack.trackId] : null;
  const cube = cubeTrack ? archive.data.cubes[cubeTrack.cubeId] : null;
  const currentTags = cubeTrack ? cubeTrack.tagIds.map((id) => archive.data.tags[id]).filter((tag): tag is TagDefinition => Boolean(tag)) : [];
  const [labels, setLabels] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [character, setCharacter] = useState("");
  const [periodKind, setPeriodKind] = useState<"none" | "month" | "season">("none");
  const [year, setYear] = useState("");
  const [month, setMonth] = useState("1");
  const [season, setSeason] = useState<keyof typeof SEASON_LABEL>("spring");
  const [place, setPlace] = useState("");
  const [people, setPeople] = useState("");
  const [memo, setMemo] = useState("");
  const [assigning, setAssigning] = useState(false);
  const assignDialogRef = useModalFocus<HTMLDivElement>(
    assigning,
    () => setAssigning(false),
  );
  const recentTags = useMemo(() => {
    const seen = new Set<string>();
    const tags: TagDefinition[] = [];
    Object.values(archive.data.cubeTracks)
      .filter((item) => item.id !== cubeTrackId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .forEach((item) => item.tagIds.forEach((tagId) => {
        const tag = archive.data.tags[tagId];
        if (!tag || seen.has(tag.normalizedLabel)) return;
        seen.add(tag.normalizedLabel);
        tags.push(tag);
      }));
    return tags.slice(0, 8);
  }, [archive, cubeTrackId]);
  const matchingTags = useMemo(() => {
    const needle = normalizeTagLabel(customTag);
    if (!needle) return [];
    return Object.values(archive.data.tags)
      .filter((tag) => tag.normalizedLabel.includes(needle) && !labels.some((label) => normalizeTagLabel(label) === tag.normalizedLabel))
      .slice(0, 6);
  }, [archive.data.tags, customTag, labels]);

  useEffect(() => {
    if (!cubeTrack) return;
    const hydrationTimer = window.setTimeout(() => {
      setLabels(currentTags.map((tag) => tag.label));
      setCharacter(cubeTrack.character);
      setPlace(cubeTrack.place);
      setPeople(cubeTrack.people);
      setMemo(cubeTrack.memo);
      if (cubeTrack.memoryPeriod) {
        setPeriodKind(cubeTrack.memoryPeriod.kind);
        setYear(cubeTrack.memoryPeriod.year?.toString() ?? "");
        if (cubeTrack.memoryPeriod.kind === "month") setMonth(String(cubeTrack.memoryPeriod.month));
        else setSeason(cubeTrack.memoryPeriod.season);
      } else setPeriodKind("none");
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubeTrackId]);

  if (!hydrated || !cubeTrackId) return <div className="page-content"><EmptyState icon="…" title="곡의 기억을 불러오고 있어요" copy="잠시만 기다려 주세요." /></div>;
  if (!cubeTrack || !track || !cube) return <div className="page-content"><EmptyState icon="" title="곡의 기억을 찾을 수 없어요" copy="삭제됐거나 이 기기에 없는 기록입니다." action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
  const activeCubeTrack = cubeTrack;
  const activeTrack = track;
  const activeCube = cube;

  function toggleTag(label: string) {
    setLabels((current) => current.includes(label)
      ? current.filter((item) => item !== label)
      : [...current, label].slice(0, 20));
  }

  function addCustomTag() {
    const clean = customTag.trim();
    if (!clean) return;
    if (!labels.some((item) => item.normalize("NFKC").toLocaleLowerCase("ko-KR") === clean.normalize("NFKC").toLocaleLowerCase("ko-KR"))) {
      setLabels((current) => [...current, clean].slice(0, 20));
    }
    setCustomTag("");
  }

  function save(event: FormEvent) {
    event.preventDefault();
    let memoryPeriod: MemoryPeriod = null;
    const parsedYear = year ? Number(year) : null;
    if (periodKind === "month") memoryPeriod = { kind: "month", year: parsedYear, month: Number(month) };
    if (periodKind === "season") memoryPeriod = { kind: "season", year: parsedYear, season };
    try {
      const withDetails = updateCubeTrack(archive, activeCubeTrack.id, {
        character,
        memoryPeriod,
        place,
        people,
        memo,
      });
      const tagInputs = labels.map((label) => {
        const normalized = normalizeTagLabel(label);
        const existing = Object.values(archive.data.tags).find((tag) => tag.normalizedLabel === normalized);
        const suggestion = TAG_SUGGESTIONS.find((tag) => normalizeTagLabel(tag.label) === normalized);
        return { label, category: existing?.category ?? suggestion?.category ?? "custom" };
      });
      const withTags = setCubeTrackTags(withDetails, activeCubeTrack.id, tagInputs);
      if (commit(withTags, "이 곡의 새로운 표정을 저장했어요.")) {
        router.push(`/chapter?id=${encodeURIComponent(activeCube.id)}`, "back", activeCube.id);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "기억을 저장하지 못했어요.");
    }
  }

  function addToOtherChapter(targetChapterId: string) {
    const result = addTrackToCube(archive, activeTrack.id, targetChapterId);
    if (commit(
      result.archive,
      result.added
        ? "같은 곡을 새로운 순간에 담았어요. 태그는 빈 상태로 시작합니다."
        : "이미 있던 순간을 열었어요.",
    )) {
      setAssigning(false);
      router.push(
        `/memory?id=${encodeURIComponent(result.cubeTrack.id)}`,
        "shared",
        result.cubeTrack.id,
      );
    }
  }

  return (
    <div className="page-content memory-view">
      <PageHeader eyebrow={`MEMORY · ${cube.name}`} title={`‘${track.title}’은 이 순간 어떤 음악인가요?`} copy="같은 곡도 순간마다 다르게 느껴집니다. 이 기록은 다른 챕터에 영향을 주지 않아요." />
      <div className="memory-layout">
        <MemoryPanel cube={cube} cubeTrack={cubeTrack} track={track} preview={preview} />
        <form className="memory-form form-stack" onSubmit={save}>
          <TagEditor
            labels={labels}
            recentTags={recentTags}
            customTag={customTag}
            matchingTags={matchingTags}
            character={character}
            periodKind={periodKind}
            year={year}
            month={month}
            season={season}
            place={place}
            people={people}
            memo={memo}
            toggleTag={toggleTag}
            addCustomTag={addCustomTag}
            setCustomTag={setCustomTag}
            setCharacter={setCharacter}
            setPeriodKind={setPeriodKind}
            setYear={setYear}
            setMonth={setMonth}
            setSeason={setSeason}
            setPlace={setPlace}
            setPeople={setPeople}
            setMemo={setMemo}
          />
          <div className="dialog-actions"><button className="button" type="button" onClick={() => router.push(`/chapter?id=${encodeURIComponent(cube.id)}`, "back", cube.id)}>취소</button><button className="button" type="button" onClick={() => setAssigning(true)}>다른 챕터에도 담기</button><button className="button button-primary" type="submit">이 순간 저장하기</button></div>
        </form>
      </div>

      {assigning ? (
        <div ref={assignDialogRef} className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="other-chapter-title">
          <div className="dialog">
            <span className="section-label">ANOTHER CHAPTER</span>
            <h2 id="other-chapter-title">새로운 순간을 고르세요</h2>
            <p>곡 정보만 공유하고 태그와 기억은 빈 상태로 시작합니다.</p>
            <div className="track-list" style={{ marginTop: 22 }}>
              {Object.values(archive.data.cubes).filter((item) => item.id !== cube.id).map((item, index) => <button className="chapter-choice" key={item.id} type="button" onClick={() => addToOtherChapter(item.id)}><span>{String(index + 1).padStart(2, "0")}</span><ChapterCover archive={archive} chapter={item} /><span className="track-info"><strong>{item.name}</strong><small>{getCubeTracks(archive, item.id).length}곡</small></span><em>SELECT</em></button>)}
            </div>
            <div className="dialog-actions"><button className="button" type="button" onClick={() => setAssigning(false)}>닫기</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
