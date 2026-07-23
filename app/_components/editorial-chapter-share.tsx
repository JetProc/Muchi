"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  MoveVertical,
  Share2,
  Sparkles,
  Unlock,
} from "lucide-react";
import {
  type Cube,
  getCubeTracks,
  isUserVisibleChapter,
  updateCube,
  type ArchiveEnvelopeV1,
} from "@/lib/archive";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  buildPublicChapterShareLink,
  exportShareCardPng,
  getShareLayoutCap,
  normalizeShareExportAssetUrl,
  normalizeChapterShareStyle,
  renderShareCardSvg,
  resolveShareTrackDisplayImages,
  trackShareClarityEvent,
  type ChapterShareStyle,
  type NormalizedChapterShareStyle,
  type ShareClarityPayload,
  type ShareFormat,
  type ShareLayout,
  type ShareMood,
  type ShareTrackInput,
  type ShareTrackImageMode,
} from "@/lib/share";
import {
  SHARE_DECORATION_LEVELS,
  SHARE_DESCRIPTION_MAX_LENGTH,
  SHARE_FORMATS,
  SHARE_LAYOUTS,
  SHARE_MOODS,
  SHARE_TRACK_IMAGE_MODES,
  type ShareDecorationLevel,
} from "@/lib/share/types";
import { MotionLink as Link } from "./editorial-motion";
import { ChapterCover, getOwnedRecordPhotoUrl } from "./editorial-media";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { EmptyState, PageHeader } from "./editorial-ui";
import { formatChapterTitle, isVisibleChapter } from "./editorial-format";

type GeneratedShareAsset = {
  key: string;
  blob: Blob;
  objectUrl: string;
};

function stringifyStyle(style: NormalizedChapterShareStyle): string {
  return JSON.stringify(style);
}

function classifyExportFailure(error: unknown): NonNullable<ShareClarityPayload["failureKind"]> {
  const message = error instanceof Error ? error.message : "";
  if (message.includes("timeout")) return "timeout";
  if (message.includes("asset")) return "asset";
  if (message.includes("canvas") || message.includes("blob")) return "canvas";
  return "unknown";
}

function formatLabel(format: ShareFormat): string {
  return format === "story" ? "스토리" : "피드";
}

function layoutLabel(layout: ShareLayout): string {
  if (layout === "cover") return "커버 중심";
  if (layout === "photo-tracklist") return "사진 + 트랙";
  return "컴팩트 트랙";
}

function moodLabel(mood: ShareMood): string {
  if (mood === "paper") return "페이퍼";
  if (mood === "night") return "나이트";
  return "필름";
}

function decorationLabel(level: ShareDecorationLevel): string {
  if (level === "none") return "절제";
  if (level === "light") return "기본";
  return "풍성";
}

function imageModeLabel(mode: ShareTrackImageMode): string {
  if (mode === "all") return "모든 곡";
  if (mode === "featured") return "대표 곡만";
  if (mode === "cover-only") return "커버만";
  return "텍스트만";
}

function exportFileName(chapterName: string, format: ShareFormat): string {
  const safeName = chapterName.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || "muchi-chapter";
  return `${safeName}-${format}.png`;
}

function downloadObjectUrl(objectUrl: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.click();
}

function ShareChoiceGroup<T extends string>({
  title,
  value,
  items,
  onSelect,
  label,
}: {
  title: string;
  value: T;
  items: readonly T[];
  onSelect: (value: T) => void;
  label: (value: T) => string;
}) {
  return (
    <section className="chapter-share-section" aria-label={title}>
      <div className="chapter-share-section-head">
        <h2>{title}</h2>
      </div>
      <div className="chapter-share-chip-row">
        {items.map((item) => (
          <button
            key={item}
            className={`chapter-share-chip${value === item ? " is-active" : ""}`}
            type="button"
            onClick={() => onSelect(item)}
            aria-pressed={value === item}
          >
            {label(item)}
          </button>
        ))}
      </div>
    </section>
  );
}

