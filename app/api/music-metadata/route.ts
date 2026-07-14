import { makeProviderTrackId, type TrackReference } from "../../../lib/archive";
import {
  MusicLinkError,
  parseSupportedMusicUrl,
  type ManualFallbackReason,
  type ManualMusicMetadataResponse,
  type MusicMetadataApiResponse,
  type ParsedMusicLink,
  type ReadyMusicMetadataResponse,
  type SuggestedTrackMetadata,
} from "../../../lib/music-links";

const FETCH_TIMEOUT_MS = 6_000;
const MAX_UPSTREAM_RESPONSE_BYTES = 512_000;

function json(body: MusicMetadataApiResponse, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function httpsUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function duration(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function enlargeAppleArtwork(value: unknown): string | null {
  const url = httpsUrl(value);
  return url?.replace(/\/\d+x\d+bb(?=\.[a-z0-9]+(?:\?|$))/i, "/600x600bb") ?? null;
}

async function fetchOfficialJson(url: URL): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Upstream responded with ${response.status}`);

    const declaredLength = Number(response.headers.get("content-length"));
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > MAX_UPSTREAM_RESPONSE_BYTES
    ) {
      throw new Error("Upstream response is too large");
    }

    const body = await response.text();
    if (body.length > MAX_UPSTREAM_RESPONSE_BYTES) {
      throw new Error("Upstream response is too large");
    }
    return JSON.parse(body) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

function blankSuggestion(): SuggestedTrackMetadata {
  return {
    title: "",
    artist: "",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
  };
}

function manual(
  link: ParsedMusicLink,
  reason: ManualFallbackReason,
  suggested: SuggestedTrackMetadata = blankSuggestion(),
): ManualMusicMetadataResponse {
  const missingFields = (["title", "artist"] as const).filter(
    (field) => !suggested[field],
  );
  return {
    status: "manual",
    service: link.service,
    originalUrl: link.originalUrl,
    canonicalUrl: link.canonicalUrl,
    fallback: {
      id: makeProviderTrackId(link.provider, link.providerTrackId),
      provider: link.provider,
      providerTrackId: link.providerTrackId,
      externalUrl: link.originalUrl,
      suggested,
      missingFields: [...missingFields],
      reason,
    },
  };
}

async function spotifyMetadata(link: ParsedMusicLink): Promise<ManualMusicMetadataResponse> {
  try {
    const endpoint = new URL("https://open.spotify.com/oembed");
    endpoint.searchParams.set("url", link.canonicalUrl);
    const payload = await fetchOfficialJson(endpoint);
    if (!isRecord(payload)) return manual(link, "metadata-unavailable");

    const suggested = blankSuggestion();
    suggested.title = text(payload.title);
    suggested.artworkUrl = httpsUrl(payload.thumbnail_url);
    // Spotify oEmbed intentionally omits the track artist. Keep the result in
    // manual mode instead of inventing an artist or scraping an embed page.
    return manual(
      link,
      suggested.title ? "metadata-incomplete" : "metadata-unavailable",
      suggested,
    );
  } catch {
    return manual(link, "metadata-unavailable");
  }
}

async function youtubeMetadata(
  link: ParsedMusicLink,
): Promise<ReadyMusicMetadataResponse | ManualMusicMetadataResponse> {
  try {
    const endpoint = new URL("https://www.youtube.com/oembed");
    endpoint.searchParams.set("url", link.canonicalUrl);
    endpoint.searchParams.set("format", "json");
    const payload = await fetchOfficialJson(endpoint);
    if (!isRecord(payload)) return manual(link, "metadata-unavailable");

    const suggested: SuggestedTrackMetadata = {
      ...blankSuggestion(),
      title: text(payload.title),
      artist: text(payload.author_name),
      artworkUrl: httpsUrl(payload.thumbnail_url),
    };
    if (!suggested.title || !suggested.artist) {
      return manual(link, "metadata-incomplete", suggested);
    }

    const track: TrackReference = {
      id: makeProviderTrackId(link.provider, link.providerTrackId),
      provider: link.provider,
      providerTrackId: link.providerTrackId,
      ...suggested,
      externalUrl: link.originalUrl,
    };
    return {
      status: "ready",
      service: link.service,
      originalUrl: link.originalUrl,
      canonicalUrl: link.canonicalUrl,
      track,
    };
  } catch {
    return manual(link, "metadata-unavailable");
  }
}

async function appleMusicMetadata(
  link: ParsedMusicLink,
): Promise<ReadyMusicMetadataResponse | ManualMusicMetadataResponse> {
  try {
    const endpoint = new URL("https://itunes.apple.com/lookup");
    endpoint.searchParams.set("id", String(link.providerTrackId));
    endpoint.searchParams.set("country", "KR");
    endpoint.searchParams.set("entity", "song");
    const payload = await fetchOfficialJson(endpoint);
    if (!isRecord(payload) || !Array.isArray(payload.results)) {
      return manual(link, "metadata-unavailable");
    }

    const result = payload.results.find(
      (item) =>
        isRecord(item) &&
        item.kind === "song" &&
        item.trackId === link.providerTrackId,
    );
    if (!isRecord(result)) return manual(link, "metadata-unavailable");

    const suggested: SuggestedTrackMetadata = {
      title: text(result.trackName),
      artist: text(result.artistName),
      album: text(result.collectionName),
      genre: text(result.primaryGenreName),
      durationMs: duration(result.trackTimeMillis),
      artworkUrl: enlargeAppleArtwork(result.artworkUrl100),
      previewUrl: httpsUrl(result.previewUrl),
    };
    if (!suggested.title || !suggested.artist) {
      return manual(link, "metadata-incomplete", suggested);
    }

    const track: TrackReference = {
      id: makeProviderTrackId(link.provider, link.providerTrackId),
      provider: link.provider,
      providerTrackId: link.providerTrackId,
      ...suggested,
      externalUrl: link.originalUrl,
    };
    return {
      status: "ready",
      service: link.service,
      originalUrl: link.originalUrl,
      canonicalUrl: link.canonicalUrl,
      track,
    };
  } catch {
    return manual(link, "metadata-unavailable");
  }
}

export async function GET(request: Request): Promise<Response> {
  const requestedUrl = new URL(request.url).searchParams.get("url");
  if (requestedUrl === null || requestedUrl.trim() === "") {
    return json(
      {
        status: "error",
        error: { code: "missing-url", message: "가져올 음악 링크를 입력해 주세요." },
      },
      400,
    );
  }

  let link: ParsedMusicLink;
  try {
    link = parseSupportedMusicUrl(requestedUrl);
  } catch (error) {
    const code = error instanceof MusicLinkError ? error.code : "invalid-url";
    const message =
      error instanceof MusicLinkError
        ? error.message
        : "음악 링크를 확인하지 못했습니다.";
    return json({ status: "error", error: { code, message } }, 400);
  }

  if (link.service === "apple-music") return json(await appleMusicMetadata(link));
  if (link.service === "spotify") return json(await spotifyMetadata(link));
  if (link.service === "youtube") return json(await youtubeMetadata(link));
  return json(manual(link, "provider-manual-only"));
}
