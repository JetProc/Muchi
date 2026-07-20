import {
  makeProviderTrackId,
  type TrackId,
  type TrackProvider,
  type TrackReference,
} from "./archive";

export const SUPPORTED_MUSIC_LINK_SERVICES = [
  "apple-music",
  "spotify",
  "youtube",
  "melon",
] as const;

export type MusicLinkService = (typeof SUPPORTED_MUSIC_LINK_SERVICES)[number];
export type RequiredManualField = "title" | "artist";
export type ManualFallbackReason =
  | "metadata-incomplete"
  | "metadata-unavailable"
  | "provider-manual-only";

export interface ParsedMusicLink {
  service: MusicLinkService;
  provider: TrackProvider;
  providerTrackId: number | string;
  originalUrl: string;
  canonicalUrl: string;
}

export interface SuggestedTrackMetadata {
  title: string;
  artist: string;
  album: string;
  genre: string;
  durationMs: number | null;
  artworkUrl: string | null;
  previewUrl: string | null;
}

export interface ManualTrackFallback {
  id: TrackId;
  provider: TrackProvider;
  providerTrackId: number | string;
  externalUrl: string;
  suggested: SuggestedTrackMetadata;
  missingFields: RequiredManualField[];
  reason: ManualFallbackReason;
}

export interface ReadyMusicMetadataResponse {
  status: "ready";
  service: MusicLinkService;
  originalUrl: string;
  canonicalUrl: string;
  track: TrackReference;
}

export interface ManualMusicMetadataResponse {
  status: "manual";
  service: MusicLinkService;
  originalUrl: string;
  canonicalUrl: string;
  fallback: ManualTrackFallback;
}

export type MusicMetadataErrorCode =
  | "missing-url"
  | "invalid-url"
  | "unsupported-url";

export interface MusicMetadataErrorResponse {
  status: "error";
  error: {
    code: MusicMetadataErrorCode;
    message: string;
  };
}

export type MusicMetadataApiResponse =
  | ReadyMusicMetadataResponse
  | ManualMusicMetadataResponse
  | MusicMetadataErrorResponse;

export class MusicLinkError extends Error {
  constructor(
    public readonly code: Exclude<MusicMetadataErrorCode, "missing-url">,
    message: string,
  ) {
    super(message);
    this.name = "MusicLinkError";
  }
}

const MAX_URL_LENGTH = 2_048;
const SPOTIFY_ID = /^[A-Za-z0-9]{22}$/;
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const NUMERIC_ID = /^[1-9]\d{0,19}$/;

