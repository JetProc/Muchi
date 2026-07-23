import { SHARE_EXPORT_DIMENSIONS } from "@/lib/share/types";
import type {
  ResolvedShareTrack,
  ShareCardModel,
  ShareCardRenderContent,
  ShareDecorationLevel,
  ShareDisplayImageView,
  ShareMood,
} from "@/lib/share/types";

type ThemePalette = {
  background: string;
  surface: string;
  surfaceSoft: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  accentSoft: string;
  stroke: string;
  fontTitle: string;
  fontBody: string;
};

const THEME_BY_MOOD: Record<ShareMood, ThemePalette> = {
  paper: {
    background: "#f4ead9",
    surface: "#fff8ef",
    surfaceSoft: "#ecdec7",
    textPrimary: "#2f2218",
    textSecondary: "#695746",
    accent: "#b36a38",
    accentSoft: "#f2d1b4",
    stroke: "#dac5a9",
    fontTitle: "Georgia, 'Times New Roman', serif",
    fontBody: "'Avenir Next', Helvetica, Arial, sans-serif",
  },
  night: {
    background: "#101522",
    surface: "#171f31",
    surfaceSoft: "#222d44",
    textPrimary: "#f3f6ff",
    textSecondary: "#b4c0d8",
    accent: "#7ac7ff",
    accentSoft: "#20374e",
    stroke: "#2e3b58",
    fontTitle: "'Avenir Next', Helvetica, Arial, sans-serif",
    fontBody: "'Avenir Next', Helvetica, Arial, sans-serif",
  },
  film: {
    background: "#17130f",
    surface: "#282018",
    surfaceSoft: "#443629",
    textPrimary: "#fff3d5",
    textSecondary: "#d3c0a0",
    accent: "#e7a64a",
    accentSoft: "#815c30",
    stroke: "#6f573b",
    fontTitle: "'Courier New', Courier, monospace",
    fontBody: "'Avenir Next', Helvetica, Arial, sans-serif",
  },
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function clipText(value: string, maxLength: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function wrapText(value: string, maxLength: number, maxLines: number): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const lines: string[] = [];
  for (let start = 0; start < trimmed.length && lines.length < maxLines; start += maxLength) {
    const remaining = trimmed.slice(start);
    lines.push(lines.length === maxLines - 1 ? clipText(remaining, maxLength) : remaining.slice(0, maxLength));
  }
  return lines;
}

function renderDecorations(
  mood: ShareMood,
  level: ShareDecorationLevel,
  width: number,
  height: number,
  palette: ThemePalette,
): string {
  if (level === "none") return "";
  if (mood === "night") {
    const base = [
      `<circle cx="${width - 160}" cy="190" r="120" fill="${palette.accent}" opacity="0.12"/>`,
      `<circle cx="170" cy="${height - 250}" r="180" fill="${palette.surfaceSoft}" opacity="0.34"/>`,
    ];
    if (level === "rich") {
      base.push(
        `<circle cx="${width - 260}" cy="${height - 260}" r="164" fill="${palette.accent}" opacity="0.08"/>`,
        `<path d="M120 ${height - 360}c120-84 252-126 396-126" stroke="${palette.stroke}" stroke-width="4" stroke-linecap="round" opacity="0.7"/>`,
      );
    }
    return base.join("");
  }
  if (mood === "film") {
    const base = [
      `<rect x="38" y="38" width="${width - 76}" height="${height - 76}" rx="20" fill="none" stroke="${palette.stroke}" stroke-width="12"/>`,
      `<path d="M64 72h${width - 128}M64 ${height - 72}h${width - 128}" stroke="${palette.accentSoft}" stroke-width="16" stroke-dasharray="30 24" opacity="0.78"/>`,
    ];
    if (level === "rich") {
      base.push(
        `<rect x="84" y="84" width="${width - 168}" height="${height - 168}" rx="34" fill="none" stroke="${palette.accentSoft}" stroke-width="10" opacity="0.6"/>`,
        `<circle cx="${width - 144}" cy="150" r="42" fill="${palette.accentSoft}" opacity="0.28"/>`,
      );
    }
    return base.join("");
  }
  const base = [
    `<circle cx="164" cy="182" r="132" fill="${palette.accentSoft}" opacity="0.38"/>`,
    `<circle cx="${width - 120}" cy="${height - 210}" r="180" fill="${palette.surfaceSoft}" opacity="0.42"/>`,
  ];
  if (level === "rich") {
    base.push(
      `<circle cx="${width - 220}" cy="182" r="94" fill="${palette.accent}" opacity="0.12"/>`,
      `<path d="M92 ${height - 300}c110 58 232 84 366 84" stroke="${palette.stroke}" stroke-width="4" stroke-linecap="round" opacity="0.8"/>`,
    );
  }
  return base.join("");
}

function renderHeader(
  model: ShareCardModel,
  content: ShareCardRenderContent,
  palette: ThemePalette,
  width: number,
): string {
  const authorLine = content.showAuthor && model.authorName ? clipText(model.authorName, 24) : "";
  const descriptionLines = wrapText(model.style.description, 34, 2);
  const parts = [
    `<text x="84" y="110" fill="${palette.accent}" font-family="${palette.fontBody}" font-size="28" font-weight="700" letter-spacing="4">MUCHI CHAPTER</text>`,
    `<text x="84" y="178" fill="${palette.textPrimary}" font-family="${palette.fontTitle}" font-size="74" font-weight="700">${escapeXml(clipText(model.chapterName, 26))}</text>`,
  ];
  if (authorLine) {
    parts.push(
      `<text x="84" y="224" fill="${palette.textSecondary}" font-family="${palette.fontBody}" font-size="26">${escapeXml(authorLine)}</text>`,
    );
  }
  descriptionLines.forEach((line, index) => {
    parts.push(
      `<text x="84" y="${268 + index * 34}" fill="${palette.textSecondary}" font-family="${palette.fontBody}" font-size="26">${escapeXml(line)}</text>`,
    );
  });
  if (content.showTrackCount) {
    parts.push(
      `<text x="${width - 84}" y="110" text-anchor="end" fill="${palette.textSecondary}" font-family="${palette.fontBody}" font-size="24">${model.tracks.length} TRACKS</text>`,
    );
  }
  return parts.join("");
}

function renderImage(image: ShareDisplayImageView, x: number, y: number, width: number, height: number, radius: number): string {
  const clipId = `clip-${x}-${y}-${width}-${height}`;
  return [
    `<defs><clipPath id="${clipId}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}"/></clipPath></defs>`,
    `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#d5c3ab"/>`,
    `<image href="${escapeXml(image.url)}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`,
  ].join("");
}

function renderTagRow(tags: readonly string[], x: number, y: number, palette: ThemePalette): string {
  const text = clipText(tags.join(" • "), 46);
  return `<text x="${x}" y="${y}" fill="${palette.accent}" font-family="${palette.fontBody}" font-size="22">${escapeXml(text)}</text>`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function renderTrackRow(
  track: ResolvedShareTrack,
  index: number,
  content: ShareCardRenderContent,
  palette: ThemePalette,
  options: {
    x: number;
    y: number;
    width: number;
    rowHeight: number;
    showImage: boolean;
    showTags?: boolean;
    compact?: boolean;
  },
): string {
  const compact = options.compact ?? false;
  const allowTags = (options.showTags ?? true) && !compact && options.rowHeight >= 102;
  const imageSize = options.showImage ? clamp(options.rowHeight - (compact ? 10 : 18), 0, compact ? 56 : 112) : 0;
  const gap = compact ? 18 : 28;
  const copyX = options.x + (options.showImage ? imageSize + gap : 0);
  const indexFontSize = compact ? clamp(options.rowHeight * 0.22, 14, 18) : clamp(options.rowHeight * 0.24, 16, 20);
  const titleFontSize = compact ? clamp(options.rowHeight * 0.27, 17, 24) : clamp(options.rowHeight * 0.31, 20, 28);
  const artistFontSize = compact ? clamp(options.rowHeight * 0.21, 13, 18) : clamp(options.rowHeight * 0.24, 16, 22);
  const titleY = options.y + (compact ? clamp(options.rowHeight * 0.36, 24, 30) : clamp(options.rowHeight * 0.34, 28, 34));
  const artistY = options.y + (compact ? clamp(options.rowHeight * 0.66, 46, 56) : clamp(options.rowHeight * 0.64, 52, 64));
  const titleLength = compact ? 26 : 30;
  const artistLength = compact ? 28 : 36;
  const indexLabel = `${index + 1}`.padStart(2, "0");
  const pieces = [
    `<text x="${options.x}" y="${titleY}" fill="${palette.textSecondary}" font-family="${palette.fontBody}" font-size="${indexFontSize}">${indexLabel}</text>`,
    `<text x="${copyX + gap}" y="${titleY}" fill="${palette.textPrimary}" font-family="${palette.fontBody}" font-size="${titleFontSize}" font-weight="700">${escapeXml(clipText(track.track.title, titleLength))}</text>`,
    `<text x="${copyX + gap}" y="${artistY}" fill="${palette.textSecondary}" font-family="${palette.fontBody}" font-size="${artistFontSize}">${escapeXml(clipText(track.track.artist, artistLength))}</text>`,
  ];
  if (options.showImage) {
    pieces.unshift(renderImage(track.displayImage, options.x + 34, options.y + Math.max(0, (options.rowHeight - imageSize) / 2), imageSize, imageSize, compact ? 14 : 18));
  }
  if (allowTags && content.showTags && track.recordVisibility === "public" && track.tags.length) {
    pieces.push(renderTagRow(track.tags, copyX + gap, options.y + clamp(options.rowHeight * 0.92, 78, 94), palette));
  }
  return pieces.join("");
}

function shouldShowTrackImage(mode: ShareCardModel["style"]["trackImageMode"], index: number): boolean {
  if (mode === "none" || mode === "cover-only") return false;
  if (mode === "featured") return index === 0;
  return true;
}

function resolveHeroImage(model: ShareCardModel): ShareDisplayImageView | null {
  if (model.chapterCoverImageUrl) {
    return {
      url: model.chapterCoverImageUrl,
      source: "cover-fallback",
      alt: `${model.chapterName} cover`,
    };
  }
  return model.tracks[0]?.displayImage ?? null;
}

function renderCoverLayout(model: ShareCardModel, content: ShareCardRenderContent, palette: ThemePalette, width: number, height: number): string {
  const hero = resolveHeroImage(model);
  const rows = model.tracks;
  const cardY = 330;
  const cardHeight = height - 620;
  const innerX = 96;
  const innerWidth = width - 192;
  const innerTop = 362;
  const innerBottom = cardY + cardHeight - 32;
  const rowGap = 14;
  const listHeight = clamp(rows.length * 92 + Math.max(0, rows.length - 1) * rowGap, 280, Math.floor(cardHeight * 0.48));
  const availableHeroHeight = innerBottom - innerTop - listHeight - 36;
  const heroHeight = clamp(availableHeroHeight, height === 1920 ? 460 : 260, height === 1920 ? 760 : 420);
  const rowHeight = clamp(
    Math.floor((listHeight - Math.max(0, rows.length - 1) * rowGap) / Math.max(1, rows.length)),
    64,
    90,
  );
  const listStartY = innerTop + heroHeight + 36;
  const parts = [
    `<rect x="64" y="${cardY}" width="${width - 128}" height="${cardHeight}" rx="44" fill="${palette.surface}" stroke="${palette.stroke}" stroke-width="2"/>`,
  ];
  if (hero) {
    parts.push(renderImage(hero, innerX, innerTop, innerWidth, heroHeight, 38));
  }
  rows.forEach((track, index) => {
    parts.push(renderTrackRow(track, index, content, palette, {
      x: 112,
      y: listStartY + index * (rowHeight + rowGap),
      width: width - 224,
      rowHeight,
      showImage: shouldShowTrackImage(model.style.trackImageMode, index),
      showTags: false,
      compact: rowHeight < 78,
    }));
  });
  return parts.join("");
}

function renderPhotoTracklistLayout(model: ShareCardModel, content: ShareCardRenderContent, palette: ThemePalette, width: number, height: number): string {
  const cardY = 330;
  const cardHeight = height - 620;
  const innerTop = cardY + 28;
  const innerHeight = cardHeight - 56;
  const columnWidth = 412;
  const parts = [
    `<rect x="64" y="${cardY}" width="${columnWidth}" height="${cardHeight}" rx="38" fill="${palette.surface}" stroke="${palette.stroke}" stroke-width="2"/>`,
    `<rect x="${64 + columnWidth + 36}" y="${cardY}" width="${width - columnWidth - 164}" height="${cardHeight}" rx="38" fill="${palette.surface}" stroke="${palette.stroke}" stroke-width="2"/>`,
  ];
  const photoTracks = model.tracks.slice(0, Math.min(3, model.tracks.length));
  const photoGap = 18;
  const photoHeight = clamp(
    Math.floor((innerHeight - Math.max(0, photoTracks.length - 1) * photoGap) / Math.max(1, photoTracks.length)),
    150,
    262,
  );
  photoTracks.forEach((track, index) => {
    parts.push(renderImage(track.displayImage, 92, innerTop + index * (photoHeight + photoGap), 356, photoHeight, 28));
  });
  const rowGap = 6;
  const rowHeight = clamp(
    Math.floor((innerHeight - Math.max(0, model.tracks.length - 1) * rowGap) / Math.max(1, model.tracks.length)),
    72,
    104,
  );
  model.tracks.forEach((track, index) => {
    parts.push(renderTrackRow(track, index, content, palette, {
      x: 64 + columnWidth + 62,
      y: innerTop + 18 + index * (rowHeight + rowGap),
      width: width - columnWidth - 224,
      rowHeight,
      showImage: shouldShowTrackImage(model.style.trackImageMode, index),
      showTags: false,
      compact: rowHeight < 88,
    }));
  });
  return parts.join("");
}

function renderCompactTracklistLayout(model: ShareCardModel, content: ShareCardRenderContent, palette: ThemePalette, width: number, height: number): string {
  const cardY = 330;
  const cardHeight = height - 620;
  const innerTop = cardY + 28;
  const innerHeight = cardHeight - 56;
  const rowGap = 4;
  const rowHeight = clamp(
    Math.floor((innerHeight - Math.max(0, model.tracks.length - 1) * rowGap) / Math.max(1, model.tracks.length)),
    56,
    80,
  );
  const parts = [
    `<rect x="64" y="${cardY}" width="${width - 128}" height="${cardHeight}" rx="38" fill="${palette.surface}" stroke="${palette.stroke}" stroke-width="2"/>`,
  ];
  model.tracks.forEach((track, index) => {
    parts.push(renderTrackRow(track, index, content, palette, {
      x: 92,
      y: innerTop + index * (rowHeight + rowGap),
      width: width - 184,
      rowHeight,
      showImage: shouldShowTrackImage(model.style.trackImageMode, index),
      showTags: false,
      compact: true,
    }));
  });
  return parts.join("");
}

function renderFooter(model: ShareCardModel, palette: ThemePalette, width: number, height: number): string {
  const footerY = height - 120;
  const parts = [
    `<line x1="84" y1="${footerY - 34}" x2="${width - 84}" y2="${footerY - 34}" stroke="${palette.stroke}" stroke-width="2"/>`,
    `<text x="84" y="${footerY}" fill="${palette.textSecondary}" font-family="${palette.fontBody}" font-size="22">${escapeXml(clipText(model.chapterDescription || "music, memory, and mood", 56))}</text>`,
  ];
  return parts.join("");
}

export function resolveShareCardRenderContent(model: ShareCardModel): ShareCardRenderContent {
  return {
    showTags: model.renderMode === "public-share" && model.style.showTags,
    showAuthor: model.style.showAuthor,
    showTrackCount: model.style.showTrackCount,
    showPublicLink: false,
  };
}

export function renderShareCardSvg(model: ShareCardModel): string {
  const dimensions = SHARE_EXPORT_DIMENSIONS[model.style.format];
  const palette = THEME_BY_MOOD[model.style.mood];
  const width = dimensions.width;
  const height = dimensions.height;
  const content = resolveShareCardRenderContent(model);
  const body = model.style.layout === "cover"
    ? renderCoverLayout(model, content, palette, width, height)
    : model.style.layout === "photo-tracklist"
      ? renderPhotoTracklistLayout(model, content, palette, width, height)
      : renderCompactTracklistLayout(model, content, palette, width, height);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeXml(model.chapterName)}">`,
    `<rect width="${width}" height="${height}" fill="${palette.background}"/>`,
    renderDecorations(model.style.mood, model.style.decorationLevel, width, height, palette),
    renderHeader(model, content, palette, width),
    body,
    renderFooter(model, palette, width, height),
    "</svg>",
  ].join("");
}
