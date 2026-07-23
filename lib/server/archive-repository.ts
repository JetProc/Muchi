import { createEmptyArchive, getVisitorSpaceChapters, parseArchive, type ArchiveEnvelopeV1 } from "@/lib/archive";
import { applyArchivePatch, type ArchivePatchOperation } from "@/lib/archive-patch";
import { createPublicProjectionInput } from "./public-discovery-repository";
import { createDeferredRecordPhotoSweepPlan, deleteRecordPhotos, listRemovedRecordPhotoPaths } from "./record-photo-repository";
import type { SupabaseClient } from "@supabase/supabase-js";

export type VersionedArchive = { archive: ArchiveEnvelopeV1; revision: number };
export type ArchivePatchResult =
  | { status: "ok"; revision: number }
  | { status: "conflict"; value: VersionedArchive };

type ArchiveRow = { payload: unknown; revision: number };

function rowToArchive(row: ArchiveRow): VersionedArchive {
  const parsed = parseArchive(JSON.stringify(row.payload));
  if (parsed.status !== "ok") throw new Error("저장된 아카이브 형식이 올바르지 않습니다.");
  return { archive: parsed.archive, revision: row.revision };
}

export async function readArchive(supabase: SupabaseClient, userId: string): Promise<VersionedArchive> {
  const { data, error } = await supabase
    .from("user_archives")
    .select("payload, revision")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (data) return rowToArchive(data as ArchiveRow);

  const archive = createEmptyArchive();
  const { data: inserted, error: insertError } = await supabase
    .from("user_archives")
    .insert({ user_id: userId, payload: archive, schema_version: archive.schemaVersion, revision: 0 })
    .select("payload, revision")
    .single();
  if (!insertError) return rowToArchive(inserted as ArchiveRow);
  // Another first request may have created the row. Read once more before surfacing an error.
  const { data: retry, error: retryError } = await supabase
    .from("user_archives")
    .select("payload, revision")
    .eq("user_id", userId)
    .single();
  if (retryError) throw insertError;
  return rowToArchive(retry as ArchiveRow);
}

export async function patchArchive(
  supabase: SupabaseClient,
  userId: string,
  operations: ArchivePatchOperation[],
  expectedRevision: number,
  syncPublicProjection: boolean,
): Promise<ArchivePatchResult> {
  const current = await readArchive(supabase, userId);
  if (current.revision !== expectedRevision) return { status: "conflict", value: current };
  const archive = applyArchivePatch(current.archive, operations);
  // An empty projection only removes existing public chapters. It must not depend
  // on profile completeness, otherwise archive reset can fail before deletion.
  const projection = syncPublicProjection && getVisitorSpaceChapters(archive).length > 0
    ? await createPublicProjectionInput(supabase, userId, archive)
    : null;
  const { data, error } = await supabase.rpc("save_archive_with_public_projection", {
    p_payload: archive,
    p_schema_version: archive.schemaVersion,
    p_expected_revision: expectedRevision,
    p_sync_public_projection: syncPublicProjection,
    p_projection: projection?.chapters.map((chapter) => ({
      chapter_id: chapter.chapterId,
      payload: chapter.payload,
      published_at: chapter.publishedAt,
    })) ?? [],
    p_author_name: projection?.author.name ?? null,
    p_author_avatar_url: projection?.author.avatarUrl ?? null,
    p_author_bio: projection?.author.bio ?? null,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object") throw new Error("저장 결과가 올바르지 않습니다.");
  const result = row as { status?: unknown; payload?: unknown; revision?: unknown };
  if (typeof result.revision !== "number") throw new Error("저장 revision이 올바르지 않습니다.");
  if (result.status === "conflict") {
    return { status: "conflict", value: rowToArchive({ payload: result.payload, revision: result.revision }) };
  }
  if (result.status !== "ok") throw new Error("저장 결과 상태가 올바르지 않습니다.");
  try {
    await deleteRecordPhotos(supabase, listRemovedRecordPhotoPaths(current.archive, archive));
  } catch (cleanupError) {
    console.error("record photo cleanup failed", {
      userId,
      cleanup: createDeferredRecordPhotoSweepPlan(userId, archive),
      cleanupError,
    });
  }
  return { status: "ok", revision: result.revision };
}
