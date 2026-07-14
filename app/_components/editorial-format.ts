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

export const TAG_SUGGESTIONS: Array<{ label: string; category: TagCategory }> = [
  { label: "그리운", category: "emotion" },
  { label: "따뜻한", category: "emotion" },
  { label: "불안한", category: "emotion" },
  { label: "질주하는", category: "energy" },
  { label: "몽환적인", category: "texture" },
  { label: "차가운", category: "texture" },
  { label: "도시적인", category: "situation" },
  { label: "새벽", category: "period" },
  { label: "드라이브", category: "situation" },
  { label: "여름밤", category: "period" },
  { label: "인디 록", category: "genre" },
  { label: "청춘", category: "custom" },
];

export const TAG_CATEGORY_LABEL: Record<TagCategory, string> = {
  genre: "장르",
  emotion: "감정",
  energy: "에너지",
  texture: "질감",
  situation: "상황",
  period: "시기",
  custom: "나만의 언어",
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
