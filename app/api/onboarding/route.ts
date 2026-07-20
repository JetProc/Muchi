import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import {
  completeOnboarding,
  readOnboardingProfile,
} from "@/lib/server/profile-repository";
import { validateNickname } from "@/lib/profile";

function error(code: string, message: string, status: number) {
  return Response.json(
    { code, message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function GET() {
  try {
    const { supabase, userId } = await requireAuthenticatedUser();
    const profile = await readOnboardingProfile(supabase, userId);
    return Response.json(profile, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return error("unauthenticated", cause.message, 401);
    return error("unavailable", "온보딩 정보를 불러오지 못했어요.", 503);
  }
}

export async function PUT(request: Request) {
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 4_000) {
      return error("invalid_nickname", "닉네임 입력값이 너무 큽니다.", 413);
    }
    const body = (() => {
      try { return JSON.parse(rawBody) as { nickname?: unknown }; }
      catch { return null; }
    })();
    if (!body || typeof body.nickname !== "string") {
      return error("invalid_nickname", "닉네임을 입력해 주세요.", 400);
    }
    const validation = validateNickname(body.nickname);
    if (!validation.ok) return error("invalid_nickname", validation.message, 400);
    const { supabase, userId } = await requireAuthenticatedUser();
    const profile = await completeOnboarding(supabase, userId, validation.nickname);
    return Response.json(profile, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return error("unauthenticated", cause.message, 401);
    return error("unavailable", "온보딩을 완료하지 못했어요.", 503);
  }
}
