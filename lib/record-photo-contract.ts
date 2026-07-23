export const RECORD_PHOTO_BUCKET = "record-photos";
export const RECORD_PHOTO_VERSION_MAX_LENGTH = 64;

const UUID_PATH_SEGMENT = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const CUBE_TRACK_PATH_SEGMENT = "[A-Za-z0-9:_-]{1,200}";
const VERSION_PATH_SEGMENT = `[A-Za-z0-9_-]{1,${RECORD_PHOTO_VERSION_MAX_LENGTH}}`;
const RECORD_PHOTO_PATH_PATTERN = new RegExp(
  `^${RECORD_PHOTO_BUCKET}\/(${UUID_PATH_SEGMENT})\/(${CUBE_TRACK_PATH_SEGMENT})\/(${VERSION_PATH_SEGMENT})\.jpg$`,
  "i",
);
const RECORD_PHOTO_VERSION_PATTERN = new RegExp(`^${VERSION_PATH_SEGMENT}$`);

export type ParsedRecordPhotoPath = {
  ownerId: string;
  cubeTrackId: string;
  version: string;
};

export function isRecordPhotoVersion(value: unknown): value is string {
  return typeof value === "string" && RECORD_PHOTO_VERSION_PATTERN.test(value);
}

export function parseRecordPhotoStoragePath(value: unknown): ParsedRecordPhotoPath | null {
  if (typeof value !== "string") return null;
  const match = value.match(RECORD_PHOTO_PATH_PATTERN);
  if (!match) return null;
  return { ownerId: match[1], cubeTrackId: match[2], version: match[3] };
}

export function isRecordPhotoStoragePath(value: unknown): value is string {
  return parseRecordPhotoStoragePath(value) !== null;
}

export function createOwnedRecordPhotoUrl(
  cubeTrackId: string,
  version: string | null | undefined,
): string | null {
  if (!version) return null;
  return `/api/record-photo?${new URLSearchParams({ cubeTrackId, v: version }).toString()}`;
}
