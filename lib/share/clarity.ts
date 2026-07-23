import type { ShareClarityEventName, ShareClarityPayload } from "@/lib/share/types";

declare global {
  interface Window {
    clarity?: (...args: unknown[]) => void;
  }
}

const ALLOWED_KEYS = [
  "chapterVisibility",
  "renderMode",
  "format",
  "layout",
  "mood",
  "decorationLevel",
  "trackImageMode",
  "selectedTrackCount",
  "chapterTrackCount",
  "exportedTrackCount",
  "hasPublicLink",
  "result",
  "failureKind",
] as const;

function sanitizeValue(value: unknown): string | number | boolean | undefined {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  return undefined;
}

export function sanitizeShareClarityPayload(payload: ShareClarityPayload): Record<string, string | number | boolean> {
  const sanitized: Record<string, string | number | boolean> = {};
  for (const key of ALLOWED_KEYS) {
    const value = sanitizeValue(payload[key]);
    if (value !== undefined) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export function trackShareClarityEvent(
  eventName: ShareClarityEventName,
  payload: ShareClarityPayload = {},
): boolean {
  if (typeof window === "undefined" || typeof window.clarity !== "function") return false;
  try {
    window.clarity("event", `share:${eventName}`, sanitizeShareClarityPayload(payload));
    return true;
  } catch {
    return false;
  }
}