export function ChapterShareEditor({
  archive,
  chapterId,
  commit,
  notify,
  authorName,
}: {
  archive: ArchiveEnvelopeV1;
  chapterId: string | null;
  commit: ArchiveCommit;
  notify: Notify;
  authorName?: string | null;
}) {
  const candidateChapter = chapterId ? archive.data.cubes[chapterId] : null;
  const chapter = candidateChapter && isUserVisibleChapter(candidateChapter) && isVisibleChapter(archive, candidateChapter)
    ? candidateChapter
    : null;
  const entries = useMemo(
    () => chapter ? getCubeTracks(archive, chapter.id) : [],
    [archive, chapter],
  );
  const [authorId, setAuthorId] = useState<string | null>(null);
  const availableTracks = useMemo<ShareTrackInput[]>(() => entries.map((entry) => ({
    id: entry.cubeTrack.id,
    track: entry.track,
    sortOrder: entry.cubeTrack.sortOrder,
    createdAt: entry.cubeTrack.createdAt,
    updatedAt: entry.cubeTrack.updatedAt,
    recordVisibility: entry.cubeTrack.recordVisibility,
    tags: entry.tags.map((tag) => tag.label),
    note: entry.cubeTrack.notes[0]?.body ?? null,
    affection: entry.cubeTrack.affection,
    customImageUrl: getOwnedRecordPhotoUrl(entry.cubeTrack.id, entry.cubeTrack.customImageVersion),
  })), [entries]);

  const normalizedArchiveStyle = useMemo(() => normalizeChapterShareStyle(
    chapter?.shareStyle,
    {
      availableTracks,
      chapterVisibility: chapter?.visibility ?? "private",
    },
  ), [availableTracks, chapter?.shareStyle, chapter?.visibility]);
  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabaseBrowserClient();
    void supabase.auth.getSession().then((result: {
      data: { session: { user: { id: string } } | null };
    }) => {
      if (!cancelled) setAuthorId(result.data.session?.user.id ?? null);
    }).catch(() => {
      if (!cancelled) setAuthorId(null);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!chapterId || !chapter) {
    return (
      <div className="page-content">
        <EmptyState
          title="공유할 챕터를 찾을 수 없어요"
          action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>}
        />
      </div>
    );
  }

  return (
    <ChapterShareEditorScreen
      key={chapter.id}
      archive={archive}
      chapter={chapter}
      availableTracks={availableTracks}
      initialStyle={normalizedArchiveStyle}
      authorId={authorId}
      authorName={authorName}
      commit={commit}
      notify={notify}
    />
  );
}

