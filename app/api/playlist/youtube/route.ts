import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";
import {
  YoutubeApiError,
  createYoutubePlaylist,
  insertYoutubePlaylistItem,
} from "@/lib/server/youtube-api";
import { matchYoutubeTracks } from "@/lib/server/youtube-playlist-service";
import type { YoutubeTrackInput } from "@/lib/server/youtube-track-matcher";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const MAX_TRACKS = 50;
const NO_STORE_HEADERS = { "Cache-Control": "private, no-store" };
const TRACK_PROVIDERS = new Set(["itunes", "spotify", "youtube", "melon"]);

class YoutubeRequestError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(
  value: unknown,
  name: string,
  maxLength: number,
  required = true,
): string {
  if (typeof value !== "string") throw new YoutubeRequestError(`${name}이(가) 올바르지 않습니다.`);
  const cleaned = value.trim().replace(/\s+/g, " ");
  if ((required && !cleaned) || Array.from(cleaned).length > maxLength) {
    throw new YoutubeRequestError(`${name}이(가) 올바르지 않습니다.`);
  }
  return cleaned;
}

function parseTrack(value: unknown): YoutubeTrackInput {
  if (!isRecord(value)) throw new YoutubeRequestError("곡 정보가 올바르지 않습니다.");
  const id = text(value.id, "곡 ID", 200);
  const provider = text(value.provider, "음악 제공자", 20);
  if (!TRACK_PROVIDERS.has(provider)) throw new YoutubeRequestError("지원하지 않는 음악 제공자입니다.");
  const providerTrackId = value.providerTrackId;
  if (
    (typeof providerTrackId !== "string" && typeof providerTrackId !== "number")
    || (typeof providerTrackId === "string" && Array.from(providerTrackId).length > 200)
    || (typeof providerTrackId === "number" && !Number.isSafeInteger(providerTrackId))
  ) throw new YoutubeRequestError("음원 ID가 올바르지 않습니다.");
  if (provider === "youtube" && (typeof providerTrackId !== "string" || !VIDEO_ID_PATTERN.test(providerTrackId))) {
    throw new YoutubeRequestError("YouTube 영상 ID가 올바르지 않습니다.");
  }
  const durationMs = value.durationMs;
  if (
    durationMs !== null
    && (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs < 0 || durationMs > 24 * 60 * 60 * 1_000)
  ) throw new YoutubeRequestError("재생 시간이 올바르지 않습니다.");
  return {
    id,
    provider,
    providerTrackId,
    title: text(value.title, "곡명", 200),
    artist: text(value.artist, "아티스트", 200),
    album: text(value.album, "앨범", 200, false),
    durationMs: durationMs === null ? null : Math.round(durationMs),
  };
}

function parseTracks(value: unknown): YoutubeTrackInput[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_TRACKS) {
    throw new YoutubeRequestError(`곡은 1곡 이상 ${MAX_TRACKS}곡 이하로 선택해 주세요.`);
  }
  const tracks = value.map(parseTrack);
  if (new Set(tracks.map((track) => track.id)).size !== tracks.length) {
    throw new YoutubeRequestError("중복된 곡 ID가 있습니다.");
  }
  return tracks;
}

function parseSelections(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_TRACKS) {
    throw new YoutubeRequestError(`내보낼 곡은 1곡 이상 ${MAX_TRACKS}곡 이하로 선택해 주세요.`);
  }
  return value.map((videoId) => {
    if (typeof videoId !== "string" || !VIDEO_ID_PATTERN.test(videoId)) {
      throw new YoutubeRequestError("YouTube 영상 ID가 올바르지 않습니다.");
    }
    return videoId;
  });
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? "");
  if (!match || match[1].length > 4_096) {
    throw new YoutubeRequestError("Google YouTube 권한을 다시 연결해 주세요.");
  }
  return match[1];
}

function errorResponse(
  code: string,
  message: string,
  status: number,
  errorCode?: string,
) {
  return Response.json(
    { code, message, ...(errorCode ? { errorCode } : {}) },
    { status, headers: NO_STORE_HEADERS },
  );
}

function youtubeErrorResponse(cause: YoutubeApiError) {
  const authReasons = new Set([
    "authError",
    "forbidden",
    "insufficientPermissions",
    "unauthorized",
    "youtubeSignupRequired",
  ]);
  const status = authReasons.has(cause.reason) ? 403 : cause.status >= 400 && cause.status < 500 ? cause.status : 502;
  const messages: Record<string, string> = {
    quotaExceeded: "YouTube API 사용 한도를 초과했어요. 잠시 후 다시 시도해 주세요.",
    dailyLimitExceeded: "YouTube API 일일 사용 한도를 초과했어요.",
    accessNotConfigured: "YouTube Data API가 활성화되지 않았어요.",
    insufficientPermissions: "Google 계정의 YouTube 권한이 필요해요.",
    youtubeSignupRequired: "먼저 Google 계정에서 YouTube 채널을 활성화해 주세요.",
  };
  return errorResponse(
    "youtube-error",
    messages[cause.reason] ?? "YouTube 요청을 처리하지 못했어요.",
    status,
    cause.reason,
  );
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const payload: unknown = await request.json().catch(() => {
      throw new YoutubeRequestError("요청 본문이 올바르지 않습니다.");
    });
    if (!isRecord(payload)) throw new YoutubeRequestError("요청 본문이 올바르지 않습니다.");

    if (payload.action === "match") {
      const apiKey = process.env.YOUTUBE_API_KEY?.trim();
      if (!apiKey) return errorResponse("not-configured", "YouTube Data API 설정이 없습니다.", 503, "accessNotConfigured");
      const matches = await matchYoutubeTracks(parseTracks(payload.tracks), apiKey);
      return Response.json({ matches }, { headers: NO_STORE_HEADERS });
    }

    if (payload.action === "export") {
      const accessToken = bearerToken(request);
      const playlistName = text(payload.playlistName, "플레이리스트 이름", 80);
      const selections = parseSelections(payload.selections);
      const playlistId = await createYoutubePlaylist(accessToken, playlistName);
      const failures: Array<{ index: number; videoId: string; errorCode: string }> = [];
      let addedCount = 0;
      for (const [index, videoId] of selections.entries()) {
        try {
          await insertYoutubePlaylistItem(accessToken, playlistId, videoId);
          addedCount += 1;
        } catch (cause) {
          failures.push({
            index,
            videoId,
            errorCode: cause instanceof YoutubeApiError ? cause.reason : "youtubeRequestFailed",
          });
        }
      }
      return Response.json({
        playlistId,
        url: `https://music.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`,
        addedCount,
        failedCount: failures.length,
        failures,
      }, { headers: NO_STORE_HEADERS });
    }

    throw new YoutubeRequestError("지원하지 않는 요청입니다.");
  } catch (cause) {
    if (cause instanceof ApiAuthError) return errorResponse("unauthenticated", cause.message, 401, "unauthorized");
    if (cause instanceof YoutubeRequestError) return errorResponse("invalid-input", cause.message, 400);
    if (cause instanceof YoutubeApiError) return youtubeErrorResponse(cause);
    return errorResponse("unavailable", "YouTube Music 내보내기를 처리하지 못했어요.", 503);
  }
}
