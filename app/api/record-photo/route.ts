import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import { readArchive } from "@/lib/server/archive-repository";
import { downloadRecordPhoto, findRecordPhotoReference, isRecordPhotoVersion } from "@/lib/server/record-photo-repository";

function error(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

function parseCubeTrackId(request: Request): string | null {
  const cubeTrackId = new URL(request.url).searchParams.get("cubeTrackId")?.trim();
  return cubeTrackId && !cubeTrackId.includes("/") ? cubeTrackId : null;
}

function parseVersion(request: Request): string | null {
  const value = new URL(request.url).searchParams.get("v");
  return value && isRecordPhotoVersion(value) ? value : null;
}

export async function GET(request: Request) {
  try {
    const cubeTrackId = parseCubeTrackId(request);
    if (!cubeTrackId) {
      return error("invalid_record_photo", "기록 사진 요청 형식이 올바르지 않습니다.", 400);
    }

    const requestedVersion = parseVersion(request);
    const { supabase, userId } = await requireAuthenticatedUser();
    const { archive } = await readArchive(supabase, userId);
    const reference = findRecordPhotoReference(archive, cubeTrackId);
    if (!reference || (requestedVersion && reference.version !== requestedVersion)) {
      return error("record_photo_not_found", "기록 사진을 찾을 수 없어요.", 404);
    }

    const blob = await downloadRecordPhoto(supabase, reference.path);
    if (!blob) return error("record_photo_not_found", "기록 사진을 찾을 수 없어요.", 404);

    return new Response(blob, {
      status: 200,
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": blob.type || "image/jpeg",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return error("unauthenticated", cause.message, 401);
    return error("unavailable", "기록 사진을 불러오지 못했어요.", 503);
  }
}
