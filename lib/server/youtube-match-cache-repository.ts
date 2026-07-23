import { createClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/env";
import type { YoutubeMatchCandidate } from "./youtube-track-matcher";

export type YoutubeMatchCacheValue = {
  cacheKey: string;
  candidates: YoutubeMatchCandidate[];
};

type CacheRow = {
  cache_key: string;
  candidates: unknown;
};

function cacheClient() {
  const config = getSupabasePublicConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!config || !serviceRoleKey) throw new Error("YouTube 매칭 캐시 관리자 설정이 없습니다.");
  return createClient(config.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function isCandidate(value: unknown): value is YoutubeMatchCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Partial<YoutubeMatchCandidate>;
  return typeof candidate.id === "string"
    && typeof candidate.title === "string"
    && typeof candidate.artist === "string"
    && typeof candidate.album === "string"
    && (candidate.thumbnailUrl === null || typeof candidate.thumbnailUrl === "string")
    && (candidate.durationMs === null || typeof candidate.durationMs === "number")
    && typeof candidate.score === "number"
    && (candidate.confidence === "high" || candidate.confidence === "medium" || candidate.confidence === "low")
    && Array.isArray(candidate.reasons)
    && candidate.reasons.every((reason) => typeof reason === "string")
    && typeof candidate.url === "string";
}

export async function readYoutubeMatchCache(
  cacheKeys: string[],
  algorithmVersion: string,
): Promise<Map<string, YoutubeMatchCandidate[]>> {
  if (!cacheKeys.length) return new Map();
  const { data, error } = await cacheClient()
    .from("youtube_track_match_cache")
    .select("cache_key, candidates")
    .in("cache_key", [...new Set(cacheKeys)])
    .eq("algorithm_version", algorithmVersion)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
  const result = new Map<string, YoutubeMatchCandidate[]>();
  (data as CacheRow[] | null)?.forEach((row) => {
    if (Array.isArray(row.candidates) && row.candidates.every(isCandidate)) {
      result.set(row.cache_key, row.candidates);
    }
  });
  return result;
}

export async function writeYoutubeMatchCache(
  values: YoutubeMatchCacheValue[],
  algorithmVersion: string,
): Promise<void> {
  if (!values.length) return;
  const now = new Date();
  const { error } = await cacheClient()
    .from("youtube_track_match_cache")
    .upsert(values.map((value) => ({
      cache_key: value.cacheKey,
      algorithm_version: algorithmVersion,
      candidates: value.candidates,
      expires_at: new Date(
        now.getTime() + (value.candidates.length ? 30 : 1) * 24 * 60 * 60 * 1_000,
      ).toISOString(),
      updated_at: now.toISOString(),
    })), { onConflict: "cache_key" });
  if (error) throw error;
}
