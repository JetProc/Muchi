import type { ArchivePatchOperation } from "@/lib/archive-patch";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import { patchArchive, readArchive } from "@/lib/server/archive-repository";

function error(code: string, message: string, status: number, latest?: { archive: unknown; revision: number }) {
  return Response.json({ code, message, ...latest }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function GET() {
  try {
    const { supabase, userId } = await requireAuthenticatedUser();
    const value = await readArchive(supabase, userId);
    return Response.json(value, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return error("unauthenticated", cause.message, 401);
    return error("unavailable", "아카이브를 불러오지 못했어요.", 503);
  }
}

export async function PUT(request: Request) {
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 512_000) {
      return error("archive_too_large", "한 번에 저장할 변경사항이 너무 큽니다.", 413);
    }
    const body = (() => {
      try { return JSON.parse(rawBody) as { operations?: unknown; expectedRevision?: unknown; syncPublicProjection?: unknown }; }
      catch { return null; }
    })();
    if (!Array.isArray(body?.operations) || !Number.isInteger(body?.expectedRevision) || (body?.expectedRevision as number) < 0) {
      return error("invalid_archive", "저장할 음악 기록 형식이 올바르지 않습니다.", 400);
    }
    const { supabase, userId } = await requireAuthenticatedUser();
    const result = await patchArchive(
      supabase,
      userId,
      body.operations as ArchivePatchOperation[],
      body.expectedRevision as number,
      body.syncPublicProjection === true,
    );
    if (result.status === "conflict") {
      return error("conflict", "다른 기기에서 먼저 변경됐어요.", 409, result.value);
    }
    return Response.json({ revision: result.revision }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return error("unauthenticated", cause.message, 401);
    return error("unavailable", "아카이브를 저장하지 못했어요.", 503);
  }
}
