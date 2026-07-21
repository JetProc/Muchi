export const TAG_STARTER_PACKS = [
  {
    id: "genre",
    title: "장르",
    description: "자주 듣는 음악 스타일",
    tags: ["팝", "록", "힙합", "R&B", "재즈", "클래식"],
  },
  {
    id: "situation",
    title: "상황",
    description: "일상에서 음악을 찾는 순간",
    tags: ["이동할 때", "운동할 때", "일할 때", "공부할 때", "쉴 때", "잠들기 전"],
  },
  {
    id: "season",
    title: "계절",
    description: "계절마다 다시 듣고 싶은 음악",
    tags: ["봄에 듣기 좋은 곡", "여름에 듣기 좋은 곡", "가을에 듣기 좋은 곡", "겨울에 듣기 좋은 곡"],
  },
  {
    id: "time",
    title: "시간",
    description: "하루의 시간대와 어울리는 음악",
    tags: ["아침에 듣는 곡", "낮에 듣는 곡", "저녁에 듣는 곡", "새벽에 듣는 곡"],
  },
  {
    id: "instrument",
    title: "악기",
    description: "귀에 먼저 들어오는 사운드",
    tags: ["베이스가 돋보이는 곡", "드럼이 신나는 곡", "기타 리프가 좋은 곡", "피아노가 돋보이는 곡", "신스 사운드가 좋은 곡"],
  },
] as const;

export type TagStarterPackId = typeof TAG_STARTER_PACKS[number]["id"];

export function getStarterTagLabels(packIds: readonly TagStarterPackId[]): string[] {
  const selected = new Set(packIds);
  return TAG_STARTER_PACKS
    .filter((pack) => selected.has(pack.id))
    .flatMap((pack) => [...pack.tags]);
}
