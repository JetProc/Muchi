import type { CSSProperties } from "react";
import type {
  CubeColor,
  MemoryPeriod,
  TagCategory,
} from "@/lib/archive";

export const COLOR_HEX: Record<CubeColor, string> = {
  violet: "#6e2d4c",
  cyan: "#647b78",
  coral: "#a64b3d",
  amber: "#b68b4c",
  mint: "#6f7b62",
  blue: "#47586e",
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
  emotion: "감정",
  energy: "감정",
  texture: "감정",
  situation: "상황",
  period: "시기",
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

export function formatMemory(period: MemoryPeriod): string {
  if (!period) return "시기 미기록";
  const year = period.year ? `${period.year}년 ` : "";
  return period.kind === "month"
    ? `${year}${period.month}월`
    : `${year}${SEASON_LABEL[period.season]}`;
}

export function chapterColorStyle(
  color: CubeColor,
): CSSProperties & { "--cube-color": string } {
  return { "--cube-color": COLOR_HEX[color] };
}
