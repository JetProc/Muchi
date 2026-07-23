import { getSupabasePublicConfig } from "@/lib/supabase/env";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const STATIC_ALLOWED_HOSTS = new Set([
  "i.ytimg.com",
  "img.youtube.com",
  "lh3.googleusercontent.com",
]);

function error(code: string, message: string, status: number) {
  return Response.json({ code, message }, { status, headers: { "Cache-Control": "no-store" } });
}

function isAllowedImageUrl(url: URL): boolean {
  const normalized = url.hostname.toLowerCase();
  if (STATIC_ALLOWED_HOSTS.has(normalized)) return true;
  if (/^is\d+-ssl\.mzstatic\.com$/.test(normalized)) return true;
  const supabase = getSupabasePublicConfig();
  return Boolean(
    supabase
    && new URL(supabase.url).hostname.toLowerCase() === normalized
    && /^\/storage\/v1\/object\/public\/chapter-covers\/[0-9a-f-]{36}\/.+\.jpg$/i.test(url.pathname),
  );
}

function parseImageUrl(request: Request): URL | null {
  const value = new URL(request.url).searchParams.get("url");
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && isAllowedImageUrl(url) ? url : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const url = parseImageUrl(request);
  if (!url) return error("invalid_share_image", "지원하지 않는 이미지 주소입니다.", 400);

  try {
    const upstream = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
    });
    const contentType = upstream.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() ?? "";
    const announcedLength = Number(upstream.headers.get("content-length") ?? "0");
    if (!upstream.ok || !/^image\/(?:jpeg|png|webp)$/.test(contentType)) {
      return error("share_image_not_found", "공유 이미지를 불러오지 못했어요.", 404);
    }
    if (announcedLength > MAX_IMAGE_BYTES) {
      return error("share_image_too_large", "공유 이미지가 너무 큽니다.", 413);
    }
    const bytes = await upstream.arrayBuffer();
    if (bytes.byteLength > MAX_IMAGE_BYTES) {
      return error("share_image_too_large", "공유 이미지가 너무 큽니다.", 413);
    }
    return new Response(bytes, {
      headers: {
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "Content-Type": contentType,
        "Cross-Origin-Resource-Policy": "same-origin",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return error("share_image_unavailable", "공유 이미지를 불러오지 못했어요.", 503);
  }
}
