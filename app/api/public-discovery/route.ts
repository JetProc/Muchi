import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import { readPublicDiscoveryCatalog } from "@/lib/server/public-discovery-repository";

export async function GET() {
  try {
    const { supabase } = await requireAuthenticatedUser();
    return Response.json(await readPublicDiscoveryCatalog(supabase), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (cause) {
    if (cause instanceof ApiAuthError) {
      return Response.json({ code: "unauthenticated", message: cause.message }, { status: 401 });
    }
    return Response.json({ code: "unavailable", message: "공개 챕터를 불러오지 못했어요." }, { status: 503 });
  }
}
