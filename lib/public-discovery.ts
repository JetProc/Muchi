import type { ArchiveEnvelopeV1, SpaceLayoutId, SpaceThemeId, TrackId, TrackReference } from "./archive";

export const DISCOVERY_STORAGE_KEY = "music-world:public-discovery:v1";

export type PublicRecordVisibility = "public" | "private";

export type PublicSpacePresentation = {
  themeId: SpaceThemeId;
  layoutId: SpaceLayoutId;
  featuredChapterIds: string[];
};

export type PublicProfile = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  avatarTone: string;
  followerCount: number;
  space: PublicSpacePresentation;
};

export type PublicChapterTrack = {
  id: string;
  track: TrackReference;
  visibility: PublicRecordVisibility;
  note: string | null;
  tags: string[];
};

export type PublicChapter = {
  id: string;
  profileId: string;
  name: string;
  description: string;
  color: string;
  artworkUrl: string | null;
  createdAt: string;
  likeCount: number;
  tracks: PublicChapterTrack[];
};

export type FollowActivity = {
  id: string;
  profileId: string;
  chapterId: string;
  publishedAt: string;
};

export type PublicDiscoveryCatalog = {
  profiles: Record<string, PublicProfile>;
  chapters: Record<string, PublicChapter>;
  activities: FollowActivity[];
};

export type DiscoveryInteractionState = {
  followedProfileIds: string[];
  likedChapterIds: string[];
  readActivityIds: string[];
};

export type RankedPublicChapter = {
  chapter: PublicChapter;
  profile: PublicProfile;
  sharedTrackCount: number;
  sharedTrackDensity: number;
  reason: string;
};

const VOLUNTEERS_ART = "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/f9/28/8c/f9288c73-c42a-11d1-a4aa-83a7ce6e3c46/TheVolunteers_3000.jpg/600x600bb.jpg";
const VOLUNTEERS_L_ART = "https://is1-ssl.mzstatic.com/image/thumb/Music211/v4/6d/3a/98/6d3a98fb-63e0-c1a0-24cb-cbe7b8b28672/198588366318.jpg/600x600bb.jpg";
const ARTWORKS = [VOLUNTEERS_ART, VOLUNTEERS_L_ART, VOLUNTEERS_ART];

const SHARED_TRACKS: TrackReference[] = [
  {
    id: "itunes:1569294608",
    provider: "itunes",
    providerTrackId: 1569294608,
    title: "Summer",
    artist: "The Volunteers",
    album: "The Volunteers",
    genre: "록",
    durationMs: 251_033,
    artworkUrl: VOLUNTEERS_ART,
    previewUrl: null,
    externalUrl: null,
  },
  {
    id: "itunes:1569294420",
    provider: "itunes",
    providerTrackId: 1569294420,
    title: "PINKTOP",
    artist: "The Volunteers",
    album: "The Volunteers",
    genre: "록",
    durationMs: 239_910,
    artworkUrl: VOLUNTEERS_ART,
    previewUrl: null,
    externalUrl: null,
  },
  {
    id: "itunes:1752456374",
    provider: "itunes",
    providerTrackId: 1752456374,
    title: '"L"',
    artist: "The Volunteers",
    album: '"L" - EP',
    genre: "록",
    durationMs: 260_683,
    artworkUrl: VOLUNTEERS_L_ART,
    previewUrl: null,
    externalUrl: null,
  },
  {
    id: "itunes:1569294423",
    provider: "itunes",
    providerTrackId: 1569294423,
    title: "Radio",
    artist: "The Volunteers",
    album: "The Volunteers",
    genre: "록",
    durationMs: 262_652,
    artworkUrl: VOLUNTEERS_ART,
    previewUrl: null,
    externalUrl: null,
  },
  {
    id: "itunes:1569294419",
    provider: "itunes",
    providerTrackId: 1569294419,
    title: "Violet",
    artist: "The Volunteers",
    album: "The Volunteers",
    genre: "록",
    durationMs: 211_340,
    artworkUrl: VOLUNTEERS_ART,
    previewUrl: null,
    externalUrl: null,
  },
  {
    id: "itunes:1752456355",
    provider: "itunes",
    providerTrackId: 1752456355,
    title: "Tell 'em boys",
    artist: "The Volunteers",
    album: '"L" - EP',
    genre: "록",
    durationMs: 269_976,
    artworkUrl: VOLUNTEERS_L_ART,
    previewUrl: null,
    externalUrl: null,
  },
  {
    id: "itunes:1752456349",
    provider: "itunes",
    providerTrackId: 1752456349,
    title: "Psycho",
    artist: "The Volunteers",
    album: '"L" - EP',
    genre: "록",
    durationMs: 242_161,
    artworkUrl: VOLUNTEERS_L_ART,
    previewUrl: null,
    externalUrl: null,
  },
];

