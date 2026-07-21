import {
  createEmptyPublicDiscoveryCatalog,
  type PublicDiscoveryCatalog,
} from "@/lib/public-discovery";

export class PublicDiscoveryApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export async function fetchPublicDiscoveryCatalog(): Promise<PublicDiscoveryCatalog> {
  let response: Response;
  try {
    response = await fetch("/api/public-discovery", { cache: "no-store" });
  } catch {
    throw new PublicDiscoveryApiError("unavailable", "공개 챕터를 불러오지 못했어요.");
  }
  const body = await response.json().catch(() => null) as PublicDiscoveryCatalog | { code?: string; message?: string } | null;
  if (!response.ok) {
    const error = body as { code?: string; message?: string } | null;
    throw new PublicDiscoveryApiError(error?.code ?? "unavailable", error?.message ?? "공개 챕터를 불러오지 못했어요.");
  }
  if (!body || typeof body !== "object" || !("profiles" in body) || !("chapters" in body) || !("activities" in body)) {
    return createEmptyPublicDiscoveryCatalog();
  }
  return body as PublicDiscoveryCatalog;
}

export async function saveChapterLike(authorId: string, chapterId: string, liked: boolean): Promise<void> {
  const response = await fetch("/api/public-discovery", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "like", authorId, chapterId, liked }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new PublicDiscoveryApiError("unavailable", body?.message ?? "좋아요를 저장하지 못했어요.");
  }
}

export async function saveProfileFollow(profileId: string, followed: boolean): Promise<void> {
  const response = await fetch("/api/public-discovery", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "follow", profileId, followed }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { message?: string } | null;
    throw new PublicDiscoveryApiError("unavailable", body?.message ?? "팔로우를 저장하지 못했어요.");
  }
}
