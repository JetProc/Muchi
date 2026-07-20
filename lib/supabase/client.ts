"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./env";

let browserClient: ReturnType<typeof createBrowserClient> | null = null;

export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  if (!config) throw new Error("Supabase 환경 변수가 설정되지 않았습니다.");
  browserClient ??= createBrowserClient(config.url, config.publishableKey);
  return browserClient;
}
