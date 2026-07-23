import { SHARE_LAYOUT_CAPS } from "@/lib/share/types";
import type { ShareSelectionCandidate, ShareSelectionOptions } from "@/lib/share/types";

function parseDate(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizePinnedTrackIds(ids: readonly string[] | undefined, validIds: Set<string>): string[] {
  if (!ids?.length) return [];
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const id of ids) {
    if (seen.has(id) || !validIds.has(id)) continue;
    seen.add(id);
    ordered.push(id);
  }
  return ordered;
}

function hasPublicMemory(candidate: ShareSelectionCandidate): boolean {
  if (candidate.recordVisibility !== "public") return false;
  return Boolean(candidate.note?.trim()) || candidate.tags.length > 0 || candidate.affection !== null;
}

function hasAvailablePhoto(candidate: ShareSelectionCandidate): boolean {
  return candidate.displayImageSource === "custom" || Boolean(candidate.customImageUrl);
}

function hasArtwork(candidate: ShareSelectionCandidate): boolean {
  return Boolean(candidate.track.artworkUrl);
}

function compareCandidates(
  left: ShareSelectionCandidate,
  right: ShareSelectionCandidate,
  pinnedOrder: Map<string, number>,
): number {
  const leftPinned = pinnedOrder.has(left.id);
  const rightPinned = pinnedOrder.has(right.id);
  if (leftPinned || rightPinned) {
    if (leftPinned && rightPinned) {
      return (pinnedOrder.get(left.id) ?? 0) - (pinnedOrder.get(right.id) ?? 0);
    }
    return leftPinned ? -1 : 1;
  }

  const leftPhoto = hasAvailablePhoto(left);
  const rightPhoto = hasAvailablePhoto(right);
  if (leftPhoto !== rightPhoto) return leftPhoto ? -1 : 1;

  const leftMemory = hasPublicMemory(left);
  const rightMemory = hasPublicMemory(right);
  if (leftMemory !== rightMemory) return leftMemory ? -1 : 1;

  const updatedDiff = parseDate(right.updatedAt) - parseDate(left.updatedAt);
  if (updatedDiff !== 0) return updatedDiff;

  const leftArtwork = hasArtwork(left);
  const rightArtwork = hasArtwork(right);
  if (leftArtwork !== rightArtwork) return leftArtwork ? -1 : 1;

  const sortDiff = left.sortOrder - right.sortOrder;
  if (sortDiff !== 0) return sortDiff;

  return left.id.localeCompare(right.id);
}

export function autoSelectShareTrackIds(
  candidates: readonly ShareSelectionCandidate[],
  options: ShareSelectionOptions,
): string[] {
  const cap = SHARE_LAYOUT_CAPS[options.format][options.layout];
  if (!candidates.length || cap <= 0) return [];
  const validIds = new Set(candidates.map((candidate) => candidate.id));
  const pinnedTrackIds = normalizePinnedTrackIds(options.pinnedTrackIds, validIds);
  const pinnedOrder = new Map(pinnedTrackIds.map((id, index) => [id, index]));
  return [...candidates]
    .sort((left, right) => compareCandidates(left, right, pinnedOrder))
    .slice(0, cap)
    .map((candidate) => candidate.id);
}
