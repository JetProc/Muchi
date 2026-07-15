"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import {
  Apple,
  AudioLines,
  ChevronDown,
  CirclePlay,
  MoreHorizontal,
  Plus,
} from "lucide-react";
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
} from "./editorial-ui";
import {
  COLOR_HEX,
  COLOR_LABEL,
  chapterColorStyle,
  formatDate,
  formatMemory,
} from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { useModalFocus } from "./editorial-accessibility";
import {
  TagPicker,
  type EditableTagCategory,
} from "./editorial-tag-picker";

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
  const [activeTab, setActiveTab] = useState<"manual" | "monthly">("manual");
  const [sortMode, setSortMode] = useState<"recent" | "name" | "tracks">("recent");
  const chapters = useMemo(() => Object.values(archive.data.cubes), [archive.data.cubes]);
  const manualChapters = chapters.filter((chapter) => !chapter.id.startsWith("month:"));
  const monthlyChapters = chapters.filter((chapter) => chapter.id.startsWith("month:"));
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
            return (
              <article className="chapter-library-card" key={chapter.id}>
                <div className="chapter-library-cover">
                  <Link href={`/chapter?id=${encodeURIComponent(chapter.id)}`} intent="shared" sharedId={chapter.id} aria-label={`${chapter.name} 챕터 열기`}>
                    <ChapterCover archive={archive} chapter={chapter} />
                  </Link>
                  {activeTab === "manual" ? (
                    <button className="chapter-library-more" type="button" onClick={() => setDeleteTarget(chapter)} aria-label={`${chapter.name} 챕터 관리`} title="챕터 삭제">
                      <MoreHorizontal size={18} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <Link className="chapter-library-copy" href={`/chapter?id=${encodeURIComponent(chapter.id)}`} intent="shared" sharedId={chapter.id}>
                  <strong>{chapter.name}</strong>
                  <span>{activeTab === "manual" ? "내 챕터" : "월별 챕터"} · {entries.length}곡</span>
                  {chapter.description ? <small>{chapter.description}</small> : null}
                </Link>
              </article>
            );
          })}
        </section>
      ) : (
        <EmptyState
          icon=""
          title={activeTab === "manual" ? "첫 챕터의 이름을 지어주세요" : "아직 월별 챕터가 없어요"}
          action={activeTab === "manual" ? <button className="button button-primary" type="button" onClick={() => setShowForm(true)}>첫 챕터 만들기</button> : null}
        />
      )}

      {showForm || pendingTrack ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => { setShowForm(false); if (pendingTrack) router.replace("/chapters"); }}>
          <form ref={createDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-chapter-title" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
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
        <div className="dialog-backdrop" role="presentation" onClick={() => setDeleteTarget(null)}>
          <div ref={deleteDialogRef} className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-chapter-title" onClick={(event) => event.stopPropagation()}><span className="section-label">챕터 삭제</span><h2 id="delete-chapter-title">‘{deleteTarget.name}’을 지울까요?</h2><p>이 챕터의 {getCubeTracks(archive, deleteTarget.id).length}개 기억은 삭제되지만 다른 챕터의 같은 곡은 그대로 남습니다.</p><div className="dialog-actions"><button className="button" type="button" onClick={() => setDeleteTarget(null)}>취소</button><button className="button button-danger" type="button" onClick={() => { commit(deleteCube(archive, deleteTarget.id), "챕터를 삭제했어요."); setDeleteTarget(null); }}>삭제하기</button></div></div>
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
  hydrated,
}: {
  archive: ArchiveEnvelopeV1;
  chapterId: string | null;
  commit: ArchiveCommit;
  notify: Notify;
  hydrated: boolean;
}) {
  const chapter = chapterId ? archive.data.cubes[chapterId] : null;
  const entries = chapter ? getCubeTracks(archive, chapter.id) : [];
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState<CubeColor>("violet");
  const [managing, setManaging] = useState(false);
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  const editDialogRef = useModalFocus<HTMLFormElement>(
    editing,
    () => setEditing(false),
  );

  if (!hydrated || !chapterId) return <div className="page-content"><EmptyState icon="" title="챕터를 불러오고 있어요" /></div>;
  if (!chapter) return <div className="page-content"><EmptyState icon="" title="챕터를 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
  const activeChapter = chapter;

  const allTags = entries.flatMap((entry) => entry.tags);

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
    <div className="page-content chapter-view chapter-detail-compact">
      <section className="chapter-hero chapter-detail-hero" style={chapterColorStyle(chapter.color)}>
        <ChapterCover archive={archive} chapter={chapter} shared />
        <div className="chapter-hero-copy">
          <span className="section-label">챕터 · {formatDate(chapter.updatedAt)}</span>
          <h1>{chapter.name}</h1>
          {chapter.description ? <p>{chapter.description}</p> : null}
          <p className="chapter-detail-meta">{entries.length}곡 · {new Set(allTags.map((tag) => tag.id)).size}개 태그 · {entries.filter((entry) => entry.cubeTrack.memo).length}개 메모</p>
          <div className="chapter-actions"><Link className="button button-primary" href="/capture" intent="modal">곡 추가</Link><button className="text-button" type="button" onClick={() => setManaging((value) => !value)}>{managing ? "관리 완료" : "곡 관리"}</button>{managing ? <button className="text-button" type="button" onClick={openEditor}>챕터 정보 수정</button> : null}</div>
        </div>
      </section>
      {entries.length ? (
        <section className="chapter-service-actions" aria-labelledby="chapter-service-title">
          <h2 id="chapter-service-title">플레이리스트로 만들기</h2>
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
      <section className="section chapter-track-section">
        <div className="section-head"><div><span className="section-label">{entries.length}곡</span><h2>{managing ? "순서와 곡 관리" : "수록곡"}</h2></div></div>
        {entries.length ? (
          <div className="chapter-compact-track-list">
            {entries.map((entry, index) => {
              const expanded = expandedTrackId === entry.cubeTrack.id;
              const summary = entry.cubeTrack.memo.trim()
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
                          {entry.tags.slice(0, 6).map((tag) => <span key={tag.id}>#{tag.label}</span>)}
                          {entry.tags.length > 6 ? <span>+{entry.tags.length - 6}</span> : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <EmptyState icon="♪" title="이 순간의 첫 곡을 담아보세요" action={<Link className="button button-primary" href="/capture">곡 찾기</Link>} />}
      </section>

      {editing ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setEditing(false)}>
          <form ref={editDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-chapter-title" onSubmit={saveChapter} onClick={(event) => event.stopPropagation()}>
            <span className="section-label">챕터 수정</span>
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
      <div className="memory-art-copy">
        <span className="section-label">{formatMemory(cubeTrack.memoryPeriod)}</span>
        <h2>{track.title}</h2>
        <p>{track.artist}{track.album ? ` · ${track.album}` : ""}</p>
        <div className="memory-preview-actions">
          <PreviewButton track={track} preview={preview} />
          {track.externalUrl ? <a className="text-link" href={track.externalUrl} target="_blank" rel="noopener noreferrer">원본 열기</a> : null}
        </div>
      </div>
    </aside>
  );
}

interface TagEditorProps {
  tags: TagDefinition[];
  selectedTagIds: string[];
  usageCounts: Record<string, number>;
  memo: string;
  toggleTag: (tagId: string) => void;
  addTag: (category: EditableTagCategory, label: string) => boolean;
  setMemo: (value: string) => void;
}

export function TagEditor({
  tags,
  selectedTagIds,
  usageCounts,
  memo,
  toggleTag,
  addTag,
  setMemo,
}: TagEditorProps) {
  return (
    <>
      <div className="field managed-tag-field">
        <TagPicker
          tags={tags}
          selectedTagIds={selectedTagIds}
          usageCounts={usageCounts}
          onToggle={toggleTag}
          onCreate={addTag}
        />
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
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [draftArchive, setDraftArchive] = useState<ArchiveEnvelopeV1 | null>(null);
  const [assigning, setAssigning] = useState(false);
  const availableTags = Object.values((draftArchive ?? archive).data.tags)
    .sort((left, right) => left.label.localeCompare(right.label, "ko"));
  const tagUsageCounts = Object.values(archive.data.cubeTracks).reduce<Record<string, number>>((counts, item) => {
    item.tagIds.forEach((tagId) => {
      counts[tagId] = (counts[tagId] ?? 0) + 1;
    });
    return counts;
  }, {});
  const assignDialogRef = useModalFocus<HTMLDivElement>(
    assigning,
    () => setAssigning(false),
  );
  useEffect(() => {
    if (!cubeTrack) return;
    const hydrationTimer = window.setTimeout(() => {
      setSelectedTagIds(cubeTrack.tagIds.filter((tagId) => Boolean(archive.data.tags[tagId])));
      setMemo(cubeTrack.memo);
      setDraftArchive(null);
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

  function addTag(category: EditableTagCategory, label: string): boolean {
    try {
      const result = createTags(draftArchive ?? archive, [{ label, category }]);
      const tag = result.tags[0];
      if (!tag) return false;
      if (selectedTagIds.includes(tag.id)) {
        notify("이미 선택한 태그예요.");
        return true;
      }
      setDraftArchive(result.archive);
      setSelectedTagIds((current) => [...current, tag.id].slice(0, ARCHIVE_LIMITS.tagsPerCubeTrack));
      notify(`‘${tag.label}’ 태그를 저장 대기 중이에요.`);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : "태그를 추가하지 못했어요.");
      return false;
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    try {
      const withDetails = updateCubeTrack(draftArchive ?? archive, activeCubeTrack.id, {
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
            ? "같은 곡을 새로운 순간에 담았어요."
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
      <PageHeader eyebrow={`기억 · ${cube.name}`} title={`‘${track.title}’은 이 순간 어떤 음악인가요?`} />
      <div className="memory-layout">
        <MemoryPanel cubeTrack={cubeTrack} track={track} preview={preview} />
        <form className="memory-form form-stack" onSubmit={save}>
          <TagEditor
            tags={availableTags}
            selectedTagIds={selectedTagIds}
            usageCounts={tagUsageCounts}
            memo={memo}
            toggleTag={toggleTag}
            addTag={addTag}
            setMemo={setMemo}
          />
          <div className="dialog-actions"><button className="button" type="button" onClick={() => router.push(`/chapter?id=${encodeURIComponent(cube.id)}`, "back", cube.id)}>취소</button><button className="button" type="button" onClick={() => setAssigning(true)}>다른 챕터에도 담기</button><button className="button button-primary" type="submit">이 순간 저장하기</button></div>
        </form>
      </div>

      {assigning ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setAssigning(false)}>
          <div ref={assignDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="other-chapter-title" onClick={(event) => event.stopPropagation()}>
            <span className="section-label">다른 챕터</span>
            <h2 id="other-chapter-title">새로운 순간을 고르세요</h2>
            <div className="track-list" style={{ marginTop: 22 }}>
              {Object.values(archive.data.cubes).filter((item) => item.id !== cube.id).map((item, index) => <button className="chapter-choice" key={item.id} type="button" onClick={() => addToOtherChapter(item.id)}><span>{String(index + 1).padStart(2, "0")}</span><ChapterCover archive={archive} chapter={item} /><span className="track-info"><strong>{item.name}</strong><small>{getCubeTracks(archive, item.id).length}곡</small></span><em>선택</em></button>)}
            </div>
            <div className="dialog-actions"><button className="button" type="button" onClick={() => setAssigning(false)}>닫기</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
