export const ARCHIVE_SCHEMA_VERSION = 8 as const;
export const ARCHIVE_SEED_VERSION = 2 as const;

export const ARCHIVE_LIMITS = {
  cubeName: 40,
  cubeDescription: 200,
  tagsPerCubeTrack: 20,
  tagLabel: 40,
  character: 100,
  place: 60,
  people: 60,
  memo: 1_000,
  notesPerCubeTrack: 100,
  chapterCoverDataUrl: 1_500_000,
} as const;

export const CUBE_COLORS = [
  "violet",
  "cyan",
  "coral",
  "amber",
  "mint",
  "blue",
] as const;

export const TRACK_PROVIDERS = ["itunes", "spotify", "youtube", "melon"] as const;

const REGISTRATION_MONTH_FORMATTER = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "2-digit",
  timeZone: "Asia/Seoul",
});

export type TrackProvider = (typeof TRACK_PROVIDERS)[number];
export type ItunesTrackId = `itunes:${number}`;
export type TrackId =
  | ItunesTrackId
  | `spotify:${string}`
  | `youtube:${string}`
  | `melon:${string}`;
export type EntitySource = "seed" | "user";
export type CubeColor = (typeof CUBE_COLORS)[number];
export type CubeKind = "manual" | "monthly" | "capture";
export type CubeSystemKey = null | "capture" | `month:${string}`;
export type ChapterVisibility = "private" | "public";
export type RecordVisibility = "private" | "public";
export const SPACE_THEME_IDS = ["paper", "midnight", "moss"] as const;
export const SPACE_LAYOUT_IDS = ["shelf", "folio", "stack"] as const;
export type SpaceThemeId = (typeof SPACE_THEME_IDS)[number];
export type SpaceLayoutId = (typeof SPACE_LAYOUT_IDS)[number];
export type MotionPreference = "system" | "reduce" | "full";
export type Season = "spring" | "summer" | "autumn" | "winter";
export const TAG_CATEGORIES = [
  "genre",
  "emotion",
  "energy",
  "texture",
  "situation",
  "custom",
] as const;
export type TagCategory = (typeof TAG_CATEGORIES)[number];

export type MemoryPeriod =
  | { kind: "month"; year: number | null; month: number }
  | { kind: "season"; year: number | null; season: Season }
  | null;

export interface TrackReference {
  id: TrackId;
  provider: TrackProvider;
  providerTrackId: number | string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  durationMs: number | null;
  artworkUrl: string | null;
  previewUrl: string | null;
  externalUrl: string | null;
  registeredAt?: string;
}

