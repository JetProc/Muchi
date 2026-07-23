import { autoSelectShareTrackIds } from "@/lib/share/selection";
import {
  SHARE_DECORATION_LEVELS,
  SHARE_DESCRIPTION_MAX_LENGTH,
  SHARE_FONTS,
  SHARE_FORMATS,
  SHARE_LAYOUTS,
  SHARE_LAYOUT_CAPS,
  SHARE_MAX_SELECTED_TRACKS,
  SHARE_MOODS,
} from "@/lib/share/types";
import type {
  ChapterShareStyle,
  NormalizedChapterShareStyle,
  ShareDecorationLevel,
  ShareFont,
  ShareFormat,
  ShareLayout,
  ShareMood,
  ShareRenderMode,
  ShareSelectionCandidate,
} from "@/lib/share/types";
import type { ChapterVisibility } from "@/lib/archive";

const DEFAULT_SHARE_STYLE: NormalizedChapterShareStyle = {
  format: "story",
  layout: "cover",
  mood: "paper",
  customColor: "#6f5bff",
  decorationLevel: "light",
  font: "modern",
  trackImageMode: "all",
  selectedTrackIds: [],
  description: "",
  showTags: true,
  showAuthor: true,
  showTrackCount: true,
  showDescription: true,
  showPublicLink: true,
};

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

function sanitizeDescription(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, SHARE_DESCRIPTION_MAX_LENGTH);
}

function sanitizeCustomColor(value: unknown): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toLowerCase()
    : DEFAULT_SHARE_STYLE.customColor ?? "#6f5bff";
}

function normalizeSelectedTrackIds(
  ids: unknown,
  validTrackIds: Set<string>,
  maxTrackCount: number,
): string[] {
  if (!Array.isArray(ids) || maxTrackCount <= 0) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const id of ids) {
    if (typeof id !== "string" || seen.has(id) || !validTrackIds.has(id)) continue;
    seen.add(id);
    normalized.push(id);
    if (normalized.length >= maxTrackCount) break;
  }
  return normalized;
}

export function getDefaultChapterShareStyle(): NormalizedChapterShareStyle {
  return {
    ...DEFAULT_SHARE_STYLE,
    selectedTrackIds: [],
  };
}

export function isShareFormat(value: unknown): value is ShareFormat {
  return isOneOf(value, SHARE_FORMATS);
}

export function isShareLayout(value: unknown): value is ShareLayout {
  return isOneOf(value, SHARE_LAYOUTS);
}

export function isShareMood(value: unknown): value is ShareMood {
  return isOneOf(value, SHARE_MOODS);
}

export function isShareDecorationLevel(value: unknown): value is ShareDecorationLevel {
  return isOneOf(value, SHARE_DECORATION_LEVELS);
}

export function isShareFont(value: unknown): value is ShareFont {
  return isOneOf(value, SHARE_FONTS);
}

export function getShareLayoutCap(format: ShareFormat, layout: ShareLayout): number {
  return SHARE_LAYOUT_CAPS[format][layout];
}

export function normalizeChapterShareStyle(
  value: Partial<ChapterShareStyle> | null | undefined,
  options: {
    availableTracks: readonly ShareSelectionCandidate[];
    chapterVisibility: ChapterVisibility;
    renderMode?: ShareRenderMode;
  },
): NormalizedChapterShareStyle {
  const base = getDefaultChapterShareStyle();
  const format = isShareFormat(value?.format) ? value.format : base.format;
  const layout = isShareLayout(value?.layout) ? value.layout : base.layout;
  const mood = isShareMood(value?.mood) ? value.mood : base.mood;
  const decorationLevel = isShareDecorationLevel(value?.decorationLevel)
    ? value.decorationLevel
    : base.decorationLevel;
  const font = isShareFont(value?.font) ? value.font : base.font;
  const validTrackIds = new Set(options.availableTracks.map((track) => track.id));
  const cap = getShareLayoutCap(format, layout);
  const selectedTrackIds = normalizeSelectedTrackIds(value?.selectedTrackIds, validTrackIds, cap);
  const autoSelectedTrackIds = selectedTrackIds.length > 0
    ? selectedTrackIds
    : autoSelectShareTrackIds(options.availableTracks, {
      format,
      layout,
      pinnedTrackIds: Array.isArray(value?.selectedTrackIds)
        ? value?.selectedTrackIds.filter((id): id is string => typeof id === "string").slice(0, SHARE_MAX_SELECTED_TRACKS)
        : [],
    });
  const renderMode = options.renderMode ?? "public-share";
  const allowTags = renderMode === "public-share";

  return {
    format,
    layout,
    mood,
    customColor: sanitizeCustomColor(value?.customColor),
    decorationLevel,
    font,
    trackImageMode: "all",
    selectedTrackIds: autoSelectedTrackIds.slice(0, cap),
    description: sanitizeDescription(value?.description),
    showTags: allowTags && value?.showTags !== false,
    showAuthor: value?.showAuthor !== false,
    showTrackCount: value?.showTrackCount !== false,
    showDescription: value?.showDescription !== false,
    showPublicLink: false,
  };
}
