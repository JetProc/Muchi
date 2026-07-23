export const CHAPTER_SHARE_FORMATS = ["story", "feed"] as const;
export const CHAPTER_SHARE_LAYOUTS = ["cover", "photo-tracklist", "compact-tracklist"] as const;
export const CHAPTER_SHARE_MOODS = ["paper", "night", "film"] as const;
export const CHAPTER_SHARE_DECORATION_LEVELS = ["none", "light", "rich"] as const;
export const CHAPTER_SHARE_TRACK_IMAGE_MODES = ["all", "featured", "cover-only", "none"] as const;
export const CHAPTER_SHARE_LIMITS = {
  description: 120,
  selectedTrackIds: 18,
} as const;

export type ChapterShareFormat = (typeof CHAPTER_SHARE_FORMATS)[number];
export type ChapterShareLayout = (typeof CHAPTER_SHARE_LAYOUTS)[number];
export type ChapterShareMood = (typeof CHAPTER_SHARE_MOODS)[number];
export type ChapterShareDecorationLevel = (typeof CHAPTER_SHARE_DECORATION_LEVELS)[number];
export type ChapterShareTrackImageMode = (typeof CHAPTER_SHARE_TRACK_IMAGE_MODES)[number];

export interface ChapterShareStyle {
  format: ChapterShareFormat;
  layout: ChapterShareLayout;
  mood: ChapterShareMood;
  decorationLevel: ChapterShareDecorationLevel;
  trackImageMode: ChapterShareTrackImageMode;
  selectedTrackIds: string[];
  description: string;
  showTags: boolean;
  showAuthor: boolean;
  showTrackCount: boolean;
  showPublicLink: boolean;
}