export interface Cube {
  id: string;
  parentId: string | null;
  name: string;
  description: string;
  coverImageUrl: string | null;
  color: CubeColor;
  kind: CubeKind;
  systemKey: CubeSystemKey;
  sortOrder: number;
  source: EntitySource;
  visibility: ChapterVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface CubeTrack {
  id: string;
  cubeId: string;
  trackId: TrackId;
  tagIds: string[];
  character: string;
  memoryPeriod: MemoryPeriod;
  place: string;
  people: string;
  notes: MemoryNote[];
  sortOrder: number;
  source: EntitySource;
  recordVisibility: RecordVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryNote {
  id: string;
  listenedOn: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface TagDefinition {
  id: string;
  label: string;
  normalizedLabel: string;
  category: TagCategory;
  source: EntitySource;
  createdAt: string;
}

export interface InboxEntry {
  trackId: TrackId;
  capturedAt: string;
  source: EntitySource;
}

export interface PersonalSpace {
  themeId: SpaceThemeId;
  layoutId: SpaceLayoutId;
  featuredCubeIds: string[];
}

export interface Preferences {
  motion: MotionPreference;
  recapEnabled: boolean;
  lastCubeId: string | null;
  seedDismissed: boolean;
  country: "KR";
}

export interface ArchiveData {
  tracks: Record<TrackId, TrackReference>;
  cubes: Record<string, Cube>;
  cubeTracks: Record<string, CubeTrack>;
  tags: Record<string, TagDefinition>;
  inbox: Partial<Record<TrackId, InboxEntry>>;
  space: PersonalSpace;
  preferences: Preferences;
}

export interface ArchiveEnvelopeV1 {
  schemaVersion: typeof ARCHIVE_SCHEMA_VERSION;
  seedVersion: typeof ARCHIVE_SEED_VERSION;
  updatedAt: string;
  data: ArchiveData;
}

export type ArchiveDomainErrorCode =
  | "invalid-input"
  | "not-found"
  | "duplicate"
  | "limit-exceeded"
  | "invalid-order";

export type ContextArchiveState =
  | "monthly"
  | "unassigned-archived"
  | "unassigned-draft"
  | "chapter-only"
  | "chapter-archived";

export interface TrackArchiveSummary {
  trackId: TrackId;
  hasInbox: boolean;
  captureState: "unassigned-archived" | "unassigned-draft" | null;
  captureContextId: string | null;
  manualContextStates: Array<{
    cubeTrackId: string;
    cubeId: string;
    state: "chapter-only" | "chapter-archived";
  }>;
  monthlyContextIds: string[];
}

export interface ContextualMemory {
  cubeTrack: CubeTrack;
  cube: Cube;
  tags: TagDefinition[];
}

export interface TagGroup {
  tag: TagDefinition;
  trackCount: number;
  memoryCount: number;
  updatedAt: string | null;
}

export interface TagGroupResult {
  track: TrackReference;
  memories: ContextualMemory[];
}

export class ArchiveDomainError extends Error {
  constructor(
    public readonly code: ArchiveDomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ArchiveDomainError";
  }
}

export interface CreateCubeInput {
  id?: string;
  parentId?: string | null;
  name: string;
  description?: string;
  coverImageUrl?: string | null;
  color?: CubeColor;
  visibility?: ChapterVisibility;
}

export interface UpdateCubeInput {
  parentId?: string | null;
  name?: string;
  description?: string;
  coverImageUrl?: string | null;
  color?: CubeColor;
  visibility?: ChapterVisibility;
}

export interface UpdateCubeTrackInput {
  character?: string;
  memoryPeriod?: MemoryPeriod;
  place?: string;
  people?: string;
}

export interface MemoryNoteInput {
  listenedOn: string;
  body: string;
}

export interface TagInput {
  label: string;
  category?: TagCategory;
}

export interface SearchArchiveOptions {
  query?: string;
  tagIds?: string[];
  tagLabels?: string[];
  tagMatch?: "all" | "any";
  cubeIds?: string[];
  includeInbox?: boolean;
}

export type ArchiveSearchResult =
  | {
      kind: "cube-track";
      track: TrackReference;
      cube: Cube;
      cubeTrack: CubeTrack;
      tags: TagDefinition[];
      matchedNote: MemoryNote | null;
    }
  | {
      kind: "inbox";
      track: TrackReference;
      inbox: InboxEntry;
      tags: [];
    };

export type RecapMode = "this-time" | "timeline" | "random";
export type RecapReason = "same-month" | "same-season" | "saved-date" | "random";

export interface RecapOptions {
  mode?: RecapMode;
  now?: Date | string;
  limit?: number;
  random?: () => number;
}

export interface RecapEntry {
  track: TrackReference;
  cube: Cube;
  cubeTrack: CubeTrack;
  note: MemoryNote;
  tags: TagDefinition[];
  reason: RecapReason;
}

export type MigrationResult =
  | { status: "ok"; archive: ArchiveEnvelopeV1; migrated: boolean }
  | { status: "future-version"; schemaVersion: number }
  | { status: "invalid"; error: string };

export type ParseArchiveResult =
  | { status: "empty" }
  | { status: "ok"; archive: ArchiveEnvelopeV1; migrated: boolean }
  | { status: "future-version"; schemaVersion: number }
  | { status: "invalid"; error: string; raw: string };

const DEFAULT_PREFERENCES: Preferences = {
  motion: "system",
  recapEnabled: true,
  lastCubeId: null,
  seedDismissed: false,
  country: "KR",
};

const DEFAULT_PERSONAL_SPACE: PersonalSpace = {
  themeId: "paper",
  layoutId: "shelf",
  featuredCubeIds: [],
};

const SEED_NOW = "2026-07-01T00:00:00.000Z";
const SEED_MEMORY_FIXTURES: Record<string, ReadonlyArray<{
  listenedOn: string;
  body: string;
}>> = {
  "dawn-radio": [
    { listenedOn: "2023-07-15", body: "새벽 두 시, 신호가 모두 초록색이었던 날. 이 곡의 속도와 도로가 정확히 맞았다." },
    { listenedOn: "2026-07-02", body: "오랜만에 운전하며 들으니 기타보다 드럼이 먼저 앞으로 끌고 갔다." },
  ],
  "dawn-summer": [
    { listenedOn: "2022-07-23", body: "창문을 내리고 따라 부르던 후렴." },
    { listenedOn: "2025-07-12", body: "혼자 달리는 길에서도 그날 친구들의 목소리가 겹쳐 들렸다." },
  ],
  "dawn-psycho": [
    { listenedOn: "2024-08-04", body: "터널에 들어가는 순간 베이스가 더 크게 들렸다." },
    { listenedOn: "2026-06-14", body: "집에 바로 가기 싫어 강변을 한 바퀴 더 돌게 만든 곡." },
  ],
  "past-pinktop": [
    { listenedOn: "2021-06-03", body: "이 밴드를 처음 좋아하게 된 시기의 가장 선명한 곡." },
    { listenedOn: "2026-03-09", body: "한동안 잊고 있었는데 첫 소절만으로 예전 취향이 그대로 돌아왔다." },
  ],
  "past-radio": [
    { listenedOn: "2021-06-18", body: "플레이리스트 맨 위에 두고 거의 매일 들었다." },
    { listenedOn: "2025-11-02", body: "지금은 질주감보다 오래 좋아한 기타 톤이 먼저 들린다." },
  ],
  "past-l": [
    { listenedOn: "2024-07-19", body: "새 앨범을 기다렸다가 이어폰으로 처음부터 끝까지 들은 밤." },
    { listenedOn: "2026-01-24", body: "예전 곡들과는 다른 결인데도 같은 이유로 좋아하고 있다는 걸 알았다." },
  ],
  "winter-radio": [
    { listenedOn: "2018-12-14", body: "같은 Radio지만 이곳에서는 속도보다 온기가 먼저 떠오른다." },
    { listenedOn: "2024-12-21", body: "그때의 불안보다 카페 창가의 노란 불빛이 더 선명해졌다." },
  ],
  "winter-violet": [
    { listenedOn: "2018-12-28", body: "이어폰 한쪽이 자꾸 끊기던 겨울." },
    { listenedOn: "2023-11-30", body: "첫눈을 기다리며 들으니 오래된 버스 창문이 생각났다." },
  ],
  "winter-summer": [
    { listenedOn: "2018-12-31", body: "한겨울에 들은 Summer라서 오히려 그해 여름이 더 멀게 느껴졌다." },
    { listenedOn: "2025-12-07", body: "계절과 반대되는 제목 때문에 당시의 공기가 더 또렷하게 남아 있다." },
  ],
  "workout-tell": [
    { listenedOn: "2024-09-02", body: "러닝머신 속도를 한 단계 올리는 지점이 항상 같은 후렴이었다." },
    { listenedOn: "2026-07-04", body: "운동을 다시 시작한 첫날, 생각보다 몸이 가볍게 움직였다." },
  ],
  "workout-psycho": [
    { listenedOn: "2025-02-11", body: "준비 운동이 끝나고 집중이 붙는 순간에 잘 맞는다." },
    { listenedOn: "2026-06-22", body: "힘이 빠질 때 리듬만 따라가도 마지막 세트를 끝낼 수 있었다." },
  ],
  "workout-pinktop": [
    { listenedOn: "2023-05-16", body: "짧게 뛰는 날에는 첫 곡으로 가장 자주 골랐다." },
    { listenedOn: "2026-05-08", body: "기분까지 바꾸고 싶을 때 선택하는 운동용 곡." },
  ],
  "rain-l": [
    { listenedOn: "2024-07-22", body: "퇴근길 버스 창문에 빗물이 번지던 날 처음 저장했다." },
    { listenedOn: "2026-06-25", body: "비가 오는 날에는 목소리 뒤의 작은 소음까지 편안하게 들린다." },
  ],
  "rain-violet": [
    { listenedOn: "2022-10-03", body: "우산에 떨어지는 소리와 곡의 빈 공간이 잘 맞았다." },
    { listenedOn: "2025-09-18", body: "지친 날에도 서두르지 않고 집까지 걷게 해주는 곡." },
  ],
  "rain-radio": [
    { listenedOn: "2023-11-09", body: "막힌 도로에서는 빠른 곡보다 오히려 차분하게 느껴졌다." },
    { listenedOn: "2026-04-13", body: "같은 곡을 새벽 드라이브와 전혀 다른 이유로 다시 찾았다." },
  ],
  "room-pinktop": [
    { listenedOn: "2021-09-08", body: "이웃이 없을 때만 볼륨을 끝까지 올렸다." },
    { listenedOn: "2025-09-03", body: "지금 들어도 좁은 방을 단숨에 넓혀주는 곡이다." },
  ],
  "room-l": [
    { listenedOn: "2024-07-19", body: "불을 끄고 앨범 한 장을 처음부터 끝까지 듣던 밤." },
    { listenedOn: "2026-06-25", body: "비가 오는 밤에는 목소리 뒤의 작은 소음까지 편안하게 들린다." },
  ],
  "room-summer": [
    { listenedOn: "2021-09-12", body: "아직 가구가 없던 방에서 바닥에 앉아 크게 틀었다." },
    { listenedOn: "2025-07-30", body: "이 곡을 들으면 작은 창문으로 들어오던 늦여름 빛이 생각난다." },
  ],
  "sunday-violet": [
    { listenedOn: "2023-03-19", body: "알람을 끄고 다시 누운 일요일 오전에 우연히 끝까지 들었다." },
    { listenedOn: "2026-05-31", body: "아무 일정이 없을 때 곡의 느슨한 부분까지 잘 들린다." },
  ],
  "sunday-summer": [
    { listenedOn: "2022-05-08", body: "창문을 열고 밀린 빨래를 하며 계속 반복했다." },
    { listenedOn: "2025-06-01", body: "계획 없는 날을 아깝지 않게 만들어주는 밝은 곡." },
  ],
  "sunday-l": [
    { listenedOn: "2024-08-11", body: "카페에 갈지 고민하다 집에 남아 앨범을 다시 들었다." },
    { listenedOn: "2026-02-15", body: "아무것도 하지 않는 시간에 가장 집중해서 듣게 되는 곡." },
  ],
};
const SEED_ALBUM_ART =
  "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f9/28/8c/f9288c73-c42a-11d1-a4aa-83a7ce6e3c46/TheVolunteers_3000.jpg/600x600bb.jpg";
const SEED_L_ART =
  "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/6d/3a/98/6d3a98fb-63e0-c1a0-24cb-cbe7b8b28672/198588366318.jpg/600x600bb.jpg";

function nowIso(): string {
  return new Date().toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOnlyStrings(values: unknown): values is string[] {
  return Array.isArray(values) && values.every((value) => typeof value === "string");
}

function assertRecord<T>(
  record: Record<string, T>,
  id: string,
  label: string,
): T {
  const value = record[id];
  if (!value) {
    throw new ArchiveDomainError("not-found", `${label}을(를) 찾을 수 없습니다.`);
  }
  return value;
}

function assertEditableCubeTrack(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
): CubeTrack {
  const cubeTrack = assertRecord(archive.data.cubeTracks, cubeTrackId, "곡 기록");
  const cube = assertRecord(archive.data.cubes, cubeTrack.cubeId, "챕터");
  if (cube.kind === "monthly") {
    throw new ArchiveDomainError("invalid-input", "월별 자동 기록은 편집할 수 없습니다.");
  }
  return cubeTrack;
}

function cleanText(
  value: string,
  label: string,
  limit: number,
  required = false,
): string {
  const cleaned = value.normalize("NFKC").trim();
  if (required && !cleaned) {
    throw new ArchiveDomainError("invalid-input", `${label}은(는) 필수입니다.`);
  }
  if (cleaned.length > limit) {
    throw new ArchiveDomainError(
      "limit-exceeded",
      `${label}은(는) ${limit}자까지 입력할 수 있습니다.`,
    );
  }
  return cleaned;
}

function validIsoDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validCalendarDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function validChapterCoverImage(value: unknown): value is string | null {
  return value === null || (
    typeof value === "string"
    && value.length <= ARCHIVE_LIMITS.chapterCoverDataUrl
    && /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(value)
  );
}

function normalizeChapterCoverImage(value: string | null | undefined): string | null {
  const normalized = value ?? null;
  if (!validChapterCoverImage(normalized)) {
    throw new ArchiveDomainError("invalid-input", "대표 이미지는 JPG, PNG, WEBP 형식만 사용할 수 있어요.");
  }
  return normalized;
}

function withData(
  archive: ArchiveEnvelopeV1,
  data: ArchiveData,
  updatedAt: string,
): ArchiveEnvelopeV1 {
  return { ...archive, updatedAt, data };
}

function pruneUnreferencedTracks(data: ArchiveData): ArchiveData {
  const referenced = new Set<TrackId>();
  Object.values(data.cubeTracks).forEach((item) => referenced.add(item.trackId));
  Object.values(data.inbox).forEach((item) => {
    if (item) referenced.add(item.trackId);
  });

  const tracks = Object.fromEntries(
    Object.entries(data.tracks).filter(([trackId]) => referenced.has(trackId as TrackId)),
  ) as Record<TrackId, TrackReference>;

  return { ...data, tracks };
}

function validateMemoryPeriod(value: MemoryPeriod): MemoryPeriod {
  if (value === null) return null;
  if (value.kind === "month") {
    if (
      !Number.isInteger(value.month) ||
      value.month < 1 ||
      value.month > 12 ||
      (value.year !== null && (!Number.isInteger(value.year) || value.year < 1900 || value.year > 2200))
    ) {
      throw new ArchiveDomainError("invalid-input", "기억 시기가 올바르지 않습니다.");
    }
    return { ...value };
  }
  if (
    !["spring", "summer", "autumn", "winter"].includes(value.season) ||
    (value.year !== null && (!Number.isInteger(value.year) || value.year < 1900 || value.year > 2200))
  ) {
    throw new ArchiveDomainError("invalid-input", "기억 시기가 올바르지 않습니다.");
  }
  return { ...value };
}

function trackIsEqual(left: TrackReference, right: TrackReference): boolean {
  return Object.keys(left).every(
    (key) => left[key as keyof TrackReference] === right[key as keyof TrackReference],
  );
}

function mergeTrack(
  current: TrackReference | undefined,
  incoming: TrackReference,
  registeredAt: string,
): TrackReference {
  const normalized = normalizeTrack(
    incoming,
    current?.registeredAt ?? incoming.registeredAt ?? registeredAt,
  );
  if (!current) return normalized;
  return {
    ...normalized,
    registeredAt: current.registeredAt ?? normalized.registeredAt,
    artworkUrl: normalized.artworkUrl ?? current.artworkUrl,
    previewUrl: normalized.previewUrl ?? current.previewUrl,
    externalUrl: normalized.externalUrl ?? current.externalUrl,
  };
}

function normalizeTrack(track: TrackReference, registeredAt: string): TrackReference {
  const id = makeProviderTrackId(track.provider, track.providerTrackId);
  if (track.id !== id) {
    throw new ArchiveDomainError("invalid-input", "음악 곡 식별자가 올바르지 않습니다.");
  }
  const title = cleanText(track.title, "곡명", 200, true);
  const artist = cleanText(track.artist, "아티스트", 200, true);
  const album = cleanText(track.album, "앨범", 200);
  const genre = cleanText(track.genre, "장르", 100);
  if (
    track.durationMs !== null &&
    (!Number.isFinite(track.durationMs) || track.durationMs < 0)
  ) {
    throw new ArchiveDomainError("invalid-input", "재생 시간이 올바르지 않습니다.");
  }
  if (!validIsoDate(registeredAt)) {
    throw new ArchiveDomainError("invalid-input", "곡 등록 날짜가 올바르지 않습니다.");
  }
  return {
    ...track,
    id,
    title,
    artist,
    album,
    genre,
    durationMs: track.durationMs === null ? null : Math.round(track.durationMs),
    registeredAt,
  };
}

export function makeTrackId(providerTrackId: number): ItunesTrackId {
  if (!Number.isSafeInteger(providerTrackId) || providerTrackId <= 0) {
    throw new ArchiveDomainError("invalid-input", "iTunes 곡 ID가 올바르지 않습니다.");
  }
  return `itunes:${providerTrackId}`;
}

export function makeProviderTrackId(
  provider: TrackProvider,
  providerTrackId: number | string,
): TrackId {
  if (!TRACK_PROVIDERS.includes(provider)) {
    throw new ArchiveDomainError("invalid-input", "지원하지 않는 음악 제공자입니다.");
  }
  if (provider === "itunes") {
    if (typeof providerTrackId !== "number") {
      throw new ArchiveDomainError("invalid-input", "iTunes 곡 ID가 올바르지 않습니다.");
    }
    return makeTrackId(providerTrackId);
  }

  if (typeof providerTrackId !== "string") {
    throw new ArchiveDomainError("invalid-input", "음악 곡 ID가 올바르지 않습니다.");
  }

  if (provider === "spotify" && !/^[A-Za-z0-9]{22}$/.test(providerTrackId)) {
    throw new ArchiveDomainError("invalid-input", "Spotify 곡 ID가 올바르지 않습니다.");
  }
  if (provider === "youtube" && !/^[A-Za-z0-9_-]{11}$/.test(providerTrackId)) {
    throw new ArchiveDomainError("invalid-input", "YouTube 영상 ID가 올바르지 않습니다.");
  }
  if (provider === "melon" && !/^[1-9]\d{0,19}$/.test(providerTrackId)) {
    throw new ArchiveDomainError("invalid-input", "Melon 곡 ID가 올바르지 않습니다.");
  }

  return `${provider}:${providerTrackId}` as TrackId;
}

export function createId(prefix: string): string {
  const safePrefix = prefix.replace(/[^a-z0-9-]/gi, "").toLowerCase() || "id";
  const uuid = globalThis.crypto?.randomUUID?.();
  if (uuid) return `${safePrefix}:${uuid}`;

  const random = Math.random().toString(36).slice(2, 12);
  return `${safePrefix}:${Date.now().toString(36)}-${random}`;
}

export function normalizeTagLabel(label: string): string {
  return label.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

export function reconcileTagSelection(
  latestTagIds: string[],
  baselineTagIds: string[],
  selectedTagIds: string[],
): string[] {
  const removedLocally = new Set(
    baselineTagIds.filter((tagId) => !selectedTagIds.includes(tagId)),
  );
  const addedLocally = selectedTagIds.filter((tagId) => !baselineTagIds.includes(tagId));
  return [...new Set([
    ...latestTagIds.filter((tagId) => !removedLocally.has(tagId)),
    ...addedLocally,
  ])];
}

function canonicalTagCategory(category: TagCategory): TagCategory {
  return category === "energy" || category === "texture" ? "emotion" : category;
}

const LEGACY_SEED_TAG_LABELS: Record<string, { legacy: string; current: string }> = {
  "seed:tag:cold": { legacy: "차가운", current: "혼자 걷는 밤" },
  "seed:tag:urban": { legacy: "도시적인", current: "새벽에 운전할 때" },
  "seed:tag:rushing": { legacy: "질주하는", current: "운동할 때" },
  "seed:tag:nostalgic": { legacy: "그리운", current: "과거에 좋아했던 음악" },
  "seed:tag:warm": { legacy: "따뜻한", current: "첫 자취방에서" },
  "seed:tag:uneasy-youth": { legacy: "불안했던 청춘", current: "불안했던 시절" },
  "seed:tag:bright": { legacy: "눈부신", current: "여름이 시작될 때" },
  "seed:tag:open-road": { legacy: "탁 트인", current: "멀리 떠날 때" },
  "seed:tag:hazy": { legacy: "몽환적인", current: "잠들기 전" },
  "seed:tag:solitary": { legacy: "혼자 듣는", current: "혼자 있고 싶을 때" },
  "seed:tag:restless": { legacy: "들뜬", current: "기분을 바꾸고 싶을 때" },
  "seed:tag:bedroom": { legacy: "방 안의", current: "방 안에서 듣던 음악" },
};

function normalizeArchiveTags(
  archive: ArchiveEnvelopeV1,
): ArchiveEnvelopeV1 {
  let changed = false;
  const tags = Object.fromEntries(
    Object.entries(archive.data.tags).map(([id, tag]) => {
      const category = canonicalTagCategory(tag.category);
      const seedLabel = tag.source === "seed" ? LEGACY_SEED_TAG_LABELS[id] : undefined;
      const label = seedLabel?.legacy === tag.label ? seedLabel.current : tag.label;
      if (category === tag.category && label === tag.label) return [id, tag];
      changed = true;
      return [id, {
        ...tag,
        label,
        normalizedLabel: normalizeTagLabel(label),
        category: label === tag.label ? category : "custom",
      }];
    }),
  );
  return changed
    ? withData(archive, { ...archive.data, tags }, archive.updatedAt)
    : archive;
}

export function createEmptyArchive(now = nowIso()): ArchiveEnvelopeV1 {
  return {
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    seedVersion: ARCHIVE_SEED_VERSION,
    updatedAt: now,
    data: {
      tracks: {},
      cubes: {},
      cubeTracks: {},
      tags: {},
      inbox: {},
      space: { ...DEFAULT_PERSONAL_SPACE },
      preferences: { ...DEFAULT_PREFERENCES, seedDismissed: true },
    },
  };
}

function seedTrack(
  input: Omit<TrackReference, "id" | "provider" | "providerTrackId"> & {
    providerTrackId: number;
  },
): TrackReference {
  return {
    ...input,
    id: makeTrackId(input.providerTrackId),
    provider: "itunes",
    registeredAt: SEED_NOW,
  };
}

export function createSeedArchive(): ArchiveEnvelopeV1 {
  const seedTracks = [
    seedTrack({
      providerTrackId: 1569294608,
      title: "Summer",
      artist: "The Volunteers",
      album: "The Volunteers",
      genre: "록",
      durationMs: 251_033,
      artworkUrl: SEED_ALBUM_ART,
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/f3/e6/e0/f3e6e096-6e4c-cb5b-a827-553b035aaad3/mzaf_13407501163592848995.plus.aac.p.m4a",
      externalUrl: "https://music.apple.com/kr/album/summer/1569294418?i=1569294608",
    }),
    seedTrack({
      providerTrackId: 1569294420,
      title: "PINKTOP",
      artist: "The Volunteers",
      album: "The Volunteers",
      genre: "록",
      durationMs: 239_910,
      artworkUrl: SEED_ALBUM_ART,
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview125/v4/99/29/a9/9929a9f8-056a-90ab-0097-26a8c11e87e4/mzaf_14000645754408781512.plus.aac.p.m4a",
      externalUrl: "https://music.apple.com/kr/album/pinktop/1569294418?i=1569294420",
    }),
    seedTrack({
      providerTrackId: 1752456374,
      title: '"L"',
      artist: "The Volunteers",
      album: '"L" - EP',
      genre: "록",
      durationMs: 260_683,
      artworkUrl: SEED_L_ART,
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview211/v4/53/e2/78/53e27881-1b2e-ef5a-9218-dd327b62c6cb/mzaf_12131519504080993302.plus.aac.p.m4a",
      externalUrl: "https://music.apple.com/kr/album/l/1752456040?i=1752456374",
    }),
    seedTrack({
      providerTrackId: 1569294423,
      title: "Radio",
      artist: "The Volunteers",
      album: "The Volunteers",
      genre: "록",
      durationMs: 262_652,
      artworkUrl: SEED_ALBUM_ART,
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/1b/50/d0/1b50d0e2-c51b-6770-24f7-519aa886f2f7/mzaf_5324439953621750727.plus.aac.p.m4a",
      externalUrl: "https://music.apple.com/kr/album/radio/1569294418?i=1569294423",
    }),
    seedTrack({
      providerTrackId: 1569294419,
      title: "Violet",
      artist: "The Volunteers",
      album: "The Volunteers",
      genre: "록",
      durationMs: 211_340,
      artworkUrl: SEED_ALBUM_ART,
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview115/v4/04/21/15/042115ca-e717-59ab-c206-e59a6bc2b3da/mzaf_6368177652675092977.plus.aac.p.m4a",
      externalUrl: "https://music.apple.com/kr/album/violet/1569294418?i=1569294419",
    }),
    seedTrack({
      providerTrackId: 1752456355,
      title: "Tell 'em boys",
      artist: "The Volunteers",
      album: '"L" - EP',
      genre: "록",
      durationMs: 269_976,
      artworkUrl: SEED_L_ART,
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/6a/74/b1/6a74b138-d5f6-60bf-704e-3f2037e172c3/mzaf_10454458861961089573.plus.aac.p.m4a",
      externalUrl: "https://music.apple.com/kr/album/tell-em-boys/1752456040?i=1752456355",
    }),
    seedTrack({
      providerTrackId: 1752456349,
      title: "Psycho",
      artist: "The Volunteers",
      album: '"L" - EP',
      genre: "록",
      durationMs: 242_161,
      artworkUrl: SEED_L_ART,
      previewUrl:
        "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview221/v4/07/13/b3/0713b3ef-969f-2b1f-3cf9-c45505a3c90e/mzaf_13557796651863244619.plus.aac.p.m4a",
      externalUrl: "https://music.apple.com/kr/album/psycho/1752456040?i=1752456349",
    }),
  ];

  const tracks = Object.fromEntries(seedTracks.map((track) => [track.id, track])) as Record<
    TrackId,
    TrackReference
  >;

  const cubes: Record<string, Cube> = {
    "seed:cube:past-favorites": {
      id: "seed:cube:past-favorites",
      parentId: null,
      name: "예전에 좋아했던 기타 음악",
      description: "한때 매일 들었지만 잠시 잊고 있던 곡들",
      coverImageUrl: null,
      color: "amber",
      kind: "manual",
      systemKey: null,
      sortOrder: 0,
      source: "seed",
      visibility: "private",
      createdAt: "2021-06-03T02:10:00.000Z",
      updatedAt: "2026-07-10T20:10:00.000Z",
    },
    "seed:cube:dawn-drive": {
      id: "seed:cube:dawn-drive",
      parentId: null,
      name: "새벽에 혼자 운전할 때",
      description: "집에 바로 들어가기 싫어 강변을 한 바퀴 더 돌던 밤",
      coverImageUrl: null,
      color: "violet",
      kind: "manual",
      systemKey: null,
      sortOrder: 1,
      source: "seed",
      visibility: "private",
      createdAt: "2025-07-10T02:10:00.000Z",
      updatedAt: "2026-07-04T23:40:00.000Z",
    },
    "seed:cube:winter-2018": {
      id: "seed:cube:winter-2018",
      parentId: "seed:cube:past-favorites",
      name: "2018년 겨울",
      description: "불안했던 시절과 학교 앞 카페의 노란 불빛",
      coverImageUrl: null,
      color: "cyan",
      kind: "manual",
      systemKey: null,
      sortOrder: 0,
      source: "seed",
      visibility: "private",
      createdAt: "2025-07-09T02:10:00.000Z",
      updatedAt: "2026-05-18T20:20:00.000Z",
    },
    "seed:cube:workout": {
      id: "seed:cube:workout",
      parentId: null,
      name: "운동 시작 20분",
      description: "몸보다 기분을 먼저 움직이게 하는 곡",
      coverImageUrl: null,
      color: "blue",
      kind: "manual",
      systemKey: null,
      sortOrder: 2,
      source: "seed",
      visibility: "private",
      createdAt: "2024-09-02T09:00:00.000Z",
      updatedAt: "2026-07-04T10:30:00.000Z",
    },
    "seed:cube:rainy-commute": {
      id: "seed:cube:rainy-commute",
      parentId: null,
      name: "비 오는 퇴근길",
      description: "서두르지 않고 집까지 걷고 싶던 날",
      coverImageUrl: null,
      color: "cyan",
      kind: "manual",
      systemKey: null,
      sortOrder: 3,
      source: "seed",
      visibility: "private",
      createdAt: "2024-07-22T10:00:00.000Z",
      updatedAt: "2026-06-25T12:20:00.000Z",
    },
    "seed:cube:first-room": {
      id: "seed:cube:first-room",
      parentId: null,
      name: "첫 자취방에서",
      description: "가구가 없던 작은 방에서 혼자 크게 틀어두던 노래",
      coverImageUrl: null,
      color: "coral",
      kind: "manual",
      systemKey: null,
      sortOrder: 4,
      source: "seed",
      visibility: "private",
      createdAt: "2025-07-08T02:10:00.000Z",
      updatedAt: "2026-04-03T18:30:00.000Z",
    },
    "seed:cube:slow-sunday": {
      id: "seed:cube:slow-sunday",
      parentId: null,
      name: "아무 계획 없는 일요일",
      description: "알람을 끄고 앨범 한 장을 천천히 듣는 오전",
      coverImageUrl: null,
      color: "mint",
      kind: "manual",
      systemKey: null,
      sortOrder: 5,
      source: "seed",
      visibility: "private",
      createdAt: "2023-03-19T01:00:00.000Z",
      updatedAt: "2026-05-31T05:00:00.000Z",
    },
  };

  const tagSeeds: Array<[string, string]> = [
    ["cold", "혼자 걷는 밤"],
    ["urban", "새벽에 운전할 때"],
    ["rushing", "운동할 때"],
    ["nostalgic", "과거에 좋아했던 음악"],
    ["warm", "첫 자취방에서"],
    ["uneasy-youth", "불안했던 시절"],
    ["bright", "여름이 시작될 때"],
    ["open-road", "멀리 떠날 때"],
    ["hazy", "잠들기 전"],
    ["solitary", "혼자 있고 싶을 때"],
    ["restless", "기분을 바꾸고 싶을 때"],
    ["bedroom", "방 안에서 듣던 음악"],
    ["rainy-commute", "비 오는 퇴근길"],
    ["old-guitar", "예전에 좋아했던 기타 음악"],
    ["restart-workout", "운동을 다시 시작할 때"],
    ["no-plan", "아무 계획 없는 일요일"],
    ["focus-reset", "집중이 풀릴 때"],
    ["late-bus", "막차에서"],
    ["headphones", "이어폰으로 크게 듣고 싶을 때"],
    ["after-work", "퇴근 직후"],
  ];
  const tags = Object.fromEntries(
    tagSeeds.map(([slug, label]) => {
      const id = `seed:tag:${slug}`;
      return [
        id,
        {
          id,
          label,
          normalizedLabel: normalizeTagLabel(label),
          category: "custom",
          source: "seed",
          createdAt: SEED_NOW,
        } satisfies TagDefinition,
      ];
    }),
  );

  const cubeTracks: Record<string, CubeTrack> = {
    "seed:cube-track:dawn-radio": seedCubeTrack(
      "dawn-radio",
      "seed:cube:dawn-drive",
      makeTrackId(1569294423),
      ["urban", "cold", "late-bus"],
      0,
      "도로의 속도와 정확히 맞물리는 기타",
      null,
      "",
      "",
    ),
    "seed:cube-track:dawn-summer": seedCubeTrack(
      "dawn-summer",
      "seed:cube:dawn-drive",
      makeTrackId(1569294608),
      ["bright", "open-road"],
      1,
      "창문을 내리고 따라 부르고 싶은 여름밤",
      null,
      "",
      "친구들",
    ),
    "seed:cube-track:dawn-psycho": seedCubeTrack(
      "dawn-psycho",
      "seed:cube:dawn-drive",
      makeTrackId(1752456349),
      ["urban", "headphones", "focus-reset"],
      2,
      "터널을 지날 때 저음이 더 크게 느껴지는 곡",
      null,
      "",
      "",
    ),
    "seed:cube-track:past-pinktop": seedCubeTrack(
      "past-pinktop",
      "seed:cube:past-favorites",
      makeTrackId(1569294420),
      ["old-guitar", "nostalgic", "headphones"],
      0,
      "이 밴드를 처음 좋아하게 만든 선명한 기타",
      null,
      "",
      "",
    ),
    "seed:cube-track:past-radio": seedCubeTrack(
      "past-radio",
      "seed:cube:past-favorites",
      makeTrackId(1569294423),
      ["old-guitar", "nostalgic"],
      1,
      "매일 들어도 질리지 않았던 기타 톤",
      null,
      "",
      "",
    ),
    "seed:cube-track:past-l": seedCubeTrack(
      "past-l",
      "seed:cube:past-favorites",
      makeTrackId(1752456374),
      ["old-guitar", "solitary", "headphones"],
      2,
      "취향이 조금 달라진 뒤에도 계속 좋아한 곡",
      null,
      "",
      "",
    ),
    "seed:cube-track:winter-radio": seedCubeTrack(
      "winter-radio",
      "seed:cube:winter-2018",
      makeTrackId(1569294423),
      ["nostalgic", "warm", "uneasy-youth"],
      0,
      "불안했지만 이상하게 따뜻한 청춘",
      null,
      "",
      "",
    ),
    "seed:cube-track:winter-violet": seedCubeTrack(
      "winter-violet",
      "seed:cube:winter-2018",
      makeTrackId(1569294419),
      ["nostalgic", "hazy"],
      1,
      "보랏빛으로 번지는 오래된 장면",
      null,
      "",
      "",
    ),
    "seed:cube-track:winter-summer": seedCubeTrack(
      "winter-summer",
      "seed:cube:winter-2018",
      makeTrackId(1569294608),
      ["nostalgic", "uneasy-youth", "late-bus"],
      2,
      "겨울에 들어서 더 멀게 느껴진 여름",
      null,
      "",
      "",
    ),
    "seed:cube-track:workout-tell": seedCubeTrack(
      "workout-tell",
      "seed:cube:workout",
      makeTrackId(1752456355),
      ["rushing", "restart-workout", "focus-reset"],
      0,
      "러닝머신 속도를 한 단계 올리게 하는 후렴",
      null,
      "",
      "",
    ),
    "seed:cube-track:workout-psycho": seedCubeTrack(
      "workout-psycho",
      "seed:cube:workout",
      makeTrackId(1752456349),
      ["rushing", "restart-workout", "headphones"],
      1,
      "준비 운동이 끝난 뒤 집중을 붙잡는 리듬",
      null,
      "",
      "",
    ),
    "seed:cube-track:workout-pinktop": seedCubeTrack(
      "workout-pinktop",
      "seed:cube:workout",
      makeTrackId(1569294420),
      ["rushing", "restless", "restart-workout"],
      2,
      "몸보다 기분을 먼저 움직이는 첫 곡",
      null,
      "",
      "",
    ),
    "seed:cube-track:rain-l": seedCubeTrack(
      "rain-l",
      "seed:cube:rainy-commute",
      makeTrackId(1752456374),
      ["rainy-commute", "after-work", "hazy"],
      0,
      "빗물 번지는 창문과 함께 천천히 듣는 곡",
      null,
      "",
      "",
    ),
    "seed:cube-track:rain-violet": seedCubeTrack(
      "rain-violet",
      "seed:cube:rainy-commute",
      makeTrackId(1569294419),
      ["rainy-commute", "after-work", "solitary"],
      1,
      "지친 날에도 집까지 조금 더 걷게 하는 곡",
      null,
      "",
      "",
    ),
    "seed:cube-track:rain-radio": seedCubeTrack(
      "rain-radio",
      "seed:cube:rainy-commute",
      makeTrackId(1569294423),
      ["rainy-commute", "after-work", "late-bus"],
      2,
      "빠른 곡인데 막힌 퇴근길에서는 차분하게 들린다",
      null,
      "",
      "",
    ),
    "seed:cube-track:room-pinktop": seedCubeTrack(
      "room-pinktop",
      "seed:cube:first-room",
      makeTrackId(1569294420),
      ["restless", "bedroom"],
      0,
      "작은 방을 가득 채우는 반항심",
      null,
      "",
      "",
    ),
    "seed:cube-track:room-l": seedCubeTrack(
      "room-l",
      "seed:cube:first-room",
      makeTrackId(1752456374),
      ["solitary", "hazy", "bedroom"],
      1,
      "혼자 있는 밤의 부드러운 소음",
      null,
      "",
      "",
    ),
    "seed:cube-track:room-summer": seedCubeTrack(
      "room-summer",
      "seed:cube:first-room",
      makeTrackId(1569294608),
      ["bedroom", "bright", "warm"],
      2,
      "가구가 없던 방을 넓게 채워준 후렴",
      null,
      "",
      "",
    ),
    "seed:cube-track:sunday-violet": seedCubeTrack(
      "sunday-violet",
      "seed:cube:slow-sunday",
      makeTrackId(1569294419),
      ["no-plan", "hazy", "solitary"],
      0,
      "알람을 끄고 다시 누운 오전의 느슨함",
      null,
      "",
      "",
    ),
    "seed:cube-track:sunday-summer": seedCubeTrack(
      "sunday-summer",
      "seed:cube:slow-sunday",
      makeTrackId(1569294608),
      ["no-plan", "bright", "warm"],
      1,
      "밀린 빨래를 하면서도 따라 부르게 되는 곡",
      null,
      "",
      "",
    ),
    "seed:cube-track:sunday-l": seedCubeTrack(
      "sunday-l",
      "seed:cube:slow-sunday",
      makeTrackId(1752456374),
      ["no-plan", "headphones", "solitary"],
      2,
      "아무것도 하지 않을 때 가장 집중해서 듣는 곡",
      null,
      "",
      "",
    ),
  };

  const inbox: Partial<Record<TrackId, InboxEntry>> = {};

  const archive: ArchiveEnvelopeV1 = {
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    seedVersion: ARCHIVE_SEED_VERSION,
    updatedAt: SEED_NOW,
    data: {
      tracks,
      cubes,
      cubeTracks,
      tags: tags as Record<string, TagDefinition>,
      inbox,
      space: { ...DEFAULT_PERSONAL_SPACE },
      preferences: { ...DEFAULT_PREFERENCES },
    },
  };
  return withPersonalSpaceDefaults(archive);
}

function seedCubeTrack(
  slug: string,
  cubeId: string,
  trackId: TrackId,
  tagSlugs: string[],
  sortOrder: number,
  character: string,
  memoryPeriod: MemoryPeriod,
  place: string,
  people: string,
): CubeTrack {
  return {
    id: `seed:cube-track:${slug}`,
    cubeId,
    trackId,
    tagIds: tagSlugs.map((tag) => `seed:tag:${tag}`),
    character,
    memoryPeriod,
    place,
    people,
    notes: seedMemoryNotes(slug),
    sortOrder,
    source: "seed",
    recordVisibility: "private",
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
  };
}

function seedMemoryNotes(slug: string): MemoryNote[] {
  return (SEED_MEMORY_FIXTURES[slug] ?? []).map((fixture, index) => ({
    id: index === 0 ? `seed:memory-note:${slug}` : `seed:memory-note:${slug}:${index + 1}`,
    listenedOn: fixture.listenedOn,
    body: fixture.body,
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
  }));
}

function refreshLegacySeedMemory(archive: ArchiveEnvelopeV1): ArchiveEnvelopeV1 {
  let changed = false;
  const cubeTracks = { ...archive.data.cubeTracks };

  Object.entries(SEED_MEMORY_FIXTURES).forEach(([slug, fixtures]) => {
    const cubeTrackId = `seed:cube-track:${slug}`;
    const current = cubeTracks[cubeTrackId];
    const primaryId = `seed:memory-note:${slug}`;
    const legacyPrimary = current?.notes.find((note) => note.id === primaryId);
    if (
      !current
      || current.source !== "seed"
      || !legacyPrimary
      || legacyPrimary.listenedOn !== null
      || legacyPrimary.body !== fixtures[0]?.body
    ) return;

    const bundledNotes = seedMemoryNotes(slug);
    const bundledIds = new Set(bundledNotes.map((note) => note.id));
    const userNotes = current.notes.filter((note) => !bundledIds.has(note.id));
    cubeTracks[cubeTrackId] = {
      ...current,
      notes: [...bundledNotes, ...userNotes],
    };
    changed = true;
  });

  return changed
    ? { ...archive, data: { ...archive.data, cubeTracks } }
    : archive;
}

function registrationMonth(value: string): { key: string; year: number; month: number } {
  if (!validIsoDate(value)) {
    throw new ArchiveDomainError("invalid-input", "곡 등록 날짜가 올바르지 않습니다.");
  }
  const parts = REGISTRATION_MONTH_FORMATTER.formatToParts(new Date(value));
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return { key: `${year}-${String(month).padStart(2, "0")}`, year, month };
}

function ensureMonthlyChapter(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  registeredAt: string,
  now: string,
): ArchiveEnvelopeV1 {
  const { key, month } = registrationMonth(registeredAt);
  const systemKey: CubeSystemKey = `month:${key}`;
  const existing = Object.values(archive.data.cubes).find(
    (cube) => cube.kind === "monthly" && cube.systemKey === systemKey,
  );
  if (existing) return addTrackToCubeInternal(archive, trackId, existing.id, now).archive;

  const canonicalId = `month:${key}`;
  let chapterId = canonicalId;
  let suffix = 1;
  while (archive.data.cubes[chapterId]) {
    chapterId = `${canonicalId}:system-${suffix}`;
    suffix += 1;
  }
  const cube: Cube = {
    id: chapterId,
    parentId: null,
    name: `${month}월`,
    description: `${month}월에 등록한 곡들`,
    coverImageUrl: null,
    color: CUBE_COLORS[(month - 1) % CUBE_COLORS.length],
    kind: "monthly",
    systemKey,
    sortOrder: Object.values(archive.data.cubes).filter((item) => item.parentId === null).length,
    source: "user",
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  };
  const withChapter = withData(
    archive,
    { ...archive.data, cubes: { ...archive.data.cubes, [chapterId]: cube } },
    now,
  );
  return addTrackToCubeInternal(withChapter, trackId, chapterId, now).archive;
}

export function captureTrack(
  archive: ArchiveEnvelopeV1,
  track: TrackReference,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const merged = mergeTrack(archive.data.tracks[track.id], track, now);
  const current = archive.data.tracks[merged.id];
  const withTrack = current && trackIsEqual(current, merged)
    ? archive
    : withData(
        archive,
        { ...archive.data, tracks: { ...archive.data.tracks, [merged.id]: merged } },
        now,
      );
  return ensureMonthlyChapter(withTrack, merged.id, merged.registeredAt ?? now, now);
}

export function captureTrackToInbox(
  archive: ArchiveEnvelopeV1,
  track: TrackReference,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const captured = captureTrack(archive, track, now);
  const summary = getTrackArchiveSummary(captured, track.id);
  if (summary.captureState || summary.manualContextStates.length > 0) return captured;
  const existing = captured.data.inbox[track.id];
  if (existing) return captured;

  return withData(
    captured,
    {
      ...captured.data,
      inbox: {
        ...captured.data.inbox,
        [track.id]: { trackId: track.id, capturedAt: now, source: "user" },
      },
    },
    now,
  );
}

export function removeInboxTrack(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  if (!archive.data.inbox[trackId]) return archive;
  const inbox = { ...archive.data.inbox };
  delete inbox[trackId];
  const data = pruneUnreferencedTracks({ ...archive.data, inbox });
  return withPersonalSpaceDefaults(withData(archive, data, now));
}

function compareCubeOrder(left: Cube, right: Cube): number {
  return (
    left.sortOrder - right.sortOrder
    || left.createdAt.localeCompare(right.createdAt)
    || left.id.localeCompare(right.id)
  );
}

function reindexCubeSiblings(
  cubes: Record<string, Cube>,
  parentId: string | null,
): void {
  Object.values(cubes)
    .filter((cube) => cube.parentId === parentId)
    .sort(compareCubeOrder)
    .forEach((cube, index) => {
      cubes[cube.id] = cube.sortOrder === index ? cube : { ...cube, sortOrder: index };
    });
}

function assertValidCubeParent(
  cubes: Record<string, Cube>,
  cubeId: string,
  parentId: string | null,
): void {
  if (parentId === null) return;
  if (parentId === cubeId) {
    throw new ArchiveDomainError("invalid-input", "챕터 계층에 순환이 생길 수 없습니다.");
  }
  const parent = assertRecord(cubes, parentId, "상위 챕터");
  if (!isUserVisibleChapter(parent)) {
    throw new ArchiveDomainError("invalid-input", "시스템 챕터는 상위 챕터가 될 수 없습니다.");
  }

  const visited = new Set<string>();
  let currentId: string | null = parentId;
  while (currentId !== null) {
    if (currentId === cubeId || visited.has(currentId)) {
      throw new ArchiveDomainError("invalid-input", "챕터 계층에 순환이 생길 수 없습니다.");
    }
    visited.add(currentId);
    currentId = cubes[currentId]?.parentId ?? null;
  }
}

export function createCube(
  archive: ArchiveEnvelopeV1,
  input: CreateCubeInput,
  now = nowIso(),
): { archive: ArchiveEnvelopeV1; cube: Cube } {
  const id = input.id ?? createId("cube");
  if (archive.data.cubes[id]) {
    throw new ArchiveDomainError("duplicate", "이미 존재하는 챕터 ID입니다.");
  }
  const parentId = input.parentId ?? null;
  assertValidCubeParent(archive.data.cubes, id, parentId);
  const cube: Cube = {
    id,
    parentId,
    name: cleanText(input.name, "챕터 이름", ARCHIVE_LIMITS.cubeName, true),
    description: cleanText(
      input.description ?? "",
      "챕터 설명",
      ARCHIVE_LIMITS.cubeDescription,
    ),
    coverImageUrl: normalizeChapterCoverImage(input.coverImageUrl),
    color: input.color ?? "violet",
    kind: "manual",
    systemKey: null,
    sortOrder: Object.values(archive.data.cubes).filter(
      (candidate) => candidate.parentId === parentId,
    ).length,
    source: "user",
    visibility: input.visibility ?? "private",
    createdAt: now,
    updatedAt: now,
  };
  if (!CUBE_COLORS.includes(cube.color)) {
    throw new ArchiveDomainError("invalid-input", "지원하지 않는 챕터 색상입니다.");
  }
  const next = withData(
    archive,
    { ...archive.data, cubes: { ...archive.data.cubes, [id]: cube } },
    now,
  );
  return { archive: next, cube };
}

export function updateCube(
  archive: ArchiveEnvelopeV1,
  cubeId: string,
  input: UpdateCubeInput,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertRecord(archive.data.cubes, cubeId, "챕터");
  if (!isUserVisibleChapter(current)) {
    throw new ArchiveDomainError("invalid-input", "시스템 챕터는 수정할 수 없습니다.");
  }
  if (input.color !== undefined && !CUBE_COLORS.includes(input.color)) {
    throw new ArchiveDomainError("invalid-input", "지원하지 않는 챕터 색상입니다.");
  }
  if (input.visibility !== undefined && input.visibility !== "public" && input.visibility !== "private") {
    throw new ArchiveDomainError("invalid-input", "챕터 공개 상태가 올바르지 않습니다.");
  }
  const parentId = input.parentId === undefined ? current.parentId : input.parentId;
  assertValidCubeParent(archive.data.cubes, cubeId, parentId);
  const parentChanged = parentId !== current.parentId;
  const cube: Cube = {
    ...current,
    parentId,
    ...(input.name === undefined
      ? {}
      : { name: cleanText(input.name, "챕터 이름", ARCHIVE_LIMITS.cubeName, true) }),
    ...(input.description === undefined
      ? {}
      : {
          description: cleanText(
            input.description,
            "챕터 설명",
            ARCHIVE_LIMITS.cubeDescription,
          ),
        }),
    ...(input.coverImageUrl === undefined
      ? {}
      : { coverImageUrl: normalizeChapterCoverImage(input.coverImageUrl) }),
    ...(input.color === undefined ? {} : { color: input.color }),
    ...(input.visibility === undefined ? {} : { visibility: input.visibility }),
    ...(parentChanged
      ? {
          sortOrder: Object.values(archive.data.cubes).filter(
            (candidate) => candidate.id !== cubeId && candidate.parentId === parentId,
          ).length,
        }
      : {}),
    updatedAt: now,
  };
  const cubes = { ...archive.data.cubes, [cubeId]: cube };
  if (parentChanged) {
    reindexCubeSiblings(cubes, current.parentId);
    reindexCubeSiblings(cubes, parentId);
  }
  return withData(
    archive,
    { ...archive.data, cubes },
    now,
  );
}

export function deleteCube(
  archive: ArchiveEnvelopeV1,
  cubeId: string,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertRecord(archive.data.cubes, cubeId, "챕터");
  if (!isUserVisibleChapter(current)) {
    throw new ArchiveDomainError("invalid-input", "시스템 챕터는 삭제할 수 없습니다.");
  }
  const cubes = { ...archive.data.cubes };
  delete cubes[cubeId];
  const children = Object.values(cubes)
    .filter((cube) => cube.parentId === cubeId)
    .sort(compareCubeOrder);
  const targetSiblings = Object.values(cubes)
    .filter((cube) => cube.parentId === current.parentId)
    .sort(compareCubeOrder);
  const insertionIndex = Math.min(Math.max(current.sortOrder, 0), targetSiblings.length);
  [
    ...targetSiblings.slice(0, insertionIndex),
    ...children,
    ...targetSiblings.slice(insertionIndex),
  ].forEach((cube, sortOrder) => {
    const promoted = cube.parentId === cubeId;
    cubes[cube.id] = {
      ...cube,
      parentId: current.parentId,
      sortOrder,
      ...(promoted ? { updatedAt: now } : {}),
    };
  });
  const cubeTracks = Object.fromEntries(
    Object.entries(archive.data.cubeTracks).filter(([, item]) => item.cubeId !== cubeId),
  );
  const data = pruneUnreferencedTracks({
    ...archive.data,
    cubes,
    cubeTracks,
    preferences: {
      ...archive.data.preferences,
      lastCubeId:
        archive.data.preferences.lastCubeId === cubeId
          ? null
          : archive.data.preferences.lastCubeId,
    },
  });
  return withPersonalSpaceDefaults(withData(archive, data, now));
}

export function addTrackToCube(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  cubeId: string,
  now = nowIso(),
): { archive: ArchiveEnvelopeV1; cubeTrack: CubeTrack; added: boolean } {
  const cube = assertRecord(archive.data.cubes, cubeId, "챕터");
  if (!isUserVisibleChapter(cube)) {
    throw new ArchiveDomainError("invalid-input", "시스템 챕터에는 직접 곡을 추가할 수 없습니다.");
  }
  return addTrackToCubeInternal(archive, trackId, cubeId, now);
}

function addTrackToCubeInternal(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  cubeId: string,
  now: string,
): { archive: ArchiveEnvelopeV1; cubeTrack: CubeTrack; added: boolean } {
  assertRecord(archive.data.tracks, trackId, "곡");
  assertRecord(archive.data.cubes, cubeId, "챕터");
  const existing = Object.values(archive.data.cubeTracks).find(
    (item) => item.trackId === trackId && item.cubeId === cubeId,
  );
  if (existing) {
    return { archive, cubeTrack: existing, added: false };
  }

  const id = createId("cube-track");
  const sortOrder = Object.values(archive.data.cubeTracks).filter(
    (item) => item.cubeId === cubeId,
  ).length;
  const cubeTrack: CubeTrack = {
    id,
    cubeId,
    trackId,
    tagIds: [],
    character: "",
    memoryPeriod: null,
    place: "",
    people: "",
    notes: [],
    sortOrder,
    source: "user",
    recordVisibility: "private",
    createdAt: now,
    updatedAt: now,
  };
  const cubes = {
    ...archive.data.cubes,
    [cubeId]: { ...archive.data.cubes[cubeId], updatedAt: now },
  };
  const next = withData(
    archive,
    {
      ...archive.data,
      cubes,
      cubeTracks: { ...archive.data.cubeTracks, [id]: cubeTrack },
    },
    now,
  );
  return { archive: next, cubeTrack, added: true };
}

export function moveInboxTrackToCube(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  cubeId: string,
  now = nowIso(),
): { archive: ArchiveEnvelopeV1; cubeTrack: CubeTrack; added: boolean } {
  if (!archive.data.inbox[trackId]) {
    throw new ArchiveDomainError("not-found", "임시 보관함에서 곡을 찾을 수 없습니다.");
  }
  const destination = assertRecord(archive.data.cubes, cubeId, "챕터");
  if (!isUserVisibleChapter(destination)) {
    throw new ArchiveDomainError("invalid-input", "사용자 챕터로만 곡을 옮길 수 있습니다.");
  }
  const added = addTrackToCube(archive, trackId, cubeId, now);
  const inbox = { ...added.archive.data.inbox };
  delete inbox[trackId];
  return {
    ...added,
    archive: withData(added.archive, { ...added.archive.data, inbox }, now),
  };
}

function ensureCaptureCube(
  archive: ArchiveEnvelopeV1,
  now: string,
): { archive: ArchiveEnvelopeV1; cube: Cube } {
  const existing = getCaptureCube(archive);
  if (existing) return { archive, cube: existing };

  const canonicalId = "system:capture";
  let id = canonicalId;
  let suffix = 1;
  while (archive.data.cubes[id]) {
    id = `${canonicalId}:${suffix}`;
    suffix += 1;
  }
  const cube: Cube = {
    id,
    parentId: null,
    name: "태그 기록",
    description: "아직 챕터를 정하지 않은 음악 기록",
    coverImageUrl: null,
    color: "violet",
    kind: "capture",
    systemKey: "capture",
    sortOrder: Object.values(archive.data.cubes).filter((item) => item.parentId === null).length,
    source: "user",
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  };
  return {
    archive: withData(
      archive,
      { ...archive.data, cubes: { ...archive.data.cubes, [id]: cube } },
      now,
    ),
    cube,
  };
}

/** Atomically turns an Inbox capture into an unassigned, tagged memory. */
export function archiveInboxTrackWithTags(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  inputs: Array<string | TagInput>,
  now = nowIso(),
): { archive: ArchiveEnvelopeV1; cubeTrack: CubeTrack } {
  if (!archive.data.inbox[trackId]) {
    throw new ArchiveDomainError("not-found", "임시 보관함에서 곡을 찾을 수 없습니다.");
  }
  if (inputs.length === 0) {
    throw new ArchiveDomainError("invalid-input", "아카이빙을 시작하려면 태그가 하나 필요합니다.");
  }
  if (inputs.length > ARCHIVE_LIMITS.tagsPerCubeTrack) {
    throw new ArchiveDomainError(
      "limit-exceeded",
      `곡마다 태그를 ${ARCHIVE_LIMITS.tagsPerCubeTrack}개까지 붙일 수 있습니다.`,
    );
  }

  const created = createTags(archive, inputs, now);
  const capture = ensureCaptureCube(created.archive, now);
  const added = addTrackToCubeInternal(capture.archive, trackId, capture.cube.id, now);
  const tagged = setCubeTrackTagIds(
    added.archive,
    added.cubeTrack.id,
    created.tags.map((tag) => tag.id),
    now,
  );
  const inbox = { ...tagged.data.inbox };
  delete inbox[trackId];
  const next = withData(tagged, { ...tagged.data, inbox }, now);
  return { archive: next, cubeTrack: next.data.cubeTracks[added.cubeTrack.id] };
}

export type MoveCaptureTrackResult =
  | { status: "moved"; archive: ArchiveEnvelopeV1; cubeTrack: CubeTrack }
  | { status: "duplicate"; archive: ArchiveEnvelopeV1; existingCubeTrack: CubeTrack };

/** Moves an unassigned memory without changing its stable identity or contents. */
export function moveCaptureTrackToCube(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  destinationCubeId: string,
  now = nowIso(),
): MoveCaptureTrackResult {
  const current = assertRecord(archive.data.cubeTracks, cubeTrackId, "곡 기록");
  const source = assertRecord(archive.data.cubes, current.cubeId, "챕터");
  const destination = assertRecord(archive.data.cubes, destinationCubeId, "챕터");
  if (source.kind !== "capture") {
    throw new ArchiveDomainError("invalid-input", "미분류 기록만 챕터로 옮길 수 있습니다.");
  }
  if (!isUserVisibleChapter(destination)) {
    throw new ArchiveDomainError("invalid-input", "사용자 챕터로만 곡을 옮길 수 있습니다.");
  }
  const duplicate = Object.values(archive.data.cubeTracks).find(
    (item) => item.cubeId === destinationCubeId && item.trackId === current.trackId,
  );
  if (duplicate) {
    return { status: "duplicate", archive, existingCubeTrack: duplicate };
  }

  const sortOrder = Object.values(archive.data.cubeTracks).filter(
    (item) => item.cubeId === destinationCubeId,
  ).length;
  const cubeTrack = { ...current, cubeId: destinationCubeId, sortOrder, updatedAt: now };
  const cubes = {
    ...archive.data.cubes,
    [source.id]: { ...source, updatedAt: now },
    [destination.id]: { ...destination, updatedAt: now },
  };
  const next = withData(
    archive,
    {
      ...archive.data,
      cubes,
      cubeTracks: { ...archive.data.cubeTracks, [cubeTrackId]: cubeTrack },
    },
    now,
  );
  return { status: "moved", archive: next, cubeTrack };
}

/** Adds an intentionally blank, independent memory to another manual chapter. */
export function addIndependentTrackMemory(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  cubeId: string,
  now = nowIso(),
): { archive: ArchiveEnvelopeV1; cubeTrack: CubeTrack; added: boolean } {
  return addTrackToCube(archive, trackId, cubeId, now);
}

export function updateCubeTrack(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  input: UpdateCubeTrackInput,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertEditableCubeTrack(archive, cubeTrackId);
  const next: CubeTrack = {
    ...current,
    ...(input.character === undefined
      ? {}
      : {
          character: cleanText(
            input.character,
            "성격 문장",
            ARCHIVE_LIMITS.character,
          ),
        }),
    ...(input.memoryPeriod === undefined
      ? {}
      : { memoryPeriod: validateMemoryPeriod(input.memoryPeriod) }),
    ...(input.place === undefined
      ? {}
      : { place: cleanText(input.place, "장소", ARCHIVE_LIMITS.place) }),
    ...(input.people === undefined
      ? {}
      : { people: cleanText(input.people, "사람", ARCHIVE_LIMITS.people) }),
    updatedAt: now,
  };
  const cubes = {
    ...archive.data.cubes,
    [current.cubeId]: { ...archive.data.cubes[current.cubeId], updatedAt: now },
  };
  return withData(
    archive,
    {
      ...archive.data,
      cubes,
      cubeTracks: { ...archive.data.cubeTracks, [cubeTrackId]: next },
    },
    now,
  );
}

function normalizeMemoryNoteInput(input: MemoryNoteInput): MemoryNoteInput {
  if (!validCalendarDate(input.listenedOn)) {
    throw new ArchiveDomainError("invalid-input", "감상 날짜가 올바르지 않습니다.");
  }
  return {
    listenedOn: input.listenedOn,
    body: cleanText(input.body, "메모", ARCHIVE_LIMITS.memo, true),
  };
}

function withUpdatedCubeTrack(
  archive: ArchiveEnvelopeV1,
  cubeTrack: CubeTrack,
  now: string,
): ArchiveEnvelopeV1 {
  return withData(
    archive,
    {
      ...archive.data,
      cubes: {
        ...archive.data.cubes,
        [cubeTrack.cubeId]: {
          ...archive.data.cubes[cubeTrack.cubeId],
          updatedAt: now,
        },
      },
      cubeTracks: {
        ...archive.data.cubeTracks,
        [cubeTrack.id]: { ...cubeTrack, updatedAt: now },
      },
    },
    now,
  );
}

export function addCubeTrackNote(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  input: MemoryNoteInput,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertEditableCubeTrack(archive, cubeTrackId);
  if (current.notes.length >= ARCHIVE_LIMITS.notesPerCubeTrack) {
    throw new ArchiveDomainError(
      "limit-exceeded",
      `곡마다 메모를 ${ARCHIVE_LIMITS.notesPerCubeTrack}개까지 남길 수 있습니다.`,
    );
  }
  const normalized = normalizeMemoryNoteInput(input);
  const note: MemoryNote = {
    id: createId("memory-note"),
    ...normalized,
    createdAt: now,
    updatedAt: now,
  };
  return withUpdatedCubeTrack(
    archive,
    { ...current, notes: [...current.notes, note] },
    now,
  );
}

export function updateCubeTrackNote(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  noteId: string,
  input: MemoryNoteInput,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertEditableCubeTrack(archive, cubeTrackId);
  const noteIndex = current.notes.findIndex((note) => note.id === noteId);
  if (noteIndex < 0) {
    throw new ArchiveDomainError("not-found", "메모를 찾을 수 없습니다.");
  }
  const normalized = normalizeMemoryNoteInput(input);
  const notes = [...current.notes];
  notes[noteIndex] = { ...notes[noteIndex], ...normalized, updatedAt: now };
  return withUpdatedCubeTrack(archive, { ...current, notes }, now);
}

export function updateCubeTrackNoteBody(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  noteId: string,
  body: string,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertEditableCubeTrack(archive, cubeTrackId);
  const noteIndex = current.notes.findIndex((note) => note.id === noteId);
  if (noteIndex < 0) {
    throw new ArchiveDomainError("not-found", "메모를 찾을 수 없습니다.");
  }
  const notes = [...current.notes];
  notes[noteIndex] = {
    ...notes[noteIndex],
    body: cleanText(body, "메모", ARCHIVE_LIMITS.memo, true),
    updatedAt: now,
  };
  return withUpdatedCubeTrack(archive, { ...current, notes }, now);
}

export function removeCubeTrackNote(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  noteId: string,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertEditableCubeTrack(archive, cubeTrackId);
  if (!current.notes.some((note) => note.id === noteId)) {
    throw new ArchiveDomainError("not-found", "메모를 찾을 수 없습니다.");
  }
  return withUpdatedCubeTrack(
    archive,
    { ...current, notes: current.notes.filter((note) => note.id !== noteId) },
    now,
  );
}

export function getCubeTrackNotes(cubeTrack: CubeTrack): MemoryNote[] {
  return [...cubeTrack.notes].sort((left, right) => {
    const dateDifference = (right.listenedOn ?? "").localeCompare(left.listenedOn ?? "");
    return dateDifference || right.createdAt.localeCompare(left.createdAt);
  });
}

export function getLatestCubeTrackNote(cubeTrack: CubeTrack): MemoryNote | null {
  return getCubeTrackNotes(cubeTrack)[0] ?? null;
}

export function removeCubeTrack(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertEditableCubeTrack(archive, cubeTrackId);
  const cubeTracks = { ...archive.data.cubeTracks };
  delete cubeTracks[cubeTrackId];
  const siblings = Object.values(cubeTracks)
    .filter((item) => item.cubeId === current.cubeId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  siblings.forEach((item, index) => {
    cubeTracks[item.id] = { ...item, sortOrder: index };
  });
  const cube = archive.data.cubes[current.cubeId];
  if (cube?.kind === "capture") {
    const removed = withData(archive, { ...archive.data, cubeTracks }, now);
    const restored = restoreInboxWhenUnarchived(removed, current.trackId, now);
    return withData(restored, pruneUnreferencedTracks(restored.data), now);
  }
  const data = pruneUnreferencedTracks({ ...archive.data, cubeTracks });
  return withData(archive, data, now);
}

function hasPersonalContent(cubeTrack: CubeTrack): boolean {
  return Boolean(
    cubeTrack.character.trim()
    || cubeTrack.memoryPeriod
    || cubeTrack.place.trim()
    || cubeTrack.people.trim()
    || cubeTrack.notes.length,
  );
}

function hasPersonalContext(archive: ArchiveEnvelopeV1, trackId: TrackId): boolean {
  return Object.values(archive.data.cubeTracks).some((cubeTrack) => {
    if (cubeTrack.trackId !== trackId) return false;
    const cube = archive.data.cubes[cubeTrack.cubeId];
    return cube?.kind === "manual" || cube?.kind === "capture";
  });
}

function restoreInboxWhenUnarchived(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  now: string,
): ArchiveEnvelopeV1 {
  if (hasPersonalContext(archive, trackId) || archive.data.inbox[trackId]) return archive;
  return withData(
    archive,
    {
      ...archive.data,
      inbox: {
        ...archive.data.inbox,
        [trackId]: { trackId, capturedAt: now, source: "user" },
      },
    },
    now,
  );
}

function normalizeCaptureAfterTagChange(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  now: string,
): ArchiveEnvelopeV1 {
  const cubeTrack = archive.data.cubeTracks[cubeTrackId];
  if (!cubeTrack || cubeTrack.tagIds.length > 0) return archive;
  const cube = archive.data.cubes[cubeTrack.cubeId];
  if (cube?.kind !== "capture" || hasPersonalContent(cubeTrack)) return archive;

  const cubeTracks = { ...archive.data.cubeTracks };
  delete cubeTracks[cubeTrackId];
  const withoutCapture = withData(archive, { ...archive.data, cubeTracks }, now);
  return restoreInboxWhenUnarchived(withoutCapture, cubeTrack.trackId, now);
}

export function setCubeTrackTags(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  inputs: Array<string | TagInput>,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  assertRecord(archive.data.cubeTracks, cubeTrackId, "곡 기록");
  if (inputs.length > ARCHIVE_LIMITS.tagsPerCubeTrack) {
    throw new ArchiveDomainError(
      "limit-exceeded",
      `곡마다 태그를 ${ARCHIVE_LIMITS.tagsPerCubeTrack}개까지 붙일 수 있습니다.`,
    );
  }
  const created = createTags(archive, inputs, now);
  return setCubeTrackTagIds(
    created.archive,
    cubeTrackId,
    created.tags.map((tag) => tag.id),
    now,
  );
}

export function createTags(
  archive: ArchiveEnvelopeV1,
  inputs: Array<string | TagInput>,
  now = nowIso(),
): { archive: ArchiveEnvelopeV1; tags: TagDefinition[]; created: number } {
  const tags = { ...archive.data.tags };
  const byNormalized = new Map(
    Object.values(tags).map((tag) => [tag.normalizedLabel, tag] as const),
  );
  const result: TagDefinition[] = [];
  const seen = new Set<string>();
  let created = 0;

  for (const input of inputs) {
    const inputCategory = typeof input === "string" ? "custom" : (input.category ?? "custom");
    if (!TAG_CATEGORIES.includes(inputCategory)) {
      throw new ArchiveDomainError("invalid-input", "지원하지 않는 태그 카테고리입니다.");
    }
    const category = canonicalTagCategory(inputCategory);
    const label = cleanText(
      typeof input === "string" ? input : input.label,
      "태그",
      ARCHIVE_LIMITS.tagLabel,
      true,
    );
    const normalizedLabel = normalizeTagLabel(label);
    if (seen.has(normalizedLabel)) continue;
    seen.add(normalizedLabel);

    const existing = byNormalized.get(normalizedLabel);
    if (existing) {
      result.push(existing);
      continue;
    }

    const id = createId("tag");
    const tag: TagDefinition = {
      id,
      label,
      normalizedLabel,
      category,
      source: "user",
      createdAt: now,
    };
    tags[id] = tag;
    byNormalized.set(normalizedLabel, tag);
    result.push(tag);
    created += 1;
  }

  return {
    archive: created
      ? withData(archive, { ...archive.data, tags }, now)
      : archive,
    tags: result,
    created,
  };
}

export function updateTag(
  archive: ArchiveEnvelopeV1,
  tagId: string,
  input: { label?: string; category?: TagCategory },
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertRecord(archive.data.tags, tagId, "태그");
  const label = input.label === undefined
    ? current.label
    : cleanText(input.label, "태그", ARCHIVE_LIMITS.tagLabel, true);
  const inputCategory = input.category ?? current.category;
  if (!TAG_CATEGORIES.includes(inputCategory)) {
    throw new ArchiveDomainError("invalid-input", "지원하지 않는 태그 카테고리입니다.");
  }
  const category = canonicalTagCategory(inputCategory);
  const normalizedLabel = normalizeTagLabel(label);
  const duplicate = Object.values(archive.data.tags).find(
    (tag) => tag.id !== tagId && tag.normalizedLabel === normalizedLabel,
  );
  if (duplicate) {
    throw new ArchiveDomainError("duplicate", "이미 같은 이름의 태그가 있습니다.");
  }
  const next: TagDefinition = { ...current, label, normalizedLabel, category };
  return withData(
    archive,
    { ...archive.data, tags: { ...archive.data.tags, [tagId]: next } },
    now,
  );
}

export function deleteTag(
  archive: ArchiveEnvelopeV1,
  tagId: string,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  assertRecord(archive.data.tags, tagId, "태그");
  const tags = { ...archive.data.tags };
  delete tags[tagId];
  const changedCubeIds = new Set<string>();
  const cubeTracks = Object.fromEntries(
    Object.entries(archive.data.cubeTracks).map(([id, item]) => {
      if (!item.tagIds.includes(tagId)) return [id, item];
      changedCubeIds.add(item.cubeId);
      return [id, { ...item, tagIds: item.tagIds.filter((value) => value !== tagId), updatedAt: now }];
    }),
  );
  const cubes = Object.fromEntries(
    Object.entries(archive.data.cubes).map(([id, cube]) => [
      id,
      changedCubeIds.has(id) ? { ...cube, updatedAt: now } : cube,
    ]),
  );
  const removed = withData(archive, { ...archive.data, tags, cubeTracks, cubes }, now);
  return [...changedCubeIds].reduce((currentArchive, cubeId) => {
    const affectedIds = Object.values(currentArchive.data.cubeTracks)
      .filter((item) => item.cubeId === cubeId)
      .map((item) => item.id);
    return affectedIds.reduce(
      (nextArchive, cubeTrackId) => normalizeCaptureAfterTagChange(nextArchive, cubeTrackId, now),
      currentArchive,
    );
  }, removed);
}

export function setCubeTrackTagIds(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  inputTagIds: string[],
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const cubeTrack = assertEditableCubeTrack(archive, cubeTrackId);
  const tagIds = [...new Set(inputTagIds)];
  tagIds.forEach((tagId) => assertRecord(archive.data.tags, tagId, "태그"));
  if (tagIds.length > ARCHIVE_LIMITS.tagsPerCubeTrack) {
    throw new ArchiveDomainError(
      "limit-exceeded",
      `곡마다 태그를 ${ARCHIVE_LIMITS.tagsPerCubeTrack}개까지 붙일 수 있습니다.`,
    );
  }
  const nextCubeTrack = { ...cubeTrack, tagIds, updatedAt: now };
  const updated = withData(
    archive,
    {
      ...archive.data,
      cubeTracks: { ...archive.data.cubeTracks, [cubeTrackId]: nextCubeTrack },
      cubes: {
        ...archive.data.cubes,
        [cubeTrack.cubeId]: {
          ...archive.data.cubes[cubeTrack.cubeId],
          updatedAt: now,
        },
      },
    },
    now,
  );
  return normalizeCaptureAfterTagChange(updated, cubeTrackId, now);
}

export function reorderCubeTracks(
  archive: ArchiveEnvelopeV1,
  cubeId: string,
  orderedIds: string[],
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const cube = assertRecord(archive.data.cubes, cubeId, "챕터");
  if (cube.kind === "monthly") {
    throw new ArchiveDomainError("invalid-input", "월별 자동 기록은 편집할 수 없습니다.");
  }
  const currentIds = Object.values(archive.data.cubeTracks)
    .filter((item) => item.cubeId === cubeId)
    .map((item) => item.id);
  assertSameIds(currentIds, orderedIds, "챕터 안의 곡 순서");
  const cubeTracks = { ...archive.data.cubeTracks };
  orderedIds.forEach((id, index) => {
    cubeTracks[id] = { ...cubeTracks[id], sortOrder: index, updatedAt: now };
  });
  return withData(
    archive,
    {
      ...archive.data,
      cubeTracks,
      cubes: {
        ...archive.data.cubes,
        [cubeId]: { ...archive.data.cubes[cubeId], updatedAt: now },
      },
    },
    now,
  );
}

function assertSameIds(currentIds: string[], orderedIds: string[], label: string): void {
  const orderedIdSet = new Set(orderedIds);
  if (
    currentIds.length !== orderedIds.length ||
    orderedIdSet.size !== orderedIds.length ||
    currentIds.some((id) => !orderedIdSet.has(id))
  ) {
    throw new ArchiveDomainError("invalid-order", `${label}가 현재 항목과 일치하지 않습니다.`);
  }
}

export function isUserVisibleChapter(cube: Cube | undefined | null): cube is Cube {
  return cube?.kind === "manual" && cube.systemKey === null;
}

function isManualRootChapter(cube: Cube | undefined | null): cube is Cube {
  return isUserVisibleChapter(cube) && cube.parentId === null;
}

/** Adds safe defaults for data written before the personal-space schema. */
function withPersonalSpaceDefaults(archive: ArchiveEnvelopeV1): ArchiveEnvelopeV1 {
  const cubes = Object.fromEntries(Object.entries(archive.data.cubes).map(([id, cube]) => [
    id,
    cube.visibility === "public" || cube.visibility === "private"
      ? cube
      : { ...cube, visibility: "private" as const },
  ])) as Record<string, Cube>;
  const cubeTracks = Object.fromEntries(Object.entries(archive.data.cubeTracks).map(([id, cubeTrack]) => [
    id,
    cubeTrack.recordVisibility === "public" || cubeTrack.recordVisibility === "private"
      ? cubeTrack
      : { ...cubeTrack, recordVisibility: "private" as const },
  ])) as Record<string, CubeTrack>;
  const candidateIds = Array.isArray(archive.data.space?.featuredCubeIds)
    ? archive.data.space.featuredCubeIds
    : [];
  const usableFeaturedIds = [...new Set(candidateIds)]
    .filter((id) => isManualRootChapter(cubes[id]))
    .slice(0, 3);
  const fallbackIds = Object.values(cubes)
    .filter(isManualRootChapter)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id))
    .slice(0, 3)
    .map((cube) => cube.id);
  const rawSpace = archive.data.space;
  const space: PersonalSpace = {
    themeId: SPACE_THEME_IDS.includes(rawSpace?.themeId) ? rawSpace.themeId : DEFAULT_PERSONAL_SPACE.themeId,
    layoutId: SPACE_LAYOUT_IDS.includes(rawSpace?.layoutId) ? rawSpace.layoutId : DEFAULT_PERSONAL_SPACE.layoutId,
    featuredCubeIds: usableFeaturedIds.length ? usableFeaturedIds : fallbackIds,
  };
  const changed = !rawSpace
    || rawSpace.themeId !== space.themeId
    || rawSpace.layoutId !== space.layoutId
    || rawSpace.featuredCubeIds.join("\u0000") !== space.featuredCubeIds.join("\u0000")
    || Object.values(archive.data.cubes).some((cube) => cube.visibility !== "public" && cube.visibility !== "private")
    || Object.values(archive.data.cubeTracks).some((cubeTrack) => cubeTrack.recordVisibility !== "public" && cubeTrack.recordVisibility !== "private");
  return changed
    ? withData(archive, { ...archive.data, cubes, cubeTracks, space }, archive.updatedAt)
    : archive;
}

export function updatePersonalSpace(
  archive: ArchiveEnvelopeV1,
  input: Partial<PersonalSpace>,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = withPersonalSpaceDefaults(archive);
  const candidate: PersonalSpace = {
    themeId: input.themeId ?? current.data.space.themeId,
    layoutId: input.layoutId ?? current.data.space.layoutId,
    featuredCubeIds: input.featuredCubeIds ?? current.data.space.featuredCubeIds,
  };
  if (!SPACE_THEME_IDS.includes(candidate.themeId) || !SPACE_LAYOUT_IDS.includes(candidate.layoutId)) {
    throw new ArchiveDomainError("invalid-input", "지원하지 않는 내 공간 설정입니다.");
  }
  if (candidate.featuredCubeIds.length > 3 || new Set(candidate.featuredCubeIds).size !== candidate.featuredCubeIds.length) {
    throw new ArchiveDomainError("invalid-input", "대표 챕터 설정이 올바르지 않습니다.");
  }
  if (!candidate.featuredCubeIds.every((id) => isManualRootChapter(current.data.cubes[id]))) {
    throw new ArchiveDomainError("invalid-input", "대표 챕터는 최상위 수동 챕터만 선택할 수 있습니다.");
  }
  return withData(current, { ...current.data, space: candidate }, now);
}

export function setCubeTrackRecordVisibility(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  recordVisibility: RecordVisibility,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertEditableCubeTrack(archive, cubeTrackId);
  if (recordVisibility !== "public" && recordVisibility !== "private") {
    throw new ArchiveDomainError("invalid-input", "기록 공개 상태가 올바르지 않습니다.");
  }
  return withData(archive, {
    ...archive.data,
    cubeTracks: {
      ...archive.data.cubeTracks,
      [cubeTrackId]: { ...current, recordVisibility, updatedAt: now },
    },
  }, now);
}

export type VisitorSpaceChapter = {
  chapter: Cube;
  tracks: Array<{ cubeTrack: CubeTrack; track: TrackReference; tags: TagDefinition[]; privateRecord: boolean }>;
};

export function getVisitorSpaceChapters(archive: ArchiveEnvelopeV1): VisitorSpaceChapter[] {
  const normalized = withPersonalSpaceDefaults(archive);
  return getRootCubes(normalized)
    .filter((chapter) => chapter.visibility === "public")
    .map((chapter) => ({
      chapter,
      tracks: getCubeTracks(normalized, chapter.id).map((entry) => ({
        ...entry,
        tags: entry.cubeTrack.recordVisibility === "public" ? entry.tags : [],
        privateRecord: entry.cubeTrack.recordVisibility !== "public",
      })),
    }));
}

export function getCaptureCube(archive: ArchiveEnvelopeV1): Cube | null {
  return Object.values(archive.data.cubes).find(
    (cube) => cube.kind === "capture" && cube.systemKey === "capture",
  ) ?? null;
}

export function getUserVisibleChapters(archive: ArchiveEnvelopeV1): Cube[] {
  return Object.values(archive.data.cubes)
    .filter(isUserVisibleChapter)
    .sort(compareCubeOrder);
}

export function getContextArchiveState(
  archive: ArchiveEnvelopeV1,
  cubeTrackOrId: CubeTrack | string,
): ContextArchiveState {
  const cubeTrack = typeof cubeTrackOrId === "string"
    ? assertRecord(archive.data.cubeTracks, cubeTrackOrId, "곡 기록")
    : cubeTrackOrId;
  const cube = assertRecord(archive.data.cubes, cubeTrack.cubeId, "챕터");
  if (cube.kind === "monthly") return "monthly";
  if (cube.kind === "capture") {
    return cubeTrack.tagIds.length > 0 ? "unassigned-archived" : "unassigned-draft";
  }
  return cubeTrack.tagIds.length > 0 ? "chapter-archived" : "chapter-only";
}

export function getTrackArchiveSummary(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
): TrackArchiveSummary {
  const summary: TrackArchiveSummary = {
    trackId,
    hasInbox: Boolean(archive.data.inbox[trackId]),
    captureState: null,
    captureContextId: null,
    manualContextStates: [],
    monthlyContextIds: [],
  };
  Object.values(archive.data.cubeTracks)
    .filter((cubeTrack) => cubeTrack.trackId === trackId)
    .forEach((cubeTrack) => {
      const cube = archive.data.cubes[cubeTrack.cubeId];
      if (!cube) return;
      if (cube.kind === "monthly") {
        summary.monthlyContextIds.push(cubeTrack.id);
      } else if (cube.kind === "capture") {
        summary.captureContextId = cubeTrack.id;
        summary.captureState = getContextArchiveState(archive, cubeTrack) as TrackArchiveSummary["captureState"];
      } else {
        summary.manualContextStates.push({
          cubeTrackId: cubeTrack.id,
          cubeId: cube.id,
          state: getContextArchiveState(archive, cubeTrack) as "chapter-only" | "chapter-archived",
        });
      }
    });
  summary.manualContextStates.sort((left, right) => left.cubeTrackId.localeCompare(right.cubeTrackId));
  summary.monthlyContextIds.sort();
  return summary;
}

export function getContextualMemoriesForTrack(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  tagIds: string[] = [],
): ContextualMemory[] {
  const requiredTags = new Set(tagIds);
  return Object.values(archive.data.cubeTracks)
    .filter((cubeTrack) => cubeTrack.trackId === trackId)
    .map((cubeTrack) => ({ cubeTrack, cube: archive.data.cubes[cubeTrack.cubeId] }))
    .filter((item): item is { cubeTrack: CubeTrack; cube: Cube } => Boolean(item.cube))
    .filter(({ cube }) => cube.kind !== "monthly")
    .filter(({ cubeTrack }) => (
      requiredTags.size === 0 || [...requiredTags].every((tagId) => cubeTrack.tagIds.includes(tagId))
    ))
    .map(({ cubeTrack, cube }) => ({
      cubeTrack,
      cube,
      tags: cubeTrack.tagIds
        .map((tagId) => archive.data.tags[tagId])
        .filter((tag): tag is TagDefinition => Boolean(tag)),
    }))
    .sort((left, right) => (
      right.cubeTrack.updatedAt.localeCompare(left.cubeTrack.updatedAt)
      || left.cubeTrack.id.localeCompare(right.cubeTrack.id)
    ));
}

export function getTagGroupResults(
  archive: ArchiveEnvelopeV1,
  tagIds: string[],
): TagGroupResult[] {
  const uniqueTagIds = [...new Set(tagIds)];
  uniqueTagIds.forEach((tagId) => assertRecord(archive.data.tags, tagId, "태그"));
  if (uniqueTagIds.length === 0) return [];

  const byTrack = new Map<TrackId, ContextualMemory[]>();
  Object.keys(archive.data.tracks).forEach((trackId) => {
    const memories = getContextualMemoriesForTrack(archive, trackId as TrackId, uniqueTagIds);
    if (memories.length) byTrack.set(trackId as TrackId, memories);
  });
  return [...byTrack.entries()]
    .map(([trackId, memories]) => ({ track: archive.data.tracks[trackId], memories }))
    .filter((item): item is TagGroupResult => Boolean(item.track))
    .sort((left, right) => (
      right.memories[0].cubeTrack.updatedAt.localeCompare(left.memories[0].cubeTrack.updatedAt)
      || left.track.title.localeCompare(right.track.title, "ko-KR")
      || left.track.id.localeCompare(right.track.id)
    ));
}

/** Returns the user's reusable vocabulary in deterministic recommendation order. */
export function getTagGroups(
  archive: ArchiveEnvelopeV1,
  contextCubeTrackId?: string,
): TagGroup[] {
  const context = contextCubeTrackId
    ? archive.data.cubeTracks[contextCubeTrackId]
    : undefined;
  const selected = new Set(context?.tagIds ?? []);
  const contextCubeId = context?.cubeId;

  const groups = Object.values(archive.data.tags).map((tag) => {
    const memories = Object.values(archive.data.cubeTracks).filter((cubeTrack) => {
      const cube = archive.data.cubes[cubeTrack.cubeId];
      return cube?.kind !== "monthly" && cubeTrack.tagIds.includes(tag.id);
    });
    return {
      tag,
      trackCount: new Set(memories.map((memory) => memory.trackId)).size,
      memoryCount: memories.length,
      updatedAt: memories.reduce<string | null>(
        (latest, memory) => !latest || memory.updatedAt > latest ? memory.updatedAt : latest,
        null,
      ),
      contextCount: contextCubeId
        ? memories.filter((memory) => memory.cubeId === contextCubeId).length
        : 0,
    };
  });

  return groups.sort((left, right) => (
    Number(selected.has(right.tag.id)) - Number(selected.has(left.tag.id))
    || right.contextCount - left.contextCount
    || right.memoryCount - left.memoryCount
    || (right.updatedAt ?? "").localeCompare(left.updatedAt ?? "")
    || left.tag.label.localeCompare(right.tag.label, "ko-KR")
    || left.tag.id.localeCompare(right.tag.id)
  )).map((group) => ({
    tag: group.tag,
    trackCount: group.trackCount,
    memoryCount: group.memoryCount,
    updatedAt: group.updatedAt,
  }));
}

export function getRootCubes(archive: ArchiveEnvelopeV1): Cube[] {
  return Object.values(archive.data.cubes)
    .filter((cube) => cube.parentId === null && isUserVisibleChapter(cube))
    .sort(compareCubeOrder);
}

export function getChildCubes(
  archive: ArchiveEnvelopeV1,
  parentId: string,
): Cube[] {
  assertRecord(archive.data.cubes, parentId, "상위 챕터");
  return Object.values(archive.data.cubes)
    .filter((cube) => cube.parentId === parentId && isUserVisibleChapter(cube))
    .sort(compareCubeOrder);
}

export function getCubeAncestors(
  archive: ArchiveEnvelopeV1,
  cubeId: string,
): Cube[] {
  const cube = assertRecord(archive.data.cubes, cubeId, "챕터");
  const ancestors: Cube[] = [];
  const visited = new Set([cubeId]);
  let parentId = cube.parentId;

  while (parentId !== null) {
    if (visited.has(parentId)) {
      throw new ArchiveDomainError("invalid-input", "챕터 계층에 순환이 있습니다.");
    }
    visited.add(parentId);
    const parent = assertRecord(archive.data.cubes, parentId, "상위 챕터");
    ancestors.push(parent);
    parentId = parent.parentId;
  }

  return ancestors.reverse();
}

export function getCubesInTreeOrder(archive: ArchiveEnvelopeV1): Cube[] {
  const childrenByParent = new Map<string | null, Cube[]>();
  getUserVisibleChapters(archive).forEach((cube) => {
    const siblings = childrenByParent.get(cube.parentId) ?? [];
    siblings.push(cube);
    childrenByParent.set(cube.parentId, siblings);
  });
  childrenByParent.forEach((siblings) => siblings.sort(compareCubeOrder));

  const ordered: Cube[] = [];
  function appendBranch(cube: Cube) {
    ordered.push(cube);
    childrenByParent.get(cube.id)?.forEach(appendBranch);
  }
  childrenByParent.get(null)?.forEach(appendBranch);
  return ordered;
}

export function getCubeTracks(
  archive: ArchiveEnvelopeV1,
  cubeId: string,
): Array<{ cubeTrack: CubeTrack; track: TrackReference; tags: TagDefinition[] }> {
  return Object.values(archive.data.cubeTracks)
    .filter((item) => item.cubeId === cubeId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((cubeTrack) => ({
      cubeTrack,
      track: archive.data.tracks[cubeTrack.trackId],
      tags: cubeTrack.tagIds
        .map((tagId) => archive.data.tags[tagId])
        .filter((tag): tag is TagDefinition => Boolean(tag)),
    }))
    .filter((item) => Boolean(item.track));
}

export function searchArchive(
  archive: ArchiveEnvelopeV1,
  options: SearchArchiveOptions = {},
): ArchiveSearchResult[] {
  const query = normalizeSearch(options.query ?? "");
  const cubeIds = new Set(options.cubeIds ?? []);
  const requiredTagIds = new Set(options.tagIds ?? []);
  const requiredTagLabels = new Set(
    (options.tagLabels ?? []).map(normalizeTagLabel).filter(Boolean),
  );
  const tagMatch = options.tagMatch ?? "all";
  const results: ArchiveSearchResult[] = [];

  for (const cubeTrack of Object.values(archive.data.cubeTracks)) {
    const track = archive.data.tracks[cubeTrack.trackId];
    const cube = archive.data.cubes[cubeTrack.cubeId];
    if (!track || !cube || cube.kind === "monthly") continue;
    if (cubeIds.size && !cubeIds.has(cube.id)) continue;
    const matchesTagIds = [...requiredTagIds].filter((tagId) => cubeTrack.tagIds.includes(tagId));
    if (
      requiredTagIds.size
      && (tagMatch === "all"
        ? matchesTagIds.length !== requiredTagIds.size
        : matchesTagIds.length === 0)
    ) continue;

    const tags = cubeTrack.tagIds
      .map((tagId) => archive.data.tags[tagId])
      .filter((tag): tag is TagDefinition => Boolean(tag));
    const normalizedLabels = new Set(tags.map((tag) => tag.normalizedLabel));
    const matchesTagLabels = [...requiredTagLabels].filter((label) => normalizedLabels.has(label));
    if (
      requiredTagLabels.size
      && (tagMatch === "all"
        ? matchesTagLabels.length !== requiredTagLabels.size
        : matchesTagLabels.length === 0)
    ) continue;

    const memory = memoryPeriodText(cubeTrack.memoryPeriod);
    const notes = getCubeTrackNotes(cubeTrack);
    const matchedNote = query
      ? notes.find((note) => normalizeSearch(memoryNoteSearchText(note)).includes(query)) ?? null
      : notes[0] ?? null;
    const searchable = normalizeSearch(
      [
        track.title,
        track.artist,
        track.album,
        track.genre,
        registrationDateText(track.registeredAt),
        cube.name,
        cube.description,
        tags.map((tag) => tag.label).join(" "),
        cubeTrack.character,
        memory,
        cubeTrack.place,
        cubeTrack.people,
        notes.map(memoryNoteSearchText).join(" "),
      ].join(" "),
    );
    if (query && !searchable.includes(query)) continue;
    results.push({ kind: "cube-track", track, cube, cubeTrack, tags, matchedNote });
  }

  const includeInbox = options.includeInbox !== false;
  if (includeInbox && !cubeIds.size && !requiredTagIds.size && !requiredTagLabels.size) {
    for (const inbox of Object.values(archive.data.inbox)) {
      if (!inbox) continue;
      const track = archive.data.tracks[inbox.trackId];
      if (!track) continue;
      const searchable = normalizeSearch(
        [
          track.title,
          track.artist,
          track.album,
          track.genre,
          registrationDateText(track.registeredAt),
        ].join(" "),
      );
      if (!query || searchable.includes(query)) {
        results.push({ kind: "inbox", track, inbox, tags: [] });
      }
    }
  }

  return results.sort((left, right) => resultDate(right).localeCompare(resultDate(left)));
}

function normalizeSearch(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ").toLocaleLowerCase("ko-KR");
}

function registrationDateText(registeredAt: string | undefined): string {
  if (!registeredAt || !validIsoDate(registeredAt)) return "";
  const { key, year, month } = registrationMonth(registeredAt);
  const paddedMonth = String(month).padStart(2, "0");
  return [
    key,
    `${year}-${month}`,
    `${year}.${paddedMonth}`,
    `${year}/${paddedMonth}`,
    `${year} ${paddedMonth}`,
    `${year} ${month}`,
    `${year}년 ${month}월`,
  ].join(" ");
}

function resultDate(result: ArchiveSearchResult): string {
  return result.kind === "cube-track" ? result.cubeTrack.updatedAt : result.inbox.capturedAt;
}

function memoryPeriodText(memoryPeriod: MemoryPeriod): string {
  if (!memoryPeriod) return "";
  if (memoryPeriod.kind === "month") {
    return `${memoryPeriod.year ?? ""} ${memoryPeriod.month}월`;
  }
  const seasons: Record<Season, string> = {
    spring: "봄",
    summer: "여름",
    autumn: "가을",
    winter: "겨울",
  };
  return `${memoryPeriod.year ?? ""} ${seasons[memoryPeriod.season]}`;
}

function memoryNoteSearchText(note: MemoryNote): string {
  if (!note.listenedOn) return note.body;
  const [year, month, day] = note.listenedOn.split("-").map(Number);
  return [
    note.body,
    note.listenedOn,
    `${year}.${month}.${day}`,
    `${year}년 ${month}월 ${day}일`,
  ].join(" ");
}

export function selectRecap(
  archive: ArchiveEnvelopeV1,
  options: RecapOptions = {},
): RecapEntry[] {
  if (!archive.data.preferences.recapEnabled) return [];
  const mode = options.mode ?? "this-time";
  const limit = Math.max(0, Math.floor(options.limit ?? 6));
  if (!limit) return [];
  const now = typeof options.now === "string" ? new Date(options.now) : (options.now ?? new Date());
  if (!Number.isFinite(now.getTime())) {
    throw new ArchiveDomainError("invalid-input", "회고 기준 날짜가 올바르지 않습니다.");
  }

  const candidates: Array<Omit<RecapEntry, "reason">> = [];
  Object.values(archive.data.cubeTracks).forEach((cubeTrack) => {
    const track = archive.data.tracks[cubeTrack.trackId];
    const cube = archive.data.cubes[cubeTrack.cubeId];
    if (!track || !cube) return;
    const tags = cubeTrack.tagIds
      .map((tagId) => archive.data.tags[tagId])
      .filter((tag): tag is TagDefinition => Boolean(tag));
    getCubeTrackNotes(cubeTrack).forEach((note) => {
      candidates.push({ track, cube, cubeTrack, note, tags });
    });
  });

  if (mode === "random") {
    const random = options.random ?? Math.random;
    return shuffled(candidates, random)
      .slice(0, limit)
      .map((entry) => ({ ...entry, reason: "random" }));
  }

  if (mode === "timeline") {
    return candidates
      .sort((a, b) => recapSortValue(b.cubeTrack, b.note) - recapSortValue(a.cubeTrack, a.note))
      .slice(0, limit)
      .map((entry) => ({ ...entry, reason: "saved-date" }));
  }

  const currentMonth = now.getMonth() + 1;
  const currentSeason = monthToSeason(currentMonth);
  const currentYear = now.getFullYear();
  const matched: Array<RecapEntry | null> = candidates.map<RecapEntry | null>((entry) => {
      if (entry.note.listenedOn) {
        const [year, month] = entry.note.listenedOn.split("-").map(Number);
        return month === currentMonth && year < currentYear
          ? { ...entry, reason: "same-month" as const }
          : null;
      }
      const period = entry.cubeTrack.memoryPeriod;
      if (
        period?.kind === "month" &&
        period.month === currentMonth &&
        (period.year === null || period.year < currentYear)
      ) {
        return { ...entry, reason: "same-month" as const };
      }
      if (
        period?.kind === "season" &&
        period.season === currentSeason &&
        (period.year === null || period.year < currentYear)
      ) {
        return { ...entry, reason: "same-season" as const };
      }
      const createdAt = new Date(entry.note.createdAt);
      if (createdAt.getMonth() + 1 === currentMonth && createdAt.getFullYear() < currentYear) {
        return { ...entry, reason: "saved-date" as const };
      }
      return null;
    });

  return matched
    .filter((entry): entry is RecapEntry => entry !== null)
    .sort((a, b) => recapSortValue(b.cubeTrack, b.note) - recapSortValue(a.cubeTrack, a.note))
    .slice(0, limit);
}

function monthToSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function recapSortValue(cubeTrack: CubeTrack, note: MemoryNote): number {
  if (note.listenedOn) return Date.parse(`${note.listenedOn}T00:00:00.000Z`);
  const period = cubeTrack.memoryPeriod;
  if (period?.year) {
    const month =
      period.kind === "month"
        ? period.month
        : { spring: 3, summer: 6, autumn: 9, winter: 12 }[period.season];
    return Date.UTC(period.year, month - 1, 1);
  }
  return Date.parse(note.createdAt);
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

export function removeSeedData(
  archive: ArchiveEnvelopeV1,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const seedCubeIds = new Set(
    Object.values(archive.data.cubes)
      .filter((cube) => cube.source === "seed")
      .map((cube) => cube.id),
  );
  const cubes = Object.fromEntries(
    Object.entries(archive.data.cubes)
      .filter(([, cube]) => cube.source !== "seed")
      .map(([id, cube]) => {
        let parentId = cube.parentId;
        while (parentId !== null && seedCubeIds.has(parentId)) {
          parentId = archive.data.cubes[parentId]?.parentId ?? null;
        }
        return [
          id,
          parentId === cube.parentId
            ? cube
            : { ...cube, parentId, updatedAt: now },
        ];
      }),
  ) as Record<string, Cube>;
  new Set(Object.values(cubes).map((cube) => cube.parentId)).forEach((parentId) => {
    reindexCubeSiblings(cubes, parentId);
  });
  const cubeTracks = Object.fromEntries(
    Object.entries(archive.data.cubeTracks).filter(
      ([, item]) => item.source !== "seed" && !seedCubeIds.has(item.cubeId),
    ),
  );
  const inbox = Object.fromEntries(
    Object.entries(archive.data.inbox).filter(([, item]) => item?.source !== "seed"),
  ) as Partial<Record<TrackId, InboxEntry>>;
  const usedTagIds = new Set(
    Object.values(cubeTracks).flatMap((item) => item.tagIds),
  );
  const tags = Object.fromEntries(
    Object.entries(archive.data.tags).filter(
      ([id, tag]) => (
        usedTagIds.has(id)
        || tag.source !== "seed"
      ),
    ),
  );
  const data = pruneUnreferencedTracks({
    ...archive.data,
    cubes,
    cubeTracks,
    inbox,
    tags,
    preferences: {
      ...archive.data.preferences,
      seedDismissed: true,
      lastCubeId:
        archive.data.preferences.lastCubeId && seedCubeIds.has(archive.data.preferences.lastCubeId)
          ? null
          : archive.data.preferences.lastCubeId,
    },
  });
  return withData(archive, data, now);
}

export function restoreSeedData(
  archive: ArchiveEnvelopeV1,
  now = nowIso(),
  force = false,
): ArchiveEnvelopeV1 {
  if (archive.data.preferences.seedDismissed && !force) return archive;
  const seed = createSeedArchive();
  const cubes = {
    ...seed.data.cubes,
    ...Object.fromEntries(
      Object.entries(archive.data.cubes).filter(([, cube]) => cube.source !== "seed"),
    ),
  };
  const cubeTracks: Record<string, CubeTrack> = { ...seed.data.cubeTracks };
  Object.entries(archive.data.cubeTracks).forEach(([id, cubeTrack]) => {
    if (cubeTrack.source !== "seed") {
      cubeTracks[id] = cubeTrack;
      return;
    }
    const bundled = cubeTracks[id];
    if (!bundled) return;
    const userNotes = cubeTrack.notes.filter((note) => !note.id.startsWith("seed:memory-note:"));
    cubeTracks[id] = { ...bundled, notes: [...bundled.notes, ...userNotes] };
  });
  const tags = {
    ...seed.data.tags,
    ...Object.fromEntries(
      Object.entries(archive.data.tags).filter(([, tag]) => tag.source !== "seed"),
    ),
  };
  const inbox = {
    ...seed.data.inbox,
    ...Object.fromEntries(
      Object.entries(archive.data.inbox).filter(([, entry]) => entry?.source !== "seed"),
    ),
  };
  const data = pruneUnreferencedTracks({
    ...archive.data,
    tracks: { ...seed.data.tracks, ...archive.data.tracks },
    cubes,
    cubeTracks,
    tags,
    inbox,
    preferences: { ...archive.data.preferences, seedDismissed: false },
  });
  return withData(archive, data, now);
}

export function resetArchive(
  mode: "seed" | "empty",
  now = nowIso(),
): ArchiveEnvelopeV1 {
  return mode === "seed" ? createSeedArchive() : createEmptyArchive(now);
}

export function validateArchiveEnvelope(value: unknown): value is ArchiveEnvelopeV1 {
  if (
    !isRecord(value)
    || value.schemaVersion !== ARCHIVE_SCHEMA_VERSION
    || value.seedVersion !== ARCHIVE_SEED_VERSION
  ) return false;
  if (!validIsoDate(value.updatedAt) || !isRecord(value.data)) return false;
  const data = value.data;
  if (
    !isRecord(data.tracks) ||
    !isRecord(data.cubes) ||
    !isRecord(data.cubeTracks) ||
    !isRecord(data.tags) ||
    !isRecord(data.inbox) ||
    !isPersonalSpace(data.space) ||
    !isPreferences(data.preferences)
  ) {
    return false;
  }

  const tracks = data.tracks as Record<string, unknown>;
  const cubes = data.cubes as Record<string, unknown>;
  const cubeTracks = data.cubeTracks as Record<string, unknown>;
  const tags = data.tags as Record<string, unknown>;
  const inbox = data.inbox as Record<string, unknown>;

  if (
    !Object.entries(tracks).every(([id, track]) => isTrackReference(track) && track.id === id) ||
    !Object.entries(cubes).every(([id, cube]) => isCube(cube) && cube.id === id) ||
    !Object.entries(tags).every(([id, tag]) => isTagDefinition(tag) && tag.id === id) ||
    !Object.entries(inbox).every(
      ([id, entry]) => isInboxEntry(entry) && entry.trackId === id && Boolean(tracks[id]),
    )
  ) {
    return false;
  }
  if (!hasValidCubeHierarchy(cubes as Record<string, Cube>)) return false;
  if (!hasValidSystemCubes(cubes as Record<string, Cube>)) return false;

  const seenCubeTracks = new Set<string>();
  for (const item of Object.values(cubeTracks)) {
    if (!isCubeTrack(item)) return false;
    const identity = `${item.cubeId}\u0000${item.trackId}`;
    if (seenCubeTracks.has(identity)) return false;
    seenCubeTracks.add(identity);
  }

  for (const trackId of Object.keys(inbox)) {
    const hasPersonalMemory = Object.values(cubeTracks).some((item) => {
      if (!isCubeTrack(item) || item.trackId !== trackId) return false;
      const cube = cubes[item.cubeId];
      return isCube(cube) && (cube.kind === "manual" || cube.kind === "capture");
    });
    if (hasPersonalMemory) return false;
  }

  return Object.entries(cubeTracks).every(([id, item]) => {
    if (!isCubeTrack(item) || item.id !== id) return false;
    return (
      Boolean(cubes[item.cubeId]) &&
      Boolean(tracks[item.trackId]) &&
      item.tagIds.every((tagId) => Boolean(tags[tagId]))
    );
  });
}

function hasValidSystemCubes(cubes: Record<string, Cube>): boolean {
  const captureCubes = Object.values(cubes).filter((cube) => cube.kind === "capture");
  if (captureCubes.length > 1) return false;
  const capture = captureCubes[0];
  if (
    capture
    && (
      capture.systemKey !== "capture"
      || capture.parentId !== null
      || Object.values(cubes).some((cube) => cube.parentId === capture.id)
    )
  ) return false;

  const monthKeys = new Set<string>();
  for (const cube of Object.values(cubes)) {
    if (cube.kind === "manual" && cube.systemKey !== null) return false;
    if (cube.kind === "capture" && cube.systemKey !== "capture") return false;
    if (cube.kind === "monthly") {
      if (
        typeof cube.systemKey !== "string"
        || !/^month:\d{4}-(?:0[1-9]|1[0-2])$/.test(cube.systemKey)
        || cube.parentId !== null
        || monthKeys.has(cube.systemKey)
      ) return false;
      monthKeys.add(cube.systemKey);
    }
  }
  return true;
}

function hasValidCubeHierarchy(cubes: Record<string, Cube>): boolean {
  for (const cube of Object.values(cubes)) {
    const visited = new Set([cube.id]);
    let parentId = cube.parentId;
    while (parentId !== null) {
      const parent = cubes[parentId];
      if (!parent || visited.has(parentId)) return false;
      visited.add(parentId);
      parentId = parent.parentId;
    }
  }
  return true;
}

function isTrackReference(value: unknown): value is TrackReference {
  if (!isRecord(value)) return false;
  if (
    !TRACK_PROVIDERS.includes(value.provider as TrackProvider) ||
    (typeof value.providerTrackId !== "number" && typeof value.providerTrackId !== "string") ||
    typeof value.id !== "string"
  ) {
    return false;
  }

  let expectedId: TrackId;
  try {
    expectedId = makeProviderTrackId(
      value.provider as TrackProvider,
      value.providerTrackId,
    );
  } catch {
    return false;
  }

  return (
    value.id === expectedId &&
    typeof value.title === "string" &&
    typeof value.artist === "string" &&
    typeof value.album === "string" &&
    typeof value.genre === "string" &&
    (value.durationMs === null || (typeof value.durationMs === "number" && value.durationMs >= 0)) &&
    isNullableString(value.artworkUrl) &&
    isNullableString(value.previewUrl) &&
    isNullableString(value.externalUrl) &&
    validIsoDate(value.registeredAt)
  );
}

function isCube(value: unknown): value is Cube {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    isNullableString(value.parentId) &&
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.name.length <= ARCHIVE_LIMITS.cubeName &&
    typeof value.description === "string" &&
    value.description.length <= ARCHIVE_LIMITS.cubeDescription &&
    validChapterCoverImage(value.coverImageUrl) &&
    CUBE_COLORS.includes(value.color as CubeColor) &&
    ["manual", "monthly", "capture"].includes(value.kind as CubeKind) &&
    (value.systemKey === null || typeof value.systemKey === "string") &&
    Number.isInteger(value.sortOrder) &&
    (value.source === "seed" || value.source === "user") &&
    (value.visibility === "private" || value.visibility === "public") &&
    validIsoDate(value.createdAt) &&
    validIsoDate(value.updatedAt)
  );
}

function isCubeTrack(value: unknown): value is CubeTrack {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.cubeId === "string" &&
    typeof value.trackId === "string" &&
    hasOnlyStrings(value.tagIds) &&
    value.tagIds.length <= ARCHIVE_LIMITS.tagsPerCubeTrack &&
    new Set(value.tagIds).size === value.tagIds.length &&
    typeof value.character === "string" &&
    value.character.length <= ARCHIVE_LIMITS.character &&
    isMemoryPeriod(value.memoryPeriod) &&
    typeof value.place === "string" &&
    value.place.length <= ARCHIVE_LIMITS.place &&
    typeof value.people === "string" &&
    value.people.length <= ARCHIVE_LIMITS.people &&
    Array.isArray(value.notes) &&
    value.notes.length <= ARCHIVE_LIMITS.notesPerCubeTrack &&
    value.notes.every(isMemoryNote) &&
    new Set(value.notes.map((note) => note.id)).size === value.notes.length &&
    Number.isInteger(value.sortOrder) &&
    (value.source === "seed" || value.source === "user") &&
    (value.recordVisibility === "private" || value.recordVisibility === "public") &&
    validIsoDate(value.createdAt) &&
    validIsoDate(value.updatedAt)
  );
}

function isMemoryNote(value: unknown): value is MemoryNote {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    (value.listenedOn === null || validCalendarDate(value.listenedOn)) &&
    typeof value.body === "string" &&
    value.body.length > 0 &&
    value.body.length <= ARCHIVE_LIMITS.memo &&
    validIsoDate(value.createdAt) &&
    validIsoDate(value.updatedAt)
  );
}

function isTagDefinition(value: unknown): value is TagDefinition {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    typeof value.label === "string" &&
    value.label.length > 0 &&
    value.label.length <= ARCHIVE_LIMITS.tagLabel &&
    typeof value.normalizedLabel === "string" &&
    value.normalizedLabel === normalizeTagLabel(value.label) &&
    TAG_CATEGORIES.includes(value.category as TagCategory) &&
    (value.source === "seed" || value.source === "user") &&
    validIsoDate(value.createdAt)
  );
}

function isInboxEntry(value: unknown): value is InboxEntry {
  if (!isRecord(value)) return false;
  return (
    typeof value.trackId === "string" &&
    validIsoDate(value.capturedAt) &&
    (value.source === "seed" || value.source === "user")
  );
}

function isPreferences(value: unknown): value is Preferences {
  if (!isRecord(value)) return false;
  return (
    ["system", "reduce", "full"].includes(value.motion as string) &&
    typeof value.recapEnabled === "boolean" &&
    (value.lastCubeId === null || typeof value.lastCubeId === "string") &&
    typeof value.seedDismissed === "boolean" &&
    value.country === "KR"
  );
}

function isPersonalSpace(value: unknown): value is PersonalSpace {
  if (!isRecord(value)) return false;
  return (
    SPACE_THEME_IDS.includes(value.themeId as SpaceThemeId)
    && SPACE_LAYOUT_IDS.includes(value.layoutId as SpaceLayoutId)
    && hasOnlyStrings(value.featuredCubeIds)
    && value.featuredCubeIds.length <= 3
    && new Set(value.featuredCubeIds).size === value.featuredCubeIds.length
  );
}

function isMemoryPeriod(value: unknown): value is MemoryPeriod {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  const yearIsValid =
    value.year === null ||
    (Number.isInteger(value.year) && (value.year as number) >= 1900 && (value.year as number) <= 2200);
  if (!yearIsValid) return false;
  if (value.kind === "month") {
    return Number.isInteger(value.month) && (value.month as number) >= 1 && (value.month as number) <= 12;
  }
  return (
    value.kind === "season" &&
    ["spring", "summer", "autumn", "winter"].includes(value.season as string)
  );
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function legacyRegistrationDate(
  trackId: string,
  data: Record<string, unknown>,
  fallback: string,
): string {
  const dates: string[] = [];
  if (isRecord(data.inbox)) {
    const inboxEntry = data.inbox[trackId];
    if (isRecord(inboxEntry) && validIsoDate(inboxEntry.capturedAt)) {
      dates.push(inboxEntry.capturedAt);
    }
  }
  if (isRecord(data.cubeTracks)) {
    Object.values(data.cubeTracks).forEach((entry) => {
      if (isRecord(entry) && entry.trackId === trackId && validIsoDate(entry.createdAt)) {
        dates.push(entry.createdAt);
      }
    });
  }
  return dates.sort((left, right) => Date.parse(left) - Date.parse(right))[0] ?? fallback;
}

function addLegacyRootParents(value: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(value.data) || !isRecord(value.data.cubes)) return value;
  const cubes = Object.fromEntries(
    Object.entries(value.data.cubes).map(([id, cube]) => [
      id,
      isRecord(cube) ? { ...cube, parentId: null } : cube,
    ]),
  );
  return { ...value, data: { ...value.data, cubes } };
}

function stripLegacyPeriodTags(value: Record<string, unknown>): unknown {
  if (
    !isRecord(value.data)
    || !isRecord(value.data.tags)
    || !isRecord(value.data.cubeTracks)
    || !isRecord(value.data.cubes)
  ) return value;

  const periodTagIds = new Set(
    Object.entries(value.data.tags)
      .filter(([id, tag]) => id.startsWith("auto:period:") || (isRecord(tag) && tag.category === "period"))
      .map(([id]) => id),
  );
  const tags = Object.fromEntries(
    Object.entries(value.data.tags).filter(([id]) => !periodTagIds.has(id)),
  );
  const cubeTracks = Object.fromEntries(
    Object.entries(value.data.cubeTracks).map(([id, entry]) => {
      if (!isRecord(entry) || !hasOnlyStrings(entry.tagIds)) return [id, entry];
      return [id, {
        ...entry,
        tagIds: entry.tagIds.filter((tagId) => !periodTagIds.has(tagId)),
      }];
    }),
  );
  const cubes = Object.fromEntries(
    Object.entries(value.data.cubes).map(([id, cube]) => {
      const match = /^month:\d{4}-(\d{2})$/.exec(id);
      if (!match || !isRecord(cube)) return [id, cube];
      const month = Number(match[1]);
      const legacyName = typeof cube.name === "string" && /^\d{4}년 \d{1,2}월$/.test(cube.name);
      const legacyDescription = typeof cube.description === "string"
        && /^\d{4}년 \d{1,2}월에 등록한 곡들$/.test(cube.description);
      if (!legacyName && !legacyDescription) return [id, cube];
      return [id, {
        ...cube,
        ...(legacyName ? { name: `${month}월` } : {}),
        ...(legacyDescription ? { description: `${month}월에 등록한 곡들` } : {}),
      }];
    }),
  );
  return {
    ...value,
    data: { ...value.data, tags, cubeTracks, cubes },
  };
}

function addLegacyMemoryNotes(value: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(value.data) || !isRecord(value.data.cubeTracks)) return value;
  const fallback = validIsoDate(value.updatedAt)
    ? value.updatedAt
    : "1970-01-01T00:00:00.000Z";
  const cubeTracks = Object.fromEntries(
    Object.entries(value.data.cubeTracks).map(([id, entry]) => {
      if (!isRecord(entry) || Array.isArray(entry.notes)) return [id, entry];
      const { memo: legacyMemo, ...withoutMemo } = entry;
      const body = typeof legacyMemo === "string" ? legacyMemo.trim() : "";
      const createdAt = validIsoDate(entry.createdAt) ? entry.createdAt : fallback;
      const updatedAt = validIsoDate(entry.updatedAt) ? entry.updatedAt : createdAt;
      return [id, {
        ...withoutMemo,
        notes: body
          ? [{
              id: `legacy-note:${id}`,
              listenedOn: null,
              body,
              createdAt,
              updatedAt,
            }]
          : [],
      }];
    }),
  );
  return { ...value, data: { ...value.data, cubeTracks } };
}

function hasLegacyMonthlySignature(
  cubeId: string,
  cube: Record<string, unknown>,
  data: Record<string, unknown>,
): string | null {
  const match = /^month:(\d{4})-(\d{2})$/.exec(cubeId);
  if (!match || cube.parentId !== null) return null;
  const [, year, rawMonth] = match;
  const month = Number(rawMonth);
  if (month < 1 || month > 12) return null;
  const validNames = new Set([`${month}월`, `${year}년 ${month}월`]);
  const validDescriptions = new Set([
    `${month}월에 등록한 곡들`,
    `${year}년 ${month}월에 등록한 곡들`,
  ]);
  if (!validNames.has(String(cube.name)) || !validDescriptions.has(String(cube.description))) {
    return null;
  }
  if (!isRecord(data.cubeTracks) || !isRecord(data.tracks)) return null;
  const cubeTracks = data.cubeTracks;
  const tracks = data.tracks;
  const entries = Object.values(cubeTracks).filter(
    (item) => isRecord(item) && item.cubeId === cubeId,
  );
  if (entries.length === 0) return null;
  const expectedKey = `${year}-${rawMonth}`;
  const allInMonth = entries.every((item) => {
    if (!isRecord(item) || typeof item.trackId !== "string") return false;
    const track = tracks[item.trackId];
    if (!isRecord(track) || !validIsoDate(track.registeredAt)) return false;
    return registrationMonth(track.registeredAt).key === expectedKey;
  });
  return allInMonth ? `month:${expectedKey}` : null;
}

function addLegacyCubeKinds(value: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(value.data) || !isRecord(value.data.cubes)) return value;
  const data = value.data;
  const sourceCubes = data.cubes as Record<string, unknown>;
  const cubes = Object.fromEntries(
    Object.entries(sourceCubes).map(([id, cube]) => {
      if (!isRecord(cube)) return [id, cube];
      const alreadyTyped = (
        cube.kind === "manual" && cube.systemKey === null
      ) || (
        cube.kind === "capture" && cube.systemKey === "capture"
      ) || (
        cube.kind === "monthly"
        && typeof cube.systemKey === "string"
        && /^month:\d{4}-(?:0[1-9]|1[0-2])$/.test(cube.systemKey)
      );
      if (alreadyTyped) return [id, cube];
      const monthlyKey = hasLegacyMonthlySignature(id, cube, data);
      return [id, monthlyKey
        ? { ...cube, kind: "monthly", systemKey: monthlyKey }
        : { ...cube, kind: "manual", systemKey: null }];
    }),
  );
  return { ...value, data: { ...data, cubes } };
}

