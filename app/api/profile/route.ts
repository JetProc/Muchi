import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import { updateProfile } from "@/lib/server/profile-repository";

function error(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status, headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 8_000) return error("invalid_profile", "프로필 입력값이 너무 큽니다.", 413);
    const body = (() => {
      try { return JSON.parse(raw) as { nickname?: unknown; bio?: unknown }; }
      catch { return null; }
    })();
    if (!body || typeof body.nickname !== "string" || typeof body.bio !== "string") {
      return error("invalid_profile", "닉네임과 소개를 확인해 주세요.", 400);
    }
    const { supabase, userId } = await requireAuthenticatedUser();
    return Response.json(await updateProfile(supabase, userId, { nickname: body.nickname, bio: body.bio }), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return error("unauthenticated", cause.message, 401);
    return error("unavailable", cause instanceof Error ? cause.message : "프로필을 저장하지 못했어요.", 503);
  }
}
