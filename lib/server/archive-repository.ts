import { createEmptyArchive, parseArchive, type ArchiveEnvelopeV1 } from "@/lib/archive";
import type { SupabaseClient } from "@supabase/supabase-js";

export type VersionedArchive = { archive: ArchiveEnvelopeV1; revision: number };

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

export async function replaceArchive(
  supabase: SupabaseClient,
  userId: string,
  archive: ArchiveEnvelopeV1,
  expectedRevision: number,
): Promise<{ status: "ok"; value: VersionedArchive } | { status: "conflict"; value: VersionedArchive }> {
  const { data, error } = await supabase
    .from("user_archives")
    .update({ payload: archive, schema_version: archive.schemaVersion, revision: expectedRevision + 1 })
    .eq("user_id", userId)
    .eq("revision", expectedRevision)
    .select("payload, revision")
    .maybeSingle();
  if (error) throw error;
  if (data) return { status: "ok", value: rowToArchive(data as ArchiveRow) };
  return { status: "conflict", value: await readArchive(supabase, userId) };
}
