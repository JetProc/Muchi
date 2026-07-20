import { parseArchive } from "@/lib/archive";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import { readArchive, replaceArchive } from "@/lib/server/archive-repository";
import { syncPublishedChapters } from "@/lib/server/public-discovery-repository";

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
    const body = await request.json().catch(() => null) as { payload?: unknown; expectedRevision?: unknown } | null;
    const parsed = parseArchive(JSON.stringify(body?.payload));
    if (parsed.status !== "ok" || !Number.isInteger(body?.expectedRevision) || (body?.expectedRevision as number) < 0) {
      return error("invalid_archive", "저장할 음악 기록 형식이 올바르지 않습니다.", 400);
    }
    const { supabase, userId } = await requireAuthenticatedUser();
    const result = await replaceArchive(supabase, userId, parsed.archive, body!.expectedRevision as number);
    if (result.status === "conflict") {
      return error("conflict", "다른 기기에서 먼저 변경됐어요.", 409, result.value);
    }
    await syncPublishedChapters(supabase, userId, result.value.archive);
    return Response.json(result.value, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return error("unauthenticated", cause.message, 401);
    return error("unavailable", "아카이브를 저장하지 못했어요.", 503);
  }
}
