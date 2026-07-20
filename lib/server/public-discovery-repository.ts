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
  payload: unknown;
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
      tracks: tracks.map(({ cubeTrack, track, tags, privateRecord }) => ({
        id: cubeTrack.id,
        track,
        visibility: privateRecord ? "private" : "public",
        note: privateRecord ? null : getLatestCubeTrackNote(cubeTrack)?.body ?? null,
        tags: privateRecord ? [] : tags.map((tag) => tag.label),
      })),
    },
  }));
}

async function readAuthorName(supabase: SupabaseClient, userId: string): Promise<string> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, profile_setup_completed")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.profile_setup_completed) throw new Error("프로필 설정을 먼저 완료해 주세요.");
  return typeof data?.display_name === "string" && data.display_name.trim()
    ? data.display_name.trim().slice(0, 80)
    : "뮤키 사용자";
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

  const authorName = await readAuthorName(supabase, userId);
  const existingByChapterId = new Map(
    ((existing ?? []) as PublishedChapterRow[]).map((row) => [row.chapter_id, row]),
  );
  const publicProjectionUnchanged = existingByChapterId.size === chapters.length
    && chapters.every(({ chapterId, payload }) => {
      const row = existingByChapterId.get(chapterId);
      return row?.author_name === authorName && JSON.stringify(row.payload) === JSON.stringify(payload);
    });
  if (publicProjectionUnchanged) return;

  const { error } = await supabase.from("published_chapters").upsert(
    chapters.map(({ chapterId, payload }) => ({
      author_id: userId,
      chapter_id: chapterId,
      author_name: authorName,
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

export async function readPublicDiscoveryCatalog(supabase: SupabaseClient): Promise<PublicDiscoveryCatalog> {
  const { data, error } = await supabase
    .from("published_chapters")
    .select("author_id, author_name, payload")
    .order("published_at", { ascending: false })
    .limit(60);
  if (error) throw error;
  const rows: PublicDiscoveryRow[] = ((data ?? []) as PublishedChapterRow[]).map((row) => ({
    authorId: row.author_id,
    authorName: row.author_name,
    payload: row.payload as PublicChapter,
  }));
  return createPublicDiscoveryCatalog(rows);
}
