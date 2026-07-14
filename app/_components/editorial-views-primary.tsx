"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  addTrackToCube,
  captureTrack,
  captureTrackToInbox,
  getCubeTracks,
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
  PreviewButton,
  type PreviewControls,
} from "./editorial-media";
import { EmptyState, PageHeader, TrackLine } from "./editorial-ui";
import { useModalFocus } from "./editorial-accessibility";
import { formatDate } from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";

const CAPTURE_DRAFT_KEY = "music-world:capture-draft:v1";

type HomeMemory = ReturnType<typeof getCubeTracks>[number] & { chapter: Cube };

export function AlbumHero({
  memories,
  preview,
}: {
  memories: HomeMemory[];
  preview: PreviewControls;
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
            <span className="section-label">RECENT MEMORY · {featured.chapter.name}</span>
            <h1 id="featured-memory-title">{featured.track.title}</h1>
            <p className="album-artist">{featured.track.artist}</p>
            <div className="album-actions">
              <PreviewButton track={featured.track} preview={preview} />
              <button
                className="text-button"
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
              >
                {expanded ? "CLOSE NOTE" : "READ MEMORY"}
              </button>
            </div>
            <div className="album-memory-reveal" aria-hidden={!expanded}>
              <p>
                {featured.cubeTrack.memo
                  || featured.cubeTrack.character
                  || `${featured.chapter.name}에 남긴 음악`}
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
          icon=""
          title="첫 음악을 기록해 주세요"
          copy="좋아하는 곡 하나와 그 순간의 문장만으로 아카이브가 시작됩니다."
          action={<Link className="button button-primary" href="/capture" intent="modal">첫 곡 기록하기</Link>}
        />
      )}
      {memories.length > 1 ? (
        <div className="hero-pagination" aria-label="대표 기억 이동">
          <button className="text-button" type="button" onClick={() => moveFeatured(-1)}>PREV</button>
          <div>
            {memories.slice(0, 8).map((entry, index) => (
              <span
                className={index === safeActiveIndex ? "is-active" : ""}
                key={entry.cubeTrack.id}
              />
            ))}
          </div>
          <button className="text-button" type="button" onClick={() => moveFeatured(1)}>NEXT</button>
        </div>
      ) : null}
    </section>
  );
}

export function Home({
  archive,
  preview,
}: {
  archive: ArchiveEnvelopeV1;
  preview: PreviewControls;
}) {
  const chapters = Object.values(archive.data.cubes).sort((a, b) => a.sortOrder - b.sortOrder);
  const memories = chapters
    .flatMap((chapter) => getCubeTracks(archive, chapter.id).map((entry) => ({ ...entry, chapter })))
    .sort((a, b) => b.cubeTrack.updatedAt.localeCompare(a.cubeTrack.updatedAt));

  return (
    <div className="page-content home-view">
      <AlbumHero memories={memories} preview={preview} />

      <section className="chapter-preview" aria-labelledby="chapter-preview-title">
        <div className="editorial-section-head">
          <div>
            <span className="section-label">YOUR INDEX</span>
            <h2 id="chapter-preview-title">나의 챕터</h2>
          </div>
          <Link className="text-link" href="/chapters" intent="tab">VIEW ALL</Link>
        </div>
        {chapters.length ? (
          <div className="chapter-preview-list">
            {chapters.slice(0, 4).map((chapter, index) => (
              <Link
                className="chapter-preview-line"
                href={`/chapter?id=${encodeURIComponent(chapter.id)}`}
                intent="shared"
                sharedId={chapter.id}
                key={chapter.id}
              >
                <span>{String(index + 1).padStart(2, "0")}</span>
                <strong>{chapter.name}</strong>
                <small>{getCubeTracks(archive, chapter.id).length} TRACKS</small>
              </Link>
            ))}
          </div>
        ) : <p className="empty-inline">첫 챕터를 만들면 이곳에 당신의 음악 장면이 놓입니다.</p>}
      </section>

      <section className="home-manifesto">
        <span className="section-label">A NOTE TO MY FUTURE SELF</span>
        <p>좋아했던 음악이 사라지지 않도록,<br />곡보다 먼저 그때의 나를 기록합니다.</p>
        <Link className="button button-primary" href="/capture" intent="modal">ADD A MEMORY</Link>
      </section>
    </div>
  );
}

