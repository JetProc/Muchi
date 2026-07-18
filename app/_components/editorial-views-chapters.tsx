"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Apple,
  AudioLines,
  ChevronDown,
  ChevronRight,
  CirclePlay,
  MoreHorizontal,
  Plus,
} from "lucide-react";
import {
  ARCHIVE_LIMITS,
  addCubeTrackNote,
  addIndependentTrackMemory,
  addTrackToCube,
  createCube,
  createTags,
  deleteCube,
  getChildCubes,
  getCubeAncestors,
  getCubesInTreeOrder,
  getCubeTracks,
  getCubeTrackNotes,
  getLatestCubeTrackNote,
  getTagGroups,
  getUserVisibleChapters,
  moveCaptureTrackToCube,
  moveInboxTrackToCube,
  normalizeTagLabel,
  removeCubeTrack,
  removeCubeTrackNote,
  reorderCubeTracks,
  setCubeTrackTagIds,
  updateCube,
  updateCubeTrack,
  updateCubeTrackNote,
  type ArchiveEnvelopeV1,
  type Cube,
  type CubeColor,
  type CubeTrack,
  type MemoryPeriod,
  type MemoryNote,
  type Season,
  type TagDefinition,
  type TrackId,
  type TrackReference,
} from "@/lib/archive";
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
  ChapterChoice,
  EmptyState,
  PageHeader,
} from "./editorial-ui";
import {
  chapterColorStyle,
  formatChapterTitle,
  formatCalendarDate,
  formatDate,
  formatMemory,
  isAssignableChapter,
  isMonthlyChapter,
  isVisibleChapter,
} from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { useModalFocus } from "./editorial-accessibility";
import {
  TagPicker,
} from "./editorial-tag-picker";
import { ChapterFields } from "./editorial-chapter-fields";
import { ChapterDeleteDialog } from "./editorial-chapter-delete-dialog";