function removeLegacyInboxConflicts(value: Record<string, unknown>): Record<string, unknown> {
  if (
    !isRecord(value.data)
    || !isRecord(value.data.inbox)
    || !isRecord(value.data.cubes)
    || !isRecord(value.data.cubeTracks)
  ) return value;
  const personalTrackIds = new Set(
    Object.values(value.data.cubeTracks)
      .filter((item) => {
        if (!isRecord(item) || typeof item.cubeId !== "string") return false;
        const cube = value.data && isRecord(value.data) && isRecord(value.data.cubes)
          ? value.data.cubes[item.cubeId]
          : undefined;
        return isRecord(cube) && (cube.kind === "manual" || cube.kind === "capture");
      })
      .map((item) => (item as Record<string, unknown>).trackId)
      .filter((trackId): trackId is string => typeof trackId === "string"),
  );
  const inbox = Object.fromEntries(
    Object.entries(value.data.inbox).filter(([trackId]) => !personalTrackIds.has(trackId)),
  );
  return { ...value, data: { ...value.data, inbox } };
}

function prepareLegacyEnvelope(value: Record<string, unknown>): Record<string, unknown> {
  return addLegacyChapterCoverDefaults(addLegacyPersonalSpaceDefaults({
    ...removeLegacyInboxConflicts(addLegacyCubeKinds(value)),
    seedVersion: ARCHIVE_SEED_VERSION,
  }));
}

