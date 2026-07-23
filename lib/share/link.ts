const DEFAULT_UTM_SOURCE = "instagram";
const DEFAULT_UTM_MEDIUM = "social";
const DEFAULT_UTM_CAMPAIGN = "chapter-share";

function normalizeOrigin(origin: string): string {
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

export function buildPublicChapterShareLink(input: {
  origin: string;
  authorId: string;
  chapterId: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
}): string {
  const url = new URL("/discover/chapter", normalizeOrigin(input.origin));
  url.searchParams.set("id", `public:${input.authorId}:${input.chapterId}`);
  url.searchParams.set("utm_source", input.utmSource ?? DEFAULT_UTM_SOURCE);
  url.searchParams.set("utm_medium", input.utmMedium ?? DEFAULT_UTM_MEDIUM);
  url.searchParams.set("utm_campaign", input.utmCampaign ?? DEFAULT_UTM_CAMPAIGN);
  return url.toString();
}

export function normalizeShareExportAssetUrl(rawUrl: string): string {
  if (rawUrl.startsWith("/") || rawUrl.startsWith("data:")) return rawUrl;
  const search = new URLSearchParams({ url: rawUrl });
  return `/api/share-image?${search.toString()}`;
}
