"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  ChevronRight,
  Lock,
  MoreHorizontal,
  Plus,
  Sparkles,
  Trash2,
  Unlock,
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
  reconcileTagSelection,
  reorderCubeTracks,
  setChapterTrackSort,
  setCubeTrackTagIds,
  setCubeTrackRecordVisibility,
  setCubeTrackAffection,
  sortChapterTrackEntries,
  updateCube,
  updateCubeTrackNote,
  type ArchiveEnvelopeV1,
  type AffectionLevel,
  type Cube,
  type CubeTrack,
  type ChapterVisibility,
  type MemoryNote,
  type TagDefinition,
  type TrackId,
  type TrackReference,
} from "@/lib/archive";
import {
  deleteUploadedRecordPhoto,
  uploadRecordPhoto,
  type RecordPhotoUploadResult,
} from "@/lib/client/record-photo-api";
import {
  MotionLink as Link,
  type MotionRouter,
} from "./editorial-motion";
import {
  AlbumArtwork,
  ChapterCover,
  getOwnedRecordPhotoUrl,
} from "./editorial-media";
import {
  ChapterChoice,
  CenteredEmptyMessage,
  EmptyState,
  InlineChapterCreate,
  PageHeader,
  AffectionDot,
  AffectionSelector,
} from "./editorial-ui";
import {
  chapterColorStyle,
  formatChapterTitle,
  formatCalendarDate,
  formatDate,
  formatTrackArtist,
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
import { MusicServiceIcon } from "./editorial-service-icon";

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

export type ChapterTrackDetailItem = {
  id: string;
  track: TrackReference;
  customImageUrl?: string | null;
  summary: ReactNode;
  tags?: Array<Pick<TagDefinition, "id" | "label">>;
  action?: ReactNode;
  detailActions?: ReactNode;
  collapsible?: boolean;
  privateRecord?: boolean;
  sharedId?: string;
  affection?: AffectionLevel | null;
};

export function ChapterDetailHero({
  cover,
  eyebrow,
  leading,
  menu,
  title,
  description,
  visibilityAction,
  meta,
  actions,
  utilities,
  actionsOutsideCopy = false,
  utilitiesOutsideCopy = false,
  compactUtilityRow = false,
  actionsBelowCopy = false,
  style,
}: {
  cover: ReactNode;
  eyebrow: ReactNode;
  leading?: ReactNode;
  menu?: ReactNode;
  title: string;
  description?: string;
  visibilityAction?: ReactNode;
  meta: ReactNode;
  actions?: ReactNode;
  utilities?: ReactNode;
  actionsOutsideCopy?: boolean;
  utilitiesOutsideCopy?: boolean;
  compactUtilityRow?: boolean;
  actionsBelowCopy?: boolean;
  style?: CSSProperties;
}) {
  const showMetaRow = Boolean(meta || (!compactUtilityRow && !utilitiesOutsideCopy && utilities) || (!actionsOutsideCopy && !actionsBelowCopy && actions));
  return (
    <section className="chapter-hero chapter-detail-hero" style={style}>
      {compactUtilityRow ? <div className="chapter-detail-cover-column">
        {cover}
        {visibilityAction ? <div className="chapter-detail-visibility">{visibilityAction}</div> : null}
        {utilities ? <div className="chapter-detail-utilities is-inline">{utilities}</div> : null}
      </div> : cover}
      {menu ? <div className="chapter-hero-menu">{menu}</div> : null}
      <div className="chapter-hero-copy">
        <span className="section-label">{eyebrow}</span>
        {leading}
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
        {!compactUtilityRow && visibilityAction ? <div className="chapter-detail-visibility">{visibilityAction}</div> : null}
        {showMetaRow ? <div className="chapter-detail-meta-row">
          {meta ? <p className="chapter-detail-meta">{meta}</p> : null}
          {!compactUtilityRow && !utilitiesOutsideCopy && utilities ? <div className="chapter-detail-utilities is-inline">{utilities}</div> : null}
          {!actionsOutsideCopy && actions ? <div className="chapter-detail-meta-action">{actions}</div> : null}
        </div> : null}
        {actionsBelowCopy && actions ? <div className="chapter-detail-hero-action">{actions}</div> : null}
      </div>
      {actionsOutsideCopy && actions ? <div className="chapter-detail-meta-action is-outside-copy">{actions}</div> : null}
      {utilitiesOutsideCopy && utilities ? <div className="chapter-detail-utilities is-outside-copy">{utilities}</div> : null}
    </section>
  );
}

export function ChapterTrackSection({
  items,
  title = "수록곡",
  label = `${items.length}곡`,
  action,
  tagHref,
}: {
  items: ChapterTrackDetailItem[];
  title?: string;
  label?: ReactNode;
  action?: ReactNode;
  tagHref?: (tag: Pick<TagDefinition, "id" | "label">) => string;
}) {
  const [expandedTrackId, setExpandedTrackId] = useState<string | null>(null);
  return (
    <section className="section chapter-track-section">
      <div className="section-head"><div className="chapter-section-heading"><h2>{title}</h2><span className="section-label">{label}</span></div>{action}</div>
      <div className="chapter-compact-track-list">
        {items.map((item) => {
          const expanded = expandedTrackId === item.id;
          const canExpand = item.collapsible ?? !item.privateRecord;
          const inlineSummary = item.collapsible === false ? item.summary : null;
          return (
            <article className={`chapter-compact-track${expanded ? " is-expanded" : ""}`} key={item.id}>
              <div className="chapter-compact-track-main">
                {canExpand ? (
                  <button
                    className="chapter-compact-track-toggle"
                    type="button"
                    onClick={() => setExpandedTrackId((current) => current === item.id ? null : item.id)}
                    aria-expanded={expanded}
                    aria-controls={`chapter-track-detail-${item.id}`}
                  >
                    <AlbumArtwork track={item.track} customImageUrl={item.customImageUrl} sharedId={item.sharedId ?? item.id} decorative />
                    <span className="chapter-compact-track-copy">
                      <span className="chapter-compact-track-title"><strong>{item.track.title}</strong>{item.affection ? <AffectionDot affection={item.affection} /> : null}</span>
                      <span>{formatTrackArtist(item.track)}</span>
                    </span>
                    <ChevronDown size={15} aria-hidden="true" />
                  </button>
                ) : (
                  <div className="chapter-compact-track-toggle is-static">
                    <AlbumArtwork track={item.track} customImageUrl={item.customImageUrl} sharedId={item.sharedId ?? item.id} decorative />
                    <span className="chapter-compact-track-copy">
                      <span className="chapter-compact-track-title"><strong>{item.track.title}</strong>{item.affection ? <AffectionDot affection={item.affection} /> : null}</span>
                      <span>{formatTrackArtist(item.track)}</span>
                      {inlineSummary ? <small>{inlineSummary}</small> : null}
                    </span>
                  </div>
                )}
                {item.action}
              </div>
              {canExpand ? (
                <div className="chapter-compact-track-detail" id={`chapter-track-detail-${item.id}`} aria-hidden={!expanded}>
                  <div>
                    {item.summary ? <p>{item.summary}</p> : null}
                    {item.tags?.length ? (
                      <div className="chapter-compact-track-tags" aria-label="곡 태그">
                        {item.tags.slice(0, 6).map((tag) => tagHref ? (
                          <Link href={tagHref(tag)} intent="forward" key={tag.id}>#{tag.label}</Link>
                        ) : <span key={tag.id}>#{tag.label}</span>)}
                        {item.tags.length > 6 ? <span>+{item.tags.length - 6}</span> : null}
                      </div>
                    ) : null}
                    {expanded && item.customImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="chapter-compact-track-photo"
                        src={item.customImageUrl}
                        alt={`${item.track.title} 기록 사진`}
                        loading="lazy"
                        decoding="async"
                      />
                    ) : null}
                    {item.detailActions ? <div className="chapter-compact-track-detail-actions">{item.detailActions}</div> : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function ChapterPlaylistActions({ chapterId, source }: {
  chapterId: string;
  source?: "discover";
}) {
  const youtubeHref = `/playlist?id=${encodeURIComponent(chapterId)}&service=youtube${source ? `&source=${source}` : ""}`;
  return (
    <nav className="chapter-service-actions" aria-label="플레이리스트로 내보내기">
      <div className="chapter-service-grid">
        <button className="chapter-service-link is-apple" type="button" disabled aria-label="Apple Music 내보내기 준비 중">
          <span className="chapter-service-icon" aria-hidden="true"><MusicServiceIcon service="apple" /></span>
          <span>Apple Music 준비 중</span>
        </button>
        <Link className="chapter-service-link is-youtube" href={youtubeHref} intent="forward">
          <span className="chapter-service-icon" aria-hidden="true"><MusicServiceIcon service="youtube" /></span>
          <span>YouTube Music으로 내보내기</span>
        </Link>
      </div>
    </nav>
  );
}

export function Chapters({
  archive,
  commit,
  notify,
  router,
  pendingTrackId,
  pendingTrackIds,
  pendingRecordMode,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
  router: MotionRouter;
  pendingTrackId: TrackId | null;
  pendingTrackIds?: TrackId[];
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
  const resolvedPendingTrackIds = pendingTrackIds?.length
    ? pendingTrackIds
    : pendingTrackId
      ? [pendingTrackId]
      : [];
  const pendingTracks = resolvedPendingTrackIds
    .map((trackId) => archive.data.tracks[trackId])
    .filter((track): track is TrackReference => Boolean(track));
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<ChapterVisibility>("private");
  const [deleteTarget, setDeleteTarget] = useState<Cube | null>(null);
  const createDialogRef = useModalFocus<HTMLFormElement>(
    showForm || pendingTracks.length > 0,
    () => {
      setShowForm(false);
      if (pendingTracks.length) router.replace("/chapters");
    },
  );
  const deleteDialogRef = useModalFocus<HTMLDivElement>(
    Boolean(deleteTarget),
    () => setDeleteTarget(null),
  );

  function submit(event: FormEvent) {
      event.preventDefault();
    try {
      const result = createCube(archive, { name, description, coverImageUrl, visibility });
      let next = result.archive;
      const linkedTracks: Array<ReturnType<typeof moveInboxTrackToCube>["cubeTrack"]> = [];
      for (const track of pendingTracks) {
        const linked = next.data.inbox[track.id]
          ? moveInboxTrackToCube(next, track.id, result.cube.id)
          : addTrackToCube(next, track.id, result.cube.id);
        next = linked.archive;
        linkedTracks.push(linked.cubeTrack);
      }
      if (commit(
        next,
        linkedTracks.length > 1
          ? `‘${result.cube.name}’에 ${linkedTracks.length}곡을 담았어요.`
          : linkedTracks.length === 1
            ? `‘${result.cube.name}’에 곡을 담았어요. 이제 이 곡의 표정을 남겨보세요.`
          : `‘${result.cube.name}’ 챕터를 만들었어요.`,
      )) {
        setName("");
        setDescription("");
        setCoverImageUrl(null);
        setVisibility("private");
        setShowForm(false);
        if (linkedTracks.length > 1) {
          router.push(`/chapter?id=${encodeURIComponent(result.cube.id)}`, "shared", result.cube.id);
        } else if (linkedTracks.length === 1) {
          router.push(
            `/memory?id=${encodeURIComponent(linkedTracks[0].id)}&mode=${pendingRecordMode}`,
            "shared",
            linkedTracks[0].id,
          );
        }
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터를 만들지 못했어요.");
    }
  }

  function closeCreateDialog() {
    setShowForm(false);
    if (pendingTracks.length) router.replace("/chapters");
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
    <div className="page-content chapters-view chapter-library-view" data-tour="chapter-library">
      <h1 className="sr-only">챕터 보관함</h1>
      <nav className="chapter-library-tabs" aria-label="챕터 종류">
        <button className={activeTab === "manual" ? "is-active" : ""} type="button" onClick={() => setActiveTab("manual")} aria-current={activeTab === "manual" ? "page" : undefined}>내가 만든 챕터</button>
        <button className={activeTab === "monthly" ? "is-active" : ""} type="button" onClick={() => setActiveTab("monthly")} aria-current={activeTab === "monthly" ? "page" : undefined}>월별 챕터</button>
      </nav>

      <div className="chapter-library-toolbar">
        <div className="chapter-library-heading" aria-live="polite"><span>챕터</span><small>{visibleChapters.length}개</small></div>
        <div className="chapter-library-tools">
          <label className="chapter-library-sort">
            <span className="sr-only">챕터 정렬</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as "recent" | "name" | "tracks")}>
              <option value="recent">최근 활동</option>
              <option value="name">이름순</option>
              <option value="tracks">곡 많은 순</option>
            </select>
          </label>
          {activeTab === "manual" ? (
            <button className="button button-primary chapter-library-create" type="button" onClick={() => setShowForm(true)} aria-label="새 챕터">
              <Plus aria-hidden="true" size={16} />
            </button>
          ) : null}
        </div>
      </div>

      {visibleChapters.length ? (
        <section className="chapter-library-grid" aria-label={activeTab === "manual" ? "내가 만든 챕터" : "월별 챕터"}>
          {visibleChapters.map((chapter) => {
            const entries = getCubeTracks(archive, chapter.id);
            const chapterTitle = formatChapterTitle(chapter);
            return (
              <article className="chapter-library-card" key={chapter.id}>
                <div className="chapter-library-cover">
                  <Link href={`/chapter?id=${encodeURIComponent(chapter.id)}`} intent="shared" sharedId={chapter.id} aria-label={`${chapterTitle} 챕터 열기`}>
                    <ChapterCover archive={archive} chapter={chapter} />
                  </Link>
                  {activeTab === "manual" ? (
                    <button className="chapter-library-delete" type="button" onClick={() => setDeleteTarget(chapter)} aria-label={`${chapter.name} 챕터 삭제`} title="챕터 삭제">
                      <Trash2 size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
                <Link className="chapter-library-copy" href={`/chapter?id=${encodeURIComponent(chapter.id)}`} intent="shared" sharedId={chapter.id}>
                  <strong>{chapterTitle}</strong>
                  <span>{entries.length}곡</span>
                  {chapter.description ? <small>{chapter.description}</small> : null}
                </Link>
              </article>
            );
          })}
        </section>
      ) : activeTab === "manual" ? (
        <CenteredEmptyMessage>아직 만든 챕터가 없어요.</CenteredEmptyMessage>
      ) : <CenteredEmptyMessage>월별 챕터가 아직 없어요.</CenteredEmptyMessage>}

      {showForm || pendingTracks.length ? (
        <div className="dialog-backdrop" role="presentation" onClick={closeCreateDialog}>
          <form ref={createDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="create-chapter-title" onSubmit={submit} onClick={(event) => event.stopPropagation()}>
            <h2 id="create-chapter-title">새 챕터</h2>
            <ChapterFields
              description={description}
              idPrefix="chapter"
              name={name}
              nameLabel="이름"
              namePlaceholder="예: 비 오는 날의 버스"
              onDescriptionChange={setDescription}
              coverImageUrl={coverImageUrl}
              onCoverImageChange={setCoverImageUrl}
              onNameChange={setName}
              onVisibilityChange={setVisibility}
              showDescription={false}
              visibility={visibility}
            />
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={closeCreateDialog}>취소</button><button className="button button-primary" type="submit">{pendingTracks.length ? pendingTracks.length > 1 ? "챕터 만들고 곡 담기" : "챕터 만들고 기록하기" : "챕터 만들기"}</button></div>
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
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<ChapterVisibility>("private");
  const [managing, setManaging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deletingCurrent, setDeletingCurrent] = useState(false);
  const [creatingChild, setCreatingChild] = useState(false);
  const [childName, setChildName] = useState("");
  const [childDescription, setChildDescription] = useState("");
  const [childCoverImageUrl, setChildCoverImageUrl] = useState<string | null>(null);
  const [childVisibility, setChildVisibility] = useState<ChapterVisibility>("private");
  const menuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!menuOpen) return;
    const closeMenu = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeMenu);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenu);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menuOpen]);

  if (!chapterId || !chapter) return <div className="page-content"><EmptyState title="챕터를 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
  const activeChapter = chapter;

  const childChapters = getChildCubes(archive, activeChapter.id);
  const monthlyChapter = isMonthlyChapter(activeChapter);

  function saveChapter(event: FormEvent) {
    event.preventDefault();
    try {
      const next = updateCube(archive, activeChapter.id, { name, description, coverImageUrl, visibility });
      if (commit(next, "챕터 분위기를 수정했어요.")) setEditing(false);
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터를 수정하지 못했어요.");
    }
  }

  function openEditor() {
    setName(activeChapter.name);
    setDescription(activeChapter.description);
    setCoverImageUrl(activeChapter.coverImageUrl);
    setVisibility(activeChapter.visibility);
    setEditing(true);
    setMenuOpen(false);
  }

  function openChildCreator() {
    setChildName("");
    setChildDescription("");
    setChildCoverImageUrl(null);
    setChildVisibility("private");
    setCreatingChild(true);
  }

  function submitChildChapter(event: FormEvent) {
    event.preventDefault();
    try {
      const result = createCube(archive, {
        name: childName,
        description: childDescription,
        coverImageUrl: childCoverImageUrl,
        color: activeChapter.color,
        parentId: activeChapter.id,
        visibility: childVisibility,
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

  function toggleChapterVisibility() {
    const nextVisibility = activeChapter.visibility === "public" ? "private" : "public";
    commit(
      updateCube(archive, activeChapter.id, { visibility: nextVisibility }),
      nextVisibility === "public" ? "챕터를 공개했어요." : "챕터를 비공개로 전환했어요.",
    );
  }

  function changeTrackSort(trackSort: "added" | "affection") {
    commit(
      setChapterTrackSort(archive, activeChapter.id, trackSort),
      trackSort === "affection" ? "애정도 높은 순으로 정렬했어요." : "추가순으로 정렬했어요.",
    );
  }

  const sortedEntries = sortChapterTrackEntries(entries, activeChapter.trackSort);
  const trackItems: ChapterTrackDetailItem[] = sortedEntries.map((entry, index) => ({
    id: entry.cubeTrack.id,
    track: entry.track,
    sharedId: entry.cubeTrack.id,
    customImageUrl: getOwnedRecordPhotoUrl(entry.cubeTrack.id, entry.cubeTrack.customImageVersion),
    summary: getLatestCubeTrackNote(entry.cubeTrack)?.body ?? null,
    tags: entry.tags,
    affection: entry.cubeTrack.affection,
    action: managing ? (
      <div className="chapter-compact-track-manage">
        <button type="button" disabled={index === 0} onClick={() => move(entry.cubeTrack, -1)} aria-label={`${entry.track.title} 위로 이동`}>위</button>
        <button type="button" disabled={index === entries.length - 1} onClick={() => move(entry.cubeTrack, 1)} aria-label={`${entry.track.title} 아래로 이동`}>아래</button>
        <button type="button" onClick={() => removeEntry(entry.cubeTrack, entry.track.title)} aria-label={`${entry.track.title} 삭제`}>삭제</button>
      </div>
    ) : (
      <Link className="chapter-memory-link" href={`/memory?id=${encodeURIComponent(entry.cubeTrack.id)}`} intent="shared" sharedId={entry.cubeTrack.id}>기억 열기</Link>
    ),
  }));

  return (
    <div className="page-content chapter-view chapter-detail-compact" data-tour="chapter-detail">
      <ChapterDetailHero
        cover={<ChapterCover archive={archive} chapter={chapter} />}
        eyebrow={<>{formatDate(chapter.updatedAt)} <span className="chapter-detail-date-count">· {entries.length}곡</span></>}
        title={formatChapterTitle(chapter)}
        description={chapter.description}
        visibilityAction={!monthlyChapter ? (
          <button
            className={`text-button memory-record-visibility ${activeChapter.visibility === "public" ? "is-public" : "is-private"}`}
            type="button"
            onClick={toggleChapterVisibility}
            aria-pressed={activeChapter.visibility === "public"}
            aria-label={`챕터 ${activeChapter.visibility === "public" ? "공개" : "비공개"}`}
          >
            {activeChapter.visibility === "public" ? <Unlock size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
            <span>{activeChapter.visibility === "public" ? "챕터 공개" : "챕터 비공개"}</span>
          </button>
        ) : undefined}
        meta={null}
        actions={!monthlyChapter && entries.length ? (
          <Link
            className="button button-primary chapter-share-entry"
            href={`/chapter/share?id=${encodeURIComponent(activeChapter.id)}`}
            intent="shared"
            sharedId={activeChapter.id}
          >
            <Sparkles size={16} aria-hidden="true" />
            인스타그램 공유
          </Link>
        ) : undefined}
        actionsBelowCopy
        menu={!monthlyChapter ? (
          <div className="chapter-menu" ref={menuRef}>
            <button
              aria-expanded={menuOpen}
              aria-haspopup="menu"
              aria-label="챕터 관리"
              className="chapter-menu-trigger"
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <MoreHorizontal size={18} aria-hidden="true" />
            </button>
            {menuOpen ? (
              <div className="chapter-menu-popover" role="menu">
                <button role="menuitem" type="button" onClick={() => { setManaging((value) => !value); setMenuOpen(false); }}>
                  {managing ? "곡 순서 변경 완료" : "곡 순서 변경"}
                </button>
                <button role="menuitem" type="button" onClick={openEditor}>챕터 정보 수정</button>
                <button role="menuitem" type="button" className="is-danger" onClick={() => { setDeletingCurrent(true); setMenuOpen(false); }}>챕터 삭제</button>
              </div>
            ) : null}
          </div>
        ) : undefined}
        utilities={entries.length ? <ChapterPlaylistActions chapterId={chapter.id} /> : undefined}
        compactUtilityRow
        style={chapterColorStyle(chapter.color)}
      />
      {entries.length ? (
        <ChapterTrackSection
          items={trackItems}
          label={`${entries.length}곡`}
          title="수록곡"
          action={(
            <div className="chapter-track-actions" data-tour="chapter-management">
              <label className="chapter-track-sort">
                <span className="sr-only">곡 정렬</span>
                <select value={activeChapter.trackSort} onChange={(event) => changeTrackSort(event.target.value as "added" | "affection")}>
                  <option value="affection">애정도 높은 순</option>
                  <option value="added">추가순</option>
                </select>
              </label>
              {!monthlyChapter ? <Link className="text-button compact-section-action" href="/capture" intent="modal">
                <Plus size={15} aria-hidden="true" />
                추가
              </Link> : null}
            </div>
          )}
          tagHref={(tag) => `/search?tag=${encodeURIComponent(tag.id)}`}
        />
      ) : <section className="section chapter-track-section"><div className="section-head"><div className="chapter-section-heading"><h2>수록곡</h2><span className="section-label">0곡</span></div>{!monthlyChapter ? <Link className="text-button compact-section-action" href="/capture" intent="modal"><Plus size={15} aria-hidden="true" />추가</Link> : null}</div><EmptyState title="이 순간의 첫 곡을 담아보세요" /></section>}
      {!monthlyChapter ? (
        <section className="child-chapter-section" aria-labelledby="child-chapters-title">
          <div className="child-chapter-head">
            <h2 id="child-chapters-title">하위 챕터</h2>
            {childChapters.length ? (
              <button className="text-button compact-section-action" type="button" onClick={openChildCreator}>
                <Plus size={15} aria-hidden="true" />
                추가
              </button>
            ) : null}
          </div>
          {childChapters.length ? (
            <div className="child-chapter-list">
              {childChapters.map((child) => {
                const childEntries = getCubeTracks(archive, child.id);
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
                      <small>{childEntries.length}곡</small>
                      {child.description ? <span>{child.description}</span> : null}
                    </span>
                    <ChevronRight size={17} aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="child-chapter-empty">
              <button className="text-button compact-section-action" type="button" onClick={openChildCreator}><Plus size={15} aria-hidden="true" />추가</button>
            </div>
          )}
        </section>
      ) : null}

      {editing ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setEditing(false)}>
          <form ref={editDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="edit-chapter-title" onSubmit={saveChapter} onClick={(event) => event.stopPropagation()}>
            <span className="section-label">챕터 수정</span>
            <h2 id="edit-chapter-title">챕터 정보</h2>
            <ChapterFields
              description={description}
              descriptionLabel="설명"
              idPrefix="edit"
              name={name}
              nameLabel="이름"
              onDescriptionChange={setDescription}
              onNameChange={setName}
              coverImageUrl={coverImageUrl}
              onCoverImageChange={setCoverImageUrl}
              onVisibilityChange={setVisibility}
              visibility={visibility}
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
              description={childDescription}
              idPrefix="child-chapter"
              name={childName}
              nameLabel="이름"
              namePlaceholder="예: 비가 내리기 시작할 때"
              onDescriptionChange={setChildDescription}
              onNameChange={setChildName}
              coverImageUrl={childCoverImageUrl}
              onCoverImageChange={setChildCoverImageUrl}
              showDescription={false}
              onVisibilityChange={setChildVisibility}
              visibility={childVisibility}
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

type MemoryPhotoDraft = {
  upload: RecordPhotoUploadResult | null;
  previewUrl: string | null;
  previewUsesObjectUrl: boolean;
  removed: boolean;
};

function emptyMemoryPhotoDraft(): MemoryPhotoDraft {
  return {
    upload: null,
    previewUrl: null,
    previewUsesObjectUrl: false,
    removed: false,
  };
}

function revokePreviewUrl(draft: MemoryPhotoDraft) {
  if (draft.previewUsesObjectUrl && draft.previewUrl) {
    URL.revokeObjectURL(draft.previewUrl);
  }
}

function discardPendingRecordPhoto(draft: MemoryPhotoDraft) {
  revokePreviewUrl(draft);
  if (draft.upload) {
    void deleteUploadedRecordPhoto(draft.upload.customImagePath).catch(() => {
      // Best-effort cleanup; the deferred server sweep remains the fallback.
    });
  }
}

function RecordPhotoField({
  title,
  previewUrl,
  uploading,
  error,
  onSelect,
  onRemove,
  removable,
}: {
  title: string;
  previewUrl: string | null;
  uploading: boolean;
  error: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  removable: boolean;
}) {
  return (
    <section className="field memory-photo-field" aria-labelledby="memory-photo-title">
      <div className="memory-photo-head">
        <div>
          <h2 id="memory-photo-title" className="field-label">{title}</h2>
          <p className="field-hint">JPG, PNG, WEBP 한 장을 이 날짜의 메모와 함께 남길 수 있어요.</p>
        </div>
        {uploading ? <span className="memory-photo-progress" role="status">업로드 중…</span> : null}
      </div>
      <div className={`memory-photo-card${previewUrl ? " has-photo" : ""}${uploading ? " is-uploading" : ""}`}>
        {previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="memory-photo-preview" src={previewUrl} alt="선택한 기록 사진 미리보기" />
        ) : (
          <div className="memory-photo-empty">
            <strong>이 곡과 함께 남기고 싶은 장면이 있나요?</strong>
            <span>없어도 괜찮아요. 사진 없이 태그와 메모만 저장할 수 있어요.</span>
          </div>
        )}
        <div className="memory-photo-actions">
          <label className="button button-ghost" htmlFor="memory-photo-input" aria-disabled={uploading}>
            {uploading ? "올리는 중" : previewUrl ? "사진 바꾸기" : "사진 추가"}
          </label>
          {removable ? <button className="text-button" type="button" onClick={onRemove}>사진 제거</button> : null}
        </div>
      </div>
      <input
        id="memory-photo-input"
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onSelect(file);
        }}
      />
      {error ? <p className="field-error" role="alert">{error}</p> : null}
    </section>
  );
}

export function MemoryPanel({
  cubeTrack,
  track,
}: {
  cubeTrack: CubeTrack;
  track: TrackReference;
}) {
  const latestNote = getLatestCubeTrackNote(cubeTrack);
  return (
    <aside className="memory-art-panel">
      <AlbumArtwork track={track} sharedId={cubeTrack.id} priority />
      <div className="memory-art-copy">
        <span className="section-label">{latestNote?.listenedOn ? formatCalendarDate(latestNote.listenedOn) : `최초 기록 · ${formatDate(cubeTrack.createdAt)}`}</span>
        <h2>{track.title}{cubeTrack.affection ? <AffectionDot affection={cubeTrack.affection} /> : null}</h2>
        <p>{formatTrackArtist(track)}{track.album ? ` · ${track.album}` : ""}</p>
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
  memoryReturnId?: string;
  headingAction?: ReactNode;
}

export function TagEditor({
  tags,
  selectedTagIds,
  suggestedTagIds,
  usageCounts,
  toggleTag,
  addTag,
  memoryReturnId,
  headingAction,
}: TagEditorProps) {
  return (
    <div className="field managed-tag-field">
      <TagPicker
        tags={tags}
        selectedTagIds={selectedTagIds}
        suggestedTagIds={suggestedTagIds}
        usageCounts={usageCounts}
        onToggle={toggleTag}
        onCreate={addTag}
        headingAction={headingAction}
        inline
        manageHref={memoryReturnId
          ? `/tags?fromMemory=${encodeURIComponent(memoryReturnId)}`
          : "/tags"}
      />
    </div>
  );
}

export function Memory({
  archive,
  cubeTrackId,
  commit,
  notify,
  recordMode,
  openChapterMove = false,
  router,
}: {
  archive: ArchiveEnvelopeV1;
  cubeTrackId: string | null;
  commit: ArchiveCommit;
  notify: Notify;
  recordMode: "quick" | "detail";
  openChapterMove?: boolean;
  router: MotionRouter;
}) {
  const cubeTrack = cubeTrackId ? archive.data.cubeTracks[cubeTrackId] : null;
  const track = cubeTrack ? archive.data.tracks[cubeTrack.trackId] : null;
  const cube = cubeTrack ? archive.data.cubes[cubeTrack.cubeId] : null;
  const today = todayInSeoul();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [affection, setAffection] = useState<AffectionLevel | null>(null);
  const [noteDate, setNoteDate] = useState(today);
  const [noteBody, setNoteBody] = useState("");
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [pendingTags, setPendingTags] = useState<TagDefinition[]>([]);
  const [photoDraft, setPhotoDraft] = useState<MemoryPhotoDraft>(() => emptyMemoryPhotoDraft());
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(openChapterMove);
  const draftReady = useRef(false);
  const baselineTagIdsRef = useRef<string[]>([]);
  const photoDraftRef = useRef<MemoryPhotoDraft>(emptyMemoryPhotoDraft());
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
    const syncTimer = window.setTimeout(() => setAssigning(openChapterMove), 0);
    return () => window.clearTimeout(syncTimer);
  }, [cubeTrackId, openChapterMove]);

  useEffect(() => {
    if (!cubeTrack) return;
    draftReady.current = false;
    const hydrationTimer = window.setTimeout(() => {
      baselineTagIdsRef.current = cubeTrack.tagIds;
      setSelectedTagIds(cubeTrack.tagIds.filter((tagId) => Boolean(archive.data.tags[tagId])));
      setAffection(cubeTrack.affection);
      setNoteDate(today);
      setNoteBody("");
      setEditingNoteId(null);
      setPendingTags([]);
      setPhotoError(null);
      setPhotoUploading(false);
      discardPendingRecordPhoto(photoDraftRef.current);
      const emptyPhotoDraft = emptyMemoryPhotoDraft();
      photoDraftRef.current = emptyPhotoDraft;
      setPhotoDraft(emptyPhotoDraft);
      try {
        const raw = window.sessionStorage.getItem(`muchi:memory-draft:v1:${cubeTrack.id}`);
        if (raw) {
          const draft = JSON.parse(raw) as Partial<{
            selectedTagIds: string[];
            noteDate: string;
            noteBody: string;
            editingNoteId: string | null;
            pendingTags: TagDefinition[];
            affection: AffectionLevel | null;
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
          setSelectedTagIds((draft.selectedTagIds ?? cubeTrack.tagIds)
            .filter((tagId) => knownTagIds.has(tagId)));
          setAffection(draft.affection ?? cubeTrack.affection);
          setPendingTags(restoredPendingTags);
          const restoredEditingNote = draft.editingNoteId
            ? cubeTrack.notes.find((note) => note.id === draft.editingNoteId)
            : null;
          if (draft.editingNoteId && !restoredEditingNote) {
            notify("수정 중이던 메모가 삭제되어 새 메모 작성으로 전환했어요.");
          }
          setEditingNoteId(restoredEditingNote?.id ?? null);
          setNoteDate(draft.noteDate ?? restoredEditingNote?.listenedOn ?? today);
          setNoteBody(draft.noteBody ?? restoredEditingNote?.body ?? "");
        }
      } catch {
        // Session-only drafts are best effort and never block the archive.
      }
      draftReady.current = true;
    }, 0);
    return () => window.clearTimeout(hydrationTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cubeTrackId]);

  useEffect(() => {
    if (!cubeTrackId || !draftReady.current) return;
    const saveTimer = window.setTimeout(() => {
      try {
        window.sessionStorage.setItem(`muchi:memory-draft:v1:${cubeTrackId}`, JSON.stringify({
          selectedTagIds,
          noteDate,
          noteBody,
          editingNoteId,
          pendingTags,
          affection,
        }));
      } catch {
        // Session-only drafts are best effort.
      }
    }, 160);
    return () => {
      window.clearTimeout(saveTimer);
    };
  }, [affection, cubeTrackId, editingNoteId, noteBody, noteDate, pendingTags, selectedTagIds]);

  useEffect(() => {
    photoDraftRef.current = photoDraft;
  }, [photoDraft]);

  useEffect(() => () => {
    discardPendingRecordPhoto(photoDraftRef.current);
  }, []);

  if (!cubeTrackId || !cubeTrack || !track || !cube) return <div className="page-content"><EmptyState title="곡의 기억을 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
  const activeCubeTrack = cubeTrack;
  const activeTrack = track;
  const activeCube = cube;
  const notes = getCubeTrackNotes(activeCubeTrack);
  const editingNote = editingNoteId
    ? activeCubeTrack.notes.find((note) => note.id === editingNoteId) ?? null
    : null;
  const existingPhotoUrl = photoDraft.removed
    ? null
    : getOwnedRecordPhotoUrl(activeCubeTrack.id, editingNote?.customImageVersion ?? null);
  const currentPhotoUrl = photoDraft.previewUrl ?? existingPhotoUrl;
  function toggleTag(tagId: string) {
    setSelectedTagIds((current) => current.includes(tagId)
      ? current.filter((item) => item !== tagId)
      : [...current, tagId].slice(0, ARCHIVE_LIMITS.tagsPerCubeTrack));
  }

  function toggleRecordVisibility() {
    const nextVisibility = activeCubeTrack.recordVisibility === "public" ? "private" : "public";
    commit(
      setCubeTrackRecordVisibility(archive, activeCubeTrack.id, nextVisibility),
      nextVisibility === "public" ? "태그/메모를 공개했어요." : "태그/메모를 비공개로 전환했어요.",
    );
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
      window.sessionStorage.removeItem(`muchi:memory-draft:v1:${activeCubeTrack.id}`);
    } catch {
      // Best effort.
    }
  }

  async function selectRecordPhoto(file: File) {
    const previewUrl = URL.createObjectURL(file);
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const upload = await uploadRecordPhoto(file, activeCubeTrack.id);
      discardPendingRecordPhoto(photoDraftRef.current);
      const nextPhotoDraft = {
        upload,
        previewUrl,
        previewUsesObjectUrl: true,
        removed: false,
      };
      photoDraftRef.current = nextPhotoDraft;
      setPhotoDraft(nextPhotoDraft);
    } catch (error) {
      URL.revokeObjectURL(previewUrl);
      setPhotoError(error instanceof Error ? error.message : "기록 사진을 올리지 못했어요.");
    } finally {
      setPhotoUploading(false);
    }
  }

  function removeRecordPhoto() {
    setPhotoError(null);
    discardPendingRecordPhoto(photoDraftRef.current);
    const removedPhotoDraft = {
      upload: null,
      previewUrl: null,
      previewUsesObjectUrl: false,
      removed: true,
    };
    photoDraftRef.current = removedPhotoDraft;
    setPhotoDraft(removedPhotoDraft);
  }

  function persist() {
    try {
      if (activeCube.kind === "capture") {
        notify("곡 기록을 완료하려면 챕터를 하나 이상 선택해 주세요.");
        setAssigning(true);
        return;
      }
      const selectedExistingTagIds = reconcileTagSelection(
        activeCubeTrack.tagIds.filter((tagId) => Boolean(archive.data.tags[tagId])),
        baselineTagIdsRef.current,
        selectedTagIds.filter((tagId) => Boolean(archive.data.tags[tagId])),
      );
      const selectedPendingLabels = pendingTags
        .filter((tag) => selectedTagIds.includes(tag.id))
        .map((tag) => tag.label);
      const created = createTags(archive, selectedPendingLabels);
      const resolvedTagIds = [...new Set([
        ...selectedExistingTagIds,
        ...created.tags.map((tag) => tag.id),
      ])];
      let next = setCubeTrackTagIds(created.archive, activeCubeTrack.id, resolvedTagIds);
      next = setCubeTrackAffection(next, activeCubeTrack.id, affection);
      const shouldSaveNote = Boolean(noteBody.trim() || photoDraft.upload || (editingNote && photoDraft.removed));
      if (shouldSaveNote) {
        const photoInput = photoDraft.upload
          ? {
              customImagePath: photoDraft.upload.customImagePath,
              customImageVersion: photoDraft.upload.customImageVersion,
            }
          : photoDraft.removed
            ? { customImagePath: null, customImageVersion: null }
            : {};
        if (editingNoteId) {
          next = updateCubeTrackNote(next, activeCubeTrack.id, editingNoteId, {
            listenedOn: noteDate,
            body: noteBody,
            ...photoInput,
          });
        } else {
          next = addCubeTrackNote(next, activeCubeTrack.id, {
            listenedOn: noteDate,
            body: noteBody,
            ...photoInput,
          });
        }
      }
      const message = editingNoteId
        ? "날짜별 감상을 수정했어요."
        : shouldSaveNote
          ? "이 곡의 새로운 감상을 기록했어요."
          : resolvedTagIds.length
            ? "이 곡의 태그를 기록했어요."
            : "곡을 기록했어요.";
      if (commit(next, message)) {
        clearDraft();
        const committedPhotoDraft = photoDraftRef.current;
        photoDraftRef.current = emptyMemoryPhotoDraft();
        revokePreviewUrl(committedPhotoDraft);
        setPhotoDraft(photoDraftRef.current);
        setEditingNoteId(null);
        setNoteDate(today);
        setNoteBody("");
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "기억을 기록하지 못했어요.");
    }
  }

  function save(event: FormEvent) {
    event.preventDefault();
    persist();
  }

  function editNote(note: MemoryNote) {
    discardPendingRecordPhoto(photoDraftRef.current);
    const emptyPhotoDraft = emptyMemoryPhotoDraft();
    photoDraftRef.current = emptyPhotoDraft;
    setPhotoDraft(emptyPhotoDraft);
    setEditingNoteId(note.id);
    setNoteDate(note.listenedOn ?? today);
    setNoteBody(note.body);
    document.getElementById("memory-note-body")?.focus();
  }

  function cancelNoteEdit() {
    discardPendingRecordPhoto(photoDraftRef.current);
    const emptyPhotoDraft = emptyMemoryPhotoDraft();
    photoDraftRef.current = emptyPhotoDraft;
    setPhotoDraft(emptyPhotoDraft);
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

  function deleteCurrentMemory() {
    const confirmMessage = activeCube.kind === "capture"
      ? `‘${activeTrack.title}’ 기록을 삭제하고 보관함으로 되돌릴까요?`
      : `‘${activeTrack.title}’의 이 챕터 태그와 메모를 삭제할까요? 다른 챕터의 기록은 남습니다.`;
    if (!window.confirm(confirmMessage)) return;
    try {
      if (commit(removeCubeTrack(archive, activeCubeTrack.id), "곡 기록을 삭제했어요.")) {
        clearDraft();
        router.push(
          activeCube.kind === "capture" ? "/inbox" : `/chapter?id=${encodeURIComponent(activeCube.id)}`,
          "back",
          activeCube.kind === "capture" ? undefined : activeCube.id,
        );
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "곡 기록을 삭제하지 못했어요.");
    }
  }

  function addToOtherChapter(targetChapterId: string, sourceArchive = archive) {
    try {
      if (activeCube.kind === "capture") {
        const moved = moveCaptureTrackToCube(sourceArchive, activeCubeTrack.id, targetChapterId);
        const target = moved.status === "moved" ? moved.cubeTrack : moved.existingCubeTrack;
        const message = moved.status === "moved"
          ? "태그 기록을 챕터로 옮겼어요."
          : "이 챕터에 같은 곡의 기록이 있어 기존 기억을 열었어요.";
        if (commit(moved.archive, message)) {
          setAssigning(false);
          router.push(`/memory?id=${encodeURIComponent(target.id)}&mode=${recordMode}`, "shared", target.id);
        }
        return;
      }
      const result = addIndependentTrackMemory(sourceArchive, activeTrack.id, targetChapterId);
      if (commit(result.archive, result.added ? "같은 곡을 새로운 순간에 담았어요." : "이미 있던 순간을 열었어요.")) {
        setAssigning(false);
        router.push(`/memory?id=${encodeURIComponent(result.cubeTrack.id)}&mode=${recordMode}`, "shared", result.cubeTrack.id);
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터로 옮기지 못했어요.");
    }
  }

  function createChapterAndMove(name: string) {
    try {
      const created = createCube(archive, { name });
      addToOtherChapter(created.cube.id, created.archive);
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터를 만들지 못했어요.");
    }
  }

  return (
    <div className="page-content memory-view">
      <PageHeader
        eyebrow={cube.kind === "capture" ? "챕터 미분류" : formatChapterTitle(cube)}
        title="곡 기록"
        action={cube.kind === "manual" ? (
          <div className="page-header-actions">
            <button
              className={`text-button memory-record-visibility ${activeCubeTrack.recordVisibility === "public" ? "is-public" : "is-private"}`}
              type="button"
              onClick={toggleRecordVisibility}
              aria-pressed={activeCubeTrack.recordVisibility === "public"}
              aria-label={`태그/메모 ${activeCubeTrack.recordVisibility === "public" ? "공개" : "비공개"}`}
            >
              {activeCubeTrack.recordVisibility === "public" ? <Unlock size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
              <span>{activeCubeTrack.recordVisibility === "public" ? "공개" : "비공개"}</span>
            </button>
          </div>
        ) : undefined}
      />
      <div className="memory-layout">
        <MemoryPanel
          cubeTrack={cubeTrack}
          track={track}
        />
        <form className="memory-form form-stack" onSubmit={save}>
          <div data-tour="memory-tags">
            <TagEditor
              tags={availableTags}
              selectedTagIds={selectedTagIds}
              suggestedTagIds={suggestedTagIds}
              usageCounts={tagUsageCounts}
              toggleTag={toggleTag}
              addTag={addTag}
              memoryReturnId={activeCubeTrack.id}
            />
            <AffectionSelector value={affection} onChange={setAffection} />
          </div>
          <section className="memory-note-composer memory-note-composer-compact" aria-labelledby="memory-note-title" data-tour="memory-notes">
            <div className="memory-note-heading">
              <div><span className="section-label">{editingNoteId ? "감상 수정" : "새 감상"}</span><h2 id="memory-note-title" className="field-label">날짜별 감상</h2></div>
              <div className="memory-note-heading-actions">
                {editingNoteId ? <button className="text-button" type="button" onClick={cancelNoteEdit}>수정 취소</button> : null}
              </div>
            </div>
            <div className="field">
              <label className="sr-only" htmlFor="memory-note-body">메모</label>
              <textarea id="memory-note-body" className="textarea" value={noteBody} onChange={(event) => setNoteBody(event.target.value)} maxLength={ARCHIVE_LIMITS.memo} placeholder="오늘 이 곡에서 새롭게 들린 것" />
              <span className="field-hint">{noteBody.length} / {ARCHIVE_LIMITS.memo}</span>
            </div>
            <label className="memory-note-date-row" htmlFor="memory-note-date">
              <span>감상 날짜</span>
              <input id="memory-note-date" className="memory-note-date-input" type="date" value={noteDate} onChange={(event) => setNoteDate(event.target.value)} required />
            </label>
            <RecordPhotoField
              title="이 날짜의 사진"
              previewUrl={currentPhotoUrl}
              uploading={photoUploading}
              error={photoError}
              onSelect={(file) => { void selectRecordPhoto(file); }}
              onRemove={removeRecordPhoto}
              removable={Boolean(currentPhotoUrl)}
            />
          </section>
          <div className="memory-record-footer">
            <button className="button memory-record-delete" type="button" onClick={deleteCurrentMemory}>
              <Trash2 size={16} aria-hidden="true" />
              <span>곡 기록 삭제</span>
            </button>
            <button className="button button-primary memory-record-submit" type="submit">{editingNoteId ? "수정 완료" : "기록하기"}</button>
          </div>
          {notes.length ? (
            <section className="memory-note-history" aria-labelledby="memory-note-history-title">
              <div className="memory-note-heading"><div><span className="section-label">{notes.length}개의 감상</span><h2 id="memory-note-history-title">날짜별 감상</h2></div></div>
              <ol className="memory-note-list">
                {notes.map((note) => (
                  <li className="memory-note-item" key={note.id}>
                    <time dateTime={note.listenedOn ?? note.createdAt}>{note.listenedOn ? formatCalendarDate(note.listenedOn) : `날짜 미지정 · 최초 기록 ${formatDate(activeCubeTrack.createdAt)}`}</time>
                    {note.customImageVersion ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="memory-note-photo" src={getOwnedRecordPhotoUrl(activeCubeTrack.id, note.customImageVersion) ?? undefined} alt={`${note.listenedOn ?? "날짜 미지정"} 감상 사진`} />
                    ) : null}
                    {note.body ? <p>{note.body}</p> : <p className="memory-note-photo-only">사진만 남긴 감상</p>}
                    <div className="memory-note-actions"><button type="button" onClick={() => editNote(note)}>수정</button><button type="button" onClick={() => deleteNote(note)}>삭제</button></div>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </form>
      </div>

      {assigning ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setAssigning(false)}>
          <div ref={assignDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="other-chapter-title" onClick={(event) => event.stopPropagation()}>
            <span className="section-label">다른 챕터</span>
            <h2 id="other-chapter-title">새로운 순간을 고르세요</h2>
            <InlineChapterCreate onCreate={createChapterAndMove} />
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
