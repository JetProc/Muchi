"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Apple, AudioLines, ChevronLeft, ChevronRight, CirclePlay } from "lucide-react";
import {
  addTrackToCube,
  captureTrack,
  captureTrackToInbox,
  getCubesInTreeOrder,
  getCubeTracks,
  getLatestCubeTrackNote,
  getRootCubes,
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
                    <span className="tag" key={tag.id}>#{tag.label}</span>
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
  const allChapters = getCubesInTreeOrder(archive)
    .filter((chapter) => isVisibleChapter(archive, chapter));
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
  return (
    <div className="page-content home-view">
      <AlbumHero memories={memories} />

      {continueEntry && continueTrack ? (
        <section className="home-section home-continue" aria-labelledby="home-continue-title">
          <div className="home-section-inner">
            <div className="editorial-section-head">
              <div>
                <span className="section-label">정리 대기</span>
                <h2 id="home-continue-title">기억 이어가기</h2>
              </div>
              <Link className="text-link" href="/inbox">{inboxEntries.length}곡 남음</Link>
            </div>
            <TrackLine
              track={continueTrack}
              index={0}
              context={`${formatDate(continueEntry.capturedAt)} 저장 · 아직 챕터 없음`}
              actions={<Link className="text-link" href="/inbox">정리하기</Link>}
            />
          </div>
        </section>
      ) : null}

      <section className="home-section chapter-preview" aria-labelledby="chapter-preview-title">
        <div className="home-section-inner">
          <div className="editorial-section-head">
            <div>
              <span className="section-label">내 챕터</span>
              <h2 id="chapter-preview-title">나의 챕터</h2>
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
                  tags={memory.tags}
                  context={formatChapterTitle(memory.chapter)}
                  sharedId={memory.cubeTrack.id}
                  actions={(
                    <Link
                      className="text-link"
                      href={`/memory?id=${encodeURIComponent(memory.cubeTrack.id)}`}
                      intent="shared"
                      sharedId={memory.cubeTrack.id}
                    >
                      기억 보기
                    </Link>
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
  const [visibleResultCount, setVisibleResultCount] = useState(SEARCH_RESULT_BATCH_SIZE);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [assigning, setAssigning] = useState<TrackReference | null>(null);
  const [recordMode, setRecordMode] = useState<"choose" | "quick" | "detail">("choose");
  const [manualFallback, setManualFallback] = useState<ManualTrackFallback | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualAlbum, setManualAlbum] = useState("");
  const [resultSource, setResultSource] = useState<"link" | "search" | null>(null);
  const chapters = getCubesInTreeOrder(archive)
    .filter((chapter) => isVisibleChapter(archive, chapter) && isAssignableChapter(chapter));
  const draftReady = useRef(false);
  const shareHandled = useRef(false);
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
    setLoading(true);
    setLoadingMore(false);
    setError(null);
    try {
      const tracks = await searchItunesTracks(query);
      setResults(tracks);
      setVisibleResultCount(SEARCH_RESULT_BATCH_SIZE);
      setResultSource("search");
    } catch (cause) {
      if (cause instanceof ItunesSearchError && cause.code === "stale") return;
      setError(cause instanceof Error ? cause.message : "검색 중 문제가 생겼어요.");
    } finally {
      setLoading(false);
    }
  }

  function saveInbox(track: TrackReference) {
    const already = Boolean(archive.data.inbox[track.id]);
    const next = captureTrackToInbox(archive, track);
    if (commit(
      next,
      already ? "이미 정리 대기 중인 곡이에요." : "나중에 정리할 곡으로 저장했어요.",
    )) {
      clearCaptureDraft();
      setAssigning(null);
    }
  }

  function saveChapter(track: TrackReference, chapterId: string, mode: "quick" | "detail") {
    const captured = captureTrack(archive, track);
    const result = captured.data.inbox[track.id]
      ? moveInboxTrackToCube(captured, track.id, chapterId)
      : addTrackToCube(captured, track.id, chapterId);
    if (commit(
      result.archive,
      result.added ? "새로운 챕터 기록으로 담았어요." : "이미 있던 기록을 열었어요.",
    )) {
      clearCaptureDraft();
      setAssigning(null);
      router.push(
        `/memory?id=${encodeURIComponent(result.cubeTrack.id)}&mode=${mode}`,
        "shared",
        result.cubeTrack.id,
      );
    }
  }

  function createChapterForTrack(track: TrackReference, mode: "quick" | "detail") {
    const captured = captureTrackToInbox(archive, track);
    if (commit(captured, "곡을 잃지 않도록 먼저 보관했어요. 이제 챕터 이름만 정해 주세요.")) {
      setAssigning(null);
      router.push(`/chapters?trackId=${encodeURIComponent(track.id)}&recordMode=${mode}`);
    }
  }

  return (
    <div className="page-content capture-view">
      <header className="capture-search-header">
        <h1>곡 추가</h1>
        <button
          className="text-button"
          type="button"
          onClick={() => {
            setLinkError(null);
            setManualFallback(null);
            setLinkDialogOpen(true);
          }}
        >
          공유 링크로 추가
        </button>
      </header>
      <section className="capture-search-compact" aria-label="음악 검색">
        <form className="search-form capture-search-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="itunes-query">곡명 또는 아티스트</label>
          <input id="itunes-query" className="input" type="search" name="music-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="곡명 또는 아티스트 검색" minLength={1} enterKeyHint="search" autoComplete="off" />
          <button className="button button-cyan" type="submit" disabled={loading || !online || !query.trim()}>{loading ? <LoadingDots /> : "검색"}</button>
        </form>
      </section>

      <section className="playlist-import-prototype" aria-labelledby="playlist-import-title">
        <div>
          <span className="section-label">PROTOTYPE</span>
          <h2 id="playlist-import-title">기존 플레이리스트 가져오기</h2>
        </div>
        <div className="playlist-import-actions">
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
      </section>

      {error ? <div className="notice notice-danger" style={{ marginTop: 18 }} role="alert">{error}</div> : null}

      {resultSource ? (
        <section className="section capture-results" aria-live="polite" aria-busy={loadingMore}>
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
              <div className="track-list track-list-unified">
                {visibleResults.map((track, index) => {
                  const contexts = Object.values(archive.data.cubeTracks).filter((entry) => entry.trackId === track.id);
                  return (
                    <TrackLine
                      key={track.id}
                      track={track}
                      index={index}
                      context={contexts.length ? `이미 ${contexts.length}개의 순간에 기록됨` : track.genre || "장르 정보 없음"}
                      actions={<button className="button button-primary" type="button" onClick={() => {
                        setRecordMode("choose");
                        setAssigning(track);
                      }}>추가</button>}
                    />
                  );
                })}
              </div>
              {hasMoreResults ? (
                <div ref={loadMoreTriggerRef} className="search-load-more" role="status">
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

      {linkDialogOpen ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setLinkDialogOpen(false)}>
          <div ref={linkDialogRef} className="dialog link-import-dialog" role="dialog" aria-modal="true" aria-labelledby="link-import-title" onClick={(event) => event.stopPropagation()}>
            <span className="section-label">ADD BY LINK</span>
            <h2 id="link-import-title">공유 링크로 곡 추가</h2>
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
        <div className="dialog-backdrop" role="presentation" onClick={() => setAssigning(null)}>
          <div ref={assignDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="assign-title" onClick={(event) => event.stopPropagation()}>
            <span className="section-label">{recordMode === "choose" ? "저장 방식" : "챕터 선택"}</span>
            <h2 id="assign-title">{recordMode === "choose" ? "어떻게 남길까요?" : "어느 챕터에 담을까요?"}</h2>
            <p>{assigning.artist} · {assigning.title}</p>
            {recordMode === "choose" ? (
              <div className="record-mode-list">
                <button type="button" onClick={() => saveInbox(assigning)}><strong>곡만 보관</strong><span>태그와 메모는 나중에</span></button>
                <button type="button" onClick={() => setRecordMode("quick")}><strong>한 줄 기록</strong><span>날짜·태그·짧은 감상</span></button>
                <button type="button" onClick={() => setRecordMode("detail")}><strong>자세히 기록</strong><span>성격·시기·태그·날짜별 메모</span></button>
              </div>
            ) : (
              <>
                <div className="track-list" style={{ marginTop: 22 }}>
                  {chapters.map((chapter, index) => (
                    <ChapterChoice
                      archive={archive}
                      chapter={chapter}
                      detail={chapter.description || "설명 없음"}
                      index={index}
                      key={chapter.id}
                      onSelect={(chapterId) => saveChapter(assigning, chapterId, recordMode)}
                    />
                  ))}
                </div>
                {!chapters.length ? <p className="notice notice-warning">먼저 챕터를 하나 만들어 주세요.</p> : null}
              </>
            )}
            <div className="dialog-actions">
              <button className="button" type="button" onClick={() => recordMode === "choose" ? setAssigning(null) : setRecordMode("choose")}>{recordMode === "choose" ? "취소" : "뒤로"}</button>
              {recordMode !== "choose" ? <button className="button button-primary" type="button" onClick={() => createChapterForTrack(assigning, recordMode)}>새 챕터</button> : null}
            </div>
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
        eyebrow={`정리할 곡 · ${entries.length}곡 남음`}
        title="아직 챕터를 기다리는 곡"
        action={<div className="page-header-actions"><Link className="button button-primary" href="/capture" intent="modal">곡 더 찾기</Link>{entries.length ? <button className="text-button" type="button" onClick={() => setManaging((value) => !value)}>{managing ? "관리 완료" : "목록 관리"}</button> : null}</div>}
      />
      {entries.length ? (
        <div className="track-list">
          {entries.map((entry, index) => {
            const track = archive.data.tracks[entry.trackId];
            return track ? (
              <TrackLine key={entry.trackId} track={track} index={index} context={`${formatDate(entry.capturedAt)} 저장 · 정리 대기`} actions={managing ? <button className="button button-danger" type="button" onClick={() => commit(removeInboxTrack(archive, track.id), "정리 대기 목록에서 곡을 제거했어요.")}>제거</button> : <button className="button button-primary" type="button" onClick={() => setSelectedTrack(track.id)}>챕터 고르기</button>} />
            ) : null;
          })}
        </div>
      ) : <EmptyState title="정리할 곡이 없어요" action={<Link className="button button-primary" href="/capture">첫 곡 저장하기</Link>} />}

      {selectedTrack ? (
        <div className="dialog-backdrop" role="presentation" onClick={() => setSelectedTrack(null)}>
          <div ref={assignDialogRef} className="dialog" role="dialog" aria-modal="true" aria-labelledby="inbox-assign-title" onClick={(event) => event.stopPropagation()}>
            <span className="section-label">챕터 선택</span><h2 id="inbox-assign-title">이 곡이 머물 순간은?</h2>
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
            {!chapters.length ? <div className="notice notice-warning">먼저 챕터를 만들어 주세요.</div> : null}
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setSelectedTrack(null)}>취소</button><Link className="button" href={`/chapters?trackId=${encodeURIComponent(selectedTrack)}`}>새 챕터 만들기</Link></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
