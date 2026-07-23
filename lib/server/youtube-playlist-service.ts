import { createHash } from "node:crypto";
import {
  YOUTUBE_MATCH_ALGORITHM_VERSION,
  classifyYoutubeMatch,
  directYoutubeMatch,
  normalizeYoutubeMatchText,
  rankYoutubeCandidates,
  type YoutubeMatchCandidate,
  type YoutubeTrackInput,
  type YoutubeTrackMatch,
} from "./youtube-track-matcher";
import { listYoutubeVideos, searchYoutubeVideoIds } from "./youtube-api";
import {
  readYoutubeMatchCache,
  writeYoutubeMatchCache,
} from "./youtube-match-cache-repository";

const VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const SEARCH_CONCURRENCY = 4;

function directVideoId(track: YoutubeTrackInput): string | null {
  if (track.provider !== "youtube") return null;
  const providerTrackId = String(track.providerTrackId);
  return VIDEO_ID_PATTERN.test(providerTrackId) ? providerTrackId : null;
}

export function youtubeTrackCacheKey(track: YoutubeTrackInput): string {
  const value = JSON.stringify({
    title: normalizeYoutubeMatchText(track.title),
    artist: normalizeYoutubeMatchText(track.artist),
    album: normalizeYoutubeMatchText(track.album),
    durationMs: track.durationMs === null ? null : Math.round(track.durationMs / 1_000) * 1_000,
    regionCode: "KR",
    algorithmVersion: YOUTUBE_MATCH_ALGORITHM_VERSION,
  });
  return createHash("sha256").update(value).digest("hex");
}

function searchQuery(track: YoutubeTrackInput): string {
  return [track.title, track.artist, track.album].map((value) => value.trim()).filter(Boolean).join(" ");
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  callback: (value: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      result[index] = await callback(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return result;
}

async function safelyReadCache(
  cacheKeys: string[],
): Promise<Map<string, YoutubeMatchCandidate[]>> {
  try {
    return await readYoutubeMatchCache(cacheKeys, YOUTUBE_MATCH_ALGORITHM_VERSION);
  } catch {
    return new Map();
  }
}

async function safelyWriteCache(
  values: Array<{ cacheKey: string; candidates: YoutubeMatchCandidate[] }>,
): Promise<void> {
  try {
    await writeYoutubeMatchCache(values, YOUTUBE_MATCH_ALGORITHM_VERSION);
  } catch {
    // Cache availability must not block matching.
  }
}

export async function matchYoutubeTracks(
  tracks: YoutubeTrackInput[],
  apiKey: string,
): Promise<YoutubeTrackMatch[]> {
  const keyedTracks = tracks.map((track) => ({ track, cacheKey: youtubeTrackCacheKey(track) }));
  const cached = await safelyReadCache(keyedTracks.map(({ cacheKey }) => cacheKey));
  const validationIds = keyedTracks.flatMap(({ track, cacheKey }) => [
    ...(directVideoId(track) ? [directVideoId(track) as string] : []),
    ...(cached.get(cacheKey)?.map((candidate) => candidate.id) ?? []),
  ]);
  const validatedVideos = await listYoutubeVideos(validationIds, apiKey);
  const matches = new Map<string, YoutubeTrackMatch>();
  const unresolvedByCacheKey = new Map<string, YoutubeTrackInput>();

  keyedTracks.forEach(({ track, cacheKey }) => {
    const directId = directVideoId(track);
    const directVideo = directId ? validatedVideos.get(directId) : null;
    if (directVideo) {
      matches.set(track.id, directYoutubeMatch(track, directVideo));
      return;
    }
    const cachedCandidates = cached.get(cacheKey);
    if (cachedCandidates) {
      const activeCandidates = cachedCandidates.filter((candidate) => validatedVideos.has(candidate.id));
      if (activeCandidates.length || cachedCandidates.length === 0) {
        matches.set(track.id, classifyYoutubeMatch(track.id, activeCandidates));
        return;
      }
    }
    if (!unresolvedByCacheKey.has(cacheKey)) unresolvedByCacheKey.set(cacheKey, track);
  });

  const unresolved = [...unresolvedByCacheKey.entries()];
  const searches = await mapWithConcurrency(
    unresolved,
    SEARCH_CONCURRENCY,
    async ([cacheKey, track]) => ({
      cacheKey,
      track,
      videoIds: await searchYoutubeVideoIds(searchQuery(track), apiKey),
    }),
  );
  const searchedVideos = await listYoutubeVideos(searches.flatMap((search) => search.videoIds), apiKey);
  const newCandidates = new Map<string, YoutubeMatchCandidate[]>();
  searches.forEach(({ cacheKey, track, videoIds }) => {
    const videos = videoIds.flatMap((videoId) => {
      const video = searchedVideos.get(videoId);
      return video ? [video] : [];
    });
    newCandidates.set(cacheKey, rankYoutubeCandidates(track, videos));
  });
  await safelyWriteCache([...newCandidates].map(([cacheKey, candidates]) => ({ cacheKey, candidates })));

  keyedTracks.forEach(({ track, cacheKey }) => {
    if (matches.has(track.id)) return;
    matches.set(track.id, classifyYoutubeMatch(track.id, newCandidates.get(cacheKey) ?? []));
  });
  return tracks.map((track) => matches.get(track.id)
    ?? { trackId: track.id, status: "missing", selectedId: null, candidates: [] });
}