const PROFILE_SEEDS = [
  ["soyeon", "소연", "soyeon.zip", "오래된 노래를 새 장면에 붙여 둡니다.", "#9a6d4b", 328],
  ["jun", "준", "junlistens", "도시를 걷는 속도로 앨범을 듣습니다.", "#486d7f", 182],
  ["momo", "모모", "momo.afterfive", "퇴근길에는 늘 같은 곡을 다시 찾아요.", "#af6c7d", 247],
  ["dan", "단", "dan.sideb", "좋아하는 기타 소리를 모으는 중.", "#4e6b5b", 391],
  ["hye", "혜", "hye.archive", "계절이 바뀔 때마다 챕터를 엽니다.", "#8a698f", 176],
  ["seo", "서", "seosound", "기억보다 먼저 남는 멜로디들.", "#9a7a45", 289],
  ["yuri", "유리", "yuri.inbetween", "조용한 시간에만 드러나는 곡을 기록해요.", "#6f7898", 215],
  ["minho", "민호", "minho.takefive", "운전할 때 들은 곡은 길까지 같이 남습니다.", "#557168", 151],
  ["aria", "아리아", "aria.tint", "앨범의 첫 곡과 마지막 곡을 특히 좋아합니다.", "#a75e57", 304],
  ["doeun", "도은", "doeun.letters", "문장처럼 들리는 노래를 보관합니다.", "#896958", 268],
  ["woo", "우", "woo.roomtone", "방 안의 공기까지 기억나는 음악.", "#66718b", 198],
  ["nari", "나리", "nari.dayoff", "아무 계획 없는 날의 플레이리스트.", "#a57962", 234],
] as const;

const CHAPTER_THEMES = [
  ["막차의 창문", "하루가 끝난 뒤에도 조금 더 걷고 싶은 밤", "혼자 걷는 밤", "새벽 버스 안에서"],
  ["가벼운 도망", "목적지보다 창문 밖이 더 중요했던 날", "멀리 떠날 때", "여름이 시작될 때"],
  ["방 안의 파도", "불을 끄고 앨범 한 장을 끝까지 들은 시간", "방 안에서 듣던 음악", "잠들기 전"],
] as const;

const PUBLIC_SPACE_THEMES: SpaceThemeId[] = ["paper", "midnight", "moss"];
const PUBLIC_SPACE_LAYOUTS: SpaceLayoutId[] = ["shelf", "folio", "stack"];

function publicSpace(slug: string, profileIndex: number): PublicSpacePresentation {
  return {
    themeId: PUBLIC_SPACE_THEMES[profileIndex % PUBLIC_SPACE_THEMES.length],
    layoutId: PUBLIC_SPACE_LAYOUTS[profileIndex % PUBLIC_SPACE_LAYOUTS.length],
    featuredChapterIds: CHAPTER_THEMES.map((_, chapterIndex) => `public:chapter:${slug}:${chapterIndex + 1}`),
  };
}

function generatedTrack(profileIndex: number, chapterIndex: number, trackIndex: number): TrackReference {
  const id = `itunes:${820_000_000 + profileIndex * 1_000 + chapterIndex * 100 + trackIndex}` as TrackId;
  const titles = ["Afterimage", "Soft Focus", "Mile Marker", "Room Tone", "Slow Return", "Blue Hour", "Paper Moon", "Glasshouse"];
  const artists = ["Lumen Park", "Mild Weather", "Haze Club", "June Draft", "Small Hours", "Kinfolk Radio"];
  return {
    id,
    provider: "itunes",
    providerTrackId: Number(id.replace("itunes:", "")),
    title: titles[(profileIndex + chapterIndex + trackIndex) % titles.length],
    artist: artists[(profileIndex * 2 + trackIndex) % artists.length],
    album: `${CHAPTER_THEMES[chapterIndex][0]} · selections`,
    genre: trackIndex % 2 ? "인디" : "록",
    durationMs: 195_000 + trackIndex * 14_000,
    artworkUrl: ARTWORKS[(profileIndex + chapterIndex) % ARTWORKS.length],
    previewUrl: null,
    externalUrl: null,
  };
}

