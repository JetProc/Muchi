import {
  getLatestCubeTrackNote,
  getVisitorSpaceChapters,
  type ArchiveEnvelopeV1,
} from "@/lib/archive";
import {
  createPublicDiscoveryCatalog,
  type PublicChapter,
  type PublicDiscoveryCatalog,
  type PublicDiscoveryRow,
} from "@/lib/public-discovery";
import type { SupabaseClient } from "@supabase/supabase-js";

type PublishedChapterRow = {
  chapter_id: string;
  author_id: string;
  author_name: string;
  author_avatar_url?: string | null;
  author_bio?: string;
  payload: unknown;
  like_count?: number;
};

type PublicAuthorProfile = {
  name: string;
  avatarUrl: string | null;
  bio: string;
};

function toPublicChapter(authorId: string, archive: ArchiveEnvelopeV1): Array<{ chapterId: string; payload: PublicChapter }> {
  return getVisitorSpaceChapters(archive).map(({ chapter, tracks }) => ({
    chapterId: chapter.id,
    payload: {
      id: `public:${authorId}:${chapter.id}`,
      profileId: authorId,
      name: chapter.name,
      description: chapter.description,
      color: chapter.color,
      artworkUrl: chapter.coverImageUrl,
      createdAt: chapter.createdAt,
      likeCount: 0,
      likedByViewer: false,
      tracks: tracks.map(({ cubeTrack, track, tags, privateRecord }) => ({
        id: cubeTrack.id,
        track,
        visibility: privateRecord ? "private" : "public",
        note: privateRecord ? null : getLatestCubeTrackNote(cubeTrack)?.body ?? null,
        tags: privateRecord ? [] : tags.map((tag) => tag.label),
        affection: privateRecord ? null : cubeTrack.affection,
      })),
    },
  }));
}

function safeAvatarUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function readAuthorProfile(supabase: SupabaseClient, userId: string): Promise<PublicAuthorProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, avatar_url, bio, profile_setup_completed")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.profile_setup_completed) throw new Error("프로필 설정을 먼저 완료해 주세요.");
  return {
    name: typeof data?.display_name === "string" && data.display_name.trim()
      ? data.display_name.trim().slice(0, 80)
      : "뮤키 사용자",
    avatarUrl: safeAvatarUrl(data?.avatar_url),
    bio: typeof data?.bio === "string" ? data.bio.trim().slice(0, 160) : "",
  };
}

export async function syncPublishedAuthorProfile(
  supabase: SupabaseClient,
  userId: string,
  profile?: PublicAuthorProfile,
): Promise<void> {
  const author = profile ?? await readAuthorProfile(supabase, userId);
  const { error } = await supabase
    .from("published_chapters")
    .update({
      author_name: author.name,
      author_avatar_url: author.avatarUrl,
      author_bio: author.bio,
    })
    .eq("author_id", userId);
  if (error) throw error;
}

export async function syncPublishedChapters(
  supabase: SupabaseClient,
  userId: string,
  archive: ArchiveEnvelopeV1,
): Promise<void> {
  const chapters = toPublicChapter(userId, archive);
  const { data: existing, error: existingError } = await supabase
    .from("published_chapters")
    .select("chapter_id, author_name, payload")
    .eq("author_id", userId);
  if (existingError) throw existingError;

  if (!chapters.length) {
    if (!(existing ?? []).length) return;
    const { error } = await supabase
      .from("published_chapters")
      .delete()
      .eq("author_id", userId);
    if (error) throw error;
    return;
  }

  const author = await readAuthorProfile(supabase, userId);
  const existingByChapterId = new Map(
    ((existing ?? []) as PublishedChapterRow[]).map((row) => [row.chapter_id, row]),
  );
  const publicProjectionUnchanged = existingByChapterId.size === chapters.length
    && chapters.every(({ chapterId, payload }) => {
      const row = existingByChapterId.get(chapterId);
      return row?.author_name === author.name
        && row?.author_avatar_url === author.avatarUrl
        && row?.author_bio === author.bio
        && JSON.stringify(row.payload) === JSON.stringify(payload);
    });
  if (publicProjectionUnchanged) return;

  const { error } = await supabase.from("published_chapters").upsert(
    chapters.map(({ chapterId, payload }) => ({
      author_id: userId,
      chapter_id: chapterId,
      author_name: author.name,
      author_avatar_url: author.avatarUrl,
      author_bio: author.bio,
      payload,
      published_at: payload.createdAt,
    })),
    { onConflict: "author_id,chapter_id" },
  );
  if (error) throw error;

  const currentIds = new Set(chapters.map(({ chapterId }) => chapterId));
  const removedIds = (existing ?? [])
    .map((row) => row.chapter_id)
    .filter((chapterId): chapterId is string => typeof chapterId === "string" && !currentIds.has(chapterId));
  if (removedIds.length) {
    const { error } = await supabase
      .from("published_chapters")
      .delete()
      .eq("author_id", userId)
      .in("chapter_id", removedIds);
    if (error) throw error;
  }
}

