import { createAppleMusicDeveloperToken } from "@/lib/server/apple-music";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";

export async function GET() {
  try {
    await requireAuthenticatedUser();
    const token = createAppleMusicDeveloperToken();
    if (!token) return Response.json({ code: "not_configured", message: "Apple Music 연동 설정이 아직 완료되지 않았어요." }, { status: 503 });
    return Response.json({ token }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return Response.json({ code: "unauthenticated", message: cause.message }, { status: 401 });
    return Response.json({ code: "unavailable", message: "Apple Music 연결을 시작하지 못했어요." }, { status: 503 });
  }
}
