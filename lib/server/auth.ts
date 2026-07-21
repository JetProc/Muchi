import { createSupabaseServerClient } from "@/lib/supabase/server";

export class ApiAuthError extends Error {}

export async function requireAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || typeof userId !== "string" || !userId) throw new ApiAuthError("로그인이 필요합니다.");
  return { supabase, userId, claims: data?.claims };
}

export async function getOptionalAuthenticatedUser() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  return { supabase, userId: typeof userId === "string" && userId ? userId : null };
}
