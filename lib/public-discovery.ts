import type { ArchiveEnvelopeV1, SpaceLayoutId, SpaceThemeId, TrackReference } from "./archive";

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

export type PublicDiscoveryRow = {
  authorId: string;
  authorName: string;
  payload: PublicChapter;
};

export function createEmptyPublicDiscoveryCatalog(): PublicDiscoveryCatalog {
  return { profiles: {}, chapters: {}, activities: [] };
}

export function createPublicDiscoveryCatalog(rows: PublicDiscoveryRow[]): PublicDiscoveryCatalog {
  const catalog = createEmptyPublicDiscoveryCatalog();
  for (const row of rows) {
    const chapter = row.payload;
    if (!chapter || typeof chapter !== "object" || !chapter.id || !chapter.name || !Array.isArray(chapter.tracks)) continue;
    const profileId = row.authorId;
    const existingProfile = catalog.profiles[profileId];
    catalog.profiles[profileId] = existingProfile ?? {
      id: profileId,
      name: row.authorName.trim() || "뮤키 사용자",
      handle: "",
      bio: "",
      avatarTone: "#6f7898",
      followerCount: 0,
      space: { themeId: "paper", layoutId: "shelf", featuredChapterIds: [] },
    };
    catalog.chapters[chapter.id] = { ...chapter, profileId };
  }
  for (const profile of Object.values(catalog.profiles)) {
    profile.space.featuredChapterIds = getProfileChapters(catalog, profile.id).slice(0, 3).map((chapter) => chapter.id);
  }
  catalog.activities = Object.values(catalog.chapters).map((chapter) => ({
    id: `public:activity:${chapter.id}`,
    profileId: chapter.profileId,
    chapterId: chapter.id,
    publishedAt: chapter.createdAt,
  }));
  return catalog;
}

export function createDiscoveryInteractionState(): DiscoveryInteractionState {
  return { followedProfileIds: [], likedChapterIds: [], readActivityIds: [] };
}

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids)];
}

function validState(value: unknown, catalog?: PublicDiscoveryCatalog): DiscoveryInteractionState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<DiscoveryInteractionState>;
  const filterKnown = (ids: unknown, lookup?: Record<string, unknown>) => (
    Array.isArray(ids) ? uniqueIds(ids.filter((id): id is string => typeof id === "string" && id.length <= 180 && (!lookup || Boolean(lookup[id])))).slice(0, 500) : []
  );
  const activityLookup = catalog ? Object.fromEntries(catalog.activities.map((activity) => [activity.id, activity])) : undefined;
  return {
    followedProfileIds: filterKnown(raw.followedProfileIds, catalog?.profiles),
    likedChapterIds: filterKnown(raw.likedChapterIds, catalog?.chapters),
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
  catalog?: PublicDiscoveryCatalog,
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