function addLegacyPersonalSpaceDefaults(value: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(value.data)) return value;
  const cubes = isRecord(value.data.cubes)
    ? Object.fromEntries(Object.entries(value.data.cubes).map(([id, cube]) => [
      id,
      isRecord(cube) ? { ...cube, visibility: cube.visibility === "public" ? "public" : "private" } : cube,
    ]))
    : value.data.cubes;
  const cubeTracks = isRecord(value.data.cubeTracks)
    ? Object.fromEntries(Object.entries(value.data.cubeTracks).map(([id, cubeTrack]) => [
      id,
      isRecord(cubeTrack)
        ? { ...cubeTrack, recordVisibility: cubeTrack.recordVisibility === "public" ? "public" : "private" }
        : cubeTrack,
    ]))
    : value.data.cubeTracks;
  const space = isRecord(value.data.space)
    ? value.data.space
    : { ...DEFAULT_PERSONAL_SPACE };
  return { ...value, data: { ...value.data, cubes, cubeTracks, space } };
}

function addLegacyChapterCoverDefaults(value: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(value.data) || !isRecord(value.data.cubes)) return value;
  const cubes = Object.fromEntries(Object.entries(value.data.cubes).map(([id, cube]) => [
    id,
    isRecord(cube) ? { ...cube, coverImageUrl: null } : cube,
  ]));
  return { ...value, data: { ...value.data, cubes } };
}

