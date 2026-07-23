import {
  createRecordPhotoStorageAdminClient,
  downloadRecordPhoto,
  isRecordPhotoVersion,
} from "@/lib/server/record-photo-repository";
import { readPublishedPublicRecordPhoto } from "@/lib/server/public-discovery-repository";

function error(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function parseParam(request: Request, key: string): string | null {
  const value = new URL(request.url).searchParams.get(key)?.trim();
  return value ? value : null;
}

export async function GET(request: Request) {
  try {
    const chapterId = parseParam(request, "chapterId");
    const cubeTrackId = parseParam(request, "cubeTrackId");
    const version = parseParam(request, "v");
    if (!chapterId || !cubeTrackId || !version || !isRecordPhotoVersion(version)) {
      return error("invalid_public_record_media", "공개 기록 사진 요청 형식이 올바르지 않습니다.", 400);
    }

    const supabase = createRecordPhotoStorageAdminClient();
    const reference = await readPublishedPublicRecordPhoto(supabase, { chapterId, cubeTrackId, version });
    if (!reference) {
      return error("public_record_media_not_found", "공개 기록 사진을 찾을 수 없어요.", 404);
    }

    const blob = await downloadRecordPhoto(supabase, reference.path);
    if (!blob) return error("public_record_media_not_found", "공개 기록 사진을 찾을 수 없어요.", 404);

    return new Response(blob, {
      status: 200,
      headers: {
        // Revalidate every request so a public -> private transition cannot leave
        // a previously authorized photo readable from a CDN cache.
        "Cache-Control": "private, no-store",
        "Content-Type": blob.type || "image/jpeg",
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return error("unavailable", "공개 기록 사진을 불러오지 못했어요.", 503);
  }
}
