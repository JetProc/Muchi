import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import { readPublicDiscoveryCatalog, setChapterLike } from "@/lib/server/public-discovery-repository";

export async function GET() {
  try {
    const { supabase, userId } = await requireAuthenticatedUser();
    return Response.json(await readPublicDiscoveryCatalog(supabase, userId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    if (cause instanceof ApiAuthError) {
      return Response.json({ code: "unauthenticated", message: cause.message }, { status: 401 });
    }
    return Response.json({ code: "unavailable", message: "공개 챕터를 불러오지 못했어요." }, { status: 503 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json() as { authorId?: unknown; chapterId?: unknown; liked?: unknown };
    if (typeof body.authorId !== "string" || typeof body.chapterId !== "string" || typeof body.liked !== "boolean") {
      return Response.json({ code: "invalid_like", message: "좋아요 요청이 올바르지 않습니다." }, { status: 400 });
    }
    const { supabase, userId } = await requireAuthenticatedUser();
    await setChapterLike(supabase, userId, body.authorId, body.chapterId, body.liked);
    return Response.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    const status = cause instanceof ApiAuthError ? 401 : 503;
    return Response.json({ code: status === 401 ? "unauthenticated" : "unavailable", message: cause instanceof ApiAuthError ? cause.message : "좋아요를 저장하지 못했어요." }, { status });
  }
}
