import type { ArchiveEnvelopeV1 } from "@/lib/archive";
import {
  RECORD_PHOTO_BUCKET,
  isRecordPhotoStoragePath,
  isRecordPhotoVersion,
  parseRecordPhotoStoragePath,
} from "@/lib/record-photo-contract";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const RECORD_PHOTO_PREFIX = `${RECORD_PHOTO_BUCKET}/`;
const ORPHAN_SWEEP_GRACE_HOURS = 24;

export type RecordPhotoReference = {
  cubeTrackId: string;
  ownerId: string;
  path: string;
  version: string | null;
};

export type DeferredRecordPhotoSweepPlan = {
  bucket: typeof RECORD_PHOTO_BUCKET;
  ownerId: string;
  prefix: string;
  referencedPaths: string[];
  notBefore: string;
};

type RawPhotoOwner = { customImagePath?: unknown; customImageVersion?: unknown };
type RawCubeTrack = RawPhotoOwner & { id?: unknown; notes?: unknown };
type RawArchiveData = { cubeTracks?: unknown };
type RawArchiveEnvelope = { data?: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export { isRecordPhotoStoragePath as isRecordPhotoPath, isRecordPhotoVersion };

export function createRecordPhotoStorageAdminClient(): SupabaseClient {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceRoleKey) {
    throw new Error("비공개 기록 사진 저장소 관리자 설정이 없습니다.");
  }
  return createClient(config.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function toReference(cubeTrackId: string, value: unknown): RecordPhotoReference | null {
  if (!isRecord(value)) return null;
  const raw = value as RawPhotoOwner;
  if (typeof raw.customImagePath !== "string") return null;
  const path = raw.customImagePath;
  const parsed = parseRecordPhotoStoragePath(path);
  if (!parsed) return null;
  return {
    cubeTrackId,
    ownerId: parsed.ownerId,
    path,
    version: isRecordPhotoVersion(raw.customImageVersion) ? raw.customImageVersion : null,
  };
}

export function findRecordPhotoReference(
  archive: ArchiveEnvelopeV1,
  cubeTrackId: string,
  version?: string,
): RecordPhotoReference | null {
  return listCubeTrackRecordPhotoReferences(cubeTrackId, archive.data.cubeTracks[cubeTrackId])
    .find((reference) => version === undefined || reference.version === version) ?? null;
}

export function findRecordPhotoReferenceInPayload(
  payload: unknown,
  cubeTrackId: string,
): RecordPhotoReference | null {
  if (!isRecord(payload)) return null;
  const envelope = payload as RawArchiveEnvelope;
  if (!isRecord(envelope.data)) return null;
  const data = envelope.data as RawArchiveData;
  if (!isRecord(data.cubeTracks)) return null;
  return listCubeTrackRecordPhotoReferences(cubeTrackId, data.cubeTracks[cubeTrackId])[0] ?? null;
}

export function listRecordPhotoReferences(archive: ArchiveEnvelopeV1): RecordPhotoReference[] {
  return Object.entries(archive.data.cubeTracks)
    .flatMap(([cubeTrackId, cubeTrack]) => listCubeTrackRecordPhotoReferences(cubeTrackId, cubeTrack));
}

function listCubeTrackRecordPhotoReferences(cubeTrackId: string, value: unknown): RecordPhotoReference[] {
  if (!isRecord(value)) return [];
  const cubeTrack = value as RawCubeTrack;
  return [
    toReference(cubeTrackId, cubeTrack),
    ...(Array.isArray(cubeTrack.notes) ? cubeTrack.notes.map((note) => toReference(cubeTrackId, note)) : []),
  ].filter((reference): reference is RecordPhotoReference => reference !== null);
}

export function listRemovedRecordPhotoPaths(
  previousArchive: ArchiveEnvelopeV1,
  nextArchive: ArchiveEnvelopeV1,
): string[] {
  const previous = new Set(listRecordPhotoReferences(previousArchive).map((reference) => reference.path));
  const next = new Set(listRecordPhotoReferences(nextArchive).map((reference) => reference.path));
  return [...previous].filter((path) => !next.has(path));
}

function toObjectName(path: string): string {
  if (!isRecordPhotoStoragePath(path)) throw new Error("기록 사진 경로가 올바르지 않습니다.");
  return path.slice(RECORD_PHOTO_PREFIX.length);
}

function isMissingObjectError(error: { message?: string; statusCode?: string | number } | null | undefined): boolean {
  if (!error) return false;
  return error.statusCode === 404 || error.statusCode === "404" || /not found/i.test(error.message ?? "");
}

export async function downloadRecordPhoto(
  supabase: SupabaseClient,
  path: string,
): Promise<Blob | null> {
  const { data, error } = await supabase.storage.from(RECORD_PHOTO_BUCKET).download(toObjectName(path));
  if (error) {
    if (isMissingObjectError(error)) return null;
    throw error;
  }
  return data;
}

export async function deleteRecordPhotos(supabase: SupabaseClient, paths: string[]): Promise<void> {
  const objectNames = [...new Set(paths.filter(isRecordPhotoStoragePath).map(toObjectName))];
  if (!objectNames.length) return;
  const { error } = await supabase.storage.from(RECORD_PHOTO_BUCKET).remove(objectNames);
  if (error && !isMissingObjectError(error)) throw error;
}

export function createDeferredRecordPhotoSweepPlan(
  ownerId: string,
  archive: ArchiveEnvelopeV1,
  now = new Date(),
): DeferredRecordPhotoSweepPlan {
  return {
    bucket: RECORD_PHOTO_BUCKET,
    ownerId,
    prefix: `${ownerId}/`,
    referencedPaths: listRecordPhotoReferences(archive)
      .filter((reference) => reference.ownerId === ownerId)
      .map((reference) => reference.path)
      .sort(),
    notBefore: new Date(now.getTime() + ORPHAN_SWEEP_GRACE_HOURS * 60 * 60 * 1000).toISOString(),
  };
}
