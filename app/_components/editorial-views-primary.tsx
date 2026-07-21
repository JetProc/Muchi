"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Check, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react";
import {
  ARCHIVE_LIMITS,
  captureTrackToInbox,
  createCube,
  createTags,
  getCubesInTreeOrder,
  getCubeTracks,
  getLatestCubeTrackNote,
  getRootCubes,
  getTagGroups,
  getTrackArchiveSummary,
  getUserVisibleChapters,
  moveInboxTrackToCube,
  removeInboxTrack,
  setCubeTrackTagIds,
  type ArchiveEnvelopeV1,
  type Cube,
  type TrackId,
  type TrackReference,
} from "@/lib/archive";
import {
  ItunesSearchError,
  searchItunesTracks,
} from "@/lib/itunes";
import {
  completeManualTrack,
  type ManualTrackFallback,
  type MusicMetadataApiResponse,
} from "@/lib/music-links";
import {
  MotionLink as Link,
  type MotionRouter,
} from "./editorial-motion";
import {
  AlbumArtwork,
  ChapterCover,
  LoadingDots,
} from "./editorial-media";
import {
  ChapterChoice,
  EmptyState,
  InlineChapterCreate,
  PageHeader,
  TrackLine,
} from "./editorial-ui";
import { ChapterTrackSection } from "./editorial-views-chapters";
import { useModalFocus } from "./editorial-accessibility";
import { useSwipeableBottomSheet } from "./use-swipeable-bottom-sheet";
import {
  formatChapterTitle,
  formatDate,
  isAssignableChapter,
  isVisibleChapter,
} from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";

const CAPTURE_DRAFT_KEY = "muchi:capture-draft:v1";
const SEARCH_RESULT_BATCH_SIZE = 10;
const SEARCH_RESULT_REVEAL_DELAY_MS = 240;

type HomeMemory = ReturnType<typeof getCubeTracks>[number] & { chapter: Cube };

function tagSearchHref(tagId: string): string {
  return `/search?tag=${encodeURIComponent(tagId)}`;
}

