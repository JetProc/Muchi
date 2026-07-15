import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const projectRoot = new URL("../", import.meta.url);
const terminalThemeMarker = "MUMU CATALOG 1996 — terminal theme contract";
const readableThemeMarker = "MUMU READABLE CATALOG — calm hierarchy layer";
const appleThemeMarker = "MUMU APPLE GALLERY — final theme";

function getTerminalTheme(css) {
  const markerIndex = css.lastIndexOf(terminalThemeMarker);
  assert.notEqual(markerIndex, -1, "terminal theme marker must exist");
  return css.slice(markerIndex);
}

function getReadableTheme(css) {
  const markerIndex = css.lastIndexOf(readableThemeMarker);
  assert.notEqual(markerIndex, -1, "readability layer marker must exist");
  return css.slice(markerIndex);
}

function getAppleTheme(css) {
  const markerIndex = css.lastIndexOf(appleThemeMarker);
  assert.notEqual(markerIndex, -1, "Apple theme marker must exist");
  return css.slice(markerIndex);
}

let workerPromise;

async function getWorker() {
  workerPromise ??= import(
    new URL(`../dist/server/index.js?test=${process.pid}-${Date.now()}`, import.meta.url)
      .href
  ).then((module) => module.default);
  return workerPromise;
}

async function render(pathname = "/") {
  const worker = await getWorker();
  return worker.fetch(
    new Request(new URL(pathname, "http://localhost"), {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

async function loadArchiveDomain() {
  const source = await readFile(new URL("../lib/archive.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("server-renders a deterministic MUMU editorial archive shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>MUMU — 나만의 음악 매거진<\/title>/);
  assert.match(html, /좋아했던 음악에 태그와 기억을 더해/);
  assert.match(html, /개인 음악 아카이브/);
  assert.match(html, /href="\/capture"/);
  assert.match(html, /href="\/chapters"/);
  assert.match(html, /id="main-content" tabindex="-1"/);
  assert.match(html, /property="og:image" content="\/og\.png"/);
  assert.doesNotMatch(html, /큐브|음악 세계|캐릭터/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Codex is working/i);

  const componentDirectory = new URL("../app/_components/", import.meta.url);
  const componentFiles = (await readdir(componentDirectory))
    .filter((name) => /\.(?:ts|tsx)$/.test(name));
  const componentSources = await Promise.all(
    componentFiles.map((name) => readFile(new URL(name, componentDirectory), "utf8")),
  );
  assert.doesNotMatch(componentSources.join("\n"), /큐브|음악 세계|캐릭터/);
});

test("renders every primary chapter archive destination with its stable shell", async () => {
  const destinations = [
    "/capture",
    "/inbox",
    "/chapters",
    "/chapter?id=cube%3Adawn",
    "/memory?id=context%3Adawn-radio",
    "/search",
    "/recap",
    "/settings",
    "/tags",
    "/playlist?id=cube%3Adawn",
  ];

  for (const pathname of destinations) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
    const html = await response.text();
    assert.match(html, /<title>MUMU — 나만의 음악 매거진<\/title>/, pathname);
    assert.match(html, /id="main-content" tabindex="-1"/, pathname);
    assert.doesNotMatch(html, /큐브|음악 세계|캐릭터/, pathname);
  }

  const offlineResponse = await render("/offline");
  assert.equal(offlineResponse.status, 200);
  const offlineHtml = await offlineResponse.text();
  assert.match(offlineHtml, /잠시 연결이 끊겼어요/);
  assert.match(offlineHtml, /내 음악 아카이브로 돌아가기/);
});

test("keeps Add search compact and opens link import in a modal", async () => {
  const [source, css] = await Promise.all([
    readFile(
      new URL("../app/_components/editorial-views-primary.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const terminalTheme = getTerminalTheme(css);

  assert.match(source, /className="capture-search-compact"/);
  assert.match(source, /<h1>곡 추가<\/h1>/);
  assert.match(source, /type="search"/);
  assert.match(source, /minLength=\{1\}/);
  assert.match(source, /enterKeyHint="search"/);
  assert.match(source, /const \[linkDialogOpen, setLinkDialogOpen\] = useState\(false\)/);
  assert.match(source, /className="dialog link-import-dialog"/);
  assert.match(source, /aria-modal="true" aria-labelledby="link-import-title"/);
  assert.doesNotMatch(source, /<details className="capture-secondary">/);
  assert.doesNotMatch(source, />CLOSE<\/Link>/);
  assert.doesNotMatch(source, /검색 및 30초 미리듣기는 iTunes에서 제공됩니다/);
  assert.doesNotMatch(source, /검색하면 곡 목록이 여기에 표시됩니다/);
  assert.match(source, /<h2 className="capture-results-count">/);
  assert.match(terminalTheme, /\.capture-results \.capture-results-count\s*\{[^}]*font-size:\s*12px;/s);
  assert.match(terminalTheme, /\.capture-results \.section-head\s*\{[^}]*margin-bottom:\s*8px;/s);
});

test("loads the Apple gallery theme after the legacy structural stylesheet", async () => {
  const [layoutSource, css] = await Promise.all([
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);
  const appleTheme = getAppleTheme(css);

  assert.ok(layoutSource.indexOf('import "./globals.css"') < layoutSource.indexOf('import "./apple-theme.css"'));
  assert.match(appleTheme, /--apple-primary:\s*#0066cc;/);
  assert.match(appleTheme, /--apple-primary-focus:\s*#0071e3;/);
  assert.match(appleTheme, /--apple-primary-on-dark:\s*#2997ff;/);
  assert.match(appleTheme, /--apple-canvas-parchment:\s*#f5f5f7;/);
  assert.match(appleTheme, /--apple-ink:\s*#1d1d1f;/);
  assert.doesNotMatch(appleTheme, /(?:linear|radial|conic)-gradient\(/);
});

test("uses Apple typography, whitespace, and flat mobile surfaces", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /body\s*\{[^}]*font-family:\s*var\(--apple-font-text\);[^}]*font-size:\s*17px;[^}]*line-height:\s*1\.47;/s);
  assert.match(appleTheme, /h1,\s*h2,\s*h3\s*\{[^}]*font-family:\s*var\(--apple-font-display\);[^}]*font-weight:\s*600;/s);
  assert.match(appleTheme, /\.editorial-header\s*\{[^}]*height:\s*44px;[^}]*background:\s*var\(--apple-surface-black\);/s);
  assert.match(appleTheme, /\.page-content\s*\{[^}]*padding:\s*var\(--apple-space-6\) var\(--apple-page-gutter\)/s);
  assert.match(appleTheme, /\.store-surface,[\s\S]*?\.search-empty\s*\{[^}]*border:\s*1px solid var\(--apple-hairline\);[^}]*border-radius:\s*var\(--apple-radius-lg\) !important;[^}]*box-shadow:\s*none !important;/s);
  assert.match(appleTheme, /@media \(max-width:\s*419px\)[\s\S]*?h1\s*\{[^}]*font-size:\s*28px;/s);
});

test("keeps toast messages compact above the fixed mobile navigation", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /\.toast\s*\{[^}]*bottom:\s*calc\(82px \+ env\(safe-area-inset-bottom\)\);[^}]*width:\s*min\(420px, calc\(100% - 32px\)\);/s);
  assert.match(appleTheme, /\.toast\s*\{[^}]*border-radius:\s*var\(--apple-radius-pill\) !important;[^}]*pointer-events:\s*none;/s);
  assert.match(appleTheme, /\.app-shell\.has-player \.toast\s*\{[^}]*bottom:\s*calc\(150px \+ env\(safe-area-inset-bottom\)\);/s);
});

test("uses an accessible settings icon in the editorial header", async () => {
  const [source, packageJsonSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonSource);

  assert.equal(typeof packageJson.dependencies["lucide-react"], "string");
  assert.match(source, /import\s*\{[^}]*\bSettings\b[^}]*\}\s*from "lucide-react"/s);
  assert.match(source, /className="settings-link"[^>]*aria-label="환경 설정"/s);
  assert.match(source, /<Settings aria-hidden="true"/);
  assert.doesNotMatch(source, /href="\/settings"[^>]*>SETTINGS<\/Link>/s);
});