function todayInSeoul(): string {
  const parts = new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul",
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function Chapters({
  archive,
  commit,
  notify,
  router,
  pendingTrackId,
  pendingRecordMode,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
  router: MotionRouter;
  pendingTrackId: TrackId | null;
  pendingRecordMode: "quick" | "detail";
}) {
  const [activeTab, setActiveTab] = useState<"manual" | "monthly">("manual");
  const [sortMode, setSortMode] = useState<"recent" | "name" | "tracks">("recent");
  const manualChapters = getUserVisibleChapters(archive)
    .filter((chapter) => chapter.parentId === null);
  const monthlyChapters = Object.values(archive.data.cubes)
    .filter((chapter) => (
      chapter.parentId === null
      && isMonthlyChapter(chapter)
      && isVisibleChapter(archive, chapter)
    ));
  const visibleChapters = [...(activeTab === "manual" ? manualChapters : monthlyChapters)]
    .sort((left, right) => {
      if (sortMode === "name") return left.name.localeCompare(right.name, "ko");
      if (sortMode === "tracks") {
        return getCubeTracks(archive, right.id).length - getCubeTracks(archive, left.id).length;
      }
      return right.updatedAt.localeCompare(left.updatedAt);
    });
  const pendingTrack = pendingTrackId ? archive.data.tracks[pendingTrackId] : null;
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<CubeColor>("violet");
  const [deleteTarget, setDeleteTarget] = useState<Cube | null>(null);
  const createDialogRef = useModalFocus<HTMLFormElement>(
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
            `/memory?id=${encodeURIComponent(linked.cubeTrack.id)}&mode=${pendingRecordMode}`,
            "shared",
            linked.cubeTrack.id,
          );
        }
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터를 만들지 못했어요.");
    }
  }

  function closeCreateDialog() {
    setShowForm(false);
    if (pendingTrack) router.replace("/chapters");
  }

  function removeTargetChapter() {
    if (!deleteTarget) return;
    try {
      if (commit(deleteCube(archive, deleteTarget.id), "챕터를 삭제했어요.")) {
        setDeleteTarget(null);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터를 삭제하지 못했어요.");
    }
  }

  return (
    <div className="page-content chapters-view chapter-library-view">
      <h1 className="sr-only">챕터 보관함</h1>
      <nav className="chapter-library-tabs" aria-label="챕터 종류">
        <button className={activeTab === "manual" ? "is-active" : ""} type="button" onClick={() => setActiveTab("manual")} aria-current={activeTab === "manual" ? "page" : undefined}>내가 만든 챕터</button>
        <button className={activeTab === "monthly" ? "is-active" : ""} type="button" onClick={() => setActiveTab("monthly")} aria-current={activeTab === "monthly" ? "page" : undefined}>월별 챕터</button>
      </nav>

      <div className="chapter-library-toolbar">
        <span className="chapter-library-count" aria-live="polite">{visibleChapters.length}개 챕터</span>
        <div className="chapter-library-tools">
          <label className="chapter-library-sort">
            <span className="sr-only">챕터 정렬</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as "recent" | "name" | "tracks")}>
              <option value="recent">최근 활동</option>
              <option value="name">이름순</option>
              <option value="tracks">곡 많은 순</option>
            </select>
          </label>
          {activeTab === "manual" ? <button className="button button-primary chapter-library-create" type="button" onClick={() => setShowForm(true)}><Plus aria-hidden="true" size={16} />새 챕터</button> : null}
        </div>
      </div>

      {visibleChapters.length ? (
        <section className="chapter-library-grid" aria-label={activeTab === "manual" ? "내가 만든 챕터" : "월별 챕터"}>
          {visibleChapters.map((chapter) => {
            const entries = getCubeTracks(archive, chapter.id);
            const childCount = getChildCubes(archive, chapter.id).length;
            const chapterTitle = formatChapterTitle(chapter);
            return (
              <article className="chapter-library-card" key={chapter.id}>
                <div className="chapter-library-cover">
                  <Link href={`/chapter?id=${encodeURIComponent(chapter.id)}`} intent="shared" sharedId={chapter.id} aria-label={`${chapterTitle} 챕터 열기`}>
                    <ChapterCover archive={archive} chapter={chapter} />
                  </Link>
                  {activeTab === "manual" ? (
                    <button className="chapter-library-more" type="button" onClick={() => setDeleteTarget(chapter)} aria-label={`${chapter.name} 챕터 삭제`} title="챕터 삭제">
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <Link className="chapter-library-copy" href={`/chapter?id=${encodeURIComponent(chapter.id)}`} intent="shared" sharedId={chapter.id}>
                  <strong>{chapterTitle}</strong>
                  <span>
                    {activeTab === "manual" ? "내 챕터" : "월별 챕터"} · {entries.length}곡
                    {childCount ? ` · 하위 ${childCount}개` : ""}
                  </span>
                  {chapter.description ? <small>{chapter.description}</small> : null}
                </Link>
              </article>
            );
          })}
        </section>
      ) : activeTab === "manual" ? (
        <div className="chapter-library-empty-action">
          <button className="button button-primary" type="button" onClick={() => setShowForm(true)}>새 챕터</button>
        </div>
      ) : <EmptyState title="월별 챕터 없음" />}

      {showForm || pendingTrack ? (
        <div className="dialog-backdrop" role="presentation" onClick={closeCreateDialog}>
          <form ref={createDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-chapter-title" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
            <h2 id="create-chapter-title">새 챕터</h2>
            <ChapterFields
              color={color}
              description={description}
              idPrefix="chapter"
              name={name}
              nameLabel="이름"
              namePlaceholder="예: 비 오는 날의 버스"
              onColorChange={setColor}
              onDescriptionChange={setDescription}
              onNameChange={setName}
              showDescription={false}
            />
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={closeCreateDialog}>취소</button><button className="button button-primary" type="submit">{pendingTrack ? "챕터 만들고 기록하기" : "챕터 만들기"}</button></div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <ChapterDeleteDialog
          chapter={deleteTarget}
          childCount={getChildCubes(archive, deleteTarget.id).length}
          dialogRef={deleteDialogRef}
          memoryCount={getCubeTracks(archive, deleteTarget.id).length}
          onCancel={() => setDeleteTarget(null)}
          onDelete={removeTargetChapter}
          titleId="delete-chapter-title"
        />
      ) : null}
    </div>
  );
}

export function ChapterDetail({
  archive,
  chapterId,
  commit,
  notify,
  router,
}: {
  archive: ArchiveEnvelopeV1;
  chapterId: string | null;
  commit: ArchiveCommit;
  notify: Notify;
  router: MotionRouter;
}) {
  const candidateChapter = chapterId ? archive.data.cubes[chapterId] : null;
  const chapter = candidateChapter && isVisibleChapter(archive, candidateChapter)
    ? candidateChapter
    : null;
  const entries = chapter ? getCubeTracks(archive, chapter.id) : [];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<CubeColor>("violet");
  const [managing, setManaging] = useState(false);
  const [deletingCurrent, setDeletingCurrent] = useState(false);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const [creatingChild, setCreatingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childDescription, setChildDescription] = useState("");
  const [childColor, setChildColor] = useState<CubeColor>("violet");
  const editDialogRef = useModalFocus<HTMLFormElement>(
    editing,
    () => setEditing(false),
  );
  const childDialogRef = useModalFocus<HTMLFormElement>(
    creatingChild,
    () => setCreatingChild(false),
  );
  const currentDeleteDialogRef = useModalFocus<HTMLDivElement>(
    deletingCurrent,
    () => setDeletingCurrent(false),
  );

  if (!chapterId || !chapter) return <div className="page-content"><EmptyState title="챕터를 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
  const activeChapter = chapter;

  const allTags = entries.flatMap((entry) => entry.tags);
  const childChapters = getChildCubes(archive, activeChapter.id);
  const ancestors = getCubeAncestors(archive, activeChapter.id);
  const monthlyChapter = isMonthlyChapter(activeChapter);
  const canCreateChild = !monthlyChapter;

  function saveChapter(event: FormEvent) {
    event.preventDefault();
    try {
      const next = updateCube(archive, activeChapter.id, { name, description, color });
      if (commit(next, "챕터 분위기를 수정했어요.")) setEditing(false);
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

  function openChildCreator() {
    setChildName("");
    setChildDescription("");
    setChildColor(activeChapter.color);
    setCreatingChild(true);
  }

  function submitChildChapter(event: FormEvent) {
    event.preventDefault();
    try {
      const result = createCube(archive, {
        name: childName,
        description: childDescription,
        color: childColor,
        parentId: activeChapter.id,
      });
      if (commit(result.archive, `‘${result.cube.name}’ 하위 챕터를 만들었어요.`)) {
        setCreatingChild(false);
        router.push(
          `/chapter?id=${encodeURIComponent(result.cube.id)}`,
          "shared",
          result.cube.id,
        );
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "하위 챕터를 만들지 못했어요.");
    }
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

  function removeCurrentChapter() {
    const parentId = activeChapter.parentId;
    if (!commit(deleteCube(archive, activeChapter.id), "챕터를 삭제했어요.")) return;
    setDeletingCurrent(false);
    router.push(
      parentId ? `/chapter?id=${encodeURIComponent(parentId)}` : "/chapters",
      "back",
      parentId ?? undefined,
    );
  }

  return (
    <div className="page-content chapter-view chapter-detail-compact">
      <nav className="chapter-breadcrumbs" aria-label="챕터 위치">
        <Link href="/chapters" intent="back">챕터</Link>
        {ancestors.map((ancestor) => (
          <span className="chapter-breadcrumb-item" key={ancestor.id}>
            <ChevronRight size={13} aria-hidden="true" />
            <Link href={`/chapter?id=${encodeURIComponent(ancestor.id)}`} intent="back" sharedId={ancestor.id}>{formatChapterTitle(ancestor)}</Link>
          </span>
        ))}
        <span className="chapter-breadcrumb-item" aria-current="page">
          <ChevronRight size={13} aria-hidden="true" />
          <strong>{formatChapterTitle(activeChapter)}</strong>
        </span>
      </nav>
      <section className="chapter-hero chapter-detail-hero" style={chapterColorStyle(chapter.color)}>
        <ChapterCover archive={archive} chapter={chapter} />
        <div className="chapter-hero-copy">
          <span className="section-label">챕터 · {formatDate(chapter.updatedAt)}</span>
          <h1>{formatChapterTitle(chapter)}</h1>
          {chapter.description ? <p>{chapter.description}</p> : null}
          <p className="chapter-detail-meta">{entries.length}곡 · {new Set(allTags.map((tag) => tag.id)).size}개 태그 · {entries.reduce((count, entry) => count + entry.cubeTrack.notes.length, 0)}개 메모{childChapters.length ? ` · 하위 ${childChapters.length}개` : ""}</p>
          <div className="chapter-actions">
            {!monthlyChapter ? (
              <>
                <Link className="button button-primary" href="/capture" intent="modal">곡 기록</Link>
                <button className="text-button" type="button" onClick={() => setManaging((value) => !value)}>{managing ? "관리 완료" : "곡 관리"}</button>
                {managing ? <button className="text-button" type="button" onClick={openEditor}>챕터 정보 수정</button> : null}
                {managing ? <button className="text-button" type="button" onClick={() => setDeletingCurrent(true)}>챕터 삭제</button> : null}
              </>
            ) : <span className="section-label">등록일 기준 자동 분류</span>}
          </div>
        </div>
      </section>
      <section className="section chapter-track-section">
        <div className="section-head"><div><span className="section-label">{entries.length}곡</span><h2>{managing ? "순서와 곡 관리" : "수록곡"}</h2></div></div>
        {entries.length ? (
          <div className="chapter-compact-track-list">
            {entries.map((entry, index) => {
              const expanded = expandedTrackId === entry.cubeTrack.id;
              const summary = getLatestCubeTrackNote(entry.cubeTrack)?.body
                || entry.cubeTrack.character.trim()
                || `${entry.track.artist}${entry.track.album ? ` · ${entry.track.album}` : ""}`;
              return (
                <article className={`chapter-compact-track${expanded ? " is-expanded" : ""}`} key={entry.cubeTrack.id}>
                  <div className="chapter-compact-track-main">
                    <button
                      className="chapter-compact-track-toggle"
                      type="button"
                      onClick={() => setExpandedTrackId((current) => current === entry.cubeTrack.id ? null : entry.cubeTrack.id)}
                      aria-expanded={expanded}
                      aria-controls={`chapter-track-detail-${entry.cubeTrack.id}`}
                    >
                      <AlbumArtwork track={entry.track} sharedId={entry.cubeTrack.id} decorative />
                      <span className="chapter-compact-track-copy">
                        <strong>{entry.track.title}</strong>
                        <span>{entry.track.artist}</span>
                      </span>
                      <ChevronDown size={15} aria-hidden="true" />
                    </button>
                    {managing ? (
                      <div className="chapter-compact-track-manage">
                        <button type="button" disabled={index === 0} onClick={() => move(entry.cubeTrack, -1)} aria-label={`${entry.track.title} 위로 이동`}>위</button>
                        <button type="button" disabled={index === entries.length - 1} onClick={() => move(entry.cubeTrack, 1)} aria-label={`${entry.track.title} 아래로 이동`}>아래</button>
                        <button type="button" onClick={() => removeEntry(entry.cubeTrack, entry.track.title)} aria-label={`${entry.track.title} 삭제`}>삭제</button>
                      </div>
                    ) : (
                      <Link className="chapter-memory-link" href={`/memory?id=${encodeURIComponent(entry.cubeTrack.id)}`} intent="shared" sharedId={entry.cubeTrack.id}>기억 열기</Link>
                    )}
                  </div>
                  <div className="chapter-compact-track-detail" id={`chapter-track-detail-${entry.cubeTrack.id}`} aria-hidden={!expanded}>
                    <div>
                      <p>{summary}</p>
                      {entry.tags.length ? (
                        <div className="chapter-compact-track-tags" aria-label="곡 태그">
                          {entry.tags.slice(0, 6).map((tag) => (
                            <Link
                              href={`/search?tag=${encodeURIComponent(tag.id)}&view=group`}
                              intent="forward"
                              key={tag.id}
                            >#{tag.label}</Link>
                          ))}
                          {entry.tags.length > 6 ? <span>+{entry.tags.length - 6}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState title="이 순간의 첫 곡을 담아보세요" action={<Link className="button button-primary" href="/capture">곡 찾기</Link>} />}
      </section>
      <section className="child-chapter-section" aria-labelledby="child-chapters-title">
        <div className="child-chapter-head">
          <div>
            <span className="section-label">하위 챕터 · {childChapters.length}</span>
            <h2 id="child-chapters-title">하위 챕터</h2>
          </div>
          {canCreateChild && childChapters.length ? (
            <button className="text-button child-chapter-create" type="button" onClick={openChildCreator}>
              <Plus size={15} aria-hidden="true" />
              만들기
            </button>
          ) : null}
        </div>
        {childChapters.length ? (
          <div className="child-chapter-list">
            {childChapters.map((child) => {
              const childEntries = getCubeTracks(archive, child.id);
              const grandchildCount = getChildCubes(archive, child.id).length;
              return (
                <Link
                  className="child-chapter-row"
                  href={`/chapter?id=${encodeURIComponent(child.id)}`}
                  intent="shared"
                  sharedId={child.id}
                  key={child.id}
                >
                  <ChapterCover archive={archive} chapter={child} />
                  <span className="child-chapter-copy">
                    <strong>{child.name}</strong>
                    <small>{childEntries.length}곡{grandchildCount ? ` · 하위 ${grandchildCount}개` : ""}</small>
                    {child.description ? <span>{child.description}</span> : null}
                  </span>
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="child-chapter-empty">
            <p>{canCreateChild ? "하위 챕터 없음" : "자동 분류"}</p>
            {canCreateChild ? <button className="button button-primary" type="button" onClick={openChildCreator}>하위 챕터</button> : null}
          </div>
        )}
      </section>
      {entries.length ? (
        <section className="chapter-service-actions" aria-labelledby="chapter-service-title">
          <h2 id="chapter-service-title">플레이리스트로 내보내기</h2>
          <div className="chapter-service-grid">
            <Link className="chapter-service-link is-apple" href={`/playlist?id=${encodeURIComponent(chapter.id)}&service=apple`} intent="modal" aria-label="Apple Music으로 플레이리스트 만들기">
              <span className="chapter-service-icon" aria-hidden="true"><Apple size={20} strokeWidth={1.9} /></span>
              <span>Apple Music</span>
            </Link>
            <Link className="chapter-service-link is-spotify" href={`/playlist?id=${encodeURIComponent(chapter.id)}&service=spotify`} intent="modal" aria-label="Spotify로 플레이리스트 만들기">
              <span className="chapter-service-icon" aria-hidden="true"><AudioLines size={20} strokeWidth={1.9} /></span>
              <span>Spotify</span>
            </Link>
            <Link className="chapter-service-link is-youtube" href={`/playlist?id=${encodeURIComponent(chapter.id)}&service=youtube`} intent="modal" aria-label="YouTube Music으로 플레이리스트 만들기">
              <span className="chapter-service-icon" aria-hidden="true"><CirclePlay size={20} strokeWidth={1.9} /></span>
              <span>YouTube Music</span>
            </Link>
          </div>
        </section>
      ) : null}

      {editing ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setEditing(false)}>
          <form ref={editDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-chapter-title" onSubmit={saveChapter} onClick={(event) => event.stopPropagation()}>
            <span className="section-label">챕터 수정</span>
            <h2 id="edit-chapter-title">챕터의 분위기</h2>
            <ChapterFields
              color={color}
              colorLabel="색상"
              description={description}
              descriptionLabel="설명"
              idPrefix="edit"
              name={name}
              nameLabel="이름"
              onColorChange={setColor}
              onDescriptionChange={setDescription}
              onNameChange={setName}
            />
            <div className="dialog-actions"><button className="button" type="button" onClick={() => setEditing(false)}>취소</button><button className="button button-primary" type="submit">완료</button></div>
          </form>
        </div>
      ) : null}

      {creatingChild ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setCreatingChild(false)}>
          <form ref={childDialogRef} className="dialog child-chapter-dialog" role="dialog" aria-modal="true" aria-labelledby="create-child-chapter-title" onSubmit={submitChildChapter} onClick={(event) => event.stopPropagation()}>
            <h2 id="create-child-chapter-title">하위 챕터</h2>
            <ChapterFields
              color={childColor}
              description={childDescription}
              idPrefix="child-chapter"
              name={childName}
              nameLabel="이름"
              namePlaceholder="예: 비가 내리기 시작할 때"
              onColorChange={setChildColor}
              onDescriptionChange={setChildDescription}
              onNameChange={setChildName}
              showDescription={false}
            />
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setCreatingChild(false)}>취소</button><button className="button button-primary" type="submit">하위 챕터 만들기</button></div>
          </form>
        </div>
      ) : null}

      {deletingCurrent ? (
        <ChapterDeleteDialog
          chapter={activeChapter}
          childCount={childChapters.length}
          dialogRef={currentDeleteDialogRef}
          memoryCount={entries.length}
          onCancel={() => setDeletingCurrent(false)}
          onDelete={removeCurrentChapter}
          titleId="delete-current-chapter-title"
        />
      ) : null}
    </div>
  );
}

export function MemoryPanel({
  cubeTrack,
  track,
  preview,
  onSharePrototype,
}: {
  cubeTrack: CubeTrack;
  track: TrackReference;
  preview: PreviewControls;
  onSharePrototype: () => void;
}) {
  const latestNote = getLatestCubeTrackNote(cubeTrack);
  const providerName = {
    itunes: "Apple Music",
    spotify: "Spotify",
    youtube: "YouTube Music",
    melon: "Melon",
  }[track.provider];
  return (
    <aside className="memory-art-panel">
      <AlbumArtwork track={track} sharedId={cubeTrack.id} priority />
      <div className="memory-art-copy">
        <span className="section-label">{latestNote?.listenedOn ? formatCalendarDate(latestNote.listenedOn) : formatMemory(cubeTrack.memoryPeriod)}</span>
        <h2>{track.title}</h2>
        <p>{track.artist}{track.album ? ` · ${track.album}` : ""}</p>
        <div className="memory-preview-actions">
          <PreviewButton track={track} preview={preview} />
          {track.externalUrl ? <a className="text-link" href={track.externalUrl} target="_blank" rel="noopener noreferrer">{providerName}에서 열기</a> : null}
          <button className="text-link" type="button" onClick={onSharePrototype}>기록 이미지 만들기 · 실험</button>
        </div>
      </div>
    </aside>
  );
}

interface TagEditorProps {
  tags: TagDefinition[];
  selectedTagIds: string[];
  suggestedTagIds: string[];
  usageCounts: Record<string, number>;
  toggleTag: (tagId: string) => void;
  addTag: (label: string) => boolean;
  searchableTagIds?: string[];
}

export function TagEditor({
  tags,
  selectedTagIds,
  suggestedTagIds,
  usageCounts,
  toggleTag,
  addTag,
  searchableTagIds = [],
}: TagEditorProps) {
  const searchableTags = selectedTagIds
    .filter((tagId) => searchableTagIds.includes(tagId))
    .map((tagId) => tags.find((tag) => tag.id === tagId))
    .filter((tag): tag is TagDefinition => Boolean(tag));
  return (
    <div className="field managed-tag-field">
      <TagPicker
        tags={tags}
        selectedTagIds={selectedTagIds}
        suggestedTagIds={suggestedTagIds}
        usageCounts={usageCounts}
        onToggle={toggleTag}
        onCreate={addTag}
      />
      {searchableTags.length ? (
        <nav className="memory-tag-links" aria-label="선택한 키워드로 음악 찾기">
          {searchableTags.map((tag) => (
            <Link
              href={`/search?tag=${encodeURIComponent(tag.id)}&view=group`}
              intent="forward"
              key={tag.id}
            >#{tag.label} 모아보기</Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

export function Memory({
  archive,
  cubeTrackId,
  commit,
  notify,
  preview,
  recordMode,
  openChapterMove = false,
  router,
}: {
  archive: ArchiveEnvelopeV1;
  cubeTrackId: string | null;
  commit: ArchiveCommit;
  notify: Notify;
  preview: PreviewControls;
  recordMode: "quick" | "detail";
  openChapterMove?: boolean;
  router: MotionRouter;
}) {
  const cubeTrack = cubeTrackId ? archive.data.cubeTracks[cubeTrackId] : null;
  const track = cubeTrack ? archive.data.tracks[cubeTrack.trackId] : null;
  const cube = cubeTrack ? archive.data.cubes[cubeTrack.cubeId] : null;
  const today = todayInSeoul();
  const [currentYear, currentMonth] = today.split("-");
  const currentMonthValue = String(Number(currentMonth));
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [character, setCharacter] = useState("");
  const [periodKind, setPeriodKind] = useState<"none" | NonNullable<MemoryPeriod>["kind"]>("month");
  const [periodYear, setPeriodYear] = useState(currentYear);
  const [periodMonth, setPeriodMonth] = useState(currentMonthValue);
  const [periodSeason, setPeriodSeason] = useState<Season>("spring");
  const [periodTouched, setPeriodTouched] = useState(false);
  const [noteDate, setNoteDate] = useState(today);
  const [noteBody, setNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [pendingTags, setPendingTags] = useState<TagDefinition[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(recordMode === "detail");
  const [assigning, setAssigning] = useState(openChapterMove);
  const draftReady = useRef(false);
  const availableTags = [...Object.values(archive.data.tags), ...pendingTags]
    .sort((left, right) => left.label.localeCompare(right.label, "ko"));
  const tagGroups = useMemo(
    () => getTagGroups(archive, cubeTrackId ?? undefined),
    [archive, cubeTrackId],
  );
  const tagUsageCounts = useMemo(() => Object.fromEntries(
    tagGroups.map((group) => [group.tag.id, group.memoryCount]),
  ), [tagGroups]);
  const suggestedTagIds = useMemo(
    () => tagGroups.slice(0, 5).map((group) => group.tag.id),
    [tagGroups],
  );
  const assignDialogRef = useModalFocus<HTMLDivElement>(
    assigning,
    () => setAssigning(false),
  );
  useEffect(() => {
    if (!cubeTrack) return;
    draftReady.current = false;
    const hydrationTimer = window.setTimeout(() => {
      const defaultPeriodKind = cubeTrack.memoryPeriod?.kind ?? "month";
      const defaultPeriodYear = cubeTrack.memoryPeriod
        ? cubeTrack.memoryPeriod.year?.toString() ?? ""
        : currentYear;
      const defaultPeriodMonth = cubeTrack.memoryPeriod?.kind === "month"
        ? String(cubeTrack.memoryPeriod.month)
        : currentMonthValue;
      setSelectedTagIds(cubeTrack.tagIds.filter((tagId) => Boolean(archive.data.tags[tagId])));
      setCharacter(cubeTrack.character);
      setPeriodKind(defaultPeriodKind);
      setPeriodYear(defaultPeriodYear);
      setPeriodMonth(defaultPeriodMonth);
      setPeriodTouched(false);
      if (cubeTrack.memoryPeriod?.kind === "season") setPeriodSeason(cubeTrack.memoryPeriod.season);
      setNoteDate(today);
      setNoteBody("");
      setEditingNoteId(null);
      setPendingTags([]);
      let shouldOpenDetails = recordMode === "detail"
        || Boolean(cubeTrack.character || cubeTrack.memoryPeriod || cubeTrack.notes.length);
      try {
        const raw = window.sessionStorage.getItem(`music-world:memory-draft:v1:${cubeTrack.id}`);
        if (raw) {
          const draft = JSON.parse(raw) as Partial<{
            selectedTagIds: string[];
            character: string;
            periodKind: "none" | NonNullable<MemoryPeriod>["kind"];
            periodYear: string;
            periodMonth: string;
            periodSeason: Season;
            periodTouched: boolean;
            noteDate: string;
            noteBody: string;
            editingNoteId: string | null;
            pendingTags: TagDefinition[];
            detailsOpen: boolean;
          }>;
          const restoredPendingTags = Array.isArray(draft.pendingTags)
            ? draft.pendingTags.filter((tag) => (
              tag
              && typeof tag.id === "string"
              && typeof tag.label === "string"
              && typeof tag.normalizedLabel === "string"
              && !archive.data.tags[tag.id]
            ))
            : [];
          const knownTagIds = new Set([
            ...Object.keys(archive.data.tags),
            ...restoredPendingTags.map((tag) => tag.id),
          ]);
          const draftKeepsPeriod = draft.periodTouched
            ?? (draft.periodKind !== undefined && draft.periodKind !== "none");
          setSelectedTagIds((draft.selectedTagIds ?? cubeTrack.tagIds)
            .filter((tagId) => knownTagIds.has(tagId)));
          setPendingTags(restoredPendingTags);
          setCharacter(draft.character ?? cubeTrack.character);
          setPeriodKind(draftKeepsPeriod ? draft.periodKind ?? defaultPeriodKind : defaultPeriodKind);
          setPeriodYear(draftKeepsPeriod ? draft.periodYear ?? defaultPeriodYear : defaultPeriodYear);
          setPeriodMonth(draftKeepsPeriod ? draft.periodMonth ?? defaultPeriodMonth : defaultPeriodMonth);
          setPeriodSeason(draftKeepsPeriod
            ? draft.periodSeason ?? (cubeTrack.memoryPeriod?.kind === "season" ? cubeTrack.memoryPeriod.season : "spring")
            : cubeTrack.memoryPeriod?.kind === "season" ? cubeTrack.memoryPeriod.season : "spring");
          setPeriodTouched(draftKeepsPeriod);
          const restoredEditingNote = draft.editingNoteId
            ? cubeTrack.notes.find((note) => note.id === draft.editingNoteId)
            : null;
          if (draft.editingNoteId && !restoredEditingNote) {
            notify("수정 중이던 메모가 삭제되어 새 메모 작성으로 전환했어요.");
          }
          setEditingNoteId(restoredEditingNote?.id ?? null);
          setNoteDate(draft.noteDate ?? restoredEditingNote?.listenedOn ?? today);
          setNoteBody(draft.noteBody ?? restoredEditingNote?.body ?? "");
          shouldOpenDetails = draft.detailsOpen
            ?? (shouldOpenDetails || Boolean(draft.noteBody || restoredEditingNote));
        }
      } catch {
        // Session-only drafts are best effort and never block the archive.
      }
      setDetailsOpen(shouldOpenDetails);
      draftReady.current = true;
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubeTrackId]);

  useEffect(() => {
    if (!cubeTrackId || !draftReady.current) return;
    try {
      window.sessionStorage.setItem(`music-world:memory-draft:v1:${cubeTrackId}`, JSON.stringify({
        selectedTagIds,
        character,
        periodKind,
        periodYear,
        periodMonth,
        periodSeason,
        periodTouched,
        noteDate,
        noteBody,
        editingNoteId,
        pendingTags,
        detailsOpen,
      }));
    } catch {
      // Session-only drafts are best effort.
    }
  }, [character, cubeTrackId, detailsOpen, editingNoteId, noteBody, noteDate, pendingTags, periodKind, periodMonth, periodSeason, periodTouched, periodYear, selectedTagIds]);

  if (!cubeTrackId || !cubeTrack || !track || !cube) return <div className="page-content"><EmptyState title="곡의 기억을 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
  const activeCubeTrack = cubeTrack;
  const activeTrack = track;
  const activeCube = cube;
  const notes = getCubeTrackNotes(activeCubeTrack);
  const providerName = {
    itunes: "Apple Music",
    spotify: "Spotify",
    youtube: "YouTube Music",
    melon: "Melon",
  }[activeTrack.provider];

  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => current.includes(tagId)
      ? current.filter((item) => item !== tagId)
      : [...current, tagId].slice(0, ARCHIVE_LIMITS.tagsPerCubeTrack));
  }

  function addTag(label: string): boolean {
    try {
      const normalizedLabel = normalizeTagLabel(label);
      const pending = pendingTags.find((tag) => tag.normalizedLabel === normalizedLabel);
      if (pending) {
        if (!selectedTagIds.includes(pending.id)) {
          setSelectedTagIds((current) => [...current, pending.id].slice(0, ARCHIVE_LIMITS.tagsPerCubeTrack));
        }
        return true;
      }
      const result = createTags(archive, [label]);
      const tag = result.tags[0];
      if (!tag) return false;
      if (selectedTagIds.includes(tag.id)) {
        notify("이미 선택한 태그예요.");
        return true;
      }
      if (result.created > 0) setPendingTags((current) => [...current, tag]);
      setSelectedTagIds((current) => [...current, tag.id].slice(0, ARCHIVE_LIMITS.tagsPerCubeTrack));
      notify(`‘${tag.label}’ 태그를 기록 대기 중이에요.`);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "태그를 추가하지 못했어요.");
      return false;
    }
  }

  function clearDraft() {
    try {
      window.sessionStorage.removeItem(`music-world:memory-draft:v1:${activeCubeTrack.id}`);
    } catch {
      // Best effort.
    }
  }

  function persist(returnToSource = false) {
    try {
      const selectedExistingTagIds = selectedTagIds.filter((tagId) => Boolean(archive.data.tags[tagId]));
      const selectedPendingLabels = pendingTags
        .filter((tag) => selectedTagIds.includes(tag.id))
        .map((tag) => tag.label);
      const created = createTags(archive, selectedPendingLabels);
      const resolvedTagIds = [...new Set([
        ...selectedExistingTagIds,
        ...created.tags.map((tag) => tag.id),
      ])];
      if (!resolvedTagIds.length) {
        notify("나중에 이 곡을 찾을 키워드를 하나 남겨 주세요.");
        return;
      }
      const year = periodYear.trim() ? Number(periodYear) : null;
      const memoryPeriod: MemoryPeriod = periodKind === "none"
        ? null
        : periodKind === "month"
          ? { kind: "month", year, month: Number(periodMonth) }
          : { kind: "season", year, season: periodSeason };
      const withDetails = updateCubeTrack(created.archive, activeCubeTrack.id, {
        character,
        memoryPeriod,
      });
      let next = setCubeTrackTagIds(withDetails, activeCubeTrack.id, resolvedTagIds);
      if (noteBody.trim()) {
        next = editingNoteId
          ? updateCubeTrackNote(next, activeCubeTrack.id, editingNoteId, { listenedOn: noteDate, body: noteBody })
          : addCubeTrackNote(next, activeCubeTrack.id, { listenedOn: noteDate, body: noteBody });
      }
      if (commit(next, editingNoteId ? "날짜별 감상을 수정했어요." : "이 곡의 새로운 감상을 기록했어요.")) {
        clearDraft();
        if (returnToSource && activeTrack.externalUrl) {
          window.open(activeTrack.externalUrl, "_blank", "noopener,noreferrer");
        }
        if (activeCube.kind === "capture") router.push("/tags", "back");
        else router.push(`/chapter?id=${encodeURIComponent(activeCube.id)}`, "back", activeCube.id);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "기억을 기록하지 못했어요.");
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    persist(false);
  }

  function editNote(note: MemoryNote) {
    setEditingNoteId(note.id);
    setNoteDate(note.listenedOn ?? today);
    setNoteBody(note.body);
    document.getElementById("memory-note-body")?.focus();
  }

  function cancelNoteEdit() {
    setEditingNoteId(null);
    setNoteDate(today);
    setNoteBody("");
  }

  function deleteNote(note: MemoryNote) {
    if (!window.confirm("이 날짜의 메모를 삭제할까요? 다른 메모는 그대로 남습니다.")) return;
    try {
      const next = removeCubeTrackNote(archive, activeCubeTrack.id, note.id);
      if (commit(next, "날짜별 메모를 삭제했어요.") && editingNoteId === note.id) {
        cancelNoteEdit();
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "메모를 삭제하지 못했어요.");
    }
  }

  function addToOtherChapter(targetChapterId: string) {
    try {
      if (activeCube.kind === "capture") {
        const moved = moveCaptureTrackToCube(archive, activeCubeTrack.id, targetChapterId);
        const target = moved.status === "moved" ? moved.cubeTrack : moved.existingCubeTrack;
        const message = moved.status === "moved"
          ? "키워드 기록을 챕터로 옮겼어요."
          : "이 챕터에 같은 곡의 기록이 있어 기존 기억을 열었어요.";
        if (commit(moved.archive, message)) {
          setAssigning(false);
          router.push(`/memory?id=${encodeURIComponent(target.id)}&mode=${recordMode}`, "shared", target.id);
        }
        return;
      }
      const result = addIndependentTrackMemory(archive, activeTrack.id, targetChapterId);
      if (commit(result.archive, result.added ? "같은 곡을 새로운 순간에 담았어요." : "이미 있던 순간을 열었어요.")) {
        setAssigning(false);
        router.push(`/memory?id=${encodeURIComponent(result.cubeTrack.id)}&mode=${recordMode}`, "shared", result.cubeTrack.id);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터로 옮기지 못했어요.");
    }
  }

  return (
    <div className="page-content memory-view">
      <PageHeader
        eyebrow={cube.kind === "capture" ? "챕터 미분류 · 키워드 기록" : `개인 기록 · ${formatChapterTitle(cube)}`}
        title="키워드 기록"
        description={<>나중에 어떤 말로 <strong>‘{track.title}’</strong>을 찾고 싶은가요?</>}
      />
      <div className="memory-layout">
        <MemoryPanel cubeTrack={cubeTrack} track={track} preview={preview} onSharePrototype={() => notify("공유 이미지 기능을 확인 중이에요. 프로토타입에서는 버튼만 제공됩니다.")} />
        <form className="memory-form form-stack" onSubmit={save}>
          <TagEditor
            tags={availableTags}
            selectedTagIds={selectedTagIds}
            suggestedTagIds={suggestedTagIds}
            usageCounts={tagUsageCounts}
            toggleTag={toggleTag}
            addTag={addTag}
            searchableTagIds={Object.keys(archive.data.tags)}
          />
          <details
            className="memory-details-disclosure"
            open={detailsOpen}
            onToggle={(event) => setDetailsOpen(event.currentTarget.open)}
          >
            <summary>더 남기기</summary>
            <div className="memory-details-content form-stack">
          <div className="field">
            <label htmlFor="character">성격</label>
            <input
              id="character"
              className="input"
              value={character}
              onChange={(event) => setCharacter(event.target.value)}
              maxLength={ARCHIVE_LIMITS.character}
              placeholder="예: 건조하고 빠르게 달리는 밤의 록"
            />
            <span className="field-hint">{character.length} / {ARCHIVE_LIMITS.character}</span>
          </div>
          <fieldset className="field memory-period-field">
            <legend>기억한 시기 · 선택</legend>
            <div className="memory-period-controls">
              <label className="memory-period-kind">
                <span className="sr-only">시기 단위</span>
                <select id="memory-period-kind" className="input" value={periodKind} onChange={(event) => {
                  setPeriodKind(event.target.value as "none" | NonNullable<MemoryPeriod>["kind"]);
                  setPeriodTouched(true);
                }}>
                  <option value="none">시기 기록 안 함</option>
                  <option value="month">월로 기록</option>
                  <option value="season">계절로 기록</option>
                </select>
              </label>
              {periodKind !== "none" ? (
                <label>
                  <span className="sr-only">연도</span>
                  <input id="memory-period-year" className="input" type="number" inputMode="numeric" min="1900" max="2200" value={periodYear} onChange={(event) => {
                    setPeriodYear(event.target.value);
                    setPeriodTouched(true);
                  }} placeholder="연도 · 선택" />
                </label>
              ) : null}
              {periodKind === "month" ? (
                <label>
                  <span className="sr-only">월</span>
                  <select id="memory-period-value" className="input" value={periodMonth} onChange={(event) => {
                    setPeriodMonth(event.target.value);
                    setPeriodTouched(true);
                  }}>
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => <option value={month} key={month}>{month}월</option>)}
                  </select>
                </label>
              ) : null}
              {periodKind === "season" ? (
                <label>
                  <span className="sr-only">계절</span>
                  <select id="memory-period-value" className="input" value={periodSeason} onChange={(event) => {
                    setPeriodSeason(event.target.value as Season);
                    setPeriodTouched(true);
                  }}>
                    <option value="spring">봄</option>
                    <option value="summer">여름</option>
                    <option value="autumn">가을</option>
                    <option value="winter">겨울</option>
                  </select>
                </label>
              ) : null}
            </div>
          </fieldset>
          <section className="memory-note-composer" aria-labelledby="memory-note-title">
            <div className="memory-note-heading">
              <div><span className="section-label">날짜별 감상</span><h2 id="memory-note-title">{editingNoteId ? "메모 수정" : "새 메모 추가"}</h2></div>
              {editingNoteId ? <button className="text-button" type="button" onClick={cancelNoteEdit}>수정 취소</button> : null}
            </div>
            <div className="field">
              <label htmlFor="memory-note-date">감상 날짜</label>
              <input id="memory-note-date" className="input" type="date" value={noteDate} onChange={(event) => setNoteDate(event.target.value)} required />
            </div>
            <div className="field">
              <label htmlFor="memory-note-body">메모 · 선택</label>
              <textarea id="memory-note-body" className="textarea" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} maxLength={ARCHIVE_LIMITS.memo} placeholder="오늘 이 곡에서 새롭게 들린 것" />
              <span className="field-hint">{noteBody.length} / {ARCHIVE_LIMITS.memo}</span>
            </div>
          </section>
          {notes.length ? (
            <section className="memory-note-history" aria-labelledby="memory-note-history-title">
              <div className="memory-note-heading"><div><span className="section-label">{notes.length}개의 감상</span><h2 id="memory-note-history-title">지금까지의 메모</h2></div></div>
              <ol className="memory-note-list">
                {notes.map((note) => (
                  <li className="memory-note-item" key={note.id}>
                    <time dateTime={note.listenedOn ?? note.createdAt}>{note.listenedOn ? formatCalendarDate(note.listenedOn) : `날짜 미지정 · ${formatMemory(activeCubeTrack.memoryPeriod)}`}</time>
                    <p>{note.body}</p>
                    <div className="memory-note-actions"><button type="button" onClick={() => editNote(note)}>수정</button><button type="button" onClick={() => deleteNote(note)}>삭제</button></div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
            </div>
          </details>
          <div className="memory-form-actions">
            <div className="dialog-actions">
              <button className="button" type="button" onClick={() => {
                notify("작성 중인 내용은 이 기기에 임시 저장했어요.");
                if (cube.kind === "capture") router.push("/tags", "back");
                else router.push(`/chapter?id=${encodeURIComponent(cube.id)}`, "back", cube.id);
              }}>나중에 이어서</button>
              {activeCube.kind === "capture" || recordMode === "detail" ? <button className="button" type="button" onClick={() => setAssigning(true)}>{activeCube.kind === "capture" ? "챕터로 옮기기" : "다른 챕터에도 기록"}</button> : null}
              <button className="button button-primary" type="submit">{editingNoteId ? "수정 완료" : "키워드 기록"}</button>
            </div>
            {activeTrack.externalUrl ? <button className="text-button memory-return-action" type="button" onClick={() => persist(true)}>기록하고 {providerName}으로 돌아가기</button> : null}
          </div>
        </form>
      </div>

      {assigning ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setAssigning(false)}>
          <div ref={assignDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="other-chapter-title" onClick={(event) => event.stopPropagation()}>
            <span className="section-label">다른 챕터</span>
            <h2 id="other-chapter-title">새로운 순간을 고르세요</h2>
            <div className="track-list" style={{ marginTop: 22 }}>
              {getCubesInTreeOrder(archive)
                .filter((item) => item.id !== cube.id && isVisibleChapter(archive, item) && isAssignableChapter(item))
                .map((item, index) => (
                  <ChapterChoice
                    archive={archive}
                    chapter={item}
                    detail={`${getCubeTracks(archive, item.id).length}곡`}
                    index={index}
                    key={item.id}
                    onSelect={addToOtherChapter}
                  />
                ))}
            </div>
            <div className="dialog-actions"><button className="button" type="button" onClick={() => setAssigning(false)}>닫기</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