export function AlbumHero({
  memories,
}: {
  memories: HomeMemory[];
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const safeActiveIndex = memories.length ? activeIndex % memories.length : 0;
  const featured = memories[safeActiveIndex] ?? null;

  function moveFeatured(direction: -1 | 1) {
    if (memories.length < 2) return;
    setExpanded(false);
    setActiveIndex((current) => (current + direction + memories.length) % memories.length);
  }

  return (
    <section
      className={`album-hero${expanded ? " is-expanded" : ""}`}
      aria-labelledby="featured-memory-title"
      aria-roledescription="carousel"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") moveFeatured(-1);
        if (event.key === "ArrowRight") moveFeatured(1);
      }}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const touch = event.changedTouches[0];
        touchStart.current = null;
        if (!start) return;
        const x = touch.clientX - start.x;
        const y = touch.clientY - start.y;
        if (Math.abs(x) > 48 && Math.abs(x) > Math.abs(y)) moveFeatured(x > 0 ? -1 : 1);
        if (y < -56 && Math.abs(y) > Math.abs(x)) setExpanded(true);
      }}
    >
      <div className="hero-folio">
        <span>VOL. {new Date().getFullYear()}</span>
        <span>
          {String(safeActiveIndex + 1).padStart(2, "0")} / {String(Math.max(1, memories.length)).padStart(2, "0")}
        </span>
      </div>
      {featured ? (
        <div className="album-feature">
          <Link
            className="album-feature-art"
            href={`/memory?id=${encodeURIComponent(featured.cubeTrack.id)}`}
            intent="shared"
            sharedId={featured.cubeTrack.id}
            aria-label={`${featured.track.title}의 기억 열기`}
          >
            <AlbumArtwork track={featured.track} sharedId={featured.cubeTrack.id} priority />
          </Link>
          <div className="album-feature-copy">
            <span className="section-label">최근 기억 · {formatChapterTitle(featured.chapter)}</span>
            <h1 id="featured-memory-title">{featured.track.title}</h1>
            <p className="album-artist">{featured.track.artist}</p>
            <div className="album-actions">
              <button
                className="text-button"
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
              >
                {expanded ? "기억 접기" : "기억 펼치기"}
              </button>
            </div>
            <div className="album-memory-reveal" aria-hidden={!expanded}>
              <p>
                {getLatestCubeTrackNote(featured.cubeTrack)?.body
                  || featured.cubeTrack.character
                  || `${formatChapterTitle(featured.chapter)}에 남긴 음악`}
              </p>
              {featured.tags.length ? (
                <div className="tag-row">
                  {featured.tags.slice(0, 5).map((tag) => (
                    <Link className="tag" href={tagSearchHref(tag.id)} key={tag.id}>
                      #{tag.label}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="첫 음악을 기록해 주세요"
          action={<Link className="button button-primary" href="/capture" intent="modal">첫 곡 기록하기</Link>}
        />
      )}
      {memories.length > 1 ? (
        <div className="hero-pagination">
          <div className="hero-pagination-dots" aria-hidden="true">
            {memories.slice(0, 8).map((entry, index) => (
              <span
                className={index === safeActiveIndex ? "is-active" : ""}
                key={entry.cubeTrack.id}
              />
            ))}
          </div>
          <div className="hero-carousel-controls">
            <button type="button" onClick={() => moveFeatured(-1)} aria-label="이전 음악">
              <ChevronLeft size={20} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => moveFeatured(1)} aria-label="다음 음악">
              <ChevronRight size={20} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {featured ? `${safeActiveIndex + 1} / ${memories.length}, ${featured.track.title}, ${featured.track.artist}` : ""}
      </p>
    </section>
  );
}

export function Home({ archive }: {
  archive: ArchiveEnvelopeV1;
}) {
  const allChapters = getUserVisibleChapters(archive);
  const chapters = getRootCubes(archive)
    .filter((chapter) => isVisibleChapter(archive, chapter));
  const memories = allChapters
    .flatMap((chapter) => getCubeTracks(archive, chapter.id).map((entry) => ({ ...entry, chapter })))
    .sort((a, b) => b.cubeTrack.updatedAt.localeCompare(a.cubeTrack.updatedAt));
  const inboxEntries = Object.values(archive.data.inbox)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const continueEntry = inboxEntries[0] ?? null;
  const continueTrack = continueEntry ? archive.data.tracks[continueEntry.trackId] : null;
  const recentKeywords = [...getTagGroups(archive)]
    .filter((group) => group.memoryCount > 0)
    .sort((left, right) => (
      (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "")
      || left.tag.label.localeCompare(right.tag.label, "ko-KR")
    ))
    .slice(0, 5);
  const untaggedMemories = Object.values(archive.data.cubeTracks)
    .filter((cubeTrack) => {
      const cube = archive.data.cubes[cubeTrack.cubeId];
      return cube?.kind !== "monthly" && cubeTrack.tagIds.length === 0;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const untaggedTrackIds = new Set<TrackId>([
    ...inboxEntries.map((entry) => entry.trackId),
    ...untaggedMemories.map((memory) => memory.trackId),
  ]);
  const untaggedMemory = untaggedMemories[0] ?? null;
  const untaggedTrack = continueTrack
    ?? (untaggedMemory ? archive.data.tracks[untaggedMemory.trackId] : null);
  const untaggedHref = continueTrack
    ? "/inbox"
    : untaggedMemory
      ? `/memory?id=${encodeURIComponent(untaggedMemory.id)}&mode=quick`
      : "/capture";
  return (
    <div className="page-content home-view">
      <AlbumHero memories={memories} />

      {continueEntry && continueTrack ? (
        <section className="home-section home-continue" aria-labelledby="home-continue-title">
          <div className="home-section-inner">
            <div className="editorial-section-head">
              <div>
                <h2 id="home-continue-title">정리 대기</h2>
              </div>
              <Link className="text-link" href="/inbox">{inboxEntries.length}곡 남음</Link>
            </div>
            <TrackLine
              track={continueTrack}
              index={0}
              context={formatDate(continueEntry.capturedAt)}
              actions={<Link className="text-link" href="/inbox">정리</Link>}
            />
          </div>
        </section>
      ) : null}

      {recentKeywords.length ? (
        <section className="home-section home-tags" aria-labelledby="home-tags-title">
          <div className="home-section-inner">
            <div className="editorial-section-head">
              <div>
                <h2 id="home-tags-title">태그</h2>
              </div>
              <Link className="text-link" href="/tags">전체 보기</Link>
            </div>
            <div className="tag-row" aria-label="최근 사용한 태그">
              {recentKeywords.map(({ tag, trackCount }) => (
                <Link className="tag" href={tagSearchHref(tag.id)} key={tag.id}>
                  #{tag.label} · {trackCount}곡
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {untaggedTrack && untaggedTrackIds.size ? (
        <section className="home-section home-untagged" aria-labelledby="home-untagged-title">
          <div className="home-section-inner">
            <div className="editorial-section-head">
              <div>
                <h2 id="home-untagged-title">태그 없음</h2>
              </div>
              <Link className="text-link" href={untaggedHref}>{untaggedTrackIds.size}곡</Link>
            </div>
            <TrackLine
              track={untaggedTrack}
              index={0}
                actions={<Link className="text-link" href={untaggedHref}>태그</Link>}
            />
          </div>
        </section>
      ) : null}

      <section className="home-section chapter-preview" aria-labelledby="chapter-preview-title">
        <div className="home-section-inner">
          <div className="editorial-section-head">
            <div>
              <h2 id="chapter-preview-title">챕터</h2>
            </div>
            <Link className="text-link" href="/chapters" intent="tab">전체 보기</Link>
          </div>
          {chapters.length ? (
            <div className="chapter-preview-list" aria-label="챕터 가로 목록">
              {chapters.slice(0, 6).map((chapter, index) => (
                <Link
                  className="chapter-preview-line"
                  href={`/chapter?id=${encodeURIComponent(chapter.id)}`}
                  intent="shared"
                  sharedId={chapter.id}
                  key={chapter.id}
                >
                  <span className="chapter-preview-art" aria-hidden="true">
                    <ChapterCover archive={archive} chapter={chapter} />
                  </span>
                  <span className="chapter-preview-copy">
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <strong>{formatChapterTitle(chapter)}</strong>
                    <small>{getCubeTracks(archive, chapter.id).length}곡</small>
                  </span>
                </Link>
              ))}
            </div>
          ) : <p className="empty-inline">아직 챕터 없음</p>}
        </div>
      </section>

      <section className="home-section home-recent" aria-labelledby="home-recent-title">
        <div className="home-section-inner">
          <div className="editorial-section-head">
            <div>
              <span className="section-label">최근 기록</span>
              <h2 id="home-recent-title">다시 듣고 싶은 순간</h2>
            </div>
            <div className="home-section-actions">
              <Link className="text-link" href="/recap">이맘때의 음악</Link>
              <Link className="text-link" href="/search">전체 찾기</Link>
            </div>
          </div>
          {memories.length ? (
            <div className="track-list">
              {memories.slice(0, 3).map((memory, index) => (
                <TrackLine
                  key={memory.cubeTrack.id}
                  track={memory.track}
                  index={index}
                  affection={memory.cubeTrack.affection}
                  context={formatChapterTitle(memory.chapter)}
                  sharedId={memory.cubeTrack.id}
                  actions={(
                    <>
                      {memory.tags.slice(0, 2).map((tag) => (
                        <Link className="tag" href={tagSearchHref(tag.id)} key={tag.id}>
                          #{tag.label}
                        </Link>
                      ))}
                      <Link
                        className="text-link"
                        href={`/memory?id=${encodeURIComponent(memory.cubeTrack.id)}`}
                        intent="shared"
                        sharedId={memory.cubeTrack.id}
                      >
                        기억 보기
                      </Link>
                    </>
                  )}
                />
              ))}
            </div>
          ) : <p className="empty-inline">아직 기록 없음</p>}
        </div>
      </section>

    </div>
  );
}

export function Capture({
  archive,
  commit,
  notify,
  online,
  router,
  sharedUrl,
  guideMode = false,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
  online: boolean;
  router: MotionRouter;
  sharedUrl: string | null;
  guideMode?: boolean;
}) {
  const [musicUrl, setMusicUrl] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackReference[]>([]);
  const [selectedResults, setSelectedResults] = useState<TrackReference[]>([]);
  const [visibleResultCount, setVisibleResultCount] = useState(SEARCH_RESULT_BATCH_SIZE);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [assigning, setAssigning] = useState<TrackReference | null>(null);
  const [recordMode, setRecordMode] = useState<"choose" | "tag" | "chapter" | "complete">("choose");
  const [selectedTagLabels, setSelectedTagLabels] = useState<string[]>([]);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [savedMemoryId, setSavedMemoryId] = useState<string | null>(null);
  const [manualFallback, setManualFallback] = useState<ManualTrackFallback | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualAlbum, setManualAlbum] = useState("");
  const [resultSource, setResultSource] = useState<"link" | "search" | null>(null);
  const [guideVisible, setGuideVisible] = useState(guideMode);
  const suggestedTags = getTagGroups(archive).slice(0, 5).map((group) => group.tag);
  const draftReady = useRef(false);
  const shareHandled = useRef(false);
  const searchRequestRef = useRef(0);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const visibleResults = resultSource === "search"
    ? results.slice(0, visibleResultCount)
    : results;
  const hasMoreResults = resultSource === "search" && visibleResultCount < results.length;
  const assignDialogRef = useModalFocus<HTMLDivElement>(
    Boolean(assigning),
    () => setAssigning(null),
  );
  const linkDialogRef = useModalFocus<HTMLDivElement>(
    linkDialogOpen,
    () => {
      setLinkDialogOpen(false);
      setManualFallback(null);
      setLinkError(null);
    },
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const raw = window.sessionStorage.getItem(CAPTURE_DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw) as Partial<{
            musicUrl: string;
            query: string;
            manualTitle: string;
            manualArtist: string;
            manualAlbum: string;
            selectedResults: TrackReference[];
          }>;
          setMusicUrl(draft.musicUrl ?? "");
          setQuery(draft.query ?? "");
          setManualTitle(draft.manualTitle ?? "");
          setManualArtist(draft.manualArtist ?? "");
          setManualAlbum(draft.manualAlbum ?? "");
          if (Array.isArray(draft.selectedResults)) {
            setSelectedResults(draft.selectedResults.filter((track) => (
              typeof track?.id === "string"
              && typeof track.title === "string"
              && typeof track.artist === "string"
            )));
          }
        }
      } catch {
        // A malformed session draft should never block the archive itself.
      }
      draftReady.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!draftReady.current) return;
    try {
      window.sessionStorage.setItem(CAPTURE_DRAFT_KEY, JSON.stringify({
        musicUrl,
        query,
        manualTitle,
        manualArtist,
        manualAlbum,
        selectedResults,
      }));
    } catch {
      // Session-only draft persistence is best effort.
    }
  }, [manualAlbum, manualArtist, manualTitle, musicUrl, query, selectedResults]);

  useEffect(() => {
    const resetCapture = () => {
      searchRequestRef.current += 1;
      clearCaptureDraft();
      setMusicUrl("");
      setQuery("");
      setResults([]);
      setSelectedResults([]);
      setVisibleResultCount(SEARCH_RESULT_BATCH_SIZE);
      setLoading(false);
      setLoadingMore(false);
      setLinkLoading(false);
      setError(null);
      setLinkError(null);
      setLinkDialogOpen(false);
      setManualFallback(null);
      setManualTitle("");
      setManualArtist("");
      setManualAlbum("");
      setResultSource(null);
      resetRecordDialog();
    };
    window.addEventListener("muchi:reset-capture", resetCapture);
    return () => window.removeEventListener("muchi:reset-capture", resetCapture);
  }, []);

  useEffect(() => {
    const trigger = loadMoreTriggerRef.current;
    if (!trigger || !hasMoreResults) return;

    let revealTimer: number | undefined;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;

      observer.disconnect();
      setLoadingMore(true);
      revealTimer = window.setTimeout(() => {
        setVisibleResultCount((current) => Math.min(
          current + SEARCH_RESULT_BATCH_SIZE,
          results.length,
        ));
        setLoadingMore(false);
      }, SEARCH_RESULT_REVEAL_DELAY_MS);
    }, { rootMargin: "160px 0px" });

    observer.observe(trigger);
    return () => {
      observer.disconnect();
      if (revealTimer !== undefined) window.clearTimeout(revealTimer);
    };
  }, [hasMoreResults, results, visibleResultCount]);

  function clearCaptureDraft() {
    try {
      window.sessionStorage.removeItem(CAPTURE_DRAFT_KEY);
    } catch {
      // Best effort.
    }
  }

  function resetRecordDialog() {
    setAssigning(null);
    setRecordMode("choose");
    setSelectedTagLabels([]);
    setNewTagLabel("");
    setSavedMemoryId(null);
  }

  const startRecord = useCallback((track: TrackReference) => {
    setAssigning(track);
    setRecordMode("choose");
    setSelectedTagLabels([]);
    setNewTagLabel("");
    setSavedMemoryId(null);
  }, []);

  const startDetailedRecord = useCallback((track: TrackReference) => {
    startRecord(track);
    setRecordMode("tag");
  }, [startRecord]);

  function changeQuery(value: string) {
    setQuery(value);
    searchRequestRef.current += 1;
    setLoading(false);
    setLoadingMore(false);
    setResultSource(null);
    setError(null);
  }

  const importMusicLink = useCallback(async (url: string) => {
    if (!online) {
      setLinkError("오프라인에서는 새 음악 링크를 가져올 수 없어요.");
      return;
    }
    setLinkLoading(true);
    setLinkError(null);
    setManualFallback(null);
    try {
      const response = await fetch(`/api/music-metadata?url=${encodeURIComponent(url.trim())}`, {
        headers: { Accept: "application/json" },
      });
      const payload = await response.json() as MusicMetadataApiResponse;
      if (payload.status === "error") {
        setLinkError(payload.error.message);
        return;
      }
      if (payload.status === "manual") {
        setManualFallback(payload.fallback);
        setManualTitle(payload.fallback.suggested.title);
        setManualArtist(payload.fallback.suggested.artist);
        setManualAlbum(payload.fallback.suggested.album);
        return;
      }
      setLinkDialogOpen(false);
      startDetailedRecord(payload.track);
    } catch {
      setLinkError("곡 정보를 가져오지 못했어요. YouTube Music 또는 Apple Music에서 해당 곡을 다시 공유해 주세요.");
    } finally {
      setLinkLoading(false);
    }
  }, [online, startDetailedRecord]);

  useEffect(() => {
    if (!sharedUrl || shareHandled.current) return;
    const matchedUrl = sharedUrl.match(/https?:\/\/\S+/)?.[0]?.replace(/[),.]+$/, "") ?? sharedUrl;
    setMusicUrl(matchedUrl);
    setLinkDialogOpen(true);
    shareHandled.current = true;
    void importMusicLink(matchedUrl);
  }, [importMusicLink, sharedUrl]);

  async function importLink(event: FormEvent) {
    event.preventDefault();
    await importMusicLink(musicUrl);
  }

  function finishManualImport(event: FormEvent) {
    event.preventDefault();
    if (!manualFallback) return;
    const track = completeManualTrack(manualFallback, {
      title: manualTitle,
      artist: manualArtist,
      album: manualAlbum,
    });
    setManualFallback(null);
    setLinkError(null);
    setLinkDialogOpen(false);
    startDetailedRecord(track);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!online) {
      setError("오프라인에서는 새 음악을 검색할 수 없어요.");
      return;
    }
    const submittedQuery = query.trim();
    const requestId = searchRequestRef.current + 1;
    searchRequestRef.current = requestId;
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    setResultSource(null);
    try {
      const tracks = await searchItunesTracks(submittedQuery);
      if (requestId !== searchRequestRef.current) return;
      setResults(tracks);
      setVisibleResultCount(SEARCH_RESULT_BATCH_SIZE);
      setResultSource("search");
    } catch (cause) {
      if (requestId !== searchRequestRef.current) return;
      if (cause instanceof ItunesSearchError && cause.code === "stale") return;
      setError(cause instanceof Error ? cause.message : "검색 중 문제가 생겼어요.");
    } finally {
      if (requestId === searchRequestRef.current) setLoading(false);
    }
  }

  function saveInbox(track: TrackReference) {
    const already = Boolean(archive.data.inbox[track.id]);
    const next = captureTrackToInbox(archive, track);
    const summary = getTrackArchiveSummary(next, track.id);
    if (!next.data.inbox[track.id] && (summary.captureContextId || summary.manualContextStates.length)) {
      notify("이미 기록한 곡이에요. 기존 기록에서 태그를 이어서 남길 수 있어요.");
      const memoryId = summary.captureContextId ?? summary.manualContextStates[0]?.cubeTrackId;
      resetRecordDialog();
      if (memoryId) router.push(`/memory?id=${encodeURIComponent(memoryId)}&mode=detail`, "shared", memoryId);
      return;
    }
    if (commit(
      next,
      already ? "이미 보관함에 저장한 곡이에요." : "보관함에 우선 저장했어요.",
    )) {
      clearCaptureDraft();
      setSelectedResults((current) => current.filter((item) => item.id !== track.id));
      resetRecordDialog();
    }
  }

  function toggleResultSelection(track: TrackReference) {
    setSelectedResults((current) => current.some((item) => item.id === track.id)
      ? current.filter((item) => item.id !== track.id)
      : [...current, track]);
  }

  function saveSelectedResults() {
    if (!selectedResults.length) return;

    let next = archive;
    let added = 0;
    let already = 0;
    for (const track of selectedResults) {
      const wasInInbox = Boolean(next.data.inbox[track.id]);
      const captured = captureTrackToInbox(next, track);
      const isInInbox = Boolean(captured.data.inbox[track.id]);
      if (!wasInInbox && isInInbox) added += 1;
      else already += 1;
      next = captured;
    }

    const message = added
      ? {
        text: `${added}곡을 보관함에 우선 저장했어요.`,
        action: { label: "보관함 보기", href: "/inbox" },
      }
      : already
        ? "선택한 곡은 이미 기록되어 있어요."
        : "기록할 곡이 없어요.";

    if (commit(next, message)) {
      clearCaptureDraft();
      setSelectedResults([]);
    }
  }

  function recordSelectedResults() {
    if (selectedResults.length === 1) {
      startRecord(selectedResults[0]);
      return;
    }
    saveSelectedResults();
  }

  function toggleSuggestedTag(label: string) {
    setSelectedTagLabels((current) => current.includes(label)
      ? current.filter((item) => item !== label)
      : [...current, label].slice(0, ARCHIVE_LIMITS.tagsPerCubeTrack));
  }

  function addCustomTag() {
    const label = newTagLabel.trim();
    if (!label) return;
    if (!selectedTagLabels.includes(label)) {
      setSelectedTagLabels((current) => [...current, label].slice(0, ARCHIVE_LIMITS.tagsPerCubeTrack));
    }
    setNewTagLabel("");
  }

  function saveKeywords(event: FormEvent) {
    event.preventDefault();
    if (!assigning) return;
    const typedLabel = newTagLabel.trim();
    const labels = [...new Set([
      ...selectedTagLabels,
      ...(typedLabel ? [typedLabel] : []),
    ])];
    try {
      const captured = captureTrackToInbox(archive, assigning);
      if (!captured.data.inbox[assigning.id]) {
        const summary = getTrackArchiveSummary(captured, assigning.id);
        const memoryId = summary.captureContextId ?? summary.manualContextStates[0]?.cubeTrackId;
        notify("이미 기록된 곡이에요. 기존 기억에서 태그를 더해 주세요.");
        resetRecordDialog();
        if (memoryId) router.push(`/memory?id=${encodeURIComponent(memoryId)}&mode=detail`, "shared", memoryId);
        return;
      }
      setSelectedTagLabels(labels);
      setNewTagLabel("");
      setRecordMode("chapter");
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "태그를 기록하지 못했어요.");
    }
  }

  function recordInChapter(chapterId: string) {
    if (!assigning) return;
    try {
      const captured = captureTrackToInbox(archive, assigning);
      const moved = moveInboxTrackToCube(captured, assigning.id, chapterId);
      const created = createTags(moved.archive, selectedTagLabels);
      const next = setCubeTrackTagIds(
        created.archive,
        moved.cubeTrack.id,
        created.tags.map((tag) => tag.id),
      );
      if (commit(next, selectedTagLabels.length ? `‘${selectedTagLabels[0]}’ 태그로 기록했어요.` : "곡을 기록했어요.")) {
        clearCaptureDraft();
        setSelectedResults((current) => current.filter((item) => item.id !== assigning.id));
        setSavedMemoryId(moved.cubeTrack.id);
        setRecordMode("complete");
      }
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "챕터에 곡을 기록하지 못했어요.");
    }
  }

  function createChapterAndRecord(name: string) {
    if (!assigning) return;
    try {
      const created = createCube(archive, { name });
      const captured = captureTrackToInbox(created.archive, assigning);
      const moved = moveInboxTrackToCube(captured, assigning.id, created.cube.id);
      const withTags = createTags(moved.archive, selectedTagLabels);
      const next = setCubeTrackTagIds(
        withTags.archive,
        moved.cubeTrack.id,
        withTags.tags.map((tag) => tag.id),
      );
      if (commit(next, `‘${created.cube.name}’ 챕터에 곡을 기록했어요.`)) {
        clearCaptureDraft();
        setSelectedResults((current) => current.filter((item) => item.id !== assigning.id));
        setSavedMemoryId(moved.cubeTrack.id);
        setRecordMode("complete");
      }
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "챕터를 만들고 곡을 기록하지 못했어요.");
    }
  }

  return (
    <div className={`page-content capture-view${selectedResults.length ? " has-selection" : ""}`}>
      <header className="capture-search-header">
        <h1>곡 기록</h1>
      </header>
      <section className="capture-search-compact" aria-label="음악 검색">
        <form className="search-form capture-search-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="itunes-query">외부 음악에서 기록할 곡 찾기</label>
          <input id="itunes-query" className="input" type="search" name="music-search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="기록할 곡이나 아티스트" minLength={1} enterKeyHint="search" autoComplete="off" autoFocus data-route-autofocus />
          <button className="capture-search-submit" type="submit" aria-label="외부 음악 검색" disabled={loading || !online || !query.trim()}>{loading ? <LoadingDots /> : <Search aria-hidden="true" size={20} />}</button>
        </form>
      </section>
      {guideVisible ? <aside className="capture-mini-guide" aria-label="첫 곡 기록 안내">
        <div><span>처음 기록한다면</span><strong>곡을 고른 뒤, 태그로 그때의 순간을 남겨 보세요.</strong><p>검색으로 찾거나, YouTube Music·Apple Music 링크를 가져올 수 있어요.</p></div>
        <button type="button" onClick={() => setGuideVisible(false)} aria-label="기록 안내 닫기"><X aria-hidden="true" size={16} /></button>
      </aside> : null}
      <div className="capture-link-row">
        <button
          className="capture-link-action"
          type="button"
          onClick={() => {
            setLinkError(null);
            setManualFallback(null);
            setLinkDialogOpen(true);
          }}
        >
          링크로 가져오기
        </button>
      </div>

      {error ? <div className="notice notice-danger" style={{ marginTop: 18 }} role="alert">{error}</div> : null}

      {resultSource ? (
        <section className="section capture-results" aria-busy={loadingMore}>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {resultSource === "link" ? `가져온 음악 ${results.length}곡` : `찾은 음악 ${results.length}곡`}
          </p>
          <div className="section-head capture-results-head">
            {resultSource === "link" || !results.length ? (
              <h2 className="capture-results-count">
                {results.length ? "가져온 음악" : "찾은 음악이 없어요"}
              </h2>
            ) : null}
            {results.length ? <span className="section-label">{results.length}곡</span> : null}
          </div>
          {results.length ? (
            <>
              <div className="capture-track-list">
                {visibleResults.map((track) => {
                  const selected = selectedResults.some((item) => item.id === track.id);
                  return (
                    <article className={`capture-track-row${selected ? " is-selected" : ""}`} key={track.id}>
                      <AlbumArtwork track={track} decorative />
                      <span className="capture-track-copy">
                        <strong>{track.title}</strong>
                        <span>{track.artist}</span>
                      </span>
                      <button
                        className="capture-track-select"
                        type="button"
                        aria-label={selected ? `${track.title} 선택 해제` : `${track.title} 선택`}
                        aria-pressed={selected}
                        onClick={() => toggleResultSelection(track)}
                      >
                        {selected ? <Check aria-hidden="true" size={20} /> : <Plus aria-hidden="true" size={20} />}
                      </button>
                    </article>
                  );
                })}
              </div>
              {hasMoreResults ? (
                <div ref={loadMoreTriggerRef} className="search-load-more">
                  {loadingMore ? (
                    <>
                      <span className="search-loading-spinner" aria-hidden="true" />
                      <span>다음 곡을 불러오는 중</span>
                    </>
                  ) : (
                    <span>스크롤하면 다음 10곡을 불러와요</span>
                  )}
                </div>
              ) : resultSource === "search" && results.length > SEARCH_RESULT_BATCH_SIZE ? (
                <p className="search-results-end">검색 결과를 모두 확인했어요.</p>
              ) : null}
            </>
          ) : null}
        </section>
      ) : null}

      {selectedResults.length ? (
        <div className="capture-floating-action" aria-live="polite">
          <button className="button button-primary" type="button" onClick={recordSelectedResults}>
            {selectedResults.length}곡 기록하기
          </button>
        </div>
      ) : null}

      {linkDialogOpen ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setLinkDialogOpen(false)}>
          <div ref={linkDialogRef} className="dialog link-import-dialog" role="dialog" aria-modal="true" aria-labelledby="link-import-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="link-import-title">음악 앱에서 가져오기</h2>
            <p className="link-import-description">YouTube Music 또는 Apple Music 앱에서 곡을 공유해 뮤키로 보내 주세요. 분석이 끝나면 바로 같은 기록 화면으로 이어져요.</p>
            {!manualFallback ? (
              <>
                <form className="form-stack link-import-form" onSubmit={importLink}>
                  <div className="field">
                    <label htmlFor="music-url">YouTube Music 또는 Apple Music 곡 링크</label>
                    <input id="music-url" className="input" type="url" value={musicUrl} onChange={(event) => setMusicUrl(event.target.value)} placeholder="https://music.youtube.com/watch?v=… 또는 music.apple.com/…" required autoComplete="url" />
                  </div>
                  {linkError ? <div className="notice notice-danger" role="alert">{linkError}</div> : null}
                  <div className="dialog-actions">
                    <button className="button button-ghost" type="button" onClick={() => setLinkDialogOpen(false)}>취소</button>
                    <button className="button button-primary" type="submit" disabled={linkLoading || !online}>{linkLoading ? <LoadingDots /> : "곡 분석하기"}</button>
                  </div>
                </form>
              </>
            ) : (
              <form className="form-stack link-import-form" onSubmit={finishManualImport}>
                <div className="form-grid"><div className="field"><label htmlFor="manual-title">곡명 *</label><input id="manual-title" className="input" value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} maxLength={200} required /></div><div className="field"><label htmlFor="manual-artist">아티스트 *</label><input id="manual-artist" className="input" value={manualArtist} onChange={(event) => setManualArtist(event.target.value)} maxLength={200} required /></div></div>
                <div className="field"><label htmlFor="manual-album">앨범 · 선택</label><input id="manual-album" className="input" value={manualAlbum} onChange={(event) => setManualAlbum(event.target.value)} maxLength={200} /></div>
                <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setManualFallback(null)}>뒤로</button><button className="button button-primary" type="submit">이 곡 확인하기</button></div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {assigning ? (
        <div className="dialog-backdrop" role="presentation" onClick={resetRecordDialog}>
          <div ref={assignDialogRef} className="dialog record-dialog" role="dialog" aria-modal="true" aria-labelledby="assign-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="assign-title">{recordMode === "choose" ? "기록" : recordMode === "tag" ? "태그" : recordMode === "chapter" ? "챕터" : "기록 완료"}</h2>
            <div className="record-dialog-track">
              <AlbumArtwork track={assigning} decorative />
              <p><strong>{assigning.title}</strong><span>{assigning.artist}</span></p>
            </div>
            {recordMode === "choose" ? (
              <div className="record-mode-list">
                <button type="button" onClick={() => saveInbox(assigning)}><strong>보관함에 우선 저장</strong></button>
                <button type="button" onClick={() => setRecordMode("tag")}><strong>자세히 기록</strong></button>
              </div>
            ) : recordMode === "tag" ? (
              <form className="form-stack record-tag-form" onSubmit={saveKeywords}>
                <p className="record-tag-guide">태그는 나중에 이 곡을 다시 찾을 수 있는 나만의 단서예요.</p>
                {suggestedTags.length ? (
                  <div className="field">
                    <span className="field-label">최근 태그</span>
                    <div className="tag-row">
                      {suggestedTags.map((tag) => (
                        <button className="tag" type="button" aria-pressed={selectedTagLabels.includes(tag.label)} key={tag.id} onClick={() => toggleSuggestedTag(tag.label)}>#{tag.label}</button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="field">
                  <label htmlFor="capture-new-tag">새 태그</label>
                  <div className="search-form">
                    <input id="capture-new-tag" className="input" value={newTagLabel} onChange={(event) => setNewTagLabel(event.target.value)} maxLength={ARCHIVE_LIMITS.tagLabel} placeholder="예: 스무 살 여름, 새벽 러닝" autoFocus />
                    <button className="button" type="button" onClick={addCustomTag} disabled={!newTagLabel.trim()}>추가</button>
                  </div>
                </div>
                {selectedTagLabels.length ? (
                  <div className="tag-row" aria-label="선택한 태그">
                    {selectedTagLabels.map((label) => (
                      <button
                        className="tag is-selected"
                        type="button"
                        key={label}
                        onClick={() => toggleSuggestedTag(label)}
                        aria-label={`${label} 태그 삭제`}
                      >
                        <span>#{label}</span>
                        <X size={14} strokeWidth={2.4} aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="dialog-actions">
                  <button className="button" type="button" onClick={() => setRecordMode("choose")}>뒤로</button>
                  <button className="button button-primary" type="submit">기록하기</button>
                </div>
              </form>
            ) : recordMode === "chapter" ? (
              <div className="record-chapter-step">
                <p className="record-tag-guide">곡을 기록할 챕터를 하나 이상 선택해 주세요.</p>
                <InlineChapterCreate onCreate={createChapterAndRecord} />
                <div className="track-list record-chapter-list">
                  {getCubesInTreeOrder(archive)
                    .filter((chapter) => isAssignableChapter(chapter) && isVisibleChapter(archive, chapter))
                    .map((chapter, index) => (
                      <ChapterChoice
                        archive={archive}
                        chapter={chapter}
                        detail={`${getCubeTracks(archive, chapter.id).length}곡`}
                        index={index}
                        key={chapter.id}
                        onSelect={recordInChapter}
                      />
                    ))}
                </div>
                {!getUserVisibleChapters(archive).some((chapter) => isAssignableChapter(chapter) && isVisibleChapter(archive, chapter)) ? (
                  <p className="record-tag-guide">먼저 챕터를 하나 만들어 주세요.</p>
                ) : null}
                <div className="dialog-actions">
                  <button className="button" type="button" onClick={() => setRecordMode("tag")}>뒤로</button>
                </div>
              </div>
            ) : (
              <div className="record-mode-list">
                <button type="button" onClick={() => savedMemoryId && router.push(`/memory?id=${encodeURIComponent(savedMemoryId)}&mode=detail`, "shared", savedMemoryId)}><strong>기억 더 남기기</strong></button>
                <button type="button" onClick={() => savedMemoryId && router.push(`/memory?id=${encodeURIComponent(savedMemoryId)}&mode=detail&move=chapter`, "shared", savedMemoryId)}><strong>다른 챕터에도 담기</strong></button>
              </div>
            )}
            {recordMode !== "tag" && recordMode !== "chapter" ? <div className="dialog-actions"><button className="button" type="button" onClick={resetRecordDialog}>{recordMode === "complete" ? "완료" : "취소"}</button></div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Inbox({
  archive,
  commit,
  notify,
  router,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
  router: MotionRouter;
}) {
  const entries = Object.values(archive.data.inbox)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const chapters = getCubesInTreeOrder(archive)
    .filter((chapter) => isVisibleChapter(archive, chapter) && isAssignableChapter(chapter));
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<TrackId>>(() => new Set());
  const [assignmentTrackIds, setAssignmentTrackIds] = useState<TrackId[]>([]);
  const assignDialogRef = useModalFocus<HTMLDivElement>(
    assignmentTrackIds.length > 0,
    () => setAssignmentTrackIds([]),
  );
  const chapterSheet = useSwipeableBottomSheet({
    initialSnap: "middle",
    snapPoints: ["middle", "expanded"],
    snapHeights: { middle: "56%", expanded: "86%" },
    onDismiss: () => setAssignmentTrackIds([]),
  });

  function openAssignment(trackIds: TrackId[]) {
    if (!trackIds.length) return;
    setAssignmentTrackIds(trackIds);
  }

  function toggleTrackSelection(trackId: TrackId) {
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }

  function deleteSelectedTracks() {
    if (!selectedTrackIds.size) return;
    let next = archive;
    let removedCount = 0;
    for (const trackId of selectedTrackIds) {
      if (!next.data.inbox[trackId]) continue;
      next = removeInboxTrack(next, trackId);
      removedCount += 1;
    }
    if (!removedCount) {
      setSelectedTrackIds(new Set());
      return;
    }
    if (commit(
      next,
      removedCount > 1
        ? `${removedCount}곡을 보관함에서 삭제했어요.`
        : "정리 대기 목록에서 곡을 삭제했어요.",
    )) {
      setSelectedTrackIds(new Set());
    }
  }

  function assign(chapterId: string, sourceArchive = archive) {
    try {
      if (!assignmentTrackIds.length) return;
      let next = sourceArchive;
      let lastResult: ReturnType<typeof moveInboxTrackToCube> | null = null;
      let addedCount = 0;
      for (const trackId of assignmentTrackIds) {
        if (!next.data.inbox[trackId]) continue;
        const result = moveInboxTrackToCube(next, trackId, chapterId);
        next = result.archive;
        lastResult = result;
        if (result.added) addedCount += 1;
      }
      if (!lastResult) return;
      if (commit(
        next,
        assignmentTrackIds.length > 1
          ? `${assignmentTrackIds.length}곡을 한 챕터에 담았어요.`
          : addedCount
            ? "곡이 챕터에서 새로운 순간을 찾았어요."
            : "이미 이 챕터에 있는 곡이라 보관함에서만 정리했어요.",
      )) {
        const assignedIds = assignmentTrackIds;
        setAssignmentTrackIds([]);
        setSelectedTrackIds((current) => {
          const remaining = new Set(current);
          assignedIds.forEach((trackId) => remaining.delete(trackId));
          return remaining;
        });
        if (assignedIds.length > 1) {
          router.push(`/chapter?id=${encodeURIComponent(chapterId)}`, "shared", chapterId);
        } else {
          router.push(
            `/memory?id=${encodeURIComponent(lastResult.cubeTrack.id)}`,
            "shared",
            lastResult.cubeTrack.id,
          );
        }
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "곡을 이동하지 못했어요.");
    }
  }

  function createChapterAndAssign(name: string) {
    try {
      const created = createCube(archive, { name });
      assign(created.cube.id, created.archive);
    } catch (error) {
      notify(error instanceof Error ? error.message : "챕터를 만들지 못했어요.");
    }
  }

  const selectedTrackIdList = [...selectedTrackIds];

  const inboxItems = entries.flatMap((entry) => {
    const track = archive.data.tracks[entry.trackId];
    if (!track) return [];
    return [{
      id: entry.trackId,
      track,
      summary: `${formatDate(entry.capturedAt)}에 기록`,
      collapsible: false,
      action: (
        <div className="inbox-track-actions">
          <button
            className={`inbox-track-select${selectedTrackIds.has(track.id) ? " is-selected" : ""}`}
            type="button"
            aria-pressed={selectedTrackIds.has(track.id)}
            aria-label={`${track.title} ${selectedTrackIds.has(track.id) ? "선택 해제" : "선택"}`}
            onClick={() => toggleTrackSelection(track.id)}
          >
            <Check size={14} aria-hidden="true" />
          </button>
        </div>
      ),
    }];
  });

  return (
    <div className="page-content inbox-view">
      <PageHeader
        eyebrow={`${entries.length}곡`}
        title="보관함"
        action={<div className="page-header-actions"><Link className="button button-primary" href="/capture" intent="modal">곡 기록</Link></div>}
      />
      {entries.length ? (
        <ChapterTrackSection items={inboxItems} title="기록할 곡" label={`${inboxItems.length}곡`} />
      ) : <EmptyState title="정리할 곡이 없어요" action={<Link className="button button-primary" href="/capture">첫 곡 기록하기</Link>} />}

      {selectedTrackIds.size ? (
        <div className="inbox-selection-bar" aria-live="polite">
          <span>{selectedTrackIds.size}곡 선택됨</span>
          <div className="inbox-selection-actions">
            {selectedTrackIdList.length === 1 ? (
              <button className="button" type="button" onClick={() => openAssignment(selectedTrackIdList)}>
                기록
              </button>
            ) : null}
            <button className="button button-primary" type="button" onClick={() => openAssignment(selectedTrackIdList)}>
              챕터 넣기
            </button>
            <button className="button button-danger" type="button" onClick={deleteSelectedTracks}>
              삭제
            </button>
          </div>
        </div>
      ) : null}

      {assignmentTrackIds.length ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setAssignmentTrackIds([])}>
          <div
            ref={assignDialogRef}
            className={`dialog inbox-chapter-sheet is-swipeable-sheet${chapterSheet.isDragging ? " is-dragging" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="inbox-assign-title"
            onClick={(event) => event.stopPropagation()}
            style={chapterSheet.sheetStyle}
            {...chapterSheet.sheetProps}
          >
            <button
              className="sheet-handle bottom-sheet-drag-handle"
              type="button"
              tabIndex={-1}
              aria-label="챕터 선택 시트 높이 변경"
              {...chapterSheet.dragHandleProps}
            ><span /></button>
            <div className="inbox-chapter-sheet-scroll" data-bottom-sheet-scroll="true">
              <h2 id="inbox-assign-title">챕터 선택</h2>
              <InlineChapterCreate onCreate={createChapterAndAssign} />
              <div className="inbox-chapter-list">
              {chapters.map((chapter, index) => (
                <ChapterChoice
                  archive={archive}
                  chapter={chapter}
                  detail={`${getCubeTracks(archive, chapter.id).length}곡`}
                  index={index}
                  key={chapter.id}
                  onSelect={assign}
                  showSelectionLabel={false}
                />
              ))}
              </div>
              {!chapters.length ? <div className="notice notice-warning">아직 챕터가 없어요.</div> : null}
            </div>
            <div className="inbox-chapter-sheet-footer">
              <button className="button button-ghost" type="button" onClick={() => setAssignmentTrackIds([])}>취소</button>
              <Link
                className="button button-primary"
                href={`/chapters?${assignmentTrackIds.map((trackId) => `trackId=${encodeURIComponent(trackId)}`).join("&")}`}
              >새 챕터 만들기</Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
