import type { YoutubeVideo } from "./youtube-track-matcher";

const YOUTUBE_API_BASE = "https://www.googleapis.com/youtube/v3";
const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

type YoutubeErrorPayload = {
  error?: {
    code?: unknown;
    message?: unknown;
    errors?: Array<{ reason?: unknown }>;
  };
};

export class YoutubeApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function youtubeError(payload: unknown, fallbackStatus: number): YoutubeApiError {
  const typed = isRecord(payload) ? payload as YoutubeErrorPayload : {};
  const rawReason = typed.error?.errors?.find((error) => typeof error.reason === "string")?.reason;
  const reason = typeof rawReason === "string" ? rawReason : "youtubeRequestFailed";
  const message = typeof typed.error?.message === "string"
    ? typed.error.message
    : "YouTube 요청을 처리하지 못했어요.";
  return new YoutubeApiError(message, fallbackStatus, reason);
}

async function readResponse(response: Response): Promise<unknown> {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw youtubeError(payload, response.status);
  return payload;
}

function parseDurationMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(value);
  if (!match) return null;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return Math.round((((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1_000);
}

function thumbnailUrl(snippet: Record<string, unknown>): string | null {
  const thumbnails = snippet.thumbnails;
  if (!isRecord(thumbnails)) return null;
  for (const key of ["maxres", "standard", "high", "medium", "default"]) {
    const thumbnail = thumbnails[key];
    if (isRecord(thumbnail) && typeof thumbnail.url === "string") return thumbnail.url;
  }
  return null;
}

function toYoutubeVideo(value: unknown): YoutubeVideo | null {
  if (!isRecord(value) || typeof value.id !== "string" || !VIDEO_ID_PATTERN.test(value.id)) return null;
  const snippet = value.snippet;
  const contentDetails = value.contentDetails;
  const status = value.status;
  if (!isRecord(snippet) || typeof snippet.title !== "string" || typeof snippet.channelTitle !== "string") return null;
  if (isRecord(status)) {
    if (status.uploadStatus !== "processed") return null;
    if (status.privacyStatus !== "public" && status.privacyStatus !== "unlisted") return null;
  }
  return {
    id: value.id,
    title: snippet.title,
    channelTitle: snippet.channelTitle,
    description: typeof snippet.description === "string" ? snippet.description : "",
    thumbnailUrl: thumbnailUrl(snippet),
    durationMs: isRecord(contentDetails) ? parseDurationMs(contentDetails.duration) : null,
    categoryId: typeof snippet.categoryId === "string" ? snippet.categoryId : null,
  };
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) result.push(values.slice(index, index + size));
  return result;
}

export async function listYoutubeVideos(
  videoIds: string[],
  apiKey: string,
): Promise<Map<string, YoutubeVideo>> {
  const uniqueIds = [...new Set(videoIds.filter((id) => VIDEO_ID_PATTERN.test(id)))];
  const videos = new Map<string, YoutubeVideo>();
  for (const batch of chunks(uniqueIds, 50)) {
    const endpoint = new URL(`${YOUTUBE_API_BASE}/videos`);
    endpoint.searchParams.set("part", "snippet,contentDetails,status");
    endpoint.searchParams.set("id", batch.join(","));
    endpoint.searchParams.set("key", apiKey);
    const response = await fetch(endpoint, { cache: "no-store" });
    const payload = await readResponse(response);
    if (!isRecord(payload) || !Array.isArray(payload.items)) continue;
    payload.items.forEach((item) => {
      const video = toYoutubeVideo(item);
      if (video) videos.set(video.id, video);
    });
  }
  return videos;
}

async function search(
  query: string,
  apiKey: string,
  musicTopicOnly: boolean,
): Promise<string[]> {
  const endpoint = new URL(`${YOUTUBE_API_BASE}/search`);
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("type", "video");
  endpoint.searchParams.set("maxResults", "10");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("regionCode", "KR");
  endpoint.searchParams.set("relevanceLanguage", "ko");
  endpoint.searchParams.set("videoCategoryId", "10");
  if (musicTopicOnly) endpoint.searchParams.set("topicId", "/m/04rlf");
  endpoint.searchParams.set("key", apiKey);
  const response = await fetch(endpoint, { cache: "no-store" });
  const payload = await readResponse(response);
  if (!isRecord(payload) || !Array.isArray(payload.items)) return [];
  return payload.items.flatMap((item) => {
    if (!isRecord(item) || !isRecord(item.id) || typeof item.id.videoId !== "string") return [];
    return VIDEO_ID_PATTERN.test(item.id.videoId) ? [item.id.videoId] : [];
  });
}

export async function searchYoutubeVideoIds(query: string, apiKey: string): Promise<string[]> {
  const musicResults = await search(query, apiKey, true);
  return musicResults.length ? musicResults : search(query, apiKey, false);
}

async function oauthRequest(
  path: string,
  accessToken: string,
  body: unknown,
): Promise<unknown> {
  const endpoint = new URL(`${YOUTUBE_API_BASE}/${path}`);
  endpoint.searchParams.set("part", path === "playlists" ? "snippet,status" : "snippet");
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return readResponse(response);
}

export async function createYoutubePlaylist(
  accessToken: string,
  title: string,
): Promise<string> {
  const payload = await oauthRequest("playlists", accessToken, {
    snippet: { title },
    status: { privacyStatus: "private" },
  });
  if (!isRecord(payload) || typeof payload.id !== "string") {
    throw new YoutubeApiError("YouTube 재생목록 ID를 확인하지 못했어요.", 502, "invalidPlaylistResponse");
  }
  return payload.id;
}

export async function insertYoutubePlaylistItem(
  accessToken: string,
  playlistId: string,
  videoId: string,
): Promise<void> {
  await oauthRequest("playlistItems", accessToken, {
    snippet: {
      playlistId,
      resourceId: { kind: "youtube#video", videoId },
    },
  });
}
