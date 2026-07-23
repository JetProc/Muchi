import type { AffectionLevel, ChapterVisibility, RecordVisibility, TrackReference } from "@/lib/archive";
import {
  CHAPTER_SHARE_DECORATION_LEVELS,
  CHAPTER_SHARE_FONTS,
  CHAPTER_SHARE_FORMATS,
  CHAPTER_SHARE_LAYOUTS,
  CHAPTER_SHARE_LIMITS,
  CHAPTER_SHARE_MOODS,
  CHAPTER_SHARE_TRACK_IMAGE_MODES,
  type ChapterShareDecorationLevel,
  type ChapterShareFont,
  type ChapterShareFormat,
  type ChapterShareLayout,
  type ChapterShareMood,
  type ChapterShareStyle as PersistedChapterShareStyle,
  type ChapterShareTrackImageMode,
} from "@/lib/chapter-share-contract";

export const SHARE_FORMATS = CHAPTER_SHARE_FORMATS;
export const SHARE_LAYOUTS = CHAPTER_SHARE_LAYOUTS;
export const SHARE_MOODS = CHAPTER_SHARE_MOODS;
export const SHARE_DECORATION_LEVELS = CHAPTER_SHARE_DECORATION_LEVELS;
export const SHARE_FONTS = CHAPTER_SHARE_FONTS;
export const SHARE_TRACK_IMAGE_MODES = CHAPTER_SHARE_TRACK_IMAGE_MODES;
export const SHARE_RENDER_MODES = ["public-share", "private-image-only"] as const;
export const SHARE_DISPLAY_IMAGE_SOURCES = ["custom", "artwork", "cover-fallback", "muchi-fallback"] as const;

export type ShareFormat = ChapterShareFormat;
export type ShareLayout = ChapterShareLayout;
export type ShareMood = ChapterShareMood;
export type ShareDecorationLevel = ChapterShareDecorationLevel;
export type ShareFont = ChapterShareFont;
export type ShareTrackImageMode = ChapterShareTrackImageMode;
export type ShareRenderMode = (typeof SHARE_RENDER_MODES)[number];
export type ShareDisplayImageSource = (typeof SHARE_DISPLAY_IMAGE_SOURCES)[number];

export type ChapterShareStyle = PersistedChapterShareStyle;

export type NormalizedChapterShareStyle = Readonly<ChapterShareStyle & {
  font: ShareFont;
  showDescription: boolean;
}>;

export type ShareCardDimensions = Readonly<{
  width: number;
  height: number;
}>;

export const SHARE_EXPORT_DIMENSIONS: Record<ShareFormat, ShareCardDimensions> = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
};

export const SHARE_LAYOUT_CAPS: Record<ShareFormat, Record<ShareLayout, number>> = {
  story: {
    cover: 5,
    "photo-tracklist": 12,
    "compact-tracklist": 18,
  },
  feed: {
    cover: 5,
    "photo-tracklist": 8,
    "compact-tracklist": 12,
  },
};

export const SHARE_MAX_SELECTED_TRACKS = Math.max(
  ...Object.values(SHARE_LAYOUT_CAPS).flatMap((caps) => Object.values(caps)),
);

export const SHARE_DESCRIPTION_MAX_LENGTH = CHAPTER_SHARE_LIMITS.description;

export interface ShareDisplayImageView {
  readonly url: string;
  readonly source: ShareDisplayImageSource;
  readonly alt: string;
}

export interface ShareTrackInput {
  readonly id: string;
  readonly track: TrackReference;
  readonly sortOrder: number;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly recordVisibility: RecordVisibility;
  readonly tags: readonly string[];
  readonly note: string | null;
  readonly affection: AffectionLevel | null;
  readonly customImageUrl: string | null;
}

export interface ResolvedShareTrack extends ShareTrackInput {
  readonly displayImage: ShareDisplayImageView;
}

export interface ResolveShareTrackImageOptions {
  readonly chapterCoverImageUrl?: string | null;
  readonly fallbackImageUrl?: string | null;
  readonly renderMode: ShareRenderMode;
}

export interface ShareSelectionCandidate extends ShareTrackInput {
  readonly displayImageSource?: ShareDisplayImageSource | null;
}

export interface ShareSelectionOptions {
  readonly format: ShareFormat;
  readonly layout: ShareLayout;
  readonly pinnedTrackIds?: readonly string[];
}

export interface ShareCardModel {
  readonly chapterId: string;
  readonly chapterName: string;
  readonly chapterDescription: string;
  readonly chapterVisibility: ChapterVisibility;
  readonly authorName: string | null;
  readonly authorHeadline?: string | null;
  readonly publicUrl: string | null;
  readonly renderMode: ShareRenderMode;
  readonly chapterCoverImageUrl: string | null;
  readonly fallbackImageUrl?: string | null;
  readonly style: NormalizedChapterShareStyle;
  readonly tracks: readonly ResolvedShareTrack[];
}

export interface ShareCardRenderContent {
  readonly showTags: boolean;
  readonly showAuthor: boolean;
  readonly showTrackCount: boolean;
  readonly showDescription: boolean;
  readonly showPublicLink: boolean;
}

export interface ShareCardExportRequest {
  readonly model: ShareCardModel;
  readonly cacheKey?: string;
  readonly assetTimeoutMs?: number;
  readonly normalizeAssetUrl?: (
    url: string,
    context: { kind: "chapter-cover" | "track-image"; trackId?: string },
  ) => string;
}

export interface ShareCardExportResult {
  readonly blob: Blob;
  readonly width: number;
  readonly height: number;
  readonly svg: string;
}

export type ShareClarityEventName =
  | "editor_open"
  | "export_start"
  | "export_success"
  | "export_failure"
  | "link_copy_success"
  | "link_copy_failure"
  | "visibility_conversion_confirmed";

export type ShareClarityPayload = {
  readonly chapterVisibility?: ChapterVisibility;
  readonly renderMode?: ShareRenderMode;
  readonly format?: ShareFormat;
  readonly layout?: ShareLayout;
  readonly mood?: ShareMood;
  readonly decorationLevel?: ShareDecorationLevel;
  readonly trackImageMode?: ShareTrackImageMode;
  readonly selectedTrackCount?: number;
  readonly chapterTrackCount?: number;
  readonly exportedTrackCount?: number;
  readonly hasPublicLink?: boolean;
  readonly result?: "success" | "fallback" | "failure";
  readonly failureKind?: "timeout" | "asset" | "canvas" | "clipboard" | "native-share" | "unknown";
};
