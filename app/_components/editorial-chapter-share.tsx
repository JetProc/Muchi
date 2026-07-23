"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Download,
  ChevronLeft,
  ChevronRight,
  MoveVertical,
  Share2,
  Sparkles,
} from "lucide-react";
import {
  type Cube,
  getCubeTracks,
  isUserVisibleChapter,
  updateCube,
  type ArchiveEnvelopeV1,
} from "@/lib/archive";
import {
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
} from "@/lib/share";
import {
  SHARE_DECORATION_LEVELS,
  SHARE_FORMATS,
  SHARE_LAYOUTS,
  SHARE_MOODS,
  type ShareDecorationLevel,
} from "@/lib/share/types";
import { MotionLink as Link } from "./editorial-motion";
import { getOwnedRecordPhotoUrl } from "./editorial-media";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { EmptyState, PageHeader } from "./editorial-ui";
import { formatChapterTitle, formatTrackArtist, isVisibleChapter } from "./editorial-format";

type GeneratedShareAsset = {
  key: string;
  blob: Blob;
  objectUrl: string;
};

const SHARE_EDITOR_STEPS = [
  { id: "layout", label: "구성" },
  { id: "mood", label: "분위기" },
  { id: "tracks", label: "곡" },
  { id: "details", label: "정보" },
  { id: "complete", label: "완료" },
] as const;

const INSTAGRAM_TRACK_IMAGE_MODES = ["all", "none"] as const;
const INSTAGRAM_SHARE_DESCRIPTION_MAX_LENGTH = 60;

type ShareEditorStep = (typeof SHARE_EDITOR_STEPS)[number]["id"];

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
  if (mood === "paper") return "라이트";
  if (mood === "night") return "다크";
  return "커스텀";
}

function decorationLabel(level: ShareDecorationLevel): string {
  if (level === "none") return "절제";
  if (level === "light") return "기본";
  return "풍성";
}