test("adds one shared back action to every non-home view", async () => {
  const [shellSource, appSource, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/music-world-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(shellSource, /const showBack = view !== "home"/);
  assert.match(shellSource, /className="header-back-button"/);
  assert.match(shellSource, /onClick=\{onBack\} aria-label="뒤로가기"/);
  assert.equal((appSource.match(/onBack=\{router\.back\}/g) ?? []).length, 2);
  assert.match(css, /\.header-back-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.header-back-button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--apple-primary-focus\);/s);
});

test("keeps the complete Apple web design direction in the repository", async () => {
  const design = await readFile(new URL("../design.md", import.meta.url), "utf8");

  assert.match(design, /^# Apple Web Design Direction$/m);
  for (const heading of [
    "## Overview",
    "## Colors",
    "## Typography",
    "## Layout",
    "## Elevation & Depth",
    "## Shapes",
    "## Components",
    "## Do's and Don'ts",
  ]) {
    assert.ok(design.includes(heading), heading);
  }
  assert.match(design, /Action Blue.*#0066cc/);
  assert.match(design, /SF Pro Display/);
  assert.match(design, /Body copy at 17px/);
  assert.match(design, /single product shadow only to product or album photography/i);
  assert.match(design, /Minimum 44 × 44px/);
});

test("applies the closed Apple palette and SF system typography", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  const appleTheme = getAppleTheme(css);
  const palette = [...new Set(
    (appleTheme.match(/#[0-9a-f]{6}/gi) ?? []).map((color) => color.toLowerCase()),
  )].sort();

  for (const color of [
    "#000000", "#0066cc", "#0071e3", "#1d1d1f", "#252527", "#272729",
    "#2997ff", "#2a2a2c", "#7a7a7a", "#cccccc", "#d2d2d7", "#e0e0e0",
    "#f0f0f0", "#f5f5f7", "#fafafc", "#ffffff",
  ]) assert.ok(palette.includes(color), color);
  for (const legacyAccent of ["#e91d2a", "#fcc20f", "#0000ee"]) {
    assert.ok(!palette.includes(legacyAccent), legacyAccent);
  }
  assert.match(appleTheme, /--apple-font-display:\s*"SF Pro Display",\s*system-ui,\s*-apple-system/);
  assert.match(appleTheme, /--apple-font-text:\s*"SF Pro Text",\s*system-ui,\s*-apple-system/);
  assert.match(appleTheme, /--apple-product-shadow:\s*rgba\(0, 0, 0, 0\.22\) 3px 5px 30px 0;/);
});

test("keeps common controls readable and touch friendly", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /\.button,[\s\S]*?\.tag-manager-menu > summary\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(appleTheme, /\.icon-button,[\s\S]*?\.preview-icon-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  assert.match(appleTheme, /\.button:active,[\s\S]*?button\.tag:active\s*\{[^}]*transform:\s*scale\(0\.95\);/s);
  assert.match(appleTheme, /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--apple-primary-focus\);/s);
});

test("keeps the compact fixed navigation with Korean labels", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /home:\s*"홈"/);
  assert.match(source, /chapters:\s*"챕터"/);
  assert.match(source, /capture:\s*"추가"/);
  assert.match(source, /search:\s*"검색"/);
  assert.match(source, /className="text-navigation icon-label-nav"/);
  const appleTheme = getAppleTheme(css);
  assert.match(appleTheme, /\.footer-band\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;[^}]*backdrop-filter:\s*saturate\(180%\) blur\(20px\) !important;/s);
});

test("anchors modal backdrops to the viewport", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /\.dialog-backdrop,[\s\S]*?\.welcome-backdrop,[\s\S]*?\.player-backdrop\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;/s);
  assert.match(appleTheme, /\.dialog,[\s\S]*?\.tag-picker-panel\s*\{[^}]*border:\s*1px solid var\(--apple-hairline\);[^}]*border-radius:\s*var\(--apple-radius-lg\) !important;[^}]*box-shadow:\s*none !important;/s);
});