function publicRecord(
  id: string,
  track: TrackReference,
  visibility: PublicRecordVisibility,
  note: string,
  tags: string[],
): PublicChapterTrack {
  return visibility === "public"
    ? { id, track, visibility, note, tags }
    : { id, track, visibility, note: null, tags: [] };
}

function createChapter(profileIndex: number, chapterIndex: number): PublicChapter {
  const profile = PROFILE_SEEDS[profileIndex];
  const theme = CHAPTER_THEMES[chapterIndex];
  const id = `public:chapter:${profile[0]}:${chapterIndex + 1}`;
  const sharedOffset = (profileIndex * 2 + chapterIndex) % SHARED_TRACKS.length;
  const shared = [
    SHARED_TRACKS[sharedOffset],
    SHARED_TRACKS[(sharedOffset + 2) % SHARED_TRACKS.length],
  ];
  const tracks = [...shared, ...Array.from({ length: 4 }, (_, trackIndex) => generatedTrack(profileIndex, chapterIndex, trackIndex))]
    .map((track, index) => publicRecord(
      `${id}:track:${index + 1}`,
      track,
      index === 2 && (profileIndex + chapterIndex) % 3 === 0 ? "private" : "public",
      index === 0
        ? `이 곡이 시작되면 ${theme[1]} 다시 선명해진다.`
        : `${theme[0]}을 떠올리며 적어 둔 곡.`,
      [theme[2], index % 2 ? theme[3] : "과거에 좋아했던 음악"],
    ));
  return {
    id,
    profileId: `public:profile:${profile[0]}`,
    name: `${theme[0]} · ${profileIndex + 1}`,
    description: theme[1],
    color: profile[4],
    artworkUrl: ARTWORKS[(profileIndex + chapterIndex) % ARTWORKS.length],
    createdAt: `2026-07-${String(17 - chapterIndex - (profileIndex % 4)).padStart(2, "0")}T${String(22 - chapterIndex).padStart(2, "0")}:20:00.000Z`,
    likeCount: 14 + profileIndex * 7 + chapterIndex * 11,
    tracks,
  };
}

export function createPublicDiscoveryCatalog(): PublicDiscoveryCatalog {
  const profiles = Object.fromEntries(PROFILE_SEEDS.map(([slug, name, handle, bio, avatarTone, followerCount], profileIndex) => {
    const id = `public:profile:${slug}`;
    return [id, { id, name, handle, bio, avatarTone, followerCount, space: publicSpace(slug, profileIndex) } satisfies PublicProfile];
  })) as Record<string, PublicProfile>;
  const chapterList = PROFILE_SEEDS.flatMap((_, profileIndex) => (
    CHAPTER_THEMES.map((__, chapterIndex) => createChapter(profileIndex, chapterIndex))
  ));
  const chapters = Object.fromEntries(chapterList.map((chapter) => [chapter.id, chapter]));
  const activities = [0, 1, 3, 4, 6, 8].map((profileIndex, index) => {
    const chapter = chapterList[profileIndex * CHAPTER_THEMES.length + (index % CHAPTER_THEMES.length)];
    return {
      id: `public:activity:${profileIndex + 1}`,
      profileId: chapter.profileId,
      chapterId: chapter.id,
      publishedAt: chapter.createdAt,
    } satisfies FollowActivity;
  });
  return { profiles, chapters, activities };
}

export function createDiscoveryInteractionState(): DiscoveryInteractionState {
  return { followedProfileIds: [], likedChapterIds: [], readActivityIds: [] };
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function validState(value: unknown, catalog: PublicDiscoveryCatalog): DiscoveryInteractionState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<DiscoveryInteractionState>;
  const filterKnown = (ids: unknown, lookup: Record<string, unknown>) => (
    Array.isArray(ids) ? uniqueIds(ids.filter((id): id is string => typeof id === "string" && Boolean(lookup[id]))) : []
  );
  const activityLookup = Object.fromEntries(catalog.activities.map((activity) => [activity.id, activity]));
  return {
    followedProfileIds: filterKnown(raw.followedProfileIds, catalog.profiles),
    likedChapterIds: filterKnown(raw.likedChapterIds, catalog.chapters),
    readActivityIds: filterKnown(raw.readActivityIds, activityLookup),
  };
}

