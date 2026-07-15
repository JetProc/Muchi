"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Plus } from "lucide-react";
import {
  ARCHIVE_LIMITS,
  CUBE_COLORS,
  addTrackToCube,
  createCube,
  createTags,
  deleteCube,
  getCubeTracks,
  moveInboxTrackToCube,
  removeCubeTrack,
  reorderCubeTracks,
  setCubeTrackTagIds,
  updateCube,
  updateCubeTrack,
  type ArchiveEnvelopeV1,
  type Cube,
  type CubeColor,
  type CubeTrack,
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
  TAG_CATEGORY_LABEL,
  chapterColorStyle,
  formatDate,
  formatMemory,
} from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { useModalFocus } from "./editorial-accessibility";

const MEMORY_TAG_CATEGORIES = ["genre", "emotion", "situation", "custom"] as const;
type MemoryTagCategory = (typeof MEMORY_TAG_CATEGORIES)[number];

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
  const [carouselRef, carouselApi] = useEmblaCarousel({
    align: "center",
    containScroll: "trimSnaps",
    loop: chapters.length > 1,
  });
  const activeIndex = chapters.length
    ? Math.min(selectedIndex, chapters.length - 1)
    : 0;
  const activeChapter = chapters[activeIndex] ?? chapters[0] ?? null;
  const activeEntries = activeChapter ? getCubeTracks(archive, activeChapter.id) : [];
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

  const syncCarouselSelection = useCallback(() => {
    if (!carouselApi) return;
    setSelectedIndex(carouselApi.selectedScrollSnap());
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi) return;
    carouselApi.on("select", syncCarouselSelection);
    carouselApi.on("reInit", syncCarouselSelection);
    return () => {
      carouselApi.off("select", syncCarouselSelection);
      carouselApi.off("reInit", syncCarouselSelection);
    };
  }, [carouselApi, syncCarouselSelection]);

  function moveStage(direction: -1 | 1) {
    if (chapters.length < 2) return;
    const targetIndex = (activeIndex + direction + chapters.length) % chapters.length;
    setSelectedIndex(targetIndex);
    carouselApi?.scrollTo(targetIndex);
  }

  function selectChapter(index: number) {
    setSelectedIndex(index);
    carouselApi?.scrollTo(index);
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
        </div>
        <button className="button button-primary" type="button" onClick={() => setShowForm(true)}>새 챕터</button>
      </header>
      {activeChapter ? (
        <>
          <section
            className="chapter-stage"
            aria-label={`${activeChapter.name} 챕터`}
            tabIndex={0}
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
          >
            <span className="sr-only" aria-live="polite">
              {chapters.length}개 중 {activeIndex + 1}번째, {activeChapter.name}
            </span>
            <div className="chapter-stage-inner">
              <div
                className="chapter-lp-carousel"
                ref={carouselRef}
                role="region"
                aria-roledescription="carousel"
                aria-label="음악 챕터 둘러보기"
              >
                <div className="chapter-lp-stack" role="tablist" aria-label="음악 챕터 선택">
                  {chapters.map((chapter, index) => {
                    const entries = getCubeTracks(archive, chapter.id);
                    const selected = index === activeIndex;
                    return (
                      <div className={`chapter-lp-slide${selected ? " is-active" : ""}`} role="presentation" key={chapter.id}>
                        <button
                          className="chapter-lp-card"
                          type="button"
                          role="tab"
                          aria-label={`${chapter.name}, ${entries.length}곡`}
                          aria-selected={selected}
                          aria-controls="active-chapter-stage"
                          tabIndex={selected ? 0 : -1}
                          onClick={() => selectChapter(index)}
                        >
                          {/* The transparent LP cutout is already compressed and must preserve its exact alpha bounds. */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/assets/chapter-lp.png" alt="" draggable={false} />
                          <span className="chapter-lp-card-copy">
                            <small>{String(index + 1).padStart(2, "0")}</small>
                            <strong>{chapter.name}</strong>
                            <span>{entries.length}곡</span>
                          </span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div
                className="chapter-stage-details"
                id="active-chapter-stage"
                role="tabpanel"
                aria-label={`${activeChapter.name} 챕터 정보`}
              >
                <div className="chapter-stage-meta">
                  <strong>{String(activeIndex + 1).padStart(2, "0")} / {String(chapters.length).padStart(2, "0")}</strong>
                  <span>{activeEntries.length}곡</span>
                </div>
                {activeChapter.description ? <p className="chapter-stage-description">{activeChapter.description}</p> : null}
                {activeEntries.length ? (
                  <ol className="chapter-stage-tracks" aria-label="대표 수록곡">
                    {activeEntries.slice(0, 3).map(({ cubeTrack, track }, index) => (
                      <li key={cubeTrack.id}><span>{String(index + 1).padStart(2, "0")}</span><strong>{track.title}</strong></li>
                    ))}
                  </ol>
                ) : <p className="chapter-stage-empty">아직 담긴 곡이 없어요.</p>}
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
            </div>
          </section>
        </>
      ) : (
        <EmptyState
          icon=""
          title="첫 챕터의 이름을 지어주세요"
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

  if (!hydrated || !chapterId) return <div className="page-content"><EmptyState icon="" title="챕터를 불러오고 있어요" /></div>;
  if (!chapter) return <div className="page-content"><EmptyState icon="" title="챕터를 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
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
          {chapter.description ? <p>{chapter.description}</p> : null}
          <div className="chapter-actions"><button className="text-button" type="button" onClick={openEditor}>EDIT CHAPTER</button><Link className="button button-primary" href="/capture" intent="modal">ADD TRACK</Link></div>
        </div>
      </section>
      <div className="chapter-stats"><span><strong>{String(entries.length).padStart(2, "0")}</strong> TRACKS</span><span><strong>{String(new Set(allTags.map((tag) => tag.id)).size).padStart(2, "0")}</strong> TAGS</span><span><strong>{String(entries.filter((entry) => entry.cubeTrack.memo).length).padStart(2, "0")}</strong> NOTES</span></div>
      {topTags.length ? <div className="filter-row" style={{ marginTop: 18 }}>{topTags.map((tag) => <span className="tag" key={tag.id}>#{tag.label}</span>)}</div> : null}
      <section className="section">
        <div className="section-head"><div><span className="section-label">TRACK LIST</span><h2>이 챕터의 음악</h2></div></div>
        {entries.length ? (
          <div className="track-list">
            {entries.map((entry, index) => {
              const otherMoments = Object.values(archive.data.cubeTracks).filter((item) => item.trackId === entry.track.id && item.id !== entry.cubeTrack.id).length;
              return <TrackLine key={entry.cubeTrack.id} track={entry.track} index={index} preview={preview} sharedId={entry.cubeTrack.id} tags={entry.tags} context={entry.cubeTrack.character || `${formatMemory(entry.cubeTrack.memoryPeriod)}${otherMoments ? ` · 다른 순간 ${otherMoments}개` : ""}`} actions={<><Link className="button" href={`/memory?id=${encodeURIComponent(entry.cubeTrack.id)}`} intent="shared" sharedId={entry.cubeTrack.id}>EDIT MEMORY</Link><button className="text-button" type="button" disabled={index === 0} onClick={() => move(entry.cubeTrack, -1)} aria-label="위로 이동">UP</button><button className="text-button" type="button" disabled={index === entries.length - 1} onClick={() => move(entry.cubeTrack, 1)} aria-label="아래로 이동">DOWN</button><button className="text-button" type="button" onClick={() => removeEntry(entry.cubeTrack, entry.track.title)} aria-label="이 챕터에서 곡과 기억 삭제">REMOVE</button></>} />;
            })}
          </div>
        ) : <EmptyState icon="♪" title="이 순간의 첫 곡을 담아보세요" action={<Link className="button button-primary" href="/capture">곡 찾기</Link>} />}
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
  cubeTrack,
  track,
  preview,
}: {
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
    </aside>
  );
}

interface TagEditorProps {
  tags: TagDefinition[];
  selectedTagIds: string[];
  memo: string;
  toggleTag: (tagId: string) => void;
  addTag: (category: MemoryTagCategory, label: string) => boolean;
  setMemo: (value: string) => void;
}

export function TagEditor(props: TagEditorProps) {
  const {
    tags,
    selectedTagIds,
    memo,
    toggleTag,
    addTag,
    setMemo,
  } = props;
  const [tagDrafts, setTagDrafts] = useState<Record<MemoryTagCategory, string>>({
    genre: "",
    emotion: "",
    situation: "",
    custom: "",
  });
  const periodTags = tags.filter(
    (tag) => tag.category === "period" && selectedTagIds.includes(tag.id),
  );

  function submitTag(category: MemoryTagCategory) {
    const label = tagDrafts[category].trim();
    if (!label || !addTag(category, label)) return;
    setTagDrafts((current) => ({ ...current, [category]: "" }));
  }

  return (
    <>
      <div className="field managed-tag-field">
        <div className="managed-tag-heading"><span className="field-label">태그</span><span className="field-hint">{selectedTagIds.length} / {ARCHIVE_LIMITS.tagsPerCubeTrack}</span></div>
        <div className="managed-tag-groups">
          <div className="managed-tag-group period-tag-group">
            <span>추가 시기 · 자동</span>
            {periodTags.length ? <div className="filter-row">{periodTags.map((tag) => <span key={tag.id} className="tag is-selected">#{tag.label}</span>)}</div> : null}
          </div>
          {MEMORY_TAG_CATEGORIES.map((category) => {
            const categoryTags = tags.filter((tag) => tag.category === category);
            return (
              <div className="managed-tag-group" key={category}>
                <span>{TAG_CATEGORY_LABEL[category]}</span>
                <div className="filter-row">
                  {categoryTags.map((tag) => (
                    <button
                      key={tag.id}
                      className={`tag${selectedTagIds.includes(tag.id) ? " is-selected" : ""}`}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      aria-pressed={selectedTagIds.includes(tag.id)}
                    >
                      #{tag.label}
                    </button>
                  ))}
                  <div className="inline-tag-composer">
                    <input
                      className="inline-tag-input"
                      value={tagDrafts[category]}
                      onChange={(event) => setTagDrafts((current) => ({
                        ...current,
                        [category]: event.target.value,
                      }))}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter") return;
                        event.preventDefault();
                        submitTag(category);
                      }}
                      maxLength={ARCHIVE_LIMITS.tagLabel}
                      placeholder="새 태그"
                      aria-label={`${TAG_CATEGORY_LABEL[category]} 태그 추가`}
                    />
                    <button
                      className="inline-tag-add"
                      type="button"
                      onClick={() => submitTag(category)}
                      disabled={!tagDrafts[category].trim()}
                      aria-label={`${TAG_CATEGORY_LABEL[category]} 태그 추가하기`}
                    >
                      <Plus aria-hidden="true" size={14} strokeWidth={1.8} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <Link className="text-link" href="/tags" intent="tab">태그 칩 만들기·관리</Link>
      </div>
      <div className="field"><label htmlFor="memo">메모</label><textarea id="memo" className="textarea" value={memo} onChange={(event) => setMemo(event.target.value)} maxLength={1000} placeholder="떠오르는 장면" /><span className="field-hint">{memo.length} / 1,000</span></div>
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
  const availableTags = Object.values(archive.data.tags).sort((left, right) => left.label.localeCompare(right.label, "ko"));
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [assigning, setAssigning] = useState(false);
  const assignDialogRef = useModalFocus<HTMLDivElement>(
    assigning,
    () => setAssigning(false),
  );
  useEffect(() => {
    if (!cubeTrack) return;
    const hydrationTimer = window.setTimeout(() => {
      setSelectedTagIds(cubeTrack.tagIds.filter((tagId) => Boolean(archive.data.tags[tagId])));
      setMemo(cubeTrack.memo);
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubeTrackId]);

  if (!hydrated || !cubeTrackId) return <div className="page-content"><EmptyState icon="…" title="곡의 기억을 불러오고 있어요" /></div>;
  if (!cubeTrack || !track || !cube) return <div className="page-content"><EmptyState icon="" title="곡의 기억을 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
  const activeCubeTrack = cubeTrack;
  const activeTrack = track;
  const activeCube = cube;

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => current.includes(tagId)
      ? current.filter((item) => item !== tagId)
      : [...current, tagId].slice(0, ARCHIVE_LIMITS.tagsPerCubeTrack));
  }

  function addTag(category: MemoryTagCategory, label: string): boolean {
    try {
      const result = createTags(archive, [{ label, category }]);
      const tag = result.tags[0];
      if (!tag) return false;
      if (selectedTagIds.includes(tag.id)) {
        notify("이미 선택한 태그예요.");
        return true;
      }
      const tagIds = [...selectedTagIds, tag.id];
      const next = setCubeTrackTagIds(
        result.archive,
        activeCubeTrack.id,
        tagIds,
      );
      if (!commit(next, `‘${tag.label}’ 태그를 추가했어요.`)) return false;
      setSelectedTagIds(next.data.cubeTracks[activeCubeTrack.id].tagIds);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "태그를 추가하지 못했어요.");
      return false;
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    try {
      const withDetails = updateCubeTrack(archive, activeCubeTrack.id, {
        memo,
      });
      const withTags = setCubeTrackTagIds(withDetails, activeCubeTrack.id, selectedTagIds);
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
        ? "같은 곡을 새로운 순간에 담았어요. 추가 시기는 자동으로 기록됩니다."
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
      <PageHeader eyebrow={`MEMORY · ${cube.name}`} title={`‘${track.title}’은 이 순간 어떤 음악인가요?`} />
      <div className="memory-layout">
        <MemoryPanel cubeTrack={cubeTrack} track={track} preview={preview} />
        <form className="memory-form form-stack" onSubmit={save}>
          <TagEditor
            tags={availableTags}
            selectedTagIds={selectedTagIds}
            memo={memo}
            toggleTag={toggleTag}
            addTag={addTag}
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