test("keeps dialog semantics on the focused surface instead of the backdrop", async () => {
  const paths = [
    "editorial-shell.tsx",
    "editorial-views-primary.tsx",
    "editorial-views-chapters.tsx",
    "editorial-views-discovery.tsx",
    "editorial-views-tags.tsx",
    "music-world-app.tsx",
  ];
  const sources = await Promise.all(paths.map((name) => readFile(
    new URL(`../app/_components/${name}`, import.meta.url),
    "utf8",
  )));
  const source = sources.join("\n");

  assert.doesNotMatch(source, /className="(?:dialog|welcome|player)-backdrop"[^>]*role="(?:dialog|alertdialog)"/);
  assert.match(source, /className="dialog[^"\n]*" role="dialog" aria-modal="true"/);
  assert.match(source, /className="welcome-card" role="dialog" aria-modal="true"/);
});

test("keeps track rows flat while reserving elevation for album artwork", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /\.track-line\s*\{[^}]*border:\s*1px solid var\(--apple-hairline\);[^}]*border-radius:\s*var\(--apple-radius-lg\) !important;[^}]*box-shadow:\s*none !important;/s);
  assert.match(appleTheme, /\.track-art,[\s\S]*?\.chapter-library-cover \.chapter-artwork\s*\{[^}]*box-shadow:\s*var\(--apple-product-shadow\) !important;/s);
  assert.doesNotMatch(appleTheme, /drop-shadow\(2px 2px 0/);
});

test("uses a compact accordion inside chapters and unified rows elsewhere", async () => {
  const [chapterSource, addSource, searchSource, globals] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  for (const source of [addSource, searchSource]) {
    assert.equal((source.match(/className="track-list track-list-unified"/g) ?? []).length, 1);
  }
  assert.doesNotMatch(chapterSource, /className="track-list track-list-unified"/);
  assert.match(chapterSource, /className="chapter-compact-track-list"/);
  assert.match(chapterSource, /className="chapter-compact-track-copy"/);
  assert.match(chapterSource, /<strong>\{entry\.track\.title\}<\/strong>[\s\S]*?<span>\{entry\.track\.artist\}<\/span>/);
  assert.match(chapterSource, /aria-expanded=\{expanded\}/);
  assert.match(chapterSource, /setExpandedTrackId/);
  assert.match(chapterSource, /className="chapter-memory-link"/);
  assert.match(chapterSource, /entry\.tags\.slice\(0, 6\)/);
  const legacyThemeEnd = globals.indexOf("} /* end inactive legacy visual themes */");
  const compactChapterStyles = globals.indexOf("/* Chapter detail — compact expandable track list");
  assert.ok(legacyThemeEnd >= 0 && compactChapterStyles > legacyThemeEnd);
  assert.match(globals, /\.chapter-compact-track-main\s*\{[^}]*min-height:\s*54px;/s);
  assert.match(globals, /\.chapter-compact-track-detail\s*\{[^}]*grid-template-rows:\s*0fr;/s);
  assert.match(globals, /\.chapter-compact-track\.is-expanded \.chapter-compact-track-detail\s*\{[^}]*grid-template-rows:\s*1fr;/s);
});

test("shows chapters as a sortable playlist-folder grid", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(source, /useEmblaCarousel|chapter-carousel|chapter-stage-controls/);
  assert.match(source, /className="chapter-library-tabs" aria-label="챕터 종류"/);
  assert.match(source, />내가 만든 챕터<\/button>/);
  assert.match(source, />월별 챕터<\/button>/);
  assert.match(source, /chapter\.id\.startsWith\("month:"\)/);
  assert.match(source, /className="chapter-library-sort"/);
  assert.match(source, /<option value="recent">최근 활동<\/option>/);
  assert.match(source, /<option value="tracks">곡 많은 순<\/option>/);
  assert.match(source, /className="chapter-library-grid"/);
  assert.match(source, /className="chapter-library-card"/);
  assert.match(source, /<ChapterCover archive=\{archive\} chapter=\{chapter\} \/>/);
  assert.match(css, /\.chapter-library-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(auto-fill, minmax\(148px, 1fr\)\);/s);
  assert.match(css, /\.chapter-library-cover\s*\{[^}]*aspect-ratio:\s*1;/s);
  assert.match(css, /@media \(max-width: 479px\)[\s\S]*?\.chapter-library-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\);/s);
  assert.match(css, /\.chapter-library-copy strong\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
});