export function Capture({
  archive,
  commit,
  preview,
  online,
  router,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  preview: PreviewControls;
  online: boolean;
  router: MotionRouter;
}) {
  const [musicUrl, setMusicUrl] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackReference[]>([]);
  const [loading, setLoading] = useState(false);
  const [linkLoading, setLinkLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [assigning, setAssigning] = useState<TrackReference | null>(null);
  const [manualFallback, setManualFallback] = useState<ManualTrackFallback | null>(null);
  const [manualTitle, setManualTitle] = useState("");
  const [manualArtist, setManualArtist] = useState("");
  const [manualAlbum, setManualAlbum] = useState("");
  const [resultSource, setResultSource] = useState<"link" | "search" | null>(null);
  const chapters = Object.values(archive.data.cubes).sort((a, b) => a.sortOrder - b.sortOrder);
  const draftReady = useRef(false);
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
    setError(null);
    try {
      setResults(await searchItunesTracks(query));
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
      already ? "이미 임시 보관함에 있는 곡이에요." : "임시 보관함에 곡을 담았어요.",
    )) clearCaptureDraft();
  }

  function saveChapter(track: TrackReference, chapterId: string) {
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
        `/memory?id=${encodeURIComponent(result.cubeTrack.id)}`,
        "shared",
        result.cubeTrack.id,
      );
    }
  }

  function createChapterForTrack(track: TrackReference) {
    const captured = captureTrackToInbox(archive, track);
    if (commit(captured, "곡을 잃지 않도록 먼저 보관했어요. 이제 챕터 이름만 정해 주세요.")) {
      setAssigning(null);
      router.push(`/chapters?trackId=${encodeURIComponent(track.id)}`);
    }
  }

  return (
    <div className="page-content capture-view">
      <PageHeader
        eyebrow="ADD A MEMORY"
        title="곡 찾기"
        copy="곡명이나 아티스트로 검색하세요. 저장한 곡은 등록한 달의 챕터에도 자동으로 모여요."
        action={(
          <div className="capture-header-actions">
            <button
              className="button button-ghost"
              type="button"
              onClick={() => {
                setLinkError(null);
                setManualFallback(null);
                setLinkDialogOpen(true);
              }}
            >
              공유 링크로 추가
            </button>
            <Link className="text-link" href="/" intent="back">CLOSE</Link>
          </div>
        )}
      />
      <section className="capture-search-compact" aria-labelledby="capture-search-label">
        <span className="section-label" id="capture-search-label">MUSIC SEARCH</span>
        <form className="search-form capture-search-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="itunes-query">곡명 또는 아티스트</label>
          <input id="itunes-query" className="input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="곡명 또는 아티스트" minLength={1} />
          <button className="button button-cyan" type="submit" disabled={loading || !online}>{loading ? <LoadingDots /> : "음악 찾기"}</button>
        </form>
        <p className="legal-note">검색 및 30초 미리듣기는 iTunes에서 제공됩니다.</p>
      </section>

      {error ? <div className="notice notice-danger" style={{ marginTop: 18 }} role="alert">{error}</div> : null}

      <section className="section capture-results">
        <div className="section-head"><div><h2>{results.length ? `${resultSource === "link" ? "가져온 음악" : "검색 결과"} ${results.length}곡` : "검색 결과"}</h2><p>일단 저장하거나 바로 챕터를 골라 당신의 언어를 덧붙일 수 있어요.</p></div></div>
        {results.length ? (
          <div className="track-list">
            {results.map((track, index) => {
              const contexts = Object.values(archive.data.cubeTracks).filter((entry) => entry.trackId === track.id);
              return (
                <TrackLine
                  key={track.id}
                  track={track}
                  index={index}
                  preview={preview}
                  context={contexts.length ? `이미 ${contexts.length}개의 순간에 기록됨` : track.genre || "장르 정보 없음"}
                  actions={<>{!track.previewUrl && track.externalUrl ? <a className="button button-ghost" href={track.externalUrl} target="_blank" rel="noopener noreferrer">원본 열기</a> : null}<button className="button" type="button" onClick={() => saveInbox(track)}>일단 저장</button><button className="button button-primary" type="button" onClick={() => setAssigning(track)}>챕터에 담기</button></>}
                />
              );
            })}
          </div>
        ) : <div className="capture-search-empty">검색하면 곡 목록이 여기에 표시됩니다.</div>}
      </section>

      {linkDialogOpen ? (
        <div ref={linkDialogRef} className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="link-import-title">
          <div className="dialog link-import-dialog">
            <span className="section-label">ADD BY LINK</span>
            <h2 id="link-import-title">공유 링크로 곡 추가</h2>
            {!manualFallback ? (
              <>
                <p>Spotify, Apple Music, YouTube 또는 Melon 링크를 붙여넣으세요.</p>
                <form className="form-stack link-import-form" onSubmit={importLink}>
                  <div className="field">
                    <label htmlFor="music-url">음악 공유 링크</label>
                    <input id="music-url" className="input" type="url" value={musicUrl} onChange={(event) => setMusicUrl(event.target.value)} placeholder="https://…" required autoComplete="url" />
                  </div>
                  {linkError ? <div className="notice notice-danger" role="alert">{linkError}</div> : null}
                  <p className="legal-note">정보가 부족한 링크는 원본을 보존한 채 곡명과 아티스트만 추가로 확인합니다.</p>
                  <div className="dialog-actions">
                    <button className="button button-ghost" type="button" onClick={() => setLinkDialogOpen(false)}>취소</button>
                    <button className="button button-primary" type="submit" disabled={linkLoading || !online}>{linkLoading ? <LoadingDots /> : "링크 가져오기"}</button>
                  </div>
                </form>
              </>
            ) : (
              <form className="form-stack link-import-form" onSubmit={finishManualImport}>
                <p className="field-hint">원본 링크는 안전하게 보관했어요. 부족한 정보만 채워주세요.</p>
                <div className="form-grid"><div className="field"><label htmlFor="manual-title">곡명 *</label><input id="manual-title" className="input" value={manualTitle} onChange={(event) => setManualTitle(event.target.value)} maxLength={200} required /></div><div className="field"><label htmlFor="manual-artist">아티스트 *</label><input id="manual-artist" className="input" value={manualArtist} onChange={(event) => setManualArtist(event.target.value)} maxLength={200} required /></div></div>
                <div className="field"><label htmlFor="manual-album">앨범 · 선택</label><input id="manual-album" className="input" value={manualAlbum} onChange={(event) => setManualAlbum(event.target.value)} maxLength={200} /></div>
                <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setManualFallback(null)}>뒤로</button><button className="button button-primary" type="submit">이 곡 확인하기</button></div>
              </form>
            )}
          </div>
        </div>
      ) : null}

      {assigning ? (
        <div ref={assignDialogRef} className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="assign-title">
          <div className="dialog">
            <span className="section-label">NEW MEMORY</span>
            <h2 id="assign-title">어느 챕터에 담을까요?</h2>
            <p>{assigning.artist} · {assigning.title}</p>
            <div className="track-list" style={{ marginTop: 22 }}>
              {chapters.map((chapter, index) => (
                <button key={chapter.id} className="chapter-choice" type="button" onClick={() => saveChapter(assigning, chapter.id)}><span>{String(index + 1).padStart(2, "0")}</span><ChapterCover archive={archive} chapter={chapter} /><span className="track-info"><strong>{chapter.name}</strong><small>{chapter.description || "설명 없음"}</small></span><em>SELECT</em></button>
              ))}
            </div>
            {!chapters.length ? <p className="notice notice-warning">먼저 챕터를 하나 만들어 주세요.</p> : null}
            <div className="dialog-actions"><button className="button button-ghost" type="button" onClick={() => setAssigning(null)}>취소</button><button className="button" type="button" onClick={() => createChapterForTrack(assigning)}>새 챕터 만들기</button></div>
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
  preview,
  router,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
  preview: PreviewControls;
  router: MotionRouter;
}) {
  const entries = Object.values(archive.data.inbox)
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  const chapters = Object.values(archive.data.cubes).sort((a, b) => a.sortOrder - b.sortOrder);
  const [selectedTrack, setSelectedTrack] = useState<TrackId | null>(null);
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
    <div className="page-content">
      <PageHeader eyebrow="INBOX" title="먼저 담아둔 음악" copy="지금은 분류하지 않아도 괜찮아요. 여유가 생겼을 때 한 곡씩 의미를 붙여보세요." action={<Link className="button button-primary" href="/capture" intent="modal">ADD TRACK</Link>} />
      {entries.length ? (
        <div className="track-list">
          {entries.map((entry, index) => {
            const track = archive.data.tracks[entry.trackId];
            return track ? (
              <TrackLine key={entry.trackId} track={track} index={index} preview={preview} context={`${formatDate(entry.capturedAt)} 포착 · 아직 미분류`} actions={<><button className="button button-primary" type="button" onClick={() => setSelectedTrack(track.id)}>기록 채우기</button><button className="button button-ghost" type="button" onClick={() => commit(removeInboxTrack(archive, track.id), "임시 보관함에서 곡을 꺼냈어요.")}>제거</button></>} />
            ) : null;
          })}
        </div>
      ) : <EmptyState icon="⌄" title="아직 기다리는 곡이 없어요" copy="마음에 남는 노래를 발견하면 완벽하게 정리하지 말고 먼저 담아두세요." action={<Link className="button button-primary" href="/capture">첫 곡 포착하기</Link>} />}

      {selectedTrack ? (
        <div ref={assignDialogRef} className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="inbox-assign-title">
          <div className="dialog">
            <span className="section-label">CHOOSE A CHAPTER</span><h2 id="inbox-assign-title">이 곡이 머물 순간은?</h2><p>챕터를 고른 뒤 태그와 기억은 천천히 채울 수 있어요.</p>
            <div className="track-list" style={{ marginTop: 22 }}>
              {chapters.map((chapter, index) => (
                <button key={chapter.id} className="chapter-choice" type="button" onClick={() => assign(selectedTrack, chapter.id)}><span>{String(index + 1).padStart(2, "0")}</span><ChapterCover archive={archive} chapter={chapter} /><span className="track-info"><strong>{chapter.name}</strong><small>{getCubeTracks(archive, chapter.id).length}곡</small></span><em>SELECT</em></button>
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
