"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Apple, AudioLines, ChevronLeft, ChevronRight, CirclePlay } from "lucide-react";
import {
  ARCHIVE_LIMITS,
  archiveInboxTrackWithTags,
  captureTrackToInbox,
  getCubesInTreeOrder,
  getCubeTracks,
  getLatestCubeTrackNote,
  getRootCubes,
  getTagGroups,
  getTrackArchiveSummary,
  getUserVisibleChapters,
  moveInboxTrackToCube,
  removeInboxTrack,
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
  PageHeader,
  TrackLine,
} from "./editorial-ui";
import { useModalFocus } from "./editorial-accessibility";
import {
  formatChapterTitle,
  formatDate,
  isAssignableChapter,
  isVisibleChapter,
} from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";

const CAPTURE_DRAFT_KEY = "music-world:capture-draft:v1";
const SEARCH_RESULT_BATCH_SIZE = 10;
const SEARCH_RESULT_REVEAL_DELAY_MS = 240;

type HomeMemory = ReturnType<typeof getCubeTracks>[number] & { chapter: Cube };

function tagGroupHref(tagId: string): string {
  return `/search?tag=${encodeURIComponent(tagId)}&view=group`;
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
                    <Link className="tag" href={tagGroupHref(tag.id)} key={tag.id}>
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
  const keywordMissingMemories = Object.values(archive.data.cubeTracks)
    .filter((cubeTrack) => {
      const cube = archive.data.cubes[cubeTrack.cubeId];
      return cube?.kind !== "monthly" && cubeTrack.tagIds.length === 0;
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  const keywordMissingTrackIds = new Set<TrackId>([
    ...inboxEntries.map((entry) => entry.trackId),
    ...keywordMissingMemories.map((memory) => memory.trackId),
  ]);
  const keywordMissingMemory = keywordMissingMemories[0] ?? null;
  const keywordMissingTrack = continueTrack
    ?? (keywordMissingMemory ? archive.data.tracks[keywordMissingMemory.trackId] : null);
  const keywordMissingHref = continueTrack
    ? "/inbox"
    : keywordMissingMemory
      ? `/memory?id=${encodeURIComponent(keywordMissingMemory.id)}&mode=quick`
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
        <section className="home-section home-keywords" aria-labelledby="home-keywords-title">
          <div className="home-section-inner">
            <div className="editorial-section-head">
              <div>
                <h2 id="home-keywords-title">키워드</h2>
              </div>
              <Link className="text-link" href="/tags">전체 보기</Link>
            </div>
            <div className="tag-row" aria-label="최근 사용한 키워드">
              {recentKeywords.map(({ tag, trackCount }) => (
                <Link className="tag" href={tagGroupHref(tag.id)} key={tag.id}>
                  #{tag.label} · {trackCount}곡
                </Link>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {keywordMissingTrack && keywordMissingTrackIds.size ? (
        <section className="home-section home-keyword-missing" aria-labelledby="home-keyword-missing-title">
          <div className="home-section-inner">
            <div className="editorial-section-head">
              <div>
                <h2 id="home-keyword-missing-title">키워드 없음</h2>
              </div>
              <Link className="text-link" href={keywordMissingHref}>{keywordMissingTrackIds.size}곡</Link>
            </div>
            <TrackLine
              track={keywordMissingTrack}
              index={0}
              actions={<Link className="text-link" href={keywordMissingHref}>키워드</Link>}
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
                  context={formatChapterTitle(memory.chapter)}
                  sharedId={memory.cubeTrack.id}
                  actions={(
                    <>
                      {memory.tags.slice(0, 2).map((tag) => (
                        <Link className="tag" href={tagGroupHref(tag.id)} key={tag.id}>
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
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
  online: boolean;
  router: MotionRouter;
  sharedUrl: string | null;
}) {
  const [musicUrl, setMusicUrl] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackReference[]>([]);
  const [selectedResultIds, setSelectedResultIds] = useState<TrackId[]>([]);
  const [visibleResultCount, setVisibleResultCount] = useState(SEARCH_RESULT_BATCH_SIZE);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [assigning, setAssigning] = useState<TrackReference | null>(null);
  const [recordMode, setRecordMode] = useState<"choose" | "tag" | "complete">("choose");
  const [selectedTagLabels, setSelectedTagLabels] = useState<string[]>([]);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [savedMemoryId, setSavedMemoryId] = useState<string | null>(null);
  const [manualFallback, setManualFallback] = useState<ManualTrackFallback | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualAlbum, setManualAlbum] = useState("");
  const [resultSource, setResultSource] = useState<"link" | "search" | null>(null);
  const suggestedTags = getTagGroups(archive).slice(0, 5).map((group) => group.tag);
  const draftReady = useRef(false);
  const shareHandled = useRef(false);
  const searchRequestRef = useRef(0);
  const loadMoreTriggerRef = useRef<HTMLDivElement>(null);
  const visibleResults = resultSource === "search"
    ? results.slice(0, visibleResultCount)
    : results;
  const selectedResultTracks = results.filter((track) => selectedResultIds.includes(track.id));
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
          }>;
          setMusicUrl(draft.musicUrl ?? "");
          setQuery(draft.query ?? "");
          setManualTitle(draft.manualTitle ?? "");
          setManualArtist(draft.manualArtist ?? "");
          setManualAlbum(draft.manualAlbum ?? "");
        }
      } catch {
        // A malformed session draft should never block the archive itself.
      }
      draftReady.current = true;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!sharedUrl || shareHandled.current) return;
    const matchedUrl = sharedUrl.match(/https?:\/\/\S+/)?.[0]?.replace(/[),.]+$/, "") ?? sharedUrl;
    setMusicUrl(matchedUrl);
    setLinkDialogOpen(true);
    shareHandled.current = true;
  }, [sharedUrl]);

  useEffect(() => {
    if (!draftReady.current) return;
    try {
      window.sessionStorage.setItem(CAPTURE_DRAFT_KEY, JSON.stringify({
        musicUrl,
        query,
        manualTitle,
        manualArtist,
        manualAlbum,
      }));
    } catch {
      // Session-only draft persistence is best effort.
    }
  }, [manualAlbum, manualArtist, manualTitle, musicUrl, query]);

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

  function startRecord(track: TrackReference) {
    setAssigning(track);
    setRecordMode("choose");
    setSelectedTagLabels([]);
    setNewTagLabel("");
    setSavedMemoryId(null);
  }

  function changeQuery(value: string) {
    setQuery(value);
    searchRequestRef.current += 1;
    setLoading(false);
    setLoadingMore(false);
    setResultSource(null);
    setSelectedResultIds([]);
    setError(null);
  }

  async function importLink(event: FormEvent) {
    event.preventDefault();
    if (!online) {
      setLinkError("오프라인에서는 새 음악 링크를 가져올 수 없어요.");
      return;
    }
    setLinkLoading(true);
    setLinkError(null);
    setManualFallback(null);
    try {
      const response = await fetch(`/api/music-metadata?url=${encodeURIComponent(musicUrl.trim())}`, {
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
      setResults([payload.track]);
      setSelectedResultIds([]);
      setVisibleResultCount(SEARCH_RESULT_BATCH_SIZE);
      setLoadingMore(false);
      setResultSource("link");
      setLinkDialogOpen(false);
    } catch {
      setLinkError("링크 정보를 가져오지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.");
    } finally {
      setLinkLoading(false);
    }
  }

  function finishManualImport(event: FormEvent) {
    event.preventDefault();
    if (!manualFallback) return;
    const track = completeManualTrack(manualFallback, {
      title: manualTitle,
      artist: manualArtist,
      album: manualAlbum,
    });
    setResults([track]);
    setSelectedResultIds([]);
    setVisibleResultCount(SEARCH_RESULT_BATCH_SIZE);
    setLoadingMore(false);
    setResultSource("link");
    setManualFallback(null);
    setLinkError(null);
    setLinkDialogOpen(false);
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
    setSelectedResultIds([]);
    try {
      const tracks = await searchItunesTracks(submittedQuery);
      if (requestId !== searchRequestRef.current) return;
      setResults(tracks);
      setSelectedResultIds([]);
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
      notify("이미 기록한 곡이에요. 기존 기록에서 키워드를 이어서 남길 수 있어요.");
      const memoryId = summary.captureContextId ?? summary.manualContextStates[0]?.cubeTrackId;
      resetRecordDialog();
      if (memoryId) router.push(`/memory?id=${encodeURIComponent(memoryId)}&mode=detail`, "shared", memoryId);
      return;
    }
    if (commit(
      next,
      already ? "이미 정리 대기 중인 곡이에요." : "나중에 이어서 기록할 곡으로 남겼어요.",
    )) {
      clearCaptureDraft();
      resetRecordDialog();
    }
  }

  function toggleResultSelection(trackId: TrackId) {
    setSelectedResultIds((current) => current.includes(trackId)
      ? current.filter((item) => item !== trackId)
      : [...current, trackId]);
  }

  function saveSelectedResults() {
    if (!selectedResultTracks.length) return;

    let next = archive;
    let added = 0;
    let already = 0;
    for (const track of selectedResultTracks) {
      const wasInInbox = Boolean(next.data.inbox[track.id]);
      const captured = captureTrackToInbox(next, track);
      const isInInbox = Boolean(captured.data.inbox[track.id]);
      if (!wasInInbox && isInInbox) added += 1;
      else already += 1;
      next = captured;
    }

    const message = added
      ? `${added}곡을 정리 대기함에 기록했어요.`
      : already
        ? "선택한 곡은 이미 기록되어 있어요."
        : "기록할 곡이 없어요.";

    if (commit(next, message)) {
      clearCaptureDraft();
      setSelectedResultIds([]);
    }
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
    if (!labels.length) {
      notify("나중에 이 곡을 찾을 키워드를 하나 남겨 주세요.");
      return;
    }
    try {
      const captured = captureTrackToInbox(archive, assigning);
      if (!captured.data.inbox[assigning.id]) {
        const summary = getTrackArchiveSummary(captured, assigning.id);
        const memoryId = summary.captureContextId ?? summary.manualContextStates[0]?.cubeTrackId;
        notify("이미 기록된 곡이에요. 기존 기억에서 키워드를 더해 주세요.");
        resetRecordDialog();
        if (memoryId) router.push(`/memory?id=${encodeURIComponent(memoryId)}&mode=detail`, "shared", memoryId);
        return;
      }
      const result = archiveInboxTrackWithTags(captured, assigning.id, labels);
      if (commit(result.archive, `‘${labels[0]}’ 키워드로 기록했어요.`)) {
        clearCaptureDraft();
        setSelectedTagLabels(labels);
        setNewTagLabel("");
        setSavedMemoryId(result.cubeTrack.id);
        setRecordMode("complete");
      }
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "키워드를 기록하지 못했어요.");
    }
  }

  return (
    <div className="page-content capture-view">
      <header className="capture-search-header">
        <h1>곡 기록</h1>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setLinkError(null);
            setManualFallback(null);
            setLinkDialogOpen(true);
          }}
        >
          공유 링크로 기록
        </button>
      </header>
      <section className="capture-search-compact" aria-label="음악 검색">
        <form className="search-form capture-search-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="itunes-query">곡명 또는 아티스트</label>
          <input id="itunes-query" className="input" type="search" name="music-search" value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="곡명 또는 아티스트 검색" minLength={1} enterKeyHint="search" autoComplete="off" />
          <button className="button button-cyan" type="submit" disabled={loading || !online || !query.trim()}>{loading ? <LoadingDots /> : "검색"}</button>
        </form>
      </section>

      {error ? <div className="notice notice-danger" style={{ marginTop: 18 }} role="alert">{error}</div> : null}

      {resultSource ? (
        <section className="section capture-results" aria-busy={loadingMore}>
          <p className="sr-only" role="status" aria-live="polite" aria-atomic="true">
            {resultSource === "link" ? `가져온 음악 ${results.length}곡` : `검색 결과 ${results.length}곡`}
          </p>
          <div className="section-head">
            <h2 className="capture-results-count">
              {results.length
                ? resultSource === "link"
                  ? `가져온 음악 ${results.length}곡`
                  : `검색 결과 ${visibleResults.length}${results.length > SEARCH_RESULT_BATCH_SIZE ? ` / ${results.length}` : ""}곡`
                : "검색 결과 없음"}
            </h2>
          </div>
          {results.length ? (
            <>
              {resultSource === "search" ? (
                <div className="capture-selection-bar" aria-live="polite">
                  <span>{selectedResultIds.length ? `${selectedResultIds.length}곡 선택` : "곡 선택"}</span>
                  <button className="button button-primary" type="button" disabled={!selectedResultIds.length} onClick={saveSelectedResults}>
                    선택 기록
                  </button>
                </div>
              ) : null}
              <div className="track-list track-list-unified">
                {visibleResults.map((track, index) => {
                  const contexts = Object.values(archive.data.cubeTracks).filter((entry) => entry.trackId === track.id);
                  const selected = selectedResultIds.includes(track.id);
                  return (
                    <TrackLine
                      key={track.id}
                      track={track}
                      index={index}
                      selectable={resultSource === "search"}
                      selected={selected}
                      onRowClick={(event) => {
                        const target = event.target as HTMLElement;
                        if (target.closest("button, a, input, label")) return;
                        toggleResultSelection(track.id);
                      }}
                      context={contexts.length ? `이미 ${contexts.length}개의 순간에 기록됨` : track.genre || "장르 정보 없음"}
                      actions={(
                        <>
                          {resultSource === "search" ? (
                            <label className="capture-result-check">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleResultSelection(track.id)}
                              />
                              <span className="sr-only">{track.title} 선택</span>
                            </label>
                          ) : null}
                          <button className="button button-primary" type="button" onClick={() => {
                            startRecord(track);
                          }}>기록</button>
                        </>
                      )}
                    />
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

      <details className="playlist-import-prototype">
        <summary id="playlist-import-title">기존 플레이리스트 가져오기 · 프로토타입</summary>
        <div className="playlist-import-actions" aria-labelledby="playlist-import-title">
          {[
            { name: "Apple Music", icon: Apple },
            { name: "Spotify", icon: AudioLines },
            { name: "YouTube Music", icon: CirclePlay },
          ].map(({ name, icon: Icon }) => (
            <button className="playlist-import-button" type="button" key={name} onClick={() => notify(`${name} 가져오기 연결을 확인 중이에요. 프로토타입에서는 버튼만 제공됩니다.`)}>
              <Icon size={17} aria-hidden="true" />
              <span>{name}</span>
            </button>
          ))}
        </div>
        <p>아직 실제 곡을 가져오지는 않아요.</p>
      </details>

      {linkDialogOpen ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setLinkDialogOpen(false)}>
          <div ref={linkDialogRef} className="dialog link-import-dialog" role="dialog" aria-modal="true" aria-labelledby="link-import-title" onClick={(event) => event.stopPropagation()}>
            <span className="section-label">ADD BY LINK</span>
            <h2 id="link-import-title">공유 링크로 곡 기록</h2>
            {!manualFallback ? (
              <>
                <form className="form-stack link-import-form" onSubmit={importLink}>
                  <div className="field">
                    <label htmlFor="music-url">음악 공유 링크</label>
                    <input id="music-url" className="input" type="url" value={musicUrl} onChange={(event) => setMusicUrl(event.target.value)} placeholder="https://…" required autoComplete="url" />
                  </div>
                  {linkError ? <div className="notice notice-danger" role="alert">{linkError}</div> : null}
                  <div className="dialog-actions">
                    <button className="button button-ghost" type="button" onClick={() => setLinkDialogOpen(false)}>취소</button>
                    <button className="button button-primary" type="submit" disabled={linkLoading || !online}>{linkLoading ? <LoadingDots /> : "링크 가져오기"}</button>
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
          <div ref={assignDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="assign-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="assign-title">{recordMode === "choose" ? "기록" : recordMode === "tag" ? "키워드" : "기록 완료"}</h2>
            <p>{assigning.artist} · {assigning.title}</p>
            {recordMode === "choose" ? (
              <div className="record-mode-list">
                <button type="button" onClick={() => saveInbox(assigning)}><strong>곡만 기록</strong></button>
                <button type="button" onClick={() => setRecordMode("tag")}><strong>키워드로 기록</strong></button>
              </div>
            ) : recordMode === "tag" ? (
              <form className="form-stack" onSubmit={saveKeywords}>
                {suggestedTags.length ? (
                  <div className="field">
                    <span className="field-label">최근 키워드</span>
                    <div className="tag-row">
                      {suggestedTags.map((tag) => (
                        <button className="tag" type="button" aria-pressed={selectedTagLabels.includes(tag.label)} key={tag.id} onClick={() => toggleSuggestedTag(tag.label)}>#{tag.label}</button>
                      ))}
                    </div>
                  </div>
                ) : null}
                <div className="field">
                  <label htmlFor="capture-new-tag">나만의 키워드</label>
                  <div className="search-form">
                    <input id="capture-new-tag" className="input" value={newTagLabel} onChange={(event) => setNewTagLabel(event.target.value)} maxLength={ARCHIVE_LIMITS.tagLabel} placeholder="예: 스무 살 여름, 새벽 러닝" autoFocus />
                    <button className="button" type="button" onClick={addCustomTag} disabled={!newTagLabel.trim()}>추가</button>
                  </div>
                </div>
                {selectedTagLabels.length ? (
                  <div className="tag-row" aria-label="선택한 키워드">
                    {selectedTagLabels.map((label) => <button className="tag is-selected" type="button" key={label} onClick={() => toggleSuggestedTag(label)}>#{label} 삭제</button>)}
                  </div>
                ) : null}
                <div className="dialog-actions">
                  <button className="button" type="button" onClick={() => setRecordMode("choose")}>뒤로</button>
                  <button className="button button-primary" type="submit" disabled={!selectedTagLabels.length && !newTagLabel.trim()}>키워드로 기록</button>
                </div>
              </form>
            ) : (
              <div className="record-mode-list">
                <button type="button" onClick={() => savedMemoryId && router.push(`/memory?id=${encodeURIComponent(savedMemoryId)}&mode=detail`, "shared", savedMemoryId)}><strong>기억 더 남기기</strong></button>
                <button type="button" onClick={() => savedMemoryId && router.push(`/memory?id=${encodeURIComponent(savedMemoryId)}&mode=detail&move=chapter`, "shared", savedMemoryId)}><strong>챕터로 정리</strong></button>
              </div>
            )}
            {recordMode !== "tag" ? <div className="dialog-actions"><button className="button" type="button" onClick={resetRecordDialog}>{recordMode === "complete" ? "완료" : "취소"}</button></div> : null}
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
  const [selectedTrack, setSelectedTrack] = useState<TrackId | null>(null);
  const [managing, setManaging] = useState(false);
  const assignDialogRef = useModalFocus<HTMLDivElement>(
    Boolean(selectedTrack),
    () => setSelectedTrack(null),
  );

  function assign(trackId: TrackId, chapterId: string) {
    try {
      const result = moveInboxTrackToCube(archive, trackId, chapterId);
      if (commit(
        result.archive,
        result.added
          ? "곡이 챕터에서 새로운 순간을 찾았어요."
          : "이미 이 챕터에 있는 곡이라 보관함에서만 정리했어요.",
      )) {
        setSelectedTrack(null);
        router.push(
          `/memory?id=${encodeURIComponent(result.cubeTrack.id)}`,
          "shared",
          result.cubeTrack.id,
        );
      }
    } catch (error) {
      notify(error instanceof Error ? error.message : "곡을 이동하지 못했어요.");
    }
  }

  return (
    <div className="page-content inbox-view">
      <PageHeader
        eyebrow={`${entries.length}곡`}
        title="정리 대기"
        action={<div className="page-header-actions"><Link className="button button-primary" href="/capture" intent="modal">곡 기록</Link>{entries.length ? <button className="text-button" type="button" onClick={() => setManaging((value) => !value)}>{managing ? "관리 완료" : "목록 관리"}</button> : null}</div>}
      />
      {entries.length ? (
        <div className="track-list">
          {entries.map((entry, index) => {
            const track = archive.data.tracks[entry.trackId];
            return track ? (
              <TrackLine key={entry.trackId} track={track} index={index} context={formatDate(entry.capturedAt)} actions={managing ? <button className="button button-danger" type="button" onClick={() => commit(removeInboxTrack(archive, track.id), "정리 대기 목록에서 곡을 제거했어요.")}>제거</button> : <button className="button button-primary" type="button" onClick={() => setSelectedTrack(track.id)}>챕터</button>} />
            ) : null;
          })}
        </div>
      ) : <EmptyState title="정리할 곡이 없어요" action={<Link className="button button-primary" href="/capture">첫 곡 기록하기</Link>} />}

      {selectedTrack ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setSelectedTrack(null)}>
          <div ref={assignDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="inbox-assign-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="inbox-assign-title">챕터 선택</h2>
            <div className="track-list" style={{ marginTop: 22 }}>
              {chapters.map((chapter, index) => (
                <ChapterChoice
                  archive={archive}
                  chapter={chapter}
                  detail={`${getCubeTracks(archive, chapter.id).length}곡`}
                  index={index}
                  key={chapter.id}
                  onSelect={(chapterId) => assign(selectedTrack, chapterId)}
                />
              ))}
            </div>
            {!chapters.length ? <div className="notice notice-warning">챕터 없음</div> : null}
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setSelectedTrack(null)}>취소</button><Link className="button" href={`/chapters?trackId=${encodeURIComponent(selectedTrack)}`}>새 챕터 만들기</Link></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
