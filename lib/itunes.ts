import type { TrackReference } from "./archive";

export const ITUNES_SEARCH_ENDPOINT = "https://itunes.apple.com/search";
export const ITUNES_PREVIEW_ATTRIBUTION = "Provided courtesy of iTunes";
export const ITUNES_PREVIEW_DURATION_SECONDS = 30;
export const ITUNES_PREVIEW_USAGE_NOTICE =
  "미리듣기는 홍보 목적으로만 스트리밍하며 다운로드하거나 저장하지 않습니다.";

const CACHE_TTL_MS = 10 * 60 * 1_000;
const REQUEST_TIMEOUT_MS = 8_000;

export type ItunesSearchErrorCode =
  | "invalid-query"
  | "unsupported-environment"
  | "network"
  | "timeout"
  | "malformed-response"
  | "stale";

export class ItunesSearchError extends Error {
  readonly code: ItunesSearchErrorCode;

  constructor(code: ItunesSearchErrorCode, message: string) {
    super(message);
    this.name = "ItunesSearchError";
    this.code = code;
  }
}

interface CachedSearch {
  expiresAt: number;
  tracks: TrackReference[];
}

interface ItunesSearchResponse {
  results: unknown[];
}

interface ItunesSongResult {
  trackId: number;
  trackName: string;
  artistName: string;
  collectionName?: unknown;
  primaryGenreName?: unknown;
  trackTimeMillis?: unknown;
  artworkUrl100?: unknown;
  previewUrl?: unknown;
  trackViewUrl?: unknown;
}

const searchCache = new Map<string, CachedSearch>();
let latestRequestSequence = 0;

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function asWebUrl(value: unknown): string | null {
  const candidate = asNonEmptyString(value);
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export function enlargeArtworkUrl(
  value: unknown,
  size = 600,
): string | null {
  const url = asWebUrl(value);
  if (!url || !Number.isInteger(size) || size < 1 || size > 3_000) {
    return url;
  }

  return url.replace(/\/\d+x\d+bb(?=\.[a-z0-9]+(?:\?|$))/i, `/${size}x${size}bb`);
}

function isSongResult(value: unknown): value is ItunesSongResult {
  if (!value || typeof value !== "object") return false;

  const result = value as Record<string, unknown>;
  return (
    typeof result.trackId === "number" &&
    Number.isFinite(result.trackId) &&
    result.trackId > 0 &&
    asNonEmptyString(result.trackName) !== null &&
    asNonEmptyString(result.artistName) !== null
  );
}

function mapSongResult(result: ItunesSongResult): TrackReference {
  return {
    id: `itunes:${result.trackId}`,
    provider: "itunes",
    providerTrackId: result.trackId,
    title: asNonEmptyString(result.trackName) ?? "제목 없음",
    artist: asNonEmptyString(result.artistName) ?? "아티스트 미상",
    album: asNonEmptyString(result.collectionName) ?? "",
    genre: asNonEmptyString(result.primaryGenreName) ?? "",
    durationMs:
      typeof result.trackTimeMillis === "number" &&
      Number.isFinite(result.trackTimeMillis) &&
      result.trackTimeMillis >= 0
        ? result.trackTimeMillis
        : null,
    artworkUrl: enlargeArtworkUrl(result.artworkUrl100),
    previewUrl: asWebUrl(result.previewUrl),
    externalUrl: asWebUrl(result.trackViewUrl),
  };
}

function parseResponse(value: unknown): TrackReference[] {
  if (!value || typeof value !== "object") {
    throw new ItunesSearchError(
      "malformed-response",
      "iTunes 검색 응답을 읽을 수 없습니다.",
    );
  }

  const response = value as Partial<ItunesSearchResponse>;
  if (!Array.isArray(response.results)) {
    throw new ItunesSearchError(
      "malformed-response",
      "iTunes 검색 결과 형식이 올바르지 않습니다.",
    );
  }

  return response.results.filter(isSongResult).map(mapSongResult);
}

function normalizeQuery(query: string): { query: string; cacheKey: string } {
  const normalized = query.trim().replace(/\s+/g, " ");
  if (normalized.length < 2) {
    throw new ItunesSearchError(
      "invalid-query",
      "곡명이나 아티스트를 두 글자 이상 입력해 주세요.",
    );
  }

  return {
    query: normalized,
    cacheKey: normalized.toLocaleLowerCase("ko-KR"),
  };
}

/**
 * Searches the Korean iTunes storefront. Call only in response to an explicit
 * user action; this function does not debounce or search while typing.
 */
export function searchItunesTracks(query: string): Promise<TrackReference[]> {
  const requestSequence = ++latestRequestSequence;

  let normalized: ReturnType<typeof normalizeQuery>;
  try {
    normalized = normalizeQuery(query);
  } catch (error) {
    return Promise.reject(error);
  }

  const cached = searchCache.get(normalized.cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve([...cached.tracks]);
  }
  if (cached) searchCache.delete(normalized.cacheKey);

  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new ItunesSearchError(
        "unsupported-environment",
        "iTunes 검색은 브라우저에서만 사용할 수 있습니다.",
      ),
    );
  }

  return new Promise<TrackReference[]>((resolve, reject) => {
    const callbackName = `__musicWorldItunes_${Date.now()}_${requestSequence}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const callbackTarget = window as unknown as Record<string, unknown>;
    const script = document.createElement("script");
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      script.remove();
      delete callbackTarget[callbackName];
    };

    const fail = (error: ItunesSearchError) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(error);
    };

    const timeoutId = window.setTimeout(() => {
      fail(
        requestSequence === latestRequestSequence
          ? new ItunesSearchError("timeout", "iTunes 검색 시간이 초과됐습니다.")
          : new ItunesSearchError("stale", "더 최근 검색 요청이 있습니다."),
      );
    }, REQUEST_TIMEOUT_MS);

    callbackTarget[callbackName] = (payload: unknown) => {
      if (requestSequence !== latestRequestSequence) {
        fail(new ItunesSearchError("stale", "더 최근 검색 요청이 있습니다."));
        return;
      }

      try {
        const tracks = parseResponse(payload);
        searchCache.set(normalized.cacheKey, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          tracks,
        });
        settled = true;
        cleanup();
        resolve([...tracks]);
      } catch (error) {
        fail(
          error instanceof ItunesSearchError
            ? error
            : new ItunesSearchError(
                "malformed-response",
                "iTunes 검색 응답을 처리하지 못했습니다.",
              ),
        );
      }
    };

    script.async = true;
    script.src = new URL(
      `${ITUNES_SEARCH_ENDPOINT}?${new URLSearchParams({
        term: normalized.query,
        country: "KR",
        media: "music",
        entity: "song",
        limit: "10",
        callback: callbackName,
      }).toString()}`,
    ).toString();
    script.onerror = () => {
      fail(
        requestSequence === latestRequestSequence
          ? new ItunesSearchError("network", "iTunes 검색에 실패했습니다.")
          : new ItunesSearchError("stale", "더 최근 검색 요청이 있습니다."),
      );
    };

    (document.head ?? document.documentElement).append(script);
  });
}