function numericItunesId(value: string | null): number | null {
  if (!value || !NUMERIC_ID.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseSpotify(url: URL, originalUrl: string): ParsedMusicLink | null {
  if (url.hostname !== "open.spotify.com") return null;
  const path = url.pathname.split("/").filter(Boolean);
  const parts = path[0]?.startsWith("intl-") ? path.slice(1) : path;
  if (parts.length !== 2 || parts[0] !== "track" || !SPOTIFY_ID.test(parts[1])) {
    return null;
  }

  const providerTrackId = parts[1];
  return {
    service: "spotify",
    provider: "spotify",
    providerTrackId,
    originalUrl,
    canonicalUrl: `https://open.spotify.com/track/${providerTrackId}`,
  };
}

function parseYoutube(url: URL, originalUrl: string): ParsedMusicLink | null {
  const youtubeHosts = new Set([
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "music.youtube.com",
  ]);
  let providerTrackId: string | null = null;

  if (url.hostname === "youtu.be") {
    const path = url.pathname.split("/").filter(Boolean);
    if (path.length === 1) providerTrackId = path[0];
  } else if (youtubeHosts.has(url.hostname)) {
    const path = url.pathname.split("/").filter(Boolean);
    if (url.pathname === "/watch" || url.pathname === "/watch/") {
      providerTrackId = url.searchParams.get("v");
    } else if (
      path.length === 2 &&
      (path[0] === "shorts" || path[0] === "embed")
    ) {
      providerTrackId = path[1];
    }
  } else {
    return null;
  }

  if (!providerTrackId || !YOUTUBE_ID.test(providerTrackId)) return null;
  return {
    service: "youtube",
    provider: "youtube",
    providerTrackId,
    originalUrl,
    canonicalUrl: `https://www.youtube.com/watch?v=${providerTrackId}`,
  };
}

function parseAppleMusic(url: URL, originalUrl: string): ParsedMusicLink | null {
  if (url.hostname !== "music.apple.com") return null;
  const path = url.pathname.split("/").filter(Boolean);
  const kindIndex = path.findIndex((segment) => segment === "album" || segment === "song");
  if (kindIndex < 1) return null;

  const providerTrackId =
    numericItunesId(url.searchParams.get("i")) ??
    (path[kindIndex] === "song" ? numericItunesId(path.at(-1) ?? null) : null);
  if (!providerTrackId) return null;

  const canonical = new URL(url.toString());
  canonical.hash = "";
  canonical.search = path[kindIndex] === "album" ? `?i=${providerTrackId}` : "";
  return {
    service: "apple-music",
    provider: "itunes",
    providerTrackId,
    originalUrl,
    canonicalUrl: canonical.toString(),
  };
}

function parseMelon(url: URL, originalUrl: string): ParsedMusicLink | null {
  const hosts = new Set(["melon.com", "www.melon.com", "m.melon.com", "m2.melon.com"]);
  const songPaths = new Set(["/song/detail.htm", "/song/lyrics.htm"]);
  if (!hosts.has(url.hostname) || !songPaths.has(url.pathname)) return null;
  const providerTrackId = url.searchParams.get("songId");
  if (!providerTrackId || !NUMERIC_ID.test(providerTrackId)) return null;

  return {
    service: "melon",
    provider: "melon",
    providerTrackId,
    originalUrl,
    canonicalUrl: `https://www.melon.com/song/detail.htm?songId=${providerTrackId}`,
  };
}

export function parseSupportedMusicUrl(input: string): ParsedMusicLink {
  const originalUrl = input.trim();
  if (
    !originalUrl ||
    originalUrl.length > MAX_URL_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(originalUrl)
  ) {
    throw new MusicLinkError("invalid-url", "올바른 음악 링크를 입력해 주세요.");
  }

  let url: URL;
  try {
    url = new URL(originalUrl);
  } catch {
    throw new MusicLinkError("invalid-url", "링크 형식이 올바르지 않습니다.");
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    throw new MusicLinkError("invalid-url", "HTTPS 음악 링크만 사용할 수 있습니다.");
  }

  const parsed =
    parseSpotify(url, originalUrl) ??
    parseYoutube(url, originalUrl) ??
    parseAppleMusic(url, originalUrl) ??
    parseMelon(url, originalUrl);
  if (!parsed) {
    throw new MusicLinkError(
      "unsupported-url",
      "Spotify 곡, YouTube 영상, Apple Music 곡, Melon 곡 링크만 지원합니다.",
    );
  }

  return parsed;
}

/**
 * Parses the share URL formats that can enter the capture flow. Keeping this
 * narrower than the legacy multi-provider parser prevents unsupported links
 * from leading users into a partially populated record form.
 */
export function parseCaptureMusicShareUrl(input: string): ParsedMusicLink {
  const originalUrl = input.trim();
  if (
    !originalUrl ||
    originalUrl.length > MAX_URL_LENGTH ||
    /[\u0000-\u001F\u007F]/.test(originalUrl)
  ) {
    throw new MusicLinkError(
      "invalid-url",
      "YouTube Music 또는 Apple Music에서 공유한 곡 링크를 확인해 주세요.",
    );
  }

  let url: URL;
  try {
    url = new URL(originalUrl);
  } catch {
    throw new MusicLinkError(
      "invalid-url",
      "YouTube Music 또는 Apple Music에서 공유한 곡 링크를 확인해 주세요.",
    );
  }

  if (
    url.protocol !== "https:" ||
    url.username !== "" ||
    url.password !== "" ||
    url.port !== ""
  ) {
    throw new MusicLinkError(
      "unsupported-url",
      "YouTube Music 또는 Apple Music 앱에서 공유한 곡 링크만 바로 기록할 수 있어요. 앱에서 공유 → 뮤키를 선택해 주세요.",
    );
  }

  const parsed = url.hostname === "music.youtube.com"
    ? parseYoutube(url, originalUrl)
    : url.hostname === "music.apple.com"
      ? parseAppleMusic(url, originalUrl)
      : null;
  if (!parsed) {
    throw new MusicLinkError(
      "unsupported-url",
      "YouTube Music 또는 Apple Music에서 곡을 다시 선택한 뒤 공유 → 뮤키를 눌러 주세요.",
    );
  }

  return parsed;
}

export function completeManualTrack(
  fallback: ManualTrackFallback,
  input: {
    title: string;
    artist: string;
    album?: string;
    genre?: string;
  },
): TrackReference {
  return {
    id: makeProviderTrackId(fallback.provider, fallback.providerTrackId),
    provider: fallback.provider,
    providerTrackId: fallback.providerTrackId,
    title: input.title,
    artist: input.artist,
    album: input.album ?? fallback.suggested.album,
    genre: input.genre ?? fallback.suggested.genre,
    durationMs: fallback.suggested.durationMs,
    artworkUrl: fallback.suggested.artworkUrl,
    previewUrl: fallback.suggested.previewUrl,
    externalUrl: fallback.externalUrl,
  };
}
