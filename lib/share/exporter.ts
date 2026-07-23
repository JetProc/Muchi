import { createMuchiFallbackImageDataUrl } from "@/lib/share/display-image";
import { renderShareCardSvg } from "@/lib/share/svg";
import { SHARE_EXPORT_DIMENSIONS } from "@/lib/share/types";
import type { ShareCardExportRequest, ShareCardExportResult, ShareCardModel } from "@/lib/share/types";

const DEFAULT_ASSET_TIMEOUT_MS = 4_000;
const inFlightExports = new Map<string, Promise<ShareCardExportResult>>();

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
  return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
}

function createExportCacheKey(request: ShareCardExportRequest): string {
  return request.cacheKey ?? stableStringify({
    assetTimeoutMs: request.assetTimeoutMs ?? DEFAULT_ASSET_TIMEOUT_MS,
    model: request.model,
  });
}

async function fetchAssetAsDataUrl(url: string, timeoutMs: number): Promise<string> {
  if (url.startsWith("data:")) return url;
  const controller = new AbortController();
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { credentials: "same-origin", signal: controller.signal });
    if (!response.ok) {
      throw new Error(`asset-fetch:${response.status}`);
    }
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("reader-failure"));
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("reader-non-string"));
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("asset-timeout");
    }
    throw error;
  } finally {
    globalThis.clearTimeout(timer);
  }
}

async function normalizeAssetUrl(
  rawUrl: string,
  request: ShareCardExportRequest,
  context: { kind: "chapter-cover" | "track-image"; trackId?: string },
): Promise<string> {
  const url = request.normalizeAssetUrl ? request.normalizeAssetUrl(rawUrl, context) : rawUrl;
  const fallback = createMuchiFallbackImageDataUrl(context.trackId ?? request.model.chapterName);
  try {
    return await fetchAssetAsDataUrl(url, request.assetTimeoutMs ?? DEFAULT_ASSET_TIMEOUT_MS);
  } catch {
    return fallback;
  }
}

async function inlineShareCardAssets(request: ShareCardExportRequest): Promise<ShareCardModel> {
  const assetCache = new Map<string, Promise<string>>();
  const getInline = (url: string, context: { kind: "chapter-cover" | "track-image"; trackId?: string }) => {
    const key = `${context.kind}:${context.trackId ?? "chapter"}:${url}`;
    const cached = assetCache.get(key);
    if (cached) return cached;
    const next = normalizeAssetUrl(url, request, context);
    assetCache.set(key, next);
    return next;
  };

  const chapterCoverImageUrl = request.model.chapterCoverImageUrl
    ? await getInline(request.model.chapterCoverImageUrl, { kind: "chapter-cover" })
    : null;

  const tracks = await Promise.all(request.model.tracks.map(async (track) => ({
    ...track,
    tags: [...track.tags],
    displayImage: {
      ...track.displayImage,
      url: await getInline(track.displayImage.url, { kind: "track-image", trackId: track.id }),
    },
  })));

  return {
    ...request.model,
    tracks,
    chapterCoverImageUrl,
  };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = async () => {
      try {
        if (typeof image.decode === "function") {
          await image.decode();
        }
        resolve(image);
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => reject(new Error("image-load-failure"));
    image.src = url;
  });
}

async function waitForFonts(timeoutMs: number): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document) || !document.fonts?.ready) return;
  await Promise.race([
    document.fonts.ready.then(() => undefined).catch(() => undefined),
    new Promise<void>((resolve) => {
      globalThis.setTimeout(resolve, Math.min(timeoutMs, 2_000));
    }),
  ]);
}

async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = await loadImage(objectUrl);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("canvas-context-unavailable");
    }
    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((pngBlob) => {
        if (pngBlob) {
          resolve(pngBlob);
          return;
        }
        reject(new Error("png-blob-failure"));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function exportShareCardPngInternal(request: ShareCardExportRequest): Promise<ShareCardExportResult> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    throw new Error("share-export-browser-only");
  }
  const inlinedModel = await inlineShareCardAssets(request);
  await waitForFonts(request.assetTimeoutMs ?? DEFAULT_ASSET_TIMEOUT_MS);
  const svg = renderShareCardSvg(inlinedModel);
  const dimensions = SHARE_EXPORT_DIMENSIONS[inlinedModel.style.format];
  const blob = await svgToPngBlob(svg, dimensions.width, dimensions.height);
  return {
    blob,
    width: dimensions.width,
    height: dimensions.height,
    svg,
  };
}

export function exportShareCardPng(request: ShareCardExportRequest): Promise<ShareCardExportResult> {
  const cacheKey = createExportCacheKey(request);
  const existing = inFlightExports.get(cacheKey);
  if (existing) return existing;
  const next = exportShareCardPngInternal(request).finally(() => {
    inFlightExports.delete(cacheKey);
  });
  inFlightExports.set(cacheKey, next);
  return next;
}
