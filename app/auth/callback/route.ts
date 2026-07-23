import { normalizeAuthDestination } from "@/lib/auth-redirect";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function privateRedirect(destination: URL) {
  const response = NextResponse.redirect(destination, 303);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = normalizeAuthDestination(url.searchParams.get("next"));
  if (!code) return privateRedirect(new URL("/auth/error", url.origin));
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return privateRedirect(new URL(next, url.origin));
  } catch {
    try {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase.auth.getClaims();
      if (typeof data?.claims?.sub === "string" && data.claims.sub) {
        return privateRedirect(new URL(next, url.origin));
      }
    } catch {
      // The error page remains the safe fallback when no valid session exists.
    }
    return privateRedirect(new URL("/auth/error", url.origin));
  }
}