export async function readPublicDiscoveryCatalog(supabase: SupabaseClient, userId: string | null): Promise<PublicDiscoveryCatalog> {
  let query = supabase
    .from("published_chapters")
    .select("author_id, chapter_id, author_name, author_avatar_url, author_bio, payload, like_count")
    .order("published_at", { ascending: false })
    .limit(60);
  if (userId) query = query.neq("author_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  const published = (data ?? []) as PublishedChapterRow[];
  const authorIds = [...new Set(published.map((row) => row.author_id))];
  const { data: followCounts, error: followCountsError } = authorIds.length
    ? await supabase.from("profile_follow_counts").select("profile_id, follower_count").in("profile_id", authorIds)
    : { data: [], error: null };
  if (followCountsError) throw followCountsError;
  const followerCountByProfile = new Map((followCounts ?? []).map((item) => [item.profile_id, item.follower_count]));
  const liked = new Set<string>();
  if (userId) {
    const { data: likes, error: likesError } = await supabase
      .from("chapter_likes")
      .select("author_id, chapter_id")
      .eq("user_id", userId);
    if (likesError) throw likesError;
    (likes ?? []).forEach((like) => liked.add(`${like.author_id}:${like.chapter_id}`));
  }
  const rows: PublicDiscoveryRow[] = published.map((row) => ({
    authorId: row.author_id,
    authorName: row.author_name,
    authorAvatarUrl: row.author_avatar_url ?? null,
    authorBio: row.author_bio ?? "",
    followerCount: followerCountByProfile.get(row.author_id) ?? 0,
    payload: {
      ...(row.payload as PublicChapter),
      likeCount: typeof row.like_count === "number" ? row.like_count : 0,
      likedByViewer: liked.has(`${row.author_id}:${row.chapter_id}`),
    },
  }));
  return createPublicDiscoveryCatalog(rows);
}

export async function setChapterLike(
  supabase: SupabaseClient,
  userId: string,
  authorId: string,
  chapterId: string,
  liked: boolean,
): Promise<void> {
  const query = liked
    ? supabase.from("chapter_likes").insert({ author_id: authorId, chapter_id: chapterId, user_id: userId })
    : supabase.from("chapter_likes").delete().eq("author_id", authorId).eq("chapter_id", chapterId).eq("user_id", userId);
  const { error } = await query;
  if (error && !(liked && error.code === "23505")) throw error;
}

export async function setProfileFollow(
  supabase: SupabaseClient,
  followerId: string,
  profileId: string,
  followed: boolean,
): Promise<void> {
  if (profileId === followerId) throw new Error("내 프로필은 팔로우할 수 없어요.");
  const query = followed
    ? supabase.from("profile_follows").insert({ profile_id: profileId, follower_id: followerId })
    : supabase.from("profile_follows").delete().eq("profile_id", profileId).eq("follower_id", followerId);
  const { error } = await query;
  if (error && !(followed && error.code === "23505")) throw error;
}
