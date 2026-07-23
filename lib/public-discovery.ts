import type { AffectionLevel, ArchiveEnvelopeV1, SpaceLayoutId, SpaceThemeId, TrackReference } from "./archive";

export type PublicRecordVisibility = "public" | "private";

export type PublicRecordMediaHandle = {
  chapterId: string;
  cubeTrackId: string;
  version: string;
};

export type PublicRecordMedia = {
  handle: PublicRecordMediaHandle;
  displayUrl: string;
};

export type PublicSpacePresentation = {
  themeId: SpaceThemeId;
  layoutId: SpaceLayoutId;
  featuredChapterIds: string[];
};

export type PublicProfile = {
  id: string;
  name: string;
  bio: string;
  avatarUrl: string | null;
  avatarTone: string;
  followerCount: number;
  followedByViewer: boolean;
  space: PublicSpacePresentation;
};

export type PublicChapterTrack = {
  id: string;
  track: TrackReference;
  visibility: PublicRecordVisibility;
  note: string | null;
  tags: string[];
  affection: AffectionLevel | null;
  recordPhoto: PublicRecordMedia | null;
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
  likedByViewer: boolean;
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
  authorAvatarUrl?: string | null;
  authorBio?: string;
  followerCount?: number;
  followedByViewer?: boolean;
  payload: PublicChapter;
};

export function createEmptyPublicDiscoveryCatalog(): PublicDiscoveryCatalog {
  return { profiles: {}, chapters: {}, activities: [] };
}

export function createPublicRecordMediaUrl(handle: PublicRecordMediaHandle): string {
  const search = new URLSearchParams({
    chapterId: handle.chapterId,
    cubeTrackId: handle.cubeTrackId,
    v: handle.version,
  });
  return `/api/public-record-media?${search.toString()}`;
}

export function withPublicChapterLike(
  catalog: PublicDiscoveryCatalog,
  chapterId: string,
  likedByViewer: boolean,
): PublicDiscoveryCatalog {
  const chapter = catalog.chapters[chapterId];
  if (!chapter || chapter.likedByViewer === likedByViewer) return catalog;

  return {
    ...catalog,
    chapters: {
      ...catalog.chapters,
      [chapterId]: {
        ...chapter,
        likedByViewer,
        likeCount: Math.max(0, chapter.likeCount + (likedByViewer ? 1 : -1)),
      },
    },
  };
}

export function withPublicProfileFollow(
  catalog: PublicDiscoveryCatalog,
  profileId: string,
  followedByViewer: boolean,
): PublicDiscoveryCatalog {
  const profile = catalog.profiles[profileId];
  if (!profile || profile.followedByViewer === followedByViewer) return catalog;
  return {
    ...catalog,
    profiles: {
      ...catalog.profiles,
      [profileId]: {
        ...profile,
        followedByViewer,
        followerCount: Math.max(0, profile.followerCount + (followedByViewer ? 1 : -1)),
      },
    },
  };
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
      bio: typeof row.authorBio === "string" ? row.authorBio.trim() : "",
      avatarUrl: typeof row.authorAvatarUrl === "string" ? row.authorAvatarUrl : null,
      avatarTone: "#6f7898",
      followerCount: typeof row.followerCount === "number" && row.followerCount >= 0 ? row.followerCount : 0,
      followedByViewer: row.followedByViewer === true,
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
  return { readActivityIds: [] };
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
  return { readActivityIds: filterKnown(raw.readActivityIds, activityLookup) };
}

export function serializeDiscoveryInteractionState(state: DiscoveryInteractionState): string {
  return JSON.stringify({
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
): FollowActivity[] {
  return catalog.activities
    .filter((activity) => catalog.profiles[activity.profileId]?.followedByViewer)
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export function rankPublicChapters(
  archive: ArchiveEnvelopeV1,
  catalog: PublicDiscoveryCatalog,
): RankedPublicChapter[] {
  const userTrackIds = new Set(Object.keys(archive.data.tracks));
  return Object.values(catalog.chapters)
    .map((chapter) => {
      const profile = catalog.profiles[chapter.profileId];
      const sharedTrackCount = chapter.tracks.filter(({ track }) => userTrackIds.has(track.id)).length;
      const sharedTrackDensity = chapter.tracks.length ? sharedTrackCount / chapter.tracks.length : 0;
      const score = sharedTrackCount * 10_000 + sharedTrackDensity * 1_000 + chapter.likeCount / 1_000;
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