function migrateVersionOne(value: Record<string, unknown>): ArchiveEnvelopeV1 | null {
  if (!isRecord(value.data) || !isRecord(value.data.tracks) || !validIsoDate(value.updatedAt)) {
    return null;
  }
  const tracks = Object.fromEntries(
    Object.entries(value.data.tracks).map(([trackId, track]) => [
      trackId,
      isRecord(track)
        ? {
            ...track,
            registeredAt: validIsoDate(track.registeredAt)
              ? track.registeredAt
              : legacyRegistrationDate(trackId, value.data as Record<string, unknown>, value.updatedAt as string),
          }
        : track,
    ]),
  );
  const structural = stripLegacyPeriodTags(addLegacyRootParents({
    ...value,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    data: { ...value.data, tracks },
  }));
  if (!isRecord(structural)) return null;
  const candidate = prepareLegacyEnvelope(addLegacyMemoryNotes(structural));
  if (!validateArchiveEnvelope(candidate)) return null;

  const userTrackIds = new Set<TrackId>();
  Object.values(candidate.data.inbox).forEach((entry) => {
    if (entry?.source === "user") userTrackIds.add(entry.trackId);
  });
  Object.values(candidate.data.cubeTracks).forEach((entry) => {
    if (entry.source === "user") userTrackIds.add(entry.trackId);
  });

  let migrated: ArchiveEnvelopeV1 = candidate;
  userTrackIds.forEach((trackId) => {
    const registeredAt = migrated.data.tracks[trackId]?.registeredAt;
    if (registeredAt) {
      migrated = ensureMonthlyChapter(migrated, trackId, registeredAt, migrated.updatedAt);
    }
  });
  return normalizeArchiveTags(migrated);
}

