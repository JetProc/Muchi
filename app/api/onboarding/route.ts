import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import {
  completeOnboarding,
  readOnboardingProfile,
} from "@/lib/server/profile-repository";

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

export async function PUT() {
  try {
    const { supabase, userId } = await requireAuthenticatedUser();
    const profile = await completeOnboarding(supabase, userId);
    return Response.json(profile, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return error("unauthenticated", cause.message, 401);
    return error("unavailable", "온보딩을 완료하지 못했어요.", 503);
  }
}
