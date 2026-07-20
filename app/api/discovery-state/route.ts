import { parseDiscoveryInteractionState } from "@/lib/public-discovery";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import { readDiscoveryState, replaceDiscoveryState } from "@/lib/server/discovery-state-repository";

function error(code: string, message: string, status: number) { return Response.json({ code, message }, { status, headers: { "Cache-Control": "private, no-store" } }); }

export async function GET() {
  try {
    const { supabase, userId } = await requireAuthenticatedUser();
    return Response.json(await readDiscoveryState(supabase, userId), { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return cause instanceof ApiAuthError ? error("unauthenticated", cause.message, 401) : error("unavailable", "탐색 상태를 불러오지 못했어요.", 503);
  }
}

export async function PUT(request: Request) {
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > 256_000) return error("state_too_large", "탐색 상태의 전체 용량이 너무 큽니다.", 413);
    const body = (() => {
      try { return JSON.parse(rawBody) as { state?: unknown; expectedRevision?: unknown }; }
      catch { return null; }
    })();
    if (!body || !Number.isInteger(body.expectedRevision) || (body.expectedRevision as number) < 0) return error("invalid_state", "저장할 탐색 상태 형식이 올바르지 않습니다.", 400);
    const state = parseDiscoveryInteractionState(JSON.stringify(body.state));
    const { supabase, userId } = await requireAuthenticatedUser();
    const result = await replaceDiscoveryState(supabase, userId, state, body.expectedRevision as number);
    if (result.status === "conflict") return Response.json({ code: "conflict", message: "다른 기기에서 먼저 변경됐어요.", state: result.value.state, revision: result.value.revision }, { status: 409 });
    return Response.json(result.value, { headers: { "Cache-Control": "private, no-store" } });
  } catch (cause) {
    return cause instanceof ApiAuthError ? error("unauthenticated", cause.message, 401) : error("unavailable", "탐색 상태를 저장하지 못했어요.", 503);
  }
}
