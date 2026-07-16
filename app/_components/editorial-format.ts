import type { CSSProperties } from "react";
import {
  getCubeAncestors,
  getCubeTracks,
  type ArchiveEnvelopeV1,
  type Cube,
  type CubeColor,
  type MemoryPeriod,
  type TagCategory,
} from "@/lib/archive";

export const COLOR_HEX: Record<CubeColor, string> = {
  violet: "#8c9ae0",
  cyan: "#9ab6c8",
  coral: "#d77a7a",
  amber: "#e6915d",
  mint: "#c0d4a7",
  blue: "#a5b8c0",
};

export const COLOR_LABEL: Record<CubeColor, string> = {
  violet: "말린 자두",
  cyan: "비 온 뒤",
  coral: "붉은 잔상",
  amber: "오래된 종이",
  mint: "바랜 초록",
  blue: "깊은 밤",
};

export const TAG_CATEGORY_LABEL: Record<TagCategory, string> = {
  genre: "장르",
  emotion: "감정·상황",
  energy: "감정",
  texture: "감정",
  situation: "감정·상황",
  custom: "커스텀",
};

export const SEASON_LABEL = {
  spring: "봄",
  summer: "여름",
  autumn: "가을",
  winter: "겨울",
} as const;

export function formatDate(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function formatCalendarDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function formatMemory(period: MemoryPeriod): string {
  if (!period) return "시기 미기록";
  const year = period.year ? `${period.year}년 ` : "";
  return period.kind === "month"
    ? `${year}${period.month}월`
    : `${year}${SEASON_LABEL[period.season]}`;
}

const MONTHLY_CHAPTER_ID = /^month:(\d{4})-(\d{2})$/;

export function isMonthlyChapter(chapter: Cube): boolean {
  return MONTHLY_CHAPTER_ID.test(chapter.id);
}

export function isAssignableChapter(chapter: Cube): boolean {
  return !isMonthlyChapter(chapter);
}

export function formatChapterTitle(chapter: Cube): string {
  const match = MONTHLY_CHAPTER_ID.exec(chapter.id);
  if (!match) return chapter.name;
  return `${match[1]}년 ${Number(match[2])}월`;
}

export function formatChapterPath(
  archive: ArchiveEnvelopeV1,
  chapter: Cube,
): string {
  return [...getCubeAncestors(archive, chapter.id), chapter]
    .map(formatChapterTitle)
    .join(" / ");
}

export function isVisibleChapter(
  archive: ArchiveEnvelopeV1,
  chapter: Cube,
): boolean {
  return !isMonthlyChapter(chapter) || getCubeTracks(archive, chapter.id).length > 0;
}

export function chapterColorStyle(
  color: CubeColor,
): CSSProperties & { "--cube-color": string } {
  return { "--cube-color": COLOR_HEX[color] };
}