export function serializeDiscoveryInteractionState(state: DiscoveryInteractionState): string {
  return JSON.stringify({
    followedProfileIds: uniqueIds(state.followedProfileIds),
    likedChapterIds: uniqueIds(state.likedChapterIds),
    readActivityIds: uniqueIds(state.readActivityIds),
  });
}

export function parseDiscoveryInteractionState(
  raw: string | null | undefined,
  catalog: PublicDiscoveryCatalog,
): DiscoveryInteractionState {
  if (!raw) return createDiscoveryInteractionState();
  try {
    return validState(JSON.parse(raw), catalog) ?? createDiscoveryInteractionState();
  } catch {
    return createDiscoveryInteractionState();
  }
}

function toggled(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

export function toggleFollow(state: DiscoveryInteractionState, profileId: string): DiscoveryInteractionState {
  return { ...state, followedProfileIds: toggled(state.followedProfileIds, profileId) };
}

export function toggleLike(state: DiscoveryInteractionState, chapterId: string): DiscoveryInteractionState {
  return { ...state, likedChapterIds: toggled(state.likedChapterIds, chapterId) };
}

export function markActivityRead(state: DiscoveryInteractionState, activityId: string): DiscoveryInteractionState {
  return state.readActivityIds.includes(activityId)
    ? state
    : { ...state, readActivityIds: [...state.readActivityIds, activityId] };
}

export function getPublicChapter(catalog: PublicDiscoveryCatalog, chapterId: string | null | undefined): PublicChapter | null {
  return chapterId ? catalog.chapters[chapterId] ?? null : null;
}

export function getPublicProfile(catalog: PublicDiscoveryCatalog, profileId: string | null | undefined): PublicProfile | null {
  return profileId ? catalog.profiles[profileId] ?? null : null;
}

export function getProfileChapters(catalog: PublicDiscoveryCatalog, profileId: string): PublicChapter[] {
  return Object.values(catalog.chapters)
    .filter((chapter) => chapter.profileId === profileId)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export function getFollowingActivities(
  catalog: PublicDiscoveryCatalog,
  state: DiscoveryInteractionState,
): FollowActivity[] {
  const followed = new Set(state.followedProfileIds);
  return catalog.activities
    .filter((activity) => followed.has(activity.profileId))
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export function rankPublicChapters(
  archive: ArchiveEnvelopeV1,
  catalog: PublicDiscoveryCatalog,
  state: DiscoveryInteractionState,
): RankedPublicChapter[] {
  const userTrackIds = new Set(Object.keys(archive.data.tracks));
  return Object.values(catalog.chapters)
    .map((chapter) => {
      const profile = catalog.profiles[chapter.profileId];
      const sharedTrackCount = chapter.tracks.filter(({ track }) => userTrackIds.has(track.id)).length;
      const sharedTrackDensity = chapter.tracks.length ? sharedTrackCount / chapter.tracks.length : 0;
      const liked = state.likedChapterIds.includes(chapter.id) ? 1 : 0;
      const score = sharedTrackCount * 10_000 + sharedTrackDensity * 1_000 + liked * 10 + chapter.likeCount / 1_000;
      return {
        chapter,
        profile,
        sharedTrackCount,
        sharedTrackDensity,
        score,
        reason: sharedTrackCount > 0 ? `내 기록과 겹치는 곡 ${sharedTrackCount}개` : "새로 공개된 챕터",
      };
    })
    .sort((left, right) => right.score - left.score || right.chapter.createdAt.localeCompare(left.chapter.createdAt))
    .map((item) => ({
      chapter: item.chapter,
      profile: item.profile,
      sharedTrackCount: item.sharedTrackCount,
      sharedTrackDensity: item.sharedTrackDensity,
      reason: item.reason,
    }));
}

export function toPlaylistSource(chapter: PublicChapter): {
  id: string;
  name: string;
  description: string;
  tracks: TrackReference[];
} {
  return {
    id: chapter.id,
    name: chapter.name,
    description: chapter.description,
    tracks: chapter.tracks.map(({ track }) => track),
  };
}