function ChapterShareEditorScreen({
  archive,
  chapter,
  availableTracks,
  initialStyle,
  authorId,
  authorName,
  commit,
  notify,
}: {
  archive: ArchiveEnvelopeV1;
  chapter: Cube;
  availableTracks: ShareTrackInput[];
  initialStyle: NormalizedChapterShareStyle;
  authorId: string | null;
  authorName?: string | null;
  commit: ArchiveCommit;
  notify: Notify;
}) {
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [style, setStyle] = useState<NormalizedChapterShareStyle>(initialStyle);
  const [activeExportAction, setActiveExportAction] = useState<"share" | "download" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedShareAsset | null>(null);
  const exportPromiseRef = useRef<Promise<GeneratedShareAsset> | null>(null);
  const exportKeyRef = useRef<string | null>(null);
  const activeChapter = chapter;
  const initialStyleKey = stringifyStyle(initialStyle);
  const renderMode: "public-share" | "private-image-only" = activeChapter.visibility === "public"
    ? "public-share"
    : "private-image-only";
  const normalizedStyle = useMemo(() => normalizeChapterShareStyle(style, {
    availableTracks,
    chapterVisibility: activeChapter.visibility,
  }), [activeChapter.visibility, availableTracks, style]);
  const styleKey = stringifyStyle(normalizedStyle);
  const selectionCap = getShareLayoutCap(normalizedStyle.format, normalizedStyle.layout);
  const selectedTrackMap = useMemo(
    () => new Map(availableTracks.map((track) => [track.id, track])),
    [availableTracks],
  );
  const selectedTracks = normalizedStyle.selectedTrackIds
    .map((trackId) => selectedTrackMap.get(trackId))
    .filter((track): track is ShareTrackInput => Boolean(track));
  const publicUrl = useMemo(() => {
    if (activeChapter.visibility !== "public" || !authorId || typeof window === "undefined") return null;
    return buildPublicChapterShareLink({
      origin: window.location.origin,
      authorId,
      chapterId: activeChapter.id,
    });
  }, [activeChapter.id, activeChapter.visibility, authorId]);
  const resolvedTracks = useMemo(() => resolveShareTrackDisplayImages(selectedTracks, {
    chapterCoverImageUrl: activeChapter.coverImageUrl ?? null,
    renderMode,
  }), [activeChapter.coverImageUrl, renderMode, selectedTracks]);
  const model = useMemo(() => ({
    chapterId: activeChapter.id,
    chapterName: formatChapterTitle(activeChapter),
    chapterDescription: activeChapter.description,
    chapterVisibility: activeChapter.visibility,
    authorName: authorName?.trim() || null,
    publicUrl,
    renderMode,
    chapterCoverImageUrl: activeChapter.coverImageUrl ?? null,
    style: normalizedStyle,
    tracks: resolvedTracks,
  }), [activeChapter, authorName, normalizedStyle, publicUrl, renderMode, resolvedTracks]);
  const previewSvg = useMemo(() => renderShareCardSvg(model), [model]);

  useEffect(() => {
    trackShareClarityEvent("editor_open", {
      chapterVisibility: activeChapter.visibility,
      renderMode,
      chapterTrackCount: availableTracks.length,
    });
  }, [activeChapter.visibility, availableTracks.length, renderMode]);

  useEffect(() => () => {
    if (generatedAsset?.objectUrl) URL.revokeObjectURL(generatedAsset.objectUrl);
  }, [generatedAsset]);

  useEffect(() => {
    if (!hasLocalChanges || styleKey === initialStyleKey) return;
    const timer = window.setTimeout(() => {
      commit(updateCube(archive, activeChapter.id, { shareStyle: normalizedStyle }));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [activeChapter.id, archive, commit, hasLocalChanges, initialStyleKey, normalizedStyle, styleKey]);

  function updateStyle(next: Partial<ChapterShareStyle> | ((current: NormalizedChapterShareStyle) => Partial<ChapterShareStyle>)) {
    setHasLocalChanges(true);
    setStyle((current) => normalizeChapterShareStyle(
      { ...current, ...(typeof next === "function" ? next(current) : next) },
      {
        availableTracks,
        chapterVisibility: activeChapter.visibility,
      },
    ));
  }

  function toggleTrack(trackId: string) {
    const selected = normalizedStyle.selectedTrackIds.includes(trackId);
    if (!selected && normalizedStyle.selectedTrackIds.length >= selectionCap) {
      notify(`이 레이아웃은 최대 ${selectionCap}곡까지 담을 수 있어요.`);
      return;
    }
    updateStyle((current) => ({
      selectedTrackIds: selected
        ? current.selectedTrackIds.filter((id) => id !== trackId)
        : [...current.selectedTrackIds, trackId],
    }));
  }

  function moveSelectedTrack(trackId: string, direction: -1 | 1) {
    const ids = [...normalizedStyle.selectedTrackIds];
    const from = ids.indexOf(trackId);
    const to = from + direction;
    if (from < 0 || to < 0 || to >= ids.length) return;
    [ids[from], ids[to]] = [ids[to], ids[from]];
    updateStyle({ selectedTrackIds: ids });
  }

  function sharePayload(): ShareClarityPayload {
    return {
      chapterVisibility: activeChapter.visibility,
      renderMode,
      format: normalizedStyle.format,
      layout: normalizedStyle.layout,
      mood: normalizedStyle.mood,
      decorationLevel: normalizedStyle.decorationLevel,
      trackImageMode: normalizedStyle.trackImageMode,
      selectedTrackCount: normalizedStyle.selectedTrackIds.length,
      chapterTrackCount: availableTracks.length,
      exportedTrackCount: resolvedTracks.length,
      hasPublicLink: Boolean(publicUrl),
    };
  }

  async function ensureGeneratedAsset(): Promise<GeneratedShareAsset> {
    const key = JSON.stringify({
      renderMode,
      publicUrl,
      style: normalizedStyle,
      tracks: resolvedTracks.map((track) => ({
        id: track.id,
        image: track.displayImage.url,
        visibility: track.recordVisibility,
      })),
    });
    if (generatedAsset?.key === key) return generatedAsset;
    if (exportPromiseRef.current && exportKeyRef.current === key) return exportPromiseRef.current;

    setExportError(null);
    trackShareClarityEvent("export_start", sharePayload());
    const next = exportShareCardPng({ model, normalizeAssetUrl: normalizeShareExportAssetUrl })
      .then((result) => {
        const objectUrl = URL.createObjectURL(result.blob);
        const asset = { key, blob: result.blob, objectUrl };
        setGeneratedAsset((current) => {
          if (current?.objectUrl) URL.revokeObjectURL(current.objectUrl);
          return asset;
        });
        trackShareClarityEvent("export_success", {
          ...sharePayload(),
          result: "success",
        });
        return asset;
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : "공유 이미지를 만들지 못했어요.";
        setExportError(message);
        trackShareClarityEvent("export_failure", {
          ...sharePayload(),
          result: "failure",
          failureKind: classifyExportFailure(error),
        });
        throw error;
      })
      .finally(() => {
        exportPromiseRef.current = null;
        exportKeyRef.current = null;
      });

    exportPromiseRef.current = next;
    exportKeyRef.current = key;
    return next;
  }

  async function handleNativeShare() {
    if (activeExportAction) return;
    setActiveExportAction("share");
    try {
      const asset = await ensureGeneratedAsset();
      const file = new File([asset.blob], exportFileName(model.chapterName, normalizedStyle.format), { type: "image/png" });
      if (typeof navigator !== "undefined" && typeof navigator.share === "function" && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: model.chapterName,
          text: activeChapter.visibility === "public" && publicUrl ? publicUrl : undefined,
        });
        notify("공유할 이미지를 준비했어요.");
      } else {
        downloadObjectUrl(asset.objectUrl, exportFileName(model.chapterName, normalizedStyle.format));
        notify("기기 공유가 없어 파일로 내려받았어요.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        notify(error instanceof Error ? error.message : "공유 이미지를 만들지 못했어요.");
      }
    } finally {
      setActiveExportAction(null);
    }
  }

  async function handleDownload() {
    if (activeExportAction) return;
    setActiveExportAction("download");
    try {
      const asset = await ensureGeneratedAsset();
      downloadObjectUrl(asset.objectUrl, exportFileName(model.chapterName, normalizedStyle.format));
      notify("이미지를 내려받았어요.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "공유 이미지를 만들지 못했어요.");
    } finally {
      setActiveExportAction(null);
    }
  }

  async function handleCopyPublicLink() {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      trackShareClarityEvent("link_copy_success", sharePayload());
      notify("공개 링크를 복사했어요.");
    } catch {
      trackShareClarityEvent("link_copy_failure", {
        ...sharePayload(),
        failureKind: "clipboard",
      });
      notify("링크를 복사하지 못했어요.");
    }
  }

  function handleMakePublic() {
    if (activeChapter.visibility === "public") return;
    const confirmed = window.confirm("공개하면 탐색과 링크에서 이 챕터를 볼 수 있어요. 공개하고 링크 공유를 열까요?");
    if (!confirmed) return;
    trackShareClarityEvent("visibility_conversion_confirmed", sharePayload());
    commit(
      updateCube(archive, activeChapter.id, { visibility: "public" }),
      "챕터를 공개하고 링크 공유를 준비했어요.",
    );
  }

  return (
    <div className="page-content chapter-share-view">
      <PageHeader
        eyebrow={activeChapter.visibility === "public" ? "PUBLIC SHARE" : "PRIVATE EXPORT"}
        title="챕터 공유/꾸미기"
        description={activeChapter.visibility === "public"
          ? "형식과 분위기를 다듬고, 이미지와 링크를 함께 준비하세요."
          : "비공개 챕터는 이미지로만 저장하거나 공유할 수 있어요."}
      />

      <section className="chapter-share-summary">
        <div className="chapter-share-summary-cover">
          <ChapterCover archive={archive} chapter={chapter} />
        </div>
        <div className="chapter-share-summary-copy">
          <span className="section-label">{availableTracks.length}곡</span>
          <strong>{formatChapterTitle(activeChapter)}</strong>
          {activeChapter.description ? <p>{activeChapter.description}</p> : null}
        </div>
      </section>

      <section className="chapter-share-preview-section">
        <div className="chapter-share-preview-head">
          <div>
            <h2>실시간 미리보기</h2>
            <p>{normalizedStyle.format === "story" ? "1080 × 1920" : "1080 × 1350"} · {resolvedTracks.length}곡</p>
          </div>
          <span className={`chapter-share-mode-badge is-${renderMode}`}>{renderMode === "public-share" ? "링크 포함 가능" : "이미지 전용"}</span>
        </div>
        <div className="chapter-share-preview-device">
          <div className={`chapter-share-preview-card is-${normalizedStyle.format}`}>
            <div className="chapter-share-preview-svg" dangerouslySetInnerHTML={{ __html: previewSvg }} />
          </div>
        </div>
        {activeChapter.visibility !== "public" ? (
          <div className="chapter-share-private-note">
            <ImageIcon size={16} aria-hidden="true" />
            <p>비공개 챕터에서는 링크와 태그가 이미지에 포함되지 않아요. 제목, 아티스트, 선택한 기록 사진은 그대로 유지됩니다.</p>
          </div>
        ) : null}
      </section>

      <ShareChoiceGroup
        title="형식"
        value={normalizedStyle.format}
        items={SHARE_FORMATS}
        onSelect={(format) => updateStyle({ format })}
        label={formatLabel}
      />
      <ShareChoiceGroup
        title="레이아웃"
        value={normalizedStyle.layout}
        items={SHARE_LAYOUTS}
        onSelect={(layout) => updateStyle({ layout })}
        label={layoutLabel}
      />
      <ShareChoiceGroup
        title="분위기"
        value={normalizedStyle.mood}
        items={SHARE_MOODS}
        onSelect={(mood) => updateStyle({ mood })}
        label={moodLabel}
      />
      <ShareChoiceGroup
        title="장식"
        value={normalizedStyle.decorationLevel}
        items={SHARE_DECORATION_LEVELS}
        onSelect={(decorationLevel) => updateStyle({ decorationLevel })}
        label={decorationLabel}
      />
      <ShareChoiceGroup
        title="이미지 모드"
        value={normalizedStyle.trackImageMode}
        items={SHARE_TRACK_IMAGE_MODES}
        onSelect={(trackImageMode) => updateStyle({ trackImageMode })}
        label={imageModeLabel}
      />

      <section className="chapter-share-section">
        <div className="chapter-share-section-head">
          <h2>한 줄 설명</h2>
          <span>{normalizedStyle.description.length} / {SHARE_DESCRIPTION_MAX_LENGTH}</span>
        </div>
        <input
          className="input"
          maxLength={SHARE_DESCRIPTION_MAX_LENGTH}
          placeholder="이 챕터의 결을 한 줄로 남겨 보세요"
          value={normalizedStyle.description}
          onChange={(event) => updateStyle({ description: event.target.value })}
        />
      </section>

      <section className="chapter-share-section">
        <div className="chapter-share-section-head">
          <h2>표시 정보</h2>
        </div>
        <div className="chapter-share-toggle-grid">
          <label><input type="checkbox" checked={normalizedStyle.showTags} onChange={(event) => updateStyle({ showTags: event.target.checked })} />태그</label>
          <label><input type="checkbox" checked={normalizedStyle.showAuthor} onChange={(event) => updateStyle({ showAuthor: event.target.checked })} />작성자</label>
          <label><input type="checkbox" checked={normalizedStyle.showTrackCount} onChange={(event) => updateStyle({ showTrackCount: event.target.checked })} />곡 수</label>
          <label className={activeChapter.visibility !== "public" ? "is-disabled" : ""}>
            <input
              type="checkbox"
              checked={normalizedStyle.showPublicLink}
              disabled={activeChapter.visibility !== "public"}
              onChange={(event) => updateStyle({ showPublicLink: event.target.checked })}
            />
            공개 링크
          </label>
        </div>
      </section>

      <section className="chapter-share-section">
        <div className="chapter-share-section-head">
          <div>
            <h2>곡 선택</h2>
            <p>{normalizedStyle.selectedTrackIds.length} / {selectionCap}곡</p>
          </div>
          <button
            className="text-button"
            type="button"
            onClick={() => updateStyle({ selectedTrackIds: [] })}
          >
            추천으로 다시 고르기
          </button>
        </div>
        <div className="chapter-share-selected-list" aria-label="선택한 곡 순서">
          {selectedTracks.map((track, index) => (
            <article className="chapter-share-track-row is-selected" key={track.id}>
              <div className="chapter-share-track-copy">
                <span className="chapter-share-track-index">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{track.track.title}</strong>
                  <span>{track.track.artist}</span>
                </div>
              </div>
              <div className="chapter-share-track-actions">
                <button type="button" onClick={() => moveSelectedTrack(track.id, -1)} disabled={index === 0} aria-label={`${track.track.title} 위로 이동`}>
                  <MoveVertical size={15} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => moveSelectedTrack(track.id, 1)} disabled={index === selectedTracks.length - 1} aria-label={`${track.track.title} 아래로 이동`}>
                  <MoveVertical size={15} aria-hidden="true" />
                </button>
                <button type="button" onClick={() => toggleTrack(track.id)}>제외</button>
              </div>
            </article>
          ))}
        </div>
        <div className="chapter-share-track-bank" aria-label="챕터 전체 곡">
          {availableTracks.map((track) => {
            const selected = normalizedStyle.selectedTrackIds.includes(track.id);
            return (
              <button
                key={track.id}
                className={`chapter-share-track-pill${selected ? " is-active" : ""}`}
                type="button"
                onClick={() => toggleTrack(track.id)}
                aria-pressed={selected}
              >
                <span>{track.track.title}</span>
                <small>{track.track.artist}</small>
              </button>
            );
          })}
        </div>
      </section>

      <section className="chapter-share-section chapter-share-export-section">
        <div className="chapter-share-section-head">
          <div>
            <h2>완료</h2>
            <p>이미지를 만들고, 필요하면 링크도 함께 건네세요.</p>
          </div>
        </div>
        <div className="chapter-share-export-actions">
          <button className="button button-primary" type="button" onClick={() => { void handleNativeShare(); }} disabled={activeExportAction !== null}>
            <Share2 size={16} aria-hidden="true" />
            {activeExportAction === "share" ? "준비 중…" : "파일 공유"}
          </button>
          <button className="button" type="button" onClick={() => { void handleDownload(); }} disabled={activeExportAction !== null}>
            <Download size={16} aria-hidden="true" />
            {activeExportAction === "download" ? "내리는 중…" : "다운로드"}
          </button>
          {activeChapter.visibility === "public" ? (
            <button className="button" type="button" onClick={() => { void handleCopyPublicLink(); }}>
              <Link2 size={16} aria-hidden="true" />
              링크 복사
            </button>
          ) : (
            <button className="button" type="button" onClick={handleMakePublic}>
              <Unlock size={16} aria-hidden="true" />
              공개하고 링크 공유
            </button>
          )}
        </div>
        {activeChapter.visibility !== "public" ? (
          <p className="chapter-share-private-cta">
            비공개를 유지하려면 이미지로만 저장하세요. 링크가 필요하면 위 버튼으로 공개 전환을 먼저 확인해야 합니다.
          </p>
        ) : (
          <div className="chapter-share-link-note">
            <ExternalLink size={16} aria-hidden="true" />
            <p>인스타그램 스토리에서 링크 스티커를 추가한 뒤, 방금 복사한 공개 링크를 붙여 넣으세요.</p>
          </div>
        )}
        {exportError ? <p className="field-error" role="alert">{exportError}</p> : null}
      </section>

      <section className="chapter-share-footer-note">
        <Sparkles size={16} aria-hidden="true" />
        <p>이 화면에서 바꾼 형식, 곡 순서, 토글은 자동으로 저장되어 다음에 다시 열어도 이어집니다.</p>
      </section>
    </div>
  );
}