function migrateVersionTwo(value: Record<string, unknown>): ArchiveEnvelopeV1 | null {
  const structural = stripLegacyPeriodTags(addLegacyRootParents({
    ...value,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
  }));
  if (!isRecord(structural)) return null;
  const candidate = prepareLegacyEnvelope(addLegacyMemoryNotes(structural));
  return validateArchiveEnvelope(candidate)
    ? normalizeArchiveTags(candidate)
    : null;
}

function migrateVersionThree(value: Record<string, unknown>): ArchiveEnvelopeV1 | null {
  const candidate = prepareLegacyEnvelope(addLegacyMemoryNotes(addLegacyRootParents({
    ...value,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
  })));
  return validateArchiveEnvelope(candidate)
    ? normalizeArchiveTags(candidate)
    : null;
}

function migrateVersionFour(value: Record<string, unknown>): ArchiveEnvelopeV1 | null {
  const candidate = prepareLegacyEnvelope(addLegacyMemoryNotes({
    ...value,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
  }));
  return validateArchiveEnvelope(candidate)
    ? normalizeArchiveTags(candidate)
    : null;
}

function migrateVersionFive(value: Record<string, unknown>): ArchiveEnvelopeV1 | null {
  const candidate = prepareLegacyEnvelope({
    ...value,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
  });
  return validateArchiveEnvelope(candidate)
    ? normalizeArchiveTags(candidate)
    : null;
}

