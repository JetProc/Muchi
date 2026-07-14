export const ARCHIVE_SCHEMA_VERSION = 2 as const;
export const ARCHIVE_SEED_VERSION = 1 as const;
export const ARCHIVE_STORAGE_KEY = "music-world:archive:v1";

export const ARCHIVE_LIMITS = {
  cubeName: 40,
  cubeDescription: 200,
  tagsPerCubeTrack: 20,
  tagLabel: 40,
  character: 100,
  place: 60,
  people: 60,
  memo: 1_000,
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
export type MotionPreference = "system" | "reduce" | "full";
export type Season = "spring" | "summer" | "autumn" | "winter";
export type TagCategory =
  | "genre"
  | "emotion"
  | "energy"
  | "texture"
  | "situation"
  | "period"
  | "custom";

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
  name: string;
  description: string;
  color: CubeColor;
  sortOrder: number;
  source: EntitySource;
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
  memo: string;
  sortOrder: number;
  source: EntitySource;
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
  name: string;
  description?: string;
  color?: CubeColor;
}

export interface UpdateCubeInput {
  name?: string;
  description?: string;
  color?: CubeColor;
}

export interface UpdateCubeTrackInput {
  character?: string;
  memoryPeriod?: MemoryPeriod;
  place?: string;
  people?: string;
  memo?: string;
}

export interface TagInput {
  label: string;
  category?: TagCategory;
}

export interface SearchArchiveOptions {
  query?: string;
  tagIds?: string[];
  tagLabels?: string[];
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

const SEED_NOW = "2026-07-01T00:00:00.000Z";
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

function withData(
  archive: ArchiveEnvelopeV1,
  data: ArchiveData,
  updatedAt: string,
): ArchiveEnvelopeV1 {
  return { ...archive, updatedAt, data };
}

function compactUnreferencedEntities(data: ArchiveData): ArchiveData {
  const referenced = new Set<TrackId>();
  Object.values(data.cubeTracks).forEach((item) => referenced.add(item.trackId));
  Object.values(data.inbox).forEach((item) => {
    if (item) referenced.add(item.trackId);
  });

  const tracks = Object.fromEntries(
    Object.entries(data.tracks).filter(([trackId]) => referenced.has(trackId as TrackId)),
  ) as Record<TrackId, TrackReference>;

  const referencedTagIds = new Set(
    Object.values(data.cubeTracks).flatMap((item) => item.tagIds),
  );
  const tags = Object.fromEntries(
    Object.entries(data.tags).filter(([tagId]) => referencedTagIds.has(tagId)),
  );

  return { ...data, tracks, tags };
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
    "seed:cube:dawn-drive": {
      id: "seed:cube:dawn-drive",
      name: "새벽 드라이브",
      description: "도시의 불빛이 길게 번지는 시간",
      color: "violet",
      sortOrder: 0,
      source: "seed",
      createdAt: "2025-07-10T02:10:00.000Z",
      updatedAt: "2026-06-28T23:40:00.000Z",
    },
    "seed:cube:winter-2018": {
      id: "seed:cube:winter-2018",
      name: "2018년 겨울",
      description: "차갑고 따뜻했던 오래된 장면들",
      color: "cyan",
      sortOrder: 1,
      source: "seed",
      createdAt: "2025-07-09T02:10:00.000Z",
      updatedAt: "2026-05-18T20:20:00.000Z",
    },
    "seed:cube:first-room": {
      id: "seed:cube:first-room",
      name: "첫 자취방",
      description: "작은 방에서 혼자 크게 틀어두던 노래",
      color: "coral",
      sortOrder: 2,
      source: "seed",
      createdAt: "2025-07-08T02:10:00.000Z",
      updatedAt: "2026-04-03T18:30:00.000Z",
    },
  };

