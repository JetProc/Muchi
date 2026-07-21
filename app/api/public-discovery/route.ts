import { ApiAuthError, getOptionalAuthenticatedUser, requireAuthenticatedUser } from "@/lib/server/auth";
import { readPublicDiscoveryCatalog, setChapterLike, setProfileFollow } from "@/lib/server/public-discovery-repository";

export async function GET() {
  try {
    const { supabase, userId } = await getOptionalAuthenticatedUser();
    return Response.json(await readPublicDiscoveryCatalog(supabase, userId), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ code: "unavailable", message: "공개 챕터를 불러오지 못했어요." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { action?: unknown; authorId?: unknown; chapterId?: unknown; profileId?: unknown; liked?: unknown; followed?: unknown };
    const { supabase, userId } = await requireAuthenticatedUser();
    if (body.action === "follow" && typeof body.profileId === "string" && typeof body.followed === "boolean") {
      await setProfileFollow(supabase, userId, body.profileId, body.followed);
    } else if (body.action === "like" && typeof body.authorId === "string" && typeof body.chapterId === "string" && typeof body.liked === "boolean") {
      await setChapterLike(supabase, userId, body.authorId, body.chapterId, body.liked);
    } else {
      return Response.json({ code: "invalid_interaction", message: "요청이 올바르지 않습니다." }, { status: 400 });
    }
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const status = cause instanceof ApiAuthError ? 401 : 503;
    return Response.json({ code: status === 401 ? "unauthenticated" : "unavailable", message: cause instanceof ApiAuthError ? cause.message : "좋아요를 저장하지 못했어요." }, { status });
  }
}