function migrateVersionSix(value: Record<string, unknown>): ArchiveEnvelopeV1 | null {
  const candidate = addLegacyChapterCoverDefaults(prepareLegacyEnvelope({
    ...value,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
  }));
  return validateArchiveEnvelope(candidate)
    ? withPersonalSpaceDefaults(candidate)
    : null;
}

function migrateVersionSeven(value: Record<string, unknown>): ArchiveEnvelopeV1 | null {
  const candidate = addLegacyChapterCoverDefaults({
    ...value,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
  });
  return validateArchiveEnvelope(candidate) ? candidate : null;
}

export function migrateArchive(value: unknown): MigrationResult {
  if (!isRecord(value)) return { status: "invalid", error: "저장 데이터가 객체가 아닙니다." };
  if (typeof value.schemaVersion === "number" && value.schemaVersion > ARCHIVE_SCHEMA_VERSION) {
    return { status: "future-version", schemaVersion: value.schemaVersion };
  }
  if (value.schemaVersion === 1) {
    const migrated = migrateVersionOne(value);
    return migrated
      ? { status: "ok", archive: migrated, migrated: true }
      : { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
  }
  if (value.schemaVersion === 2) {
    const migrated = migrateVersionTwo(value);
    return migrated
      ? { status: "ok", archive: migrated, migrated: true }
      : { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
  }
  if (value.schemaVersion === 3) {
    const migrated = migrateVersionThree(value);
    return migrated
      ? { status: "ok", archive: migrated, migrated: true }
      : { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
  }
  if (value.schemaVersion === 4) {
    const migrated = migrateVersionFour(value);
    return migrated
      ? { status: "ok", archive: migrated, migrated: true }
      : { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
  }
  if (value.schemaVersion === 5) {
    const migrated = migrateVersionFive(value);
    return migrated
      ? { status: "ok", archive: migrated, migrated: true }
      : { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
  }
  if (value.schemaVersion === 6) {
    const migrated = migrateVersionSix(value);
    return migrated
      ? { status: "ok", archive: migrated, migrated: true }
      : { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
  }
  if (value.schemaVersion === 7) {
    const migrated = migrateVersionSeven(value);
    return migrated
      ? { status: "ok", archive: migrated, migrated: true }
      : { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
  }
  if (value.schemaVersion === ARCHIVE_SCHEMA_VERSION && value.seedVersion === 1) {
    const candidate = prepareLegacyEnvelope({ ...value, seedVersion: ARCHIVE_SEED_VERSION });
    if (!validateArchiveEnvelope(candidate)) {
      return { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
    }
    return {
      status: "ok",
      archive: restoreSeedData(candidate, candidate.updatedAt, true),
      migrated: true,
    };
  }
  if (!validateArchiveEnvelope(value)) {
    return { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
  }
  const archive = withPersonalSpaceDefaults(refreshLegacySeedMemory(normalizeArchiveTags(value)));
  return { status: "ok", archive, migrated: archive !== value };
}

export function parseArchive(raw: string | null): ParseArchiveResult {
  if (raw === null || raw.trim() === "") return { status: "empty" };
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return { status: "invalid", error: "JSON 형식이 올바르지 않습니다.", raw };
  }
  const result = migrateArchive(value);
  if (result.status === "ok") return result;
  if (result.status === "future-version") return result;
  return { ...result, raw };
}

export function serializeArchive(archive: ArchiveEnvelopeV1): string {
  if (!validateArchiveEnvelope(archive)) {
    throw new ArchiveDomainError("invalid-input", "저장할 아카이브 데이터가 올바르지 않습니다.");
  }
  return JSON.stringify(archive);
}
