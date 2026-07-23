import { makeProviderTrackId, type TrackReference } from "../../../lib/archive";
import {
  MusicLinkError,
  parseCaptureMusicShareUrl,
  type ManualFallbackReason,
  type ManualMusicMetadataResponse,
  type MusicMetadataApiResponse,
  type ParsedMusicLink,
  type ReadyMusicMetadataResponse,
  type ReadyMusicPlaylistResponse,
  type SuggestedTrackMetadata,
} from "../../../lib/music-links";
import { createAppleMusicDeveloperToken } from "../../../lib/server/apple-music";

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

async function fetchOfficialJson(url: URL): Promise<unknown> {
  return fetchOfficialJsonWithHeaders(url);
}

async function fetchOfficialJsonWithHeaders(
  url: URL,
  headers: Record<string, string> = {},
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json", ...headers },
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

function youtubeTrack(payload: Record<string, unknown>): TrackReference | null {
  const snippet = isRecord(payload.snippet) ? payload.snippet : null;
  if (!snippet) return null;
  const videoId = text(payload.contentDetails) || text(snippet.resourceId);
  const resource = isRecord(snippet.resourceId) ? text(snippet.resourceId.videoId) : "";
  const id = resource || videoId;
  const title = text(snippet.title);
  const artist = text(snippet.videoOwnerChannelTitle) || text(snippet.channelTitle);
  if (!id || !title || !artist) return null;
  const thumbnail = isRecord(snippet.thumbnails) ? snippet.thumbnails : null;
  const medium = thumbnail && isRecord(thumbnail.medium) ? thumbnail.medium : null;
  return {
    id: makeProviderTrackId("youtube", id),
    provider: "youtube",
    providerTrackId: id,
    title,
    artist,
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: httpsUrl(medium?.url),
    previewUrl: null,
    externalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`,
  };
}

async function youtubePlaylistMetadata(
  link: ParsedMusicLink,
): Promise<ReadyMusicPlaylistResponse> {
  const apiKey = process.env.YOUTUBE_API_KEY?.trim();
  if (!apiKey) throw new Error("YouTube 플레이리스트를 가져오려면 YOUTUBE_API_KEY 설정이 필요해요.");
  const items: unknown[] = [];
  let pageToken = "";
  for (let page = 0; page < 10; page += 1) {
    const endpoint = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    endpoint.searchParams.set("part", "snippet,contentDetails");
    endpoint.searchParams.set("playlistId", String(link.providerTrackId));
    endpoint.searchParams.set("maxResults", "50");
    endpoint.searchParams.set("key", apiKey);
    if (pageToken) endpoint.searchParams.set("pageToken", pageToken);
    const payload = await fetchOfficialJson(endpoint);
    if (!isRecord(payload) || !Array.isArray(payload.items)) break;
    items.push(...payload.items);
    const nextToken = text(payload.nextPageToken);
    if (!nextToken) break;
    pageToken = nextToken;
  }
  const tracks = items.filter(isRecord).map(youtubeTrack).filter((track): track is TrackReference => Boolean(track));
  return { status: "playlist", service: link.service, originalUrl: link.originalUrl, canonicalUrl: link.canonicalUrl, tracks, skippedCount: items.length - tracks.length };
}

function appleCatalogTrack(result: Record<string, unknown>): TrackReference | null {
  const id = text(result.id);
  const attributes = isRecord(result.attributes) ? result.attributes : null;
  const title = text(attributes?.name);
  const artist = text(attributes?.artistName);
  if (!id || !title || !artist) return null;
  return {
    id: makeProviderTrackId("itunes", id),
    provider: "itunes",
    providerTrackId: Number(id) || id,
    title,
    artist,
    album: text(attributes?.albumName),
    genre: text((Array.isArray(attributes?.genreNames) ? attributes?.genreNames[0] : "")),
    durationMs: typeof attributes?.durationInMillis === "number" ? attributes.durationInMillis : null,
    artworkUrl: httpsUrl(attributes?.artwork && isRecord(attributes.artwork) ? String(attributes.artwork.url ?? "").replace("{w}", "600").replace("{h}", "600") : null),
    previewUrl: httpsUrl(attributes?.previews && Array.isArray(attributes.previews) && isRecord(attributes.previews[0]) ? attributes.previews[0].url : null),
    externalUrl: httpsUrl(attributes?.url),
  };
}

async function applePlaylistMetadata(link: ParsedMusicLink): Promise<ReadyMusicPlaylistResponse> {
  const token = createAppleMusicDeveloperToken();
  if (!token) throw new Error("Apple Music 플레이리스트를 가져오려면 MusicKit 서버 설정이 필요해요.");
  const endpoint = new URL(`https://api.music.apple.com/v1/catalog/kr/playlists/${encodeURIComponent(String(link.providerTrackId))}`);
  endpoint.searchParams.set("include", "tracks");
  const payload = await fetchOfficialJsonWithHeaders(endpoint, { Authorization: `Bearer ${token}` });
  const playlist = isRecord(payload) && Array.isArray(payload.data) ? payload.data[0] : null;
  const relationship = isRecord(playlist) && isRecord(playlist.relationships) ? playlist.relationships : null;
  const tracksRelationship = relationship && isRecord(relationship.tracks) ? relationship.tracks : null;
  const tracksData: unknown[] = tracksRelationship && Array.isArray(tracksRelationship.data) ? [...tracksRelationship.data] : [];
  let nextUrl = text(tracksRelationship?.next);
  for (let page = 0; page < 10 && nextUrl; page += 1) {
    const nextPayload = await fetchOfficialJsonWithHeaders(new URL(nextUrl, endpoint), { Authorization: `Bearer ${token}` });
    if (!isRecord(nextPayload) || !Array.isArray(nextPayload.data)) break;
    tracksData.push(...nextPayload.data);
    nextUrl = text(nextPayload.next);
  }
  const tracks = tracksData.filter(isRecord).map(appleCatalogTrack).filter((track): track is TrackReference => Boolean(track));
  return { status: "playlist", service: link.service, originalUrl: link.originalUrl, canonicalUrl: link.canonicalUrl, tracks, skippedCount: tracksData.length - tracks.length };
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

    const result = payload.results.find(isRecord);
    if (!result) return manual(link, "metadata-unavailable");
    const suggested: SuggestedTrackMetadata = {
      ...blankSuggestion(),
      title: text(result.trackName),
      artist: text(result.artistName),
      album: text(result.collectionName),
      genre: text(result.primaryGenreName),
      durationMs: typeof result.trackTimeMillis === "number" && Number.isFinite(result.trackTimeMillis)
        ? result.trackTimeMillis
        : null,
      artworkUrl: httpsUrl(result.artworkUrl100),
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
    link = parseCaptureMusicShareUrl(requestedUrl);
  } catch (error) {
    const code = error instanceof MusicLinkError ? error.code : "invalid-url";
    const message =
      error instanceof MusicLinkError
        ? error.message
        : "음악 링크를 확인하지 못했습니다.";
    return json({ status: "error", error: { code, message } }, 400);
  }

  try {
    if (link.kind === "playlist") {
      return json(link.service === "apple-music"
        ? await applePlaylistMetadata(link)
        : await youtubePlaylistMetadata(link));
    }
    return json(link.service === "apple-music"
      ? await appleMusicMetadata(link)
      : await youtubeMetadata(link));
  } catch (error) {
    return json({
      status: "error",
      error: {
        code: "playlist-unavailable",
        message: error instanceof Error ? error.message : "플레이리스트 곡을 가져오지 못했어요.",
      },
    }, 502);
  }
}
