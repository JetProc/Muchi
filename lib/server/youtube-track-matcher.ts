export const YOUTUBE_MATCH_ALGORITHM_VERSION = "2026-07-23-v1";
export const YOUTUBE_AUTO_MATCH_SCORE = 80;
export const YOUTUBE_REVIEW_SCORE = 45;
export const YOUTUBE_AUTO_MATCH_GAP = 10;
export const YOUTUBE_CANDIDATE_LIMIT = 5;

export type YoutubeTrackInput = {
  id: string;
  provider: string;
  providerTrackId: number | string;
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
};

export type YoutubeVideo = {
  id: string;
  title: string;
  channelTitle: string;
  description: string;
  thumbnailUrl: string | null;
  durationMs: number | null;
  categoryId: string | null;
};

export type YoutubeMatchConfidence = "high" | "medium" | "low";

export type YoutubeMatchCandidate = {
  id: string;
  title: string;
  artist: string;
  album: string;
  thumbnailUrl: string | null;
  durationMs: number | null;
  score: number;
  confidence: YoutubeMatchConfidence;
  reasons: string[];
  url: string;
};

export type YoutubeTrackMatch = {
  trackId: string;
  status: "matched" | "review" | "missing";
  selectedId: string | null;
  candidates: YoutubeMatchCandidate[];
  errorCode?: string;
};

const PRESENTATION_LABELS = [
  "official audio",
  "official video",
  "official music video",
  "official mv",
] as const;

