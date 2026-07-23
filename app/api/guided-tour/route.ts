import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import { CURRENT_GUIDED_TOUR_VERSION } from "@/lib/guided-tour";
import { completeGuidedTour } from "@/lib/server/profile-repository";

function error(code: string, message: string, status: number) {
  return Response.json(
    { code, message },
    { status, headers: { "Cache-Control": "private, no-store" } },
  );
}

export async function PUT(request: Request) {
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 200) {
      return error("invalid_version", "투어 버전 입력값이 너무 큽니다.", 413);
    }
    const body = (() => {
      try { return JSON.parse(rawBody) as { version?: unknown }; }
      catch { return null; }
    })();
    if (!body || body.version !== CURRENT_GUIDED_TOUR_VERSION) {
      return error("invalid_version", "현재 투어 버전과 일치하지 않습니다.", 400);
    }
    const { supabase, userId } = await requireAuthenticatedUser();
    const guidedTourVersion = await completeGuidedTour(
      supabase,
      userId,
      CURRENT_GUIDED_TOUR_VERSION,
    );
    return Response.json(
      { guidedTourVersion },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    if (cause instanceof ApiAuthError) return error("unauthenticated", cause.message, 401);
    return error("unavailable", "투어 완료 상태를 저장하지 못했어요.", 503);
  }
}
