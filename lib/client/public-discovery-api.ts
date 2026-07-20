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
