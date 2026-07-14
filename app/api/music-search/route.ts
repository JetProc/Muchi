const ITUNES_SEARCH_ENDPOINT = "https://itunes.apple.com/search";
const FETCH_TIMEOUT_MS = 7_000;
const MAX_UPSTREAM_RESPONSE_BYTES = 512_000;

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": status === 200
        ? "public, max-age=300, s-maxage=600, stale-while-revalidate=60"
        : "private, no-store",
      "Content-Type": "application/json; charset=utf-8",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isSearchResponse(value: unknown): value is { results: unknown[] } {
  return typeof value === "object"
    && value !== null
    && Array.isArray((value as { results?: unknown }).results);
}

export async function GET(request: Request): Promise<Response> {
  const term = new URL(request.url).searchParams.get("term")?.trim().replace(/\s+/g, " ") ?? "";
  if (term.length < 1) {
    return json({ error: "곡명이나 아티스트를 한 글자 이상 입력해 주세요." }, 400);
  }

  const endpoint = new URL(ITUNES_SEARCH_ENDPOINT);
  endpoint.searchParams.set("term", term);
  endpoint.searchParams.set("country", "KR");
  endpoint.searchParams.set("media", "music");
  endpoint.searchParams.set("entity", "song");
  endpoint.searchParams.set("limit", "10");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(endpoint, {
      cache: "no-store",
      headers: { Accept: "application/json" },
      redirect: "manual",
      signal: controller.signal,
    });
    if (!response.ok) {
      return json({ error: "iTunes 검색 서비스가 응답하지 않았습니다." }, 502);
    }

    const declaredLength = Number(response.headers.get("content-length"));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_UPSTREAM_RESPONSE_BYTES) {
      return json({ error: "iTunes 검색 응답이 너무 큽니다." }, 502);
    }
    const body = await response.text();
    if (body.length > MAX_UPSTREAM_RESPONSE_BYTES) {
      return json({ error: "iTunes 검색 응답이 너무 큽니다." }, 502);
    }
    const payload = JSON.parse(body) as unknown;
    return isSearchResponse(payload)
      ? json(payload)
      : json({ error: "iTunes 검색 응답 형식이 올바르지 않습니다." }, 502);
  } catch (error) {
    console.error("[api/music-search] upstream request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error),
    });
    return json(
      {
        error: error instanceof DOMException && error.name === "AbortError"
          ? "iTunes 검색 시간이 초과됐습니다."
          : "iTunes 검색 서비스에 연결하지 못했습니다.",
      },
      error instanceof DOMException && error.name === "AbortError" ? 504 : 502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