function imageModeLabel(mode: (typeof INSTAGRAM_TRACK_IMAGE_MODES)[number]): string {
  if (mode === "all") return "모든 곡";
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
  authorName,
  commit,
  notify,
}: {
  archive: ArchiveEnvelopeV1;
  chapter: Cube;
  availableTracks: ShareTrackInput[];
  initialStyle: NormalizedChapterShareStyle;
  authorName?: string | null;
  commit: ArchiveCommit;
  notify: Notify;
}) {
  const [hasLocalChanges, setHasLocalChanges] = useState(false);
  const [style, setStyle] = useState<NormalizedChapterShareStyle>(initialStyle);
  const [activeExportAction, setActiveExportAction] = useState<"share" | "download" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [generatedAsset, setGeneratedAsset] = useState<GeneratedShareAsset | null>(null);
  const [activeStep, setActiveStep] = useState<ShareEditorStep>("layout");
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
    publicUrl: null,
    renderMode,
    chapterCoverImageUrl: activeChapter.coverImageUrl ?? null,
    style: normalizedStyle,
    tracks: resolvedTracks,
  }), [activeChapter, authorName, normalizedStyle, renderMode, resolvedTracks]);
  const previewSvg = useMemo(() => renderShareCardSvg(model), [model]);
  const activeStepIndex = SHARE_EDITOR_STEPS.findIndex((step) => step.id === activeStep);
  const orderedTracks = [
    ...selectedTracks,
    ...availableTracks.filter((track) => !normalizedStyle.selectedTrackIds.includes(track.id)),
  ];
  const instagramTrackImageMode = normalizedStyle.trackImageMode === "none" ? "none" : "all";

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
    };
  }

  async function ensureGeneratedAsset(): Promise<GeneratedShareAsset> {
    const key = JSON.stringify({
      renderMode,
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

  function moveStep(direction: -1 | 1) {
    const next = SHARE_EDITOR_STEPS[activeStepIndex + direction];
    if (next) setActiveStep(next.id);
  }

  return (
    <div className="page-content chapter-share-view" data-tour="share">
      <PageHeader
        title="인스타그램 공유"
      />

      <div className="chapter-share-workspace">
        <section className="chapter-share-preview-section">
          <div className="chapter-share-preview-device">
            <div className={`chapter-share-preview-card is-${normalizedStyle.format}`}>
              <div className="chapter-share-preview-svg" dangerouslySetInnerHTML={{ __html: previewSvg }} />
            </div>
          </div>
        </section>

        <section className="chapter-share-controls" aria-label="공유 이미지 설정">
          <nav className="chapter-share-step-nav" aria-label="설정 단계">
            {SHARE_EDITOR_STEPS.map((step, index) => (
              <button
                className={`chapter-share-step${activeStep === step.id ? " is-active" : ""}`}
                type="button"
                key={step.id}
                onClick={() => setActiveStep(step.id)}
                aria-current={activeStep === step.id ? "step" : undefined}
              >
                <span>{index + 1}</span>{step.label}
              </button>
            ))}
          </nav>
          {activeStep === "layout" ? (
            <div className="chapter-share-step-content">
              <ShareChoiceGroup title="형식" value={normalizedStyle.format} items={SHARE_FORMATS} onSelect={(format) => updateStyle({ format })} label={formatLabel} />
              <ShareChoiceGroup title="레이아웃" value={normalizedStyle.layout} items={SHARE_LAYOUTS} onSelect={(layout) => updateStyle({ layout })} label={layoutLabel} />
            </div>
          ) : null}

          {activeStep === "mood" ? (
            <div className="chapter-share-step-content">
              <ShareChoiceGroup title="분위기" value={normalizedStyle.mood} items={SHARE_MOODS} onSelect={(mood) => updateStyle({ mood })} label={moodLabel} />
              {normalizedStyle.mood === "film" ? (
                <section className="chapter-share-section chapter-share-custom-color" aria-label="커스텀 배경색">
                  <div className="chapter-share-section-head">
                    <div>
                      <h2>배경색</h2>
                      <p>텍스트 색상과 카드 대비는 자동으로 맞춰져요.</p>
                    </div>
                    <output htmlFor="chapter-share-custom-color">{normalizedStyle.customColor}</output>
                  </div>
                  <label htmlFor="chapter-share-custom-color">
                    <input
                      id="chapter-share-custom-color"
                      type="color"
                      value={normalizedStyle.customColor ?? "#6f5bff"}
                      onInput={(event) => updateStyle({ customColor: event.currentTarget.value })}
                    />
                    <span>색상 선택</span>
                  </label>
                </section>
              ) : null}
              <ShareChoiceGroup title="장식" value={normalizedStyle.decorationLevel} items={SHARE_DECORATION_LEVELS} onSelect={(decorationLevel) => updateStyle({ decorationLevel })} label={decorationLabel} />
            </div>
          ) : null}

          {activeStep === "tracks" ? (
            <div className="chapter-share-step-content">
              <ShareChoiceGroup title="이미지 모드" value={instagramTrackImageMode} items={INSTAGRAM_TRACK_IMAGE_MODES} onSelect={(trackImageMode) => updateStyle({ trackImageMode })} label={imageModeLabel} />
              <section className="chapter-share-section">
                <div className="chapter-share-section-head">
                  <div>
                    <h2>곡 선택</h2>
                    <p>{normalizedStyle.selectedTrackIds.length} / {selectionCap}곡</p>
                  </div>
                  <button className="text-button" type="button" onClick={() => updateStyle({ selectedTrackIds: [] })}>추천으로 다시 고르기</button>
                </div>
                <div className="chapter-share-track-list" aria-label="곡 선택 및 순서">
                  {orderedTracks.map((track) => {
                    const index = normalizedStyle.selectedTrackIds.indexOf(track.id);
                    const selected = index >= 0;
                    return (
                    <article className={`chapter-share-track-row${selected ? " is-selected" : ""}`} key={track.id}>
                      <div className="chapter-share-track-copy">
                        <span className="chapter-share-track-index">{selected ? String(index + 1).padStart(2, "0") : "—"}</span>
                        <div><strong>{track.track.title}</strong><span>{formatTrackArtist(track.track)}</span></div>
                      </div>
                      <div className="chapter-share-track-actions">
                        {selected ? <>
                          <button type="button" onClick={() => moveSelectedTrack(track.id, -1)} disabled={index === 0} aria-label={`${track.track.title} 위로 이동`}><MoveVertical size={15} aria-hidden="true" /></button>
                          <button type="button" onClick={() => moveSelectedTrack(track.id, 1)} disabled={index === selectedTracks.length - 1} aria-label={`${track.track.title} 아래로 이동`}><MoveVertical size={15} aria-hidden="true" /></button>
                        </> : null}
                        <button type="button" onClick={() => toggleTrack(track.id)}>{selected ? "제외" : "선택"}</button>
                      </div>
                    </article>
                    );
                  })}
                </div>
              </section>
            </div>
          ) : null}

          {activeStep === "details" ? (
            <div className="chapter-share-step-content">
              <section className="chapter-share-section">
                <div className="chapter-share-section-head"><h2>한 줄 설명</h2><span>{normalizedStyle.description.length} / {INSTAGRAM_SHARE_DESCRIPTION_MAX_LENGTH}</span></div>
                <input className="input" maxLength={INSTAGRAM_SHARE_DESCRIPTION_MAX_LENGTH} placeholder="이 챕터의 결을 한 줄로 남겨 보세요" value={normalizedStyle.description} onChange={(event) => updateStyle({ description: event.target.value })} />
              </section>
              <section className="chapter-share-section">
                <div className="chapter-share-section-head"><h2>표시 정보</h2></div>
                <div className="chapter-share-toggle-grid">
                  <label><input type="checkbox" checked={normalizedStyle.showTags} onChange={(event) => updateStyle({ showTags: event.target.checked })} />태그</label>
                  <label><input type="checkbox" checked={normalizedStyle.showAuthor} onChange={(event) => updateStyle({ showAuthor: event.target.checked })} />작성자</label>
                  <label><input type="checkbox" checked={normalizedStyle.showTrackCount} onChange={(event) => updateStyle({ showTrackCount: event.target.checked })} />곡 수</label>
                </div>
              </section>
            </div>
          ) : null}

          {activeStep === "complete" ? <section className="chapter-share-section chapter-share-export-section">
            <div className="chapter-share-section-head">
          <div>
            <h2>완료</h2>
            <p>이미지를 저장하거나 인스타그램으로 공유한 뒤, 챕터에서 기록을 계속해 보세요.</p>
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
          <Link className="button" href={`/chapter?id=${encodeURIComponent(activeChapter.id)}`} intent="back">
            챕터로 돌아가기
          </Link>
        </div>
        {exportError ? <p className="field-error" role="alert">{exportError}</p> : null}
          </section> : null}

          <div className="chapter-share-step-actions">
            <button className="button" type="button" onClick={() => moveStep(-1)} disabled={activeStepIndex === 0}><ChevronLeft size={16} aria-hidden="true" />이전</button>
            {activeStepIndex < SHARE_EDITOR_STEPS.length - 1 ? <button className="button button-primary" type="button" onClick={() => moveStep(1)}>다음<ChevronRight size={16} aria-hidden="true" /></button> : null}
          </div>
        </section>
      </div>

      <section className="chapter-share-footer-note">
        <Sparkles size={16} aria-hidden="true" />
        <p>이 화면에서 바꾼 형식, 곡 순서, 토글은 자동으로 저장되어 다음에 다시 열어도 이어집니다.</p>
      </section>
    </div>
  );
}