  const tagSeeds: Array<[string, string, TagCategory]> = [
    ["cold", "차가운", "texture"],
    ["urban", "도시적인", "situation"],
    ["rushing", "질주하는", "energy"],
    ["nostalgic", "그리운", "emotion"],
    ["warm", "따뜻한", "texture"],
    ["uneasy-youth", "불안했던 청춘", "custom"],
    ["bright", "눈부신", "emotion"],
    ["open-road", "탁 트인", "situation"],
    ["hazy", "몽환적인", "texture"],
    ["solitary", "혼자 듣는", "situation"],
    ["restless", "들뜬", "energy"],
    ["bedroom", "방 안의", "situation"],
  ];
  const tags = Object.fromEntries(
    tagSeeds.map(([slug, label, category]) => {
      const id = `seed:tag:${slug}`;
      return [
        id,
        {
          id,
          label,
          normalizedLabel: normalizeTagLabel(label),
          category,
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
      ["cold", "urban", "rushing"],
      0,
      "차가운 도시를 빠르게 가르는 기타",
      { kind: "month", year: 2023, month: 7 },
      "한강 북단",
      "",
      "새벽 두 시, 신호가 모두 초록색이었던 날.",
    ),
    "seed:cube-track:dawn-summer": seedCubeTrack(
      "dawn-summer",
      "seed:cube:dawn-drive",
      makeTrackId(1569294608),
      ["bright", "open-road"],
      1,
      "끝없이 이어지는 여름밤",
      { kind: "month", year: 2022, month: 7 },
      "동해안 국도",
      "친구들",
      "창문을 내리고 따라 부르던 후렴.",
    ),
    "seed:cube-track:winter-radio": seedCubeTrack(
      "winter-radio",
      "seed:cube:winter-2018",
      makeTrackId(1569294423),
      ["nostalgic", "warm", "uneasy-youth"],
      0,
      "불안했지만 이상하게 따뜻한 청춘",
      { kind: "season", year: 2018, season: "winter" },
      "학교 앞 카페",
      "",
      "같은 Radio지만 이곳에서는 속도보다 온기가 먼저 떠오른다.",
    ),
    "seed:cube-track:winter-violet": seedCubeTrack(
      "winter-violet",
      "seed:cube:winter-2018",
      makeTrackId(1569294419),
      ["nostalgic", "hazy"],
      1,
      "보랏빛으로 번지는 오래된 장면",
      { kind: "season", year: 2018, season: "winter" },
      "버스 맨 뒷자리",
      "",
      "이어폰 한쪽이 자꾸 끊기던 겨울.",
    ),
    "seed:cube-track:room-pinktop": seedCubeTrack(
      "room-pinktop",
      "seed:cube:first-room",
      makeTrackId(1569294420),
      ["restless", "bedroom"],
      0,
      "작은 방을 가득 채우는 반항심",
      { kind: "month", year: 2021, month: 9 },
      "첫 자취방",
      "",
      "이웃이 없을 때만 볼륨을 끝까지 올렸다.",
    ),
    "seed:cube-track:room-l": seedCubeTrack(
      "room-l",
      "seed:cube:first-room",
      makeTrackId(1752456374),
      ["solitary", "hazy", "bedroom"],
      1,
      "혼자 있는 밤의 부드러운 소음",
      { kind: "month", year: 2024, month: 7 },
      "첫 자취방",
      "",
      "불을 끄고 앨범 한 장을 처음부터 끝까지 듣던 밤.",
    ),
  };

  const inbox: Partial<Record<TrackId, InboxEntry>> = {
    [makeTrackId(1752456355)]: {
      trackId: makeTrackId(1752456355),
      capturedAt: "2026-06-30T21:10:00.000Z",
      source: "seed",
    },
    [makeTrackId(1752456349)]: {
      trackId: makeTrackId(1752456349),
      capturedAt: "2026-06-29T17:20:00.000Z",
      source: "seed",
    },
  };

  return {
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    seedVersion: ARCHIVE_SEED_VERSION,
    updatedAt: SEED_NOW,
    data: {
      tracks,
      cubes,
      cubeTracks,
      tags: tags as Record<string, TagDefinition>,
      inbox,
      preferences: { ...DEFAULT_PREFERENCES },
    },
  };
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
  memo: string,
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
    memo,
    sortOrder,
    source: "seed",
    createdAt: SEED_NOW,
    updatedAt: SEED_NOW,
  };
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
  const { key, year, month } = registrationMonth(registeredAt);
  const chapterId = `month:${key}`;
  const withChapter = archive.data.cubes[chapterId]
    ? archive
    : createCube(archive, {
        id: chapterId,
        name: `${year}년 ${month}월`,
        description: `${year}년 ${month}월에 등록한 곡들`,
        color: CUBE_COLORS[(month - 1) % CUBE_COLORS.length],
      }, now).archive;
  return addTrackToCube(withChapter, trackId, chapterId, now).archive;
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
  const data = compactUnreferencedEntities({ ...archive.data, inbox });
  return withData(archive, data, now);
}

export function createCube(
  archive: ArchiveEnvelopeV1,
  input: CreateCubeInput,
  now = nowIso(),
): { archive: ArchiveEnvelopeV1; cube: Cube } {
  const id = input.id ?? createId("cube");
  if (archive.data.cubes[id]) {
    throw new ArchiveDomainError("duplicate", "이미 존재하는 큐브 ID입니다.");
  }
  const cube: Cube = {
    id,
    name: cleanText(input.name, "큐브 이름", ARCHIVE_LIMITS.cubeName, true),
    description: cleanText(
      input.description ?? "",
      "큐브 설명",
      ARCHIVE_LIMITS.cubeDescription,
    ),
    color: input.color ?? "violet",
    sortOrder: Object.keys(archive.data.cubes).length,
    source: "user",
    createdAt: now,
    updatedAt: now,
  };
  if (!CUBE_COLORS.includes(cube.color)) {
    throw new ArchiveDomainError("invalid-input", "지원하지 않는 큐브 색상입니다.");
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
  const current = assertRecord(archive.data.cubes, cubeId, "큐브");
  if (input.color !== undefined && !CUBE_COLORS.includes(input.color)) {
    throw new ArchiveDomainError("invalid-input", "지원하지 않는 큐브 색상입니다.");
  }
  const cube: Cube = {
    ...current,
    ...(input.name === undefined
      ? {}
      : { name: cleanText(input.name, "큐브 이름", ARCHIVE_LIMITS.cubeName, true) }),
    ...(input.description === undefined
      ? {}
      : {
          description: cleanText(
            input.description,
            "큐브 설명",
            ARCHIVE_LIMITS.cubeDescription,
          ),
        }),
    ...(input.color === undefined ? {} : { color: input.color }),
    updatedAt: now,
  };
  return withData(
    archive,
    { ...archive.data, cubes: { ...archive.data.cubes, [cubeId]: cube } },
    now,
  );
}

export function deleteCube(
  archive: ArchiveEnvelopeV1,
  cubeId: string,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  assertRecord(archive.data.cubes, cubeId, "큐브");
  const cubes = { ...archive.data.cubes };
  delete cubes[cubeId];
  const cubeTracks = Object.fromEntries(
    Object.entries(archive.data.cubeTracks).filter(([, item]) => item.cubeId !== cubeId),
  );
  const reorderedCubes = Object.fromEntries(
    Object.values(cubes)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((cube, index) => [cube.id, { ...cube, sortOrder: index }]),
  );
  const data = compactUnreferencedEntities({
    ...archive.data,
    cubes: reorderedCubes,
    cubeTracks,
    preferences: {
      ...archive.data.preferences,
      lastCubeId:
        archive.data.preferences.lastCubeId === cubeId
          ? null
          : archive.data.preferences.lastCubeId,
    },
  });
  return withData(archive, data, now);
}

export function addTrackToCube(
  archive: ArchiveEnvelopeV1,
  trackId: TrackId,
  cubeId: string,
  now = nowIso(),
): { archive: ArchiveEnvelopeV1; cubeTrack: CubeTrack; added: boolean } {
  assertRecord(archive.data.tracks, trackId, "곡");
  assertRecord(archive.data.cubes, cubeId, "큐브");
  const existing = Object.values(archive.data.cubeTracks).find(
    (item) => item.trackId === trackId && item.cubeId === cubeId,
  );
  if (existing) return { archive, cubeTrack: existing, added: false };

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
    memo: "",
    sortOrder,
    source: "user",
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
  const added = addTrackToCube(archive, trackId, cubeId, now);
  const inbox = { ...added.archive.data.inbox };
  delete inbox[trackId];
  return {
    ...added,
    archive: withData(added.archive, { ...added.archive.data, inbox }, now),
  };
}

export function updateCubeTrack(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  input: UpdateCubeTrackInput,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertRecord(archive.data.cubeTracks, cubeTrackId, "곡 기록");
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
    ...(input.memo === undefined
      ? {}
      : { memo: cleanText(input.memo, "메모", ARCHIVE_LIMITS.memo) }),
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

export function removeCubeTrack(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const current = assertRecord(archive.data.cubeTracks, cubeTrackId, "곡 기록");
  const cubeTracks = { ...archive.data.cubeTracks };
  delete cubeTracks[cubeTrackId];
  const siblings = Object.values(cubeTracks)
    .filter((item) => item.cubeId === current.cubeId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  siblings.forEach((item, index) => {
    cubeTracks[item.id] = { ...item, sortOrder: index };
  });
  const data = compactUnreferencedEntities({ ...archive.data, cubeTracks });
  return withData(archive, data, now);
}

export function setCubeTrackTags(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  inputs: Array<string | TagInput>,
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const cubeTrack = assertRecord(archive.data.cubeTracks, cubeTrackId, "곡 기록");
  if (inputs.length > ARCHIVE_LIMITS.tagsPerCubeTrack) {
    throw new ArchiveDomainError(
      "limit-exceeded",
      `태그는 곡마다 ${ARCHIVE_LIMITS.tagsPerCubeTrack}개까지 붙일 수 있습니다.`,
    );
  }

  const tags = { ...archive.data.tags };
  const byNormalized = new Map(
    Object.values(tags).map((tag) => [tag.normalizedLabel, tag] as const),
  );
  const tagIds: string[] = [];
  const seen = new Set<string>();

  for (const input of inputs) {
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
      tagIds.push(existing.id);
      continue;
    }

    const id = createId("tag");
    const tag: TagDefinition = {
      id,
      label,
      normalizedLabel,
      category: typeof input === "string" ? "custom" : (input.category ?? "custom"),
      source: "user",
      createdAt: now,
    };
    tags[id] = tag;
    byNormalized.set(normalizedLabel, tag);
    tagIds.push(id);
  }

  const nextCubeTrack = { ...cubeTrack, tagIds, updatedAt: now };
  const data = compactUnreferencedEntities({
    ...archive.data,
    tags,
    cubeTracks: { ...archive.data.cubeTracks, [cubeTrackId]: nextCubeTrack },
    cubes: {
      ...archive.data.cubes,
      [cubeTrack.cubeId]: {
        ...archive.data.cubes[cubeTrack.cubeId],
        updatedAt: now,
      },
    },
  });
  return withData(
    archive,
    data,
    now,
  );
}

export function reorderCubeTracks(
  archive: ArchiveEnvelopeV1,
  cubeId: string,
  orderedIds: string[],
  now = nowIso(),
): ArchiveEnvelopeV1 {
  assertRecord(archive.data.cubes, cubeId, "큐브");
  const currentIds = Object.values(archive.data.cubeTracks)
    .filter((item) => item.cubeId === cubeId)
    .map((item) => item.id);
  assertSameIds(currentIds, orderedIds, "큐브 안의 곡 순서");
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

export function reorderCubes(
  archive: ArchiveEnvelopeV1,
  orderedIds: string[],
  now = nowIso(),
): ArchiveEnvelopeV1 {
  const currentIds = Object.keys(archive.data.cubes);
  assertSameIds(currentIds, orderedIds, "큐브 순서");
  const cubes = { ...archive.data.cubes };
  orderedIds.forEach((id, index) => {
    cubes[id] = { ...cubes[id], sortOrder: index, updatedAt: now };
  });
  return withData(archive, { ...archive.data, cubes }, now);
}

function assertSameIds(currentIds: string[], orderedIds: string[], label: string): void {
  if (
    currentIds.length !== orderedIds.length ||
    new Set(orderedIds).size !== orderedIds.length ||
    currentIds.some((id) => !orderedIds.includes(id))
  ) {
    throw new ArchiveDomainError("invalid-order", `${label}가 현재 항목과 일치하지 않습니다.`);
  }
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
  const results: ArchiveSearchResult[] = [];

  for (const cubeTrack of Object.values(archive.data.cubeTracks)) {
    const track = archive.data.tracks[cubeTrack.trackId];
    const cube = archive.data.cubes[cubeTrack.cubeId];
    if (!track || !cube) continue;
    if (cubeIds.size && !cubeIds.has(cube.id)) continue;
    if ([...requiredTagIds].some((tagId) => !cubeTrack.tagIds.includes(tagId))) continue;

    const tags = cubeTrack.tagIds
      .map((tagId) => archive.data.tags[tagId])
      .filter((tag): tag is TagDefinition => Boolean(tag));
    const normalizedLabels = new Set(tags.map((tag) => tag.normalizedLabel));
    if ([...requiredTagLabels].some((label) => !normalizedLabels.has(label))) continue;

    const memory = memoryPeriodText(cubeTrack.memoryPeriod);
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
        cubeTrack.memo,
      ].join(" "),
    );
    if (query && !searchable.includes(query)) continue;
    results.push({ kind: "cube-track", track, cube, cubeTrack, tags });
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

  const candidates = Object.values(archive.data.cubeTracks)
    .map((cubeTrack) => {
      const track = archive.data.tracks[cubeTrack.trackId];
      const cube = archive.data.cubes[cubeTrack.cubeId];
      if (!track || !cube) return null;
      return {
        track,
        cube,
        cubeTrack,
        tags: cubeTrack.tagIds
          .map((tagId) => archive.data.tags[tagId])
          .filter((tag): tag is TagDefinition => Boolean(tag)),
      };
    })
    .filter((entry): entry is Omit<RecapEntry, "reason"> => Boolean(entry));

  if (mode === "random") {
    const random = options.random ?? Math.random;
    return shuffled(candidates, random)
      .slice(0, limit)
      .map((entry) => ({ ...entry, reason: "random" }));
  }

  if (mode === "timeline") {
    return candidates
      .sort((a, b) => recapSortValue(b.cubeTrack) - recapSortValue(a.cubeTrack))
      .slice(0, limit)
      .map((entry) => ({ ...entry, reason: "saved-date" }));
  }

  const currentMonth = now.getMonth() + 1;
  const currentSeason = monthToSeason(currentMonth);
  const currentYear = now.getFullYear();
  const matched: Array<RecapEntry | null> = candidates.map<RecapEntry | null>((entry) => {
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
      const createdAt = new Date(entry.cubeTrack.createdAt);
      if (createdAt.getMonth() + 1 === currentMonth && createdAt.getFullYear() < currentYear) {
        return { ...entry, reason: "saved-date" as const };
      }
      return null;
    });

  return matched
    .filter((entry): entry is RecapEntry => entry !== null)
    .sort((a, b) => recapSortValue(b.cubeTrack) - recapSortValue(a.cubeTrack))
    .slice(0, limit);
}

function monthToSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function recapSortValue(cubeTrack: CubeTrack): number {
  const period = cubeTrack.memoryPeriod;
  if (period?.year) {
    const month =
      period.kind === "month"
        ? period.month
        : { spring: 3, summer: 6, autumn: 9, winter: 12 }[period.season];
    return Date.UTC(period.year, month - 1, 1);
  }
  return Date.parse(cubeTrack.createdAt);
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
    Object.entries(archive.data.cubes).filter(([, cube]) => cube.source !== "seed"),
  );
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
      ([id, tag]) => tag.source !== "seed" || usedTagIds.has(id),
    ),
  );
  const data = compactUnreferencedEntities({
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

  return Object.entries(cubeTracks).every(([id, item]) => {
    if (!isCubeTrack(item) || item.id !== id) return false;
    return (
      Boolean(cubes[item.cubeId]) &&
      Boolean(tracks[item.trackId]) &&
      item.tagIds.every((tagId) => Boolean(tags[tagId]))
    );
  });
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
    typeof value.name === "string" &&
    value.name.length > 0 &&
    value.name.length <= ARCHIVE_LIMITS.cubeName &&
    typeof value.description === "string" &&
    value.description.length <= ARCHIVE_LIMITS.cubeDescription &&
    CUBE_COLORS.includes(value.color as CubeColor) &&
    Number.isInteger(value.sortOrder) &&
    (value.source === "seed" || value.source === "user") &&
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
    typeof value.memo === "string" &&
    value.memo.length <= ARCHIVE_LIMITS.memo &&
    Number.isInteger(value.sortOrder) &&
    (value.source === "seed" || value.source === "user") &&
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
    ["genre", "emotion", "energy", "texture", "situation", "period", "custom"].includes(
      value.category as string,
    ) &&
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
  const candidate: unknown = {
    ...value,
    schemaVersion: ARCHIVE_SCHEMA_VERSION,
    data: { ...value.data, tracks },
  };
  if (!validateArchiveEnvelope(candidate)) return null;

  const userTrackIds = new Set<TrackId>();
  Object.values(candidate.data.inbox).forEach((entry) => {
    if (entry?.source === "user") userTrackIds.add(entry.trackId);
  });
  Object.values(candidate.data.cubeTracks).forEach((entry) => {
    if (entry.source === "user") userTrackIds.add(entry.trackId);
  });

  let migrated = candidate;
  userTrackIds.forEach((trackId) => {
    const registeredAt = migrated.data.tracks[trackId]?.registeredAt;
    if (registeredAt) {
      migrated = ensureMonthlyChapter(migrated, trackId, registeredAt, migrated.updatedAt);
    }
  });
  return migrated;
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
  if (!validateArchiveEnvelope(value)) {
    return { status: "invalid", error: "지원하지 않거나 손상된 아카이브 데이터입니다." };
  }
  return { status: "ok", archive: value, migrated: false };
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