test("shows the recap switch state as visible text as well as semantics", async () => {
  const source = await readFile(
    new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /className="toggle-label" aria-hidden="true"/);
  assert.match(source, /recapEnabled \? "켬" : "끔"/);
  assert.match(source, /role="switch" aria-checked=/);
});
test("keeps the home focused on three personal archive priorities", async () => {
  const [source, css] = await Promise.all([
    readFile(
      new URL("../app/_components/editorial-views-primary.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);
  const appleTheme = getAppleTheme(css);

  assert.match(source, /className="home-section home-continue"/);
  assert.match(source, /className="home-section chapter-preview"/);
  assert.match(source, /className="home-section home-recent"/);
  assert.match(source, /memories\.slice\(0, 3\)/);
  assert.match(source, /href="\/recap">이맘때의 음악/);
  assert.doesNotMatch(source, /COMMUNITY_PREVIEW|다른 사람의 장면|home-monthly/);
  assert.match(appleTheme, /\.album-hero\s*\{[^}]*background:\s*var\(--apple-surface-tile-1\);/s);
});

test("keeps destructive track actions behind explicit management modes", async () => {
  const [primarySource, chapterSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(primarySource, /const \[managing, setManaging\] = useState\(false\)/);
  assert.match(primarySource, /managing \? "관리 완료" : "목록 관리"/);
  assert.match(primarySource, /actions=\{managing \? <button className="button button-danger"/);
  assert.match(chapterSource, /const \[managing, setManaging\] = useState\(false\)/);
  assert.match(chapterSource, /managing \? "관리 완료" : "곡 관리"/);
  assert.match(chapterSource, /className="chapter-compact-track-manage"/);
  assert.match(chapterSource, /: \(\s*<Link className="chapter-memory-link"[^>]*>기억 열기<\/Link>/s);
});

test("defers new memory tags until the memory form is saved", async () => {
  const source = await readFile(
    new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url),
    "utf8",
  );
  const addTagSource = source.slice(source.indexOf("function addTag("), source.indexOf("function save("));
  const saveSource = source.slice(source.indexOf("function save("), source.indexOf("if (!hydrated)"));

  assert.match(source, /const \[draftArchive, setDraftArchive\] = useState<ArchiveEnvelopeV1 \| null>\(null\)/);
  assert.match(addTagSource, /createTags\(draftArchive \?\? archive/);
  assert.match(addTagSource, /setDraftArchive\(result\.archive\)/);
  assert.doesNotMatch(addTagSource, /commit\(/);
  assert.match(saveSource, /updateCubeTrack\(draftArchive \?\? archive/);
  assert.match(saveSource, /commit\(withTags/);
});

test("puts tag creation in a modal and keeps the library first", async () => {
  const source = await readFile(
    new URL("../app/_components/editorial-views-tags.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const \[createOpen, setCreateOpen\] = useState\(false\)/);
  assert.match(source, />새 태그<\/button>/);
  assert.match(source, /className="dialog tag-bulk-panel form-stack" role="dialog"/);
  assert.ok(source.indexOf("tag-library") < source.indexOf("createOpen ?"));
});

test("uses a compact swipe-first mobile home without primary playback", async () => {
  const [source, uiSource, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);
  const heroSource = source.slice(source.indexOf("export function AlbumHero"), source.indexOf("export function Home"));

  assert.doesNotMatch(heroSource, /PreviewButton|>PREV<|>NEXT</);
  assert.match(heroSource, /onTouchStart=/);
  assert.match(heroSource, /onTouchEnd=/);
  assert.match(heroSource, /aria-roledescription="carousel"/);
  assert.match(source, /showPreview=\{false\}/);
  assert.match(uiSource, /showPreview = true/);
  assert.match(uiSource, /\{showPreview \? <PreviewButton/);
  assert.match(source, /className="chapter-preview-art"/);
  assert.match(source, /className="chapter-preview-art"[\s\S]*?<ChapterCover archive=\{archive\} chapter=\{chapter\} \/>/);
  const appleTheme = getAppleTheme(css);
  assert.match(appleTheme, /\.editorial-header\s*\{[^}]*position:\s*fixed;/s);
  assert.match(appleTheme, /@media \(max-width: 640px\)[\s\S]*?\.album-feature\s*\{[^}]*grid-template-columns:\s*128px minmax\(0, 1fr\);/s);
  assert.match(appleTheme, /@media \(max-width: 419px\)[\s\S]*?\.album-feature\s*\{[^}]*grid-template-columns:\s*112px minmax\(0, 1fr\);/s);
  assert.match(appleTheme, /@media \(max-width: 419px\)[\s\S]*?\.track-list-unified \.track-line\s*\{[^}]*--track-cover-size:\s*60px;/s);
});

test("removes redundant helper copy and keeps preview controls compact", async () => {
  const paths = [
    "editorial-media.tsx",
    "editorial-ui.tsx",
    "editorial-views-primary.tsx",
    "editorial-views-chapters.tsx",
    "editorial-views-discovery.tsx",
    "editorial-views-tags.tsx",
    "music-world-app.tsx",
  ];
  const [componentSources, itunesSource, css] = await Promise.all([
    Promise.all(paths.map((name) => readFile(
      new URL(`../app/_components/${name}`, import.meta.url),
      "utf8",
    ))),
    readFile(new URL("../lib/itunes.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);
  const sources = componentSources;
  const source = sources.join("\n");
  const mediaSource = sources[0];
  const chapterSource = sources[3];
  const readableTheme = getAppleTheme(css);

  assert.doesNotMatch(source, /\bcopy=/);
  assert.doesNotMatch(source, /같은 곡도 순간마다 다르게 느껴집니다/);
  assert.doesNotMatch(source, /같은 곡도 이 챕터 안에서는 고유한 태그와 기억을 가집니다/);
  assert.doesNotMatch(source, /완벽하게 정리하지 않아도 괜찮아요/);
  assert.doesNotMatch(source, /welcome-steps/);
  assert.match(source, /삭제되지만 다른 챕터의 같은 곡은 그대로 남습니다/);
  assert.match(source, /이 기기에만 저장되는 데모입니다/);
  assert.doesNotMatch(chapterSource, /ITUNES_PREVIEW_USAGE_NOTICE|미리듣기는 홍보 목적으로만/);
  assert.doesNotMatch(itunesSource, /ITUNES_PREVIEW_USAGE_NOTICE|미리듣기는 홍보 목적으로만/);
  assert.match(mediaSource, /className="play-button preview-icon-button"/);
  assert.match(mediaSource, /const previewLabel = !track\.previewUrl[\s\S]*?\? `\$\{track\.title\} 미리듣기 정지`[\s\S]*?: `\$\{track\.title\} 30초 미리듣기`/);
  assert.match(mediaSource, /aria-label=\{previewLabel\}/);
  assert.match(mediaSource, /playing \? <Pause[^>]*aria-hidden="true"[^>]*\/> : <Play[^>]*aria-hidden="true"[^>]*\/>/);
  assert.doesNotMatch(mediaSource, /\{playing \? "정지" : "미리듣기"\}/);
  assert.match(readableTheme, /\.preview-icon-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*padding:\s*0;/s);
  assert.match(readableTheme, /\.memory-preview-actions\s*\{[^}]*display:\s*flex;[^}]*align-items:\s*center;/s);
});

test("keeps archive search compact with the shared tag picker", async () => {
  const [source, pickerSource, css] = await Promise.all([
    readFile(
      new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/_components/editorial-tag-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className="page-content search-view"/);
  assert.match(source, /<h1 className="sr-only">기록 검색<\/h1>/);
  assert.match(source, /className="input search-input"\s*\n\s*type="search"/);
  assert.match(source, /className="search-tag-controls"/);
  assert.match(source, /<TagPicker\s+label="태그 필터"/);
  assert.doesNotMatch(source, /search-tag-categories|search-tag-list|SEARCH_TAG_CATEGORIES/);
  assert.match(source, /tagMatch/);
  assert.match(source, /maxTags=\{2\}/);
  assert.match(source, /className="search-results-section"/);
  assert.match(source, /const hasSearch = Boolean\(query\.trim\(\) \|\| tagIds\.length\)/);
  assert.match(source, /const results = hasSearch/);
  assert.doesNotMatch(source, /내 언어로 음악을 다시 찾기/);
  assert.doesNotMatch(source, /className="search-editor/);
  assert.ok(source.indexOf("search-tag-controls") < source.indexOf("search-results-section"));
  assert.match(pickerSource, /role="dialog"/);
  assert.match(pickerSource, /TAG_PICKER_CATEGORIES = \["mood", "genre", "custom"\]/);
  assert.match(pickerSource, /mood: "감정·상황"/);
  assert.match(pickerSource, /className="tag-picker-category-list"/);
  assert.match(pickerSource, /className="tag-picker-category-row"/);
  assert.doesNotMatch(pickerSource, /role="tablist"|tag-picker-categories|"frequent"/);
  assert.match(css, /\.tag-picker-panel\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*0;/s);
  assert.match(css, /\.tag-picker-category-list\s*\{[^}]*border-top:/s);
  assert.match(css, /\.tag-picker-options\s*\{[^}]*max-height:\s*286px;/s);
});

test("builds a mobile playlist creation UI without streaming side effects", async () => {
  const [chapterSource, playlistSource, appSource, typesSource, routeSource, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-playlist.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/music-world-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/playlist/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const readableTheme = getReadableTheme(css);

  assert.match(chapterSource, /className="chapter-service-grid"/);
  assert.match(chapterSource, /service=apple/);
  assert.match(chapterSource, /service=spotify/);
  assert.match(chapterSource, /service=youtube/);
  assert.match(chapterSource, /Apple Music으로 플레이리스트 만들기/);
  assert.match(chapterSource, /Spotify로 플레이리스트 만들기/);
  assert.match(chapterSource, /YouTube Music으로 플레이리스트 만들기/);
  assert.match(playlistSource, /Apple Music/);
  assert.match(playlistSource, /Spotify/);
  assert.match(playlistSource, /YouTube Music/);
  assert.match(playlistSource, /icon: Apple/);
  assert.match(playlistSource, /icon: AudioLines/);
  assert.match(playlistSource, /icon: CirclePlay/);
  assert.match(playlistSource, /곡 확인/);
  assert.match(playlistSource, /서비스 선택/);
  assert.match(playlistSource, /매칭 확인/);
  assert.match(playlistSource, /플레이리스트를 만들었어요/);
  assert.match(playlistSource, /MUMU의 챕터와 기억은 바뀌지 않아요/);
  assert.match(playlistSource, /presetServiceId \? 3 : 2/);
  assert.match(appSource, /initialServiceId=\{searchParams\.get\("service"\)\}/);
  assert.doesNotMatch(playlistSource, /fetch\(|localStorage|sessionStorage/);
  assert.match(appSource, /case "playlist":/);
  assert.match(typesSource, /\| "playlist"/);
  assert.match(routeSource, /<MusicWorldApp view="playlist" \/>/);
  assert.match(readableTheme, /\.playlist-service-list\s*\{[^}]*display:\s*grid;/s);
  assert.match(readableTheme, /\.playlist-builder-actions\s*\{[^}]*position:\s*sticky;/s);
  assert.match(readableTheme, /\.playlist-service-icon\.is-apple[\s\S]*?background:\s*#fa243c;/);
  assert.match(readableTheme, /\.playlist-service-icon\.is-spotify[\s\S]*?background:\s*#1ed760;/);
  assert.match(readableTheme, /\.playlist-service-icon\.is-youtube[\s\S]*?background:\s*#ff0033;/);
  assert.match(readableTheme, /\.chapter-service-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/s);
});

test("redirects legacy presentation routes to the chapter archive", async () => {
  const redirects = [
    ["/cubes", "/chapters"],
    ["/cube?id=cube%3Adawn", "/chapter?id=cube%3Adawn"],
    ["/context?id=context%3Adawn-radio", "/memory?id=context%3Adawn-radio"],
    ["/world", "/chapters"],
  ];

  for (const [legacyPath, expectedPath] of redirects) {
    const response = await render(legacyPath);
    assert.ok([307, 308].includes(response.status), legacyPath);
    const location = response.headers.get("location");
    assert.ok(location, legacyPath);
    const redirected = new URL(location, "http://localhost");
    assert.equal(`${redirected.pathname}${redirected.search}`, expectedPath, legacyPath);
  }
});

test("accepts supported music links without allowing arbitrary upstream hosts", async () => {
  const melonUrl = encodeURIComponent(
    "https://www.melon.com/song/detail.htm?songId=12345678",
  );
  const manualResponse = await render(`/api/music-metadata?url=${melonUrl}`);
  assert.equal(manualResponse.status, 200);
  const manual = await manualResponse.json();
  assert.equal(manual.status, "manual");
  assert.equal(manual.service, "melon");
  assert.equal(manual.fallback.id, "melon:12345678");
  assert.equal(
    manual.fallback.externalUrl,
    "https://www.melon.com/song/detail.htm?songId=12345678",
  );

  const unsafeUrl = encodeURIComponent("https://127.0.0.1/private");
  const rejectedResponse = await render(`/api/music-metadata?url=${unsafeUrl}`);
  assert.equal(rejectedResponse.status, 400);
  const rejected = await rejectedResponse.json();
  assert.equal(rejected.status, "error");
  assert.equal(rejected.error.code, "unsupported-url");
});

test("proxies iTunes searches through a same-origin JSON endpoint", async () => {
  const clientSource = await readFile(new URL("../lib/itunes.ts", import.meta.url), "utf8");
  assert.match(clientSource, /fetch\(`\/api\/music-search\?/);
  assert.doesNotMatch(clientSource, /document\.createElement\("script"\)|callbackTarget/);

  const routeSource = await readFile(
    new URL("../app/api/music-search/route.ts", import.meta.url),
    "utf8",
  );
  const routeOutput = ts.transpileModule(routeSource, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const route = await import(
    `data:text/javascript;base64,${Buffer.from(routeOutput).toString("base64")}`
  );

  const originalFetch = globalThis.fetch;
  let upstreamUrl;
  let upstreamInit;
  globalThis.fetch = async (input, init) => {
    upstreamUrl = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    upstreamInit = init;
    return Response.json({
      resultCount: 1,
      results: [{
        kind: "song",
        trackId: 1779782000,
        trackName: "Radio",
        artistName: "Lana Del Rey",
      }],
    });
  };

  try {
    const response = await route.GET(
      new Request("http://localhost/api/music-search?term=R"),
    );
    assert.equal(response.status, 200);
    assert.equal(upstreamUrl.hostname, "itunes.apple.com");
    assert.equal(upstreamUrl.searchParams.get("term"), "R");
    assert.equal(upstreamUrl.searchParams.get("country"), "KR");
    assert.equal(upstreamUrl.searchParams.get("entity"), "song");
    assert.equal(upstreamUrl.searchParams.get("limit"), "30");
    assert.equal(upstreamInit.redirect, "manual");
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
    const payload = await response.json();
    assert.equal(payload.results[0].trackName, "Radio");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("reveals iTunes search results in batches of ten while scrolling", async () => {
  const [captureSource, globalStyles] = await Promise.all([
    readFile(
      new URL("../app/_components/editorial-views-primary.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(captureSource, /SEARCH_RESULT_BATCH_SIZE\s*=\s*10/);
  assert.match(captureSource, /results\.slice\(0, visibleResultCount\)/);
  assert.match(captureSource, /new IntersectionObserver\(/);
  assert.match(captureSource, /className="search-loading-spinner"/);
  assert.match(globalStyles, /\.search-loading-spinner\s*\{/);
});

test("ships the PWA shell and removes the disposable starter", async () => {
  const [packageJson, manifest, serviceWorker] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/sw.js", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(manifest, /display:\s*"standalone"/);
  assert.match(manifest, /나만의 챕터/);
  assert.match(serviceWorker, /v3-editorial/);
  assert.match(serviceWorker, /"\/chapters"/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.match(serviceWorker, /!isSameOrigin\(url\) \|\| request\.destination === "audio"/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../public/favicon.png", import.meta.url));
  await access(new URL("../public/sw.js", import.meta.url));
  await access(projectRoot);
});

test("keeps the same song's tags and memory independent in each cube", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const radioContexts = Object.values(seed.data.cubeTracks).filter(
    (item) => item.trackId === "itunes:1569294423",
  );

  assert.equal(Object.keys(seed.data.cubes).length, 3);
  assert.equal(Object.keys(seed.data.tracks).length, 7);
  assert.equal(radioContexts.length, 2);

  const [dawnRadio, winterRadio] = radioContexts;
  const winterBefore = structuredClone(winterRadio);
  const updated = archiveDomain.setCubeTrackTags(seed, dawnRadio.id, [
    "차가운",
    "질주하는",
    "한밤중",
  ]);
  const withMemory = archiveDomain.updateCubeTrack(updated, dawnRadio.id, {
    character: "도시를 가르는 야간 주행곡",
    memo: "새로 덧붙인 개인 기억",
  });

  assert.deepEqual(withMemory.data.cubeTracks[winterRadio.id], winterBefore);
  const dawnTags = withMemory.data.cubeTracks[dawnRadio.id].tagIds.map(
    (tagId) => withMemory.data.tags[tagId],
  );
  assert.equal(dawnTags.length, 3);
  assert.equal(dawnTags.some((tag) => tag.category === "period"), false);
  assert.equal(
    withMemory.data.cubeTracks[dawnRadio.id].character,
    "도시를 가르는 야간 주행곡",
  );

  const parsed = archiveDomain.parseArchive(
    archiveDomain.serializeArchive(withMemory),
  );
  assert.equal(parsed.status, "ok");
  assert.deepEqual(parsed.archive, withMemory);

  const youtubeTrack = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"),
    provider: "youtube",
    providerTrackId: "M7lc1UVf-VE",
    title: "기억할 영상 속 음악",
    artist: "기록한 아티스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
    previewUrl: null,
    externalUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  };
  const withYoutube = archiveDomain.captureTrackToInbox(withMemory, youtubeTrack);
  const youtubeRoundTrip = archiveDomain.parseArchive(
    archiveDomain.serializeArchive(withYoutube),
  );
  assert.equal(youtubeRoundTrip.status, "ok");
  assert.equal(youtubeRoundTrip.archive.data.tracks[youtubeTrack.id].externalUrl, youtubeTrack.externalUrl);

  const removable = archiveDomain.setCubeTrackTags(
    seed,
    dawnRadio.id,
    ["곧 지울 유일한 태그"],
  );
  const disposableTagId = removable.data.cubeTracks[dawnRadio.id].tagIds[0];
  const removed = archiveDomain.removeCubeTrack(removable, dawnRadio.id);
  assert.ok(removed.data.tags[disposableTagId]);
});

test("stores a stable registration date and groups registered tracks into searchable monthly chapters", async () => {
  const archiveDomain = await loadArchiveDomain();
  const firstTrack = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"),
    provider: "youtube",
    providerTrackId: "M7lc1UVf-VE",
    title: "7월의 첫 곡",
    artist: "월간 아티스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  };
  const secondTrack = {
    ...firstTrack,
    id: archiveDomain.makeProviderTrackId("youtube", "dQw4w9WgXcQ"),
    providerTrackId: "dQw4w9WgXcQ",
    title: "7월의 두 번째 곡",
    externalUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  };
  const julyStartInSeoul = "2026-06-30T15:30:00.000Z";
  const laterInJuly = "2026-07-20T09:00:00.000Z";

  const empty = archiveDomain.createEmptyArchive("2026-06-01T00:00:00.000Z");
  const withFirst = archiveDomain.captureTrackToInbox(empty, firstTrack, julyStartInSeoul);
  const withBoth = archiveDomain.captureTrackToInbox(withFirst, secondTrack, laterInJuly);
  const recaptured = archiveDomain.captureTrackToInbox(
    withBoth,
    firstTrack,
    "2026-08-01T00:00:00.000Z",
  );

  assert.equal(recaptured.data.tracks[firstTrack.id].registeredAt, julyStartInSeoul);
  assert.equal(recaptured.data.tracks[secondTrack.id].registeredAt, laterInJuly);

  const monthlyChapters = Object.values(recaptured.data.cubes)
    .filter((chapter) => chapter.name === "7월");
  assert.equal(monthlyChapters.length, 1);
  const monthlyTrackIds = archiveDomain.getCubeTracks(recaptured, monthlyChapters[0].id)
    .map((entry) => entry.track.id)
    .sort();
  assert.deepEqual(monthlyTrackIds, [firstTrack.id, secondTrack.id].sort());

  assert.equal(
    Object.values(recaptured.data.tags).some((tag) => tag.category === "period"),
    false,
  );
  assert.ok(
    archiveDomain.getCubeTracks(recaptured, monthlyChapters[0].id)
      .every((entry) => entry.cubeTrack.tagIds.every((tagId) => !tagId.startsWith("auto:period:"))),
  );

  for (const query of ["2026-07", "2026년 7월"]) {
    const results = archiveDomain.searchArchive(recaptured, { query });
    const foundTrackIds = results
      .filter((result) => result.kind === "cube-track" && result.cube.id === monthlyChapters[0].id)
      .map((result) => result.track.id)
      .sort();
    assert.deepEqual(foundTrackIds, [firstTrack.id, secondTrack.id].sort(), query);
  }
});

test("migrates existing archives with registration dates and monthly chapters", async () => {
  const archiveDomain = await loadArchiveDomain();
  const track = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"),
    provider: "youtube",
    providerTrackId: "M7lc1UVf-VE",
    title: "이전부터 저장한 곡",
    artist: "기존 아티스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  };
  const capturedAt = "2025-12-15T12:00:00.000Z";
  const legacy = archiveDomain.createEmptyArchive("2025-12-20T00:00:00.000Z");
  legacy.schemaVersion = 1;
  legacy.data.tracks[track.id] = track;
  legacy.data.inbox[track.id] = { trackId: track.id, capturedAt, source: "user" };

  const parsed = archiveDomain.parseArchive(JSON.stringify(legacy));

  assert.equal(parsed.status, "ok");
  assert.equal(parsed.migrated, true);
  assert.equal(parsed.archive.schemaVersion, archiveDomain.ARCHIVE_SCHEMA_VERSION);
  assert.equal(parsed.archive.data.tracks[track.id].registeredAt, capturedAt);
  const decemberChapter = Object.values(parsed.archive.data.cubes)
    .find((chapter) => chapter.name === "12월");
  assert.ok(decemberChapter);
  assert.deepEqual(
    archiveDomain.getCubeTracks(parsed.archive, decemberChapter.id)
      .map((entry) => entry.track.id),
    [track.id],
  );
  assert.equal(
    Object.values(parsed.archive.data.tags).some((tag) => tag.category === "period"),
    false,
  );
});

test("migrates legacy period tags into internal registration data only", async () => {
  const archiveDomain = await loadArchiveDomain();
  const legacy = structuredClone(archiveDomain.createSeedArchive());
  const cubeTrack = Object.values(legacy.data.cubeTracks)[0];
  const periodTagId = "auto:period:2026-07";
  legacy.schemaVersion = 2;
  legacy.data.tags[periodTagId] = {
    id: periodTagId,
    label: "2026년 7월",
    normalizedLabel: "2026년 7월",
    category: "period",
    source: "user",
    createdAt: "2026-07-01T00:00:00.000Z",
  };
  cubeTrack.tagIds = [periodTagId, ...cubeTrack.tagIds];
  legacy.data.cubes["month:2026-07"] = {
    id: "month:2026-07",
    name: "2026년 7월",
    description: "2026년 7월에 등록한 곡들",
    color: "violet",
    sortOrder: 99,
    source: "user",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
  };

  const parsed = archiveDomain.parseArchive(JSON.stringify(legacy));

  assert.equal(parsed.status, "ok");
  assert.equal(parsed.migrated, true);
  assert.equal(parsed.archive.schemaVersion, archiveDomain.ARCHIVE_SCHEMA_VERSION);
  assert.equal(parsed.archive.data.tags[periodTagId], undefined);
  assert.equal(parsed.archive.data.cubeTracks[cubeTrack.id].tagIds.includes(periodTagId), false);
  assert.match(parsed.archive.data.tracks[cubeTrack.trackId].registeredAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(parsed.archive.data.cubes["month:2026-07"].name, "7월");
  assert.equal(parsed.archive.data.cubes["month:2026-07"].description, "7월에 등록한 곡들");
});

test("manages a reusable tag library independently from track memories", async () => {
  const archiveDomain = await loadArchiveDomain();
  const empty = archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z");
  const created = archiveDomain.createTags(empty, [
    { label: "잔잔한", category: "energy" },
    { label: "몽환적인", category: "texture" },
    { label: " 잔잔한 ", category: "emotion" },
  ], "2026-07-02T00:00:00.000Z");

  assert.equal(created.created, 2);
  assert.equal(Object.keys(created.archive.data.tags).length, 2);
  const calm = Object.values(created.archive.data.tags)
    .find((tag) => tag.normalizedLabel === "잔잔한");
  assert.ok(calm);
  assert.equal(calm.category, "emotion");
  assert.ok(
    Object.values(created.archive.data.tags)
      .every((tag) => tag.category !== "energy" && tag.category !== "texture"),
  );

  const legacy = structuredClone(created.archive);
  legacy.data.tags[calm.id].category = "energy";
  const migrated = archiveDomain.parseArchive(archiveDomain.serializeArchive(legacy));
  assert.equal(migrated.status, "ok");
  assert.equal(migrated.migrated, true);
  assert.equal(migrated.archive.data.tags[calm.id].category, "emotion");

  const renamed = archiveDomain.updateTag(
    created.archive,
    calm.id,
    { label: "고요한", category: "emotion" },
    "2026-07-03T00:00:00.000Z",
  );
  assert.equal(renamed.data.tags[calm.id].label, "고요한");
  assert.equal(renamed.data.tags[calm.id].category, "emotion");

  const roundTrip = archiveDomain.parseArchive(archiveDomain.serializeArchive(renamed));
  assert.equal(roundTrip.status, "ok");
  assert.equal(Object.keys(roundTrip.archive.data.tags).length, 2);
});

test("selects only existing tags and removes deleted tags from every memory", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const cubeTrack = Object.values(seed.data.cubeTracks)[0];
  const selectedTagIds = Object.keys(seed.data.tags).slice(0, 2);
  const selected = archiveDomain.setCubeTrackTagIds(
    seed,
    cubeTrack.id,
    selectedTagIds,
    "2026-07-04T00:00:00.000Z",
  );
  const assignedTagIds = selected.data.cubeTracks[cubeTrack.id].tagIds;
  assert.deepEqual(assignedTagIds, selectedTagIds);
  assert.throws(
    () => archiveDomain.setCubeTrackTagIds(selected, cubeTrack.id, ["missing:tag"]),
    /태그.*찾을 수 없습니다/,
  );

  const removed = archiveDomain.deleteTag(
    selected,
    selectedTagIds[0],
    "2026-07-05T00:00:00.000Z",
  );
  assert.equal(removed.data.tags[selectedTagIds[0]], undefined);
  assert.ok(
    Object.values(removed.data.cubeTracks)
      .every((entry) => !entry.tagIds.includes(selectedTagIds[0])),
  );
});

test("supports all or any matching when archive search uses multiple tags", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const [first, second] = Object.values(seed.data.cubeTracks);
  const firstTagged = archiveDomain.setCubeTrackTags(
    seed,
    first.id,
    ["검색 전용 A"],
    "2026-07-06T00:00:00.000Z",
  );
  const tagged = archiveDomain.setCubeTrackTags(
    firstTagged,
    second.id,
    ["검색 전용 B"],
    "2026-07-07T00:00:00.000Z",
  );
  const tagA = Object.values(tagged.data.tags).find((tag) => tag.label === "검색 전용 A");
  const tagB = Object.values(tagged.data.tags).find((tag) => tag.label === "검색 전용 B");
  assert.ok(tagA && tagB);

  const allMatches = archiveDomain.searchArchive(tagged, {
    tagIds: [tagA.id, tagB.id],
    tagMatch: "all",
  });
  const anyMatches = archiveDomain.searchArchive(tagged, {
    tagIds: [tagA.id, tagB.id],
    tagMatch: "any",
  });

  assert.equal(allMatches.length, 0);
  assert.ok(anyMatches.some((result) => result.kind === "cube-track" && result.cubeTrack.id === first.id));
  assert.ok(anyMatches.some((result) => result.kind === "cube-track" && result.cubeTrack.id === second.id));
});

test("uses managed tag chips instead of suggestions or free-form memory tags", async () => {
  const [memorySource, pickerSource, managerSource, formatSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-tag-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-tags.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-format.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(memorySource, /TAG_SUGGESTIONS|id="custom-tag"/);
  assert.match(pickerSource, /manageHref = "\/tags"/);
  assert.match(managerSource, /id="bulk-tags"/);
  assert.match(managerSource, /\.split\(\/\[\\n,;\]\+\//);
  assert.match(
    managerSource,
    /MANUAL_TAG_CATEGORIES[^=]*=\s*\["emotion", "genre", "custom"\]/,
  );
  assert.match(managerSource, /category === "situation" \|\| category === "energy" \|\| category === "texture"/);
  assert.match(formatSource, /custom:\s*"커스텀"/);
});

test("uses one searchable tag picker without exposing period tags", async () => {
  const [memorySource, managerSource, discoverySource, pickerSource, archiveSource, formatSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-tags.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-tag-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/archive.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-format.ts", import.meta.url), "utf8"),
  ]);

  assert.match(memorySource, /<TagPicker/);
  assert.match(memorySource, /onCreate=\{addTag\}/);
  assert.match(discoverySource, /<TagPicker/);
  assert.doesNotMatch(memorySource, /managed-tag-groups|managed-tag-option|inline-tag-composer|period-tag-group|추가 시기 · 자동/);
  assert.doesNotMatch(managerSource, /TAG_LIBRARY_CATEGORIES|category === "period"|추가일 기준 자동/);
  assert.match(pickerSource, /type EditableTagCategory = "emotion" \| "situation" \| "genre" \| "custom"/);
  assert.match(pickerSource, /category === "mood" \? "emotion" : category/);
  assert.match(pickerSource, /role="listbox"/);
  assert.doesNotMatch(pickerSource, /aria-label="새 태그 카테고리"/);
  assert.match(formatSource, /emotion:\s*"감정·상황"/);
  assert.match(formatSource, /situation:\s*"감정·상황"/);
  assert.doesNotMatch(archiveSource, /"period",\s*\n\] as const/);
  assert.doesNotMatch(formatSource, /period\.year|\$\{year\}/);
  assert.doesNotMatch(memorySource, /기억한 시기|periodKind|period-tag-detail/);
  assert.match(memorySource, /<label htmlFor="memo">메모<\/label>/);
  assert.doesNotMatch(
    memorySource,
    /htmlFor="character"|id="character"|htmlFor="place"|id="place"|htmlFor="people"|id="people"/,
  );
  assert.doesNotMatch(
    memorySource,
    /character=\{character\}|place=\{place\}|people=\{people\}/,
  );
});

test("keeps recap creation minimal and modal blur calm", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const recapSource = source.slice(source.indexOf("export function Recap("), source.indexOf("export function Settings("));
  const readableTheme = getReadableTheme(css);

  assert.doesNotMatch(recapSource, /기록 보관함|날짜별 기록과 기간 회고를 한곳에서 봅니다|<PageHeader/);
  assert.match(recapSource, /className="recap-create-action"/);
  assert.match(recapSource, />회고 만들기<\/button>/);
  assert.match(recapSource, /className="dialog recap-create-dialog"/);
  assert.doesNotMatch(recapSource, /2026-06-07 데일리 요약/);
  assert.match(
    readableTheme,
    /\.dialog-backdrop,[\s\S]*?\.welcome-backdrop,[\s\S]*?\.player-backdrop\s*\{[^}]*background:\s*rgba\(23, 19, 15, 0\.24\);[^}]*backdrop-filter:\s*blur\(8px\) saturate\(0\.92\) !important;/s,
  );
});
