import type { TrackReference } from "./archive";

const YOUTUBE_TOPIC_SUFFIX = /\s+-\s+topic\s*$/i;

/** Keeps provider metadata intact while omitting YouTube's generated channel suffix in the UI. */
export function formatTrackArtist(
  track: Pick<TrackReference, "provider" | "artist">,
): string {
  if (track.provider !== "youtube") return track.artist;
  const displayName = track.artist.replace(YOUTUBE_TOPIC_SUFFIX, "").trim();
  return displayName || track.artist;
}