const VARIANT_PENALTIES = [
  { labels: ["karaoke", "instrumental"], penalty: 35, reason: "반주/노래방 버전" },
  { labels: ["sped up", "speed up", "nightcore"], penalty: 30, reason: "속도 변형 버전" },
  { labels: ["live", "concert", "공연", "라이브"], penalty: 25, reason: "라이브 버전" },
  { labels: ["cover", "커버"], penalty: 25, reason: "커버 버전" },
  { labels: ["shorts", "short"], penalty: 25, reason: "짧은 영상" },
  { labels: ["remix", "리믹스"], penalty: 20, reason: "리믹스 버전" },
  { labels: ["lyrics", "lyric", "가사"], penalty: 10, reason: "가사 영상" },
] as const;

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, number: string) => String.fromCodePoint(Number(number)))
    .replace(/&#x([a-f0-9]+);/gi, (_, number: string) => String.fromCodePoint(Number.parseInt(number, 16)))
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

export function normalizeYoutubeMatchText(value: string): string {
  return decodeHtml(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(value: string): string[] {
  return normalizeYoutubeMatchText(value).split(" ").filter(Boolean);
}

function containsNormalizedPhrase(value: string, phrase: string): boolean {
  const normalizedPhrase = normalizeYoutubeMatchText(phrase);
  return Boolean(normalizedPhrase) && ` ${value} `.includes(` ${normalizedPhrase} `);
}

function tokenCoverage(expected: string, actual: string): number {
  const expectedTokens = [...new Set(tokens(expected))];
  if (!expectedTokens.length) return 0;
  const actualTokens = new Set(tokens(actual));
  return expectedTokens.filter((token) => actualTokens.has(token)).length / expectedTokens.length;
}

function tokenJaccard(left: string, right: string): number {
  const leftTokens = new Set(tokens(left));
  const rightTokens = new Set(tokens(right));
  const union = new Set([...leftTokens, ...rightTokens]);
  if (!union.size) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  return intersection / union.size;
}

function stripPresentationLabels(value: string): string {
  let result = normalizeYoutubeMatchText(value);
  PRESENTATION_LABELS.forEach((label) => {
    const normalized = normalizeYoutubeMatchText(label);
    result = ` ${result} `.replace(` ${normalized} `, " ").trim();
  });
  return result.trim().replace(/\s+/g, " ");
}

function titleScore(track: YoutubeTrackInput, video: YoutubeVideo): number {
  const expected = normalizeYoutubeMatchText(track.title);
  const actual = stripPresentationLabels(video.title);
  if (!expected || !actual) return 0;
  if (expected === actual) return 40;
  if (containsNormalizedPhrase(actual, expected) || containsNormalizedPhrase(expected, actual)) return 36;
  const coverage = tokenCoverage(expected, actual);
  const jaccard = tokenJaccard(expected, actual);
  return Math.round(40 * ((coverage * 0.7) + (jaccard * 0.3)));
}

function artistScore(track: YoutubeTrackInput, video: YoutubeVideo): number {
  const expected = normalizeYoutubeMatchText(track.artist);
  if (!expected) return 0;
  const actual = normalizeYoutubeMatchText(`${video.title} ${video.channelTitle}`);
  if (containsNormalizedPhrase(actual, expected)) return 25;
  return Math.round(25 * tokenCoverage(expected, actual));
}

function durationScore(expectedMs: number | null, actualMs: number | null): number {
  if (expectedMs === null || actualMs === null) return 0;
  const differenceSeconds = Math.abs(expectedMs - actualMs) / 1_000;
  if (differenceSeconds <= 2) return 20;
  if (differenceSeconds <= 5) return 17;
  if (differenceSeconds <= 10) return 12;
  if (differenceSeconds <= 20) return 6;
  return 0;
}

function albumScore(track: YoutubeTrackInput, video: YoutubeVideo): number {
  const album = normalizeYoutubeMatchText(track.album);
  if (!album) return 0;
  const haystack = normalizeYoutubeMatchText(`${video.title} ${video.description}`);
  if (containsNormalizedPhrase(haystack, album)) return 5;
  return tokenCoverage(album, haystack) >= 0.75 ? 3 : 0;
}

function officialScore(video: YoutubeVideo): number {
  const channel = normalizeYoutubeMatchText(video.channelTitle);
  const title = normalizeYoutubeMatchText(video.title);
  if (
    channel.endsWith(" topic")
    || channel.includes("vevo")
    || PRESENTATION_LABELS.some((label) => containsNormalizedPhrase(title, label))
  ) return 10;
  return 0;
}

function variantPenalty(track: YoutubeTrackInput, video: YoutubeVideo): { score: number; reasons: string[] } {
  const expected = normalizeYoutubeMatchText(track.title);
  const candidate = normalizeYoutubeMatchText(`${video.title} ${video.channelTitle}`);
  let score = 0;
  const reasons: string[] = [];
  VARIANT_PENALTIES.forEach(({ labels, penalty, reason }) => {
    const unexpected = labels.some((label) => {
      const normalized = normalizeYoutubeMatchText(label);
      return containsNormalizedPhrase(candidate, normalized) && !containsNormalizedPhrase(expected, normalized);
    });
    if (unexpected) {
      score += penalty;
      reasons.push(`-${penalty} ${reason}`);
    }
  });
  return { score, reasons };
}

function confidence(score: number): YoutubeMatchConfidence {
  if (score >= YOUTUBE_AUTO_MATCH_SCORE) return "high";
  if (score >= YOUTUBE_REVIEW_SCORE) return "medium";
  return "low";
}

export function scoreYoutubeCandidate(
  track: YoutubeTrackInput,
  video: YoutubeVideo,
): YoutubeMatchCandidate {
  const title = titleScore(track, video);
  const artist = artistScore(track, video);
  const duration = durationScore(track.durationMs, video.durationMs);
  const album = albumScore(track, video);
  const official = officialScore(video);
  const penalty = variantPenalty(track, video);
  const score = Math.max(0, Math.min(100, title + artist + duration + album + official - penalty.score));
  const reasons = [
    title ? `제목 ${title}/40` : "제목 불일치",
    artist ? `아티스트 ${artist}/25` : "아티스트 불일치",
    duration ? `재생시간 ${duration}/20` : "재생시간 근거 없음",
    album ? `앨범 ${album}/5` : "앨범 근거 없음",
    official ? `공식 채널 단서 ${official}/10` : "공식 채널 단서 없음",
    ...penalty.reasons,
  ];
  return {
    id: video.id,
    title: decodeHtml(video.title),
    artist: decodeHtml(video.channelTitle),
    album: album ? track.album : "",
    thumbnailUrl: video.thumbnailUrl,
    durationMs: video.durationMs,
    score,
    confidence: confidence(score),
    reasons,
    url: `https://music.youtube.com/watch?v=${encodeURIComponent(video.id)}`,
  };
}

export function rankYoutubeCandidates(
  track: YoutubeTrackInput,
  videos: YoutubeVideo[],
): YoutubeMatchCandidate[] {
  return videos
    .map((video) => scoreYoutubeCandidate(track, video))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, YOUTUBE_CANDIDATE_LIMIT);
}

export function directYoutubeMatch(
  track: YoutubeTrackInput,
  video: YoutubeVideo,
): YoutubeTrackMatch {
  const candidate: YoutubeMatchCandidate = {
    ...scoreYoutubeCandidate(track, video),
    score: 100,
    confidence: "high",
    reasons: ["원본 YouTube 영상 ID 확인"],
  };
  return {
    trackId: track.id,
    status: "matched",
    selectedId: video.id,
    candidates: [candidate],
  };
}

export function classifyYoutubeMatch(
  trackId: string,
  candidates: YoutubeMatchCandidate[],
): YoutubeTrackMatch {
  const ranked = [...candidates]
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id))
    .slice(0, YOUTUBE_CANDIDATE_LIMIT);
  const best = ranked[0];
  if (!best || best.score < YOUTUBE_REVIEW_SCORE) {
    return { trackId, status: "missing", selectedId: null, candidates: [] };
  }
  const runnerUpScore = ranked[1]?.score ?? 0;
  const automatic = best.score >= YOUTUBE_AUTO_MATCH_SCORE
    && best.score - runnerUpScore >= YOUTUBE_AUTO_MATCH_GAP;
  return {
    trackId,
    status: automatic ? "matched" : "review",
    selectedId: automatic ? best.id : null,
    candidates: ranked,
  };
}
