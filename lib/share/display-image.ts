import type { ResolvedShareTrack, ResolveShareTrackImageOptions, ShareDisplayImageView, ShareTrackInput } from "@/lib/share/types";
import { formatTrackArtist } from "@/lib/music-display";

function escapeSvgText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function base64Encode(value: string): string {
  if (typeof globalThis.btoa === "function") {
    return globalThis.btoa(value);
  }
  return Buffer.from(value, "utf8").toString("base64");
}

export function createMuchiFallbackImageDataUrl(label: string): string {
  const safe = escapeSvgText(label.trim() || "MUCHI");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 720" role="img" aria-label="${safe}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#f5e8d2"/>
      <stop offset="50%" stop-color="#d9c6a3"/>
      <stop offset="100%" stop-color="#9a8767"/>
    </linearGradient>
  </defs>
  <rect width="720" height="720" rx="54" fill="url(#bg)"/>
  <circle cx="154" cy="164" r="96" fill="#fff4df" opacity="0.54"/>
  <circle cx="584" cy="564" r="132" fill="#2a1a12" opacity="0.18"/>
  <text x="68" y="568" fill="#2a1a12" font-family="Georgia, serif" font-size="78" font-weight="700">MUCHI</text>
  <text x="68" y="632" fill="#463326" font-family="Arial, sans-serif" font-size="34">${safe}</text>
</svg>`;
  return `data:image/svg+xml;base64,${base64Encode(svg)}`;
}

export function resolveShareDisplayImage(
  track: ShareTrackInput,
  options: ResolveShareTrackImageOptions,
): ShareDisplayImageView {
  const customImageUrl = (
    options.renderMode === "private-image-only" || track.recordVisibility === "public"
  ) ? track.customImageUrl : null;

  const label = `${track.track.title} - ${formatTrackArtist(track.track)}`;
  if (customImageUrl) {
    return {
      url: customImageUrl,
      source: "custom",
      alt: `${label} custom image`,
    };
  }
  if (track.track.artworkUrl) {
    return {
      url: track.track.artworkUrl,
      source: "artwork",
      alt: `${label} artwork`,
    };
  }
  if (options.chapterCoverImageUrl) {
    return {
      url: options.chapterCoverImageUrl,
      source: "cover-fallback",
      alt: `${label} chapter cover fallback`,
    };
  }
  return {
    url: options.fallbackImageUrl ?? createMuchiFallbackImageDataUrl(track.track.artist || track.track.title),
    source: "muchi-fallback",
    alt: `${label} fallback`,
  };
}

export function resolveShareTrackDisplayImages(
  tracks: readonly ShareTrackInput[],
  options: ResolveShareTrackImageOptions,
): ResolvedShareTrack[] {
  return tracks.map((track) => ({
    ...track,
    tags: [...track.tags],
    displayImage: resolveShareDisplayImage(track, options),
  }));
}
