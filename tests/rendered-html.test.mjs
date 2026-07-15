import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const projectRoot = new URL("../", import.meta.url);

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

  assert.match(source, /className="capture-search-compact"/);
  assert.match(source, /<h1>곡 검색<\/h1>/);
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
  assert.match(css, /\.capture-results \.capture-results-count\s*\{[^}]*font-size:\s*12px;/s);
  assert.match(css, /\.capture-results \.section-head\s*\{[^}]*margin-bottom:\s*8px;/s);
});

test("uses an accessible settings icon in the editorial header", async () => {
  const [source, packageJsonSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonSource);

  assert.equal(typeof packageJson.dependencies["lucide-react"], "string");
  assert.match(source, /import \{ Settings \} from "lucide-react"/);
  assert.match(source, /className="settings-link"[^>]*aria-label="환경 설정"/s);
  assert.match(source, /<Settings aria-hidden="true"/);
  assert.doesNotMatch(source, /href="\/settings"[^>]*>SETTINGS<\/Link>/s);
});

test("releases the route transform so fixed dialogs stay anchored to the viewport", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const routeStageRule = css.match(/\.route-stage\s*\{([^}]*)\}/s)?.[1] ?? "";

  assert.match(routeStageRule, /animation:\s*route-enter/);
  assert.doesNotMatch(routeStageRule, /\bboth\b/);
});

test("uses whitespace and tone instead of decorative divider lines", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(
    css,
    /border-(?:top|right|bottom|left):\s*1px solid var\(--line\)/,
  );
  assert.doesNotMatch(css, /border:\s*1px solid var\(--line-strong\)/);
  assert.match(css, /--shadow-control:/);
  assert.match(css, /--shadow-surface:/);
  assert.match(css, /\.button\s*{[^}]*box-shadow:\s*var\(--shadow-control\)/s);
  assert.match(css, /\.track-list\s*{[^}]*gap:\s*8px;/s);
  assert.match(css, /\.chapter-stats\s*{[^}]*gap:\s*8px;/s);
});

test("keeps track rows compact with actions aligned at the right edge", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /\.track-line\s*\{[^}]*grid-template-columns:[^;]*auto;/s);
  assert.match(css, /\.track-line \.track-actions\s*\{[^}]*grid-column:\s*4;/s);
  assert.match(css, /\.track-line \.track-actions\s*\{[^}]*justify-content:\s*flex-end;/s);
  assert.match(css, /\.track-line \.track-art\s*\{[^}]*width:\s*44px;/s);
});

test("turns the chapter index into an accessible overlapping LP deck", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className="chapter-stage"/);
  assert.match(source, /aria-roledescription="carousel"/);
  assert.match(source, /onPointerDown=/);
  assert.match(source, /Math\.abs\(distance\) < 48/);
  assert.match(source, /hidden=\{!visible\}/);
  assert.match(source, /className="chapter-lp-stack" role="tablist"/);
  assert.match(source, /src="\/assets\/chapter-lp\.png"/);
  assert.match(source, /className="chapter-lp-card-copy"/);
  assert.match(source, /event\.key === "ArrowLeft"/);
  assert.match(source, /event\.key === "ArrowRight"/);
  assert.match(source, /role="tablist" aria-label="음악 챕터 선택"/);
  assert.match(source, /aria-selected=\{selected\}/);
  assert.match(source, />\s*챕터 들어가기\s*</);
  assert.match(css, /\.chapter-lp-slide\s*\{[^}]*position:\s*absolute;/s);
  assert.match(css, /translateY\(var\(--stack-y\)\)/);
  assert.match(css, /drop-shadow\(0 12px 16px/);
});

test("keeps the home focused on personal archives with a restrained community preview", async () => {
  const [source, css] = await Promise.all([
    readFile(
      new URL("../app/_components/editorial-views-primary.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className="home-section home-continue"/);
  assert.match(source, /className="home-section chapter-preview"/);
  assert.match(source, /className="home-section home-discovery"/);
  assert.match(source, /COMMUNITY PREVIEW/);
  assert.match(source, /다른 사람의 장면/);
  assert.match(source, /className="home-section home-recent"/);
  assert.match(source, /className="home-section home-monthly"/);
  assert.doesNotMatch(source, /className="home-manifesto"/);
  assert.match(css, /\.chapter-preview-list\s*\{[^}]*overflow-x:\s*auto;/s);
  assert.match(css, /\.album-hero\s*\{[^}]*min-height:\s*0;/s);
});

test("removes redundant helper copy while preserving safety-critical text", async () => {
  const paths = [
    "editorial-ui.tsx",
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

  assert.doesNotMatch(source, /\bcopy=/);
  assert.doesNotMatch(source, /같은 곡도 순간마다 다르게 느껴집니다/);
  assert.doesNotMatch(source, /같은 곡도 이 챕터 안에서는 고유한 태그와 기억을 가집니다/);
  assert.doesNotMatch(source, /완벽하게 정리하지 않아도 괜찮아요/);
  assert.doesNotMatch(source, /welcome-steps/);
  assert.match(source, /삭제되지만 다른 챕터의 같은 곡은 그대로 남습니다/);
  assert.match(source, /이 기기에만 저장되는 데모입니다/);
  assert.match(source, /ITUNES_PREVIEW_USAGE_NOTICE/);
});

test("keeps archive search compact and prioritizes the result list", async () => {
  const [source, css] = await Promise.all([
    readFile(
      new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className="page-content search-view"/);
  assert.match(source, /<h1 className="sr-only">기록 검색<\/h1>/);
  assert.match(source, /className="input search-input"\s*\n\s*type="search"/);
  assert.match(source, /className="search-tag-list" role="group"/);
  assert.match(source, /className="search-tag-more"/);
  assert.match(source, /className="dialog search-tag-dialog"/);
  assert.match(source, /tagMatch/);
  assert.match(source, /maxTags=\{2\}/);
  assert.match(source, /className="search-results-section"/);
  assert.doesNotMatch(source, /내 언어로 음악을 다시 찾기/);
  assert.doesNotMatch(source, /className="search-editor/);
  assert.ok(
    source.indexOf("search-results-section") > source.indexOf("search-tag-list"),
  );
  assert.match(css, /\.search-tag-list\s*\{[^}]*flex-wrap:\s*nowrap;[^}]*overflow-x:\s*auto;/s);
  assert.match(css, /\.search-results-section\s*\{[^}]*margin-top:\s*8px;/s);
  assert.match(css, /\.search-tag-dialog-list\s*\{[^}]*overflow-y:\s*auto;/s);
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
  assert.equal(dawnTags.length, 4);
  assert.equal(dawnTags.filter((tag) => tag.category === "period").length, 1);
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
    .filter((chapter) => chapter.name === "2026년 7월");
  assert.equal(monthlyChapters.length, 1);
  const monthlyTrackIds = archiveDomain.getCubeTracks(recaptured, monthlyChapters[0].id)
    .map((entry) => entry.track.id)
    .sort();
  assert.deepEqual(monthlyTrackIds, [firstTrack.id, secondTrack.id].sort());

  const julyPeriodTags = Object.values(recaptured.data.tags)
    .filter((tag) => tag.category === "period" && tag.label === "2026년 7월");
  assert.equal(julyPeriodTags.length, 1);
  assert.ok(
    archiveDomain.getCubeTracks(recaptured, monthlyChapters[0].id)
      .every((entry) => entry.cubeTrack.tagIds.includes(julyPeriodTags[0].id)),
  );
  assert.equal(
    Object.values(recaptured.data.tags)
      .filter((tag) => tag.category === "period" && tag.label === "2026년 8월")
      .length,
    0,
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
    .find((chapter) => chapter.name === "2025년 12월");
  assert.ok(decemberChapter);
  assert.deepEqual(
    archiveDomain.getCubeTracks(parsed.archive, decemberChapter.id)
      .map((entry) => entry.track.id),
    [track.id],
  );
  const decemberPeriodTag = Object.values(parsed.archive.data.tags)
    .find((tag) => tag.category === "period" && tag.label === "2025년 12월");
  assert.ok(decemberPeriodTag);
  assert.ok(
    archiveDomain.getCubeTracks(parsed.archive, decemberChapter.id)[0]
      .cubeTrack.tagIds.includes(decemberPeriodTag.id),
  );
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
  assert.deepEqual(assignedTagIds.slice(1), selectedTagIds);
  assert.equal(selected.data.tags[assignedTagIds[0]].category, "period");
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
  const [memorySource, managerSource, formatSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-tags.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-format.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(memorySource, /TAG_SUGGESTIONS|id="custom-tag"/);
  assert.match(memorySource, /href="\/tags"/);
  assert.match(managerSource, /id="bulk-tags"/);
  assert.match(managerSource, /\.split\(\/\[\\n,;\]\+\//);
  assert.match(
    managerSource,
    /MANUAL_TAG_CATEGORIES[^=]*=\s*\["genre", "emotion", "situation", "custom"\]/,
  );
  assert.doesNotMatch(managerSource, /"energy"|"texture"/);
  assert.match(formatSource, /custom:\s*"커스텀"/);
});

test("keeps memory editing to automatic period tags, managed tags, and memo", async () => {
  const memorySource = await readFile(
    new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url),
    "utf8",
  );

  assert.match(memorySource, /className="managed-tag-group period-tag-group"/);
  assert.match(memorySource, /추가 시기 · 자동/);
  assert.doesNotMatch(memorySource, /periodTags\.map\(\(tag\) => <button/);
  assert.doesNotMatch(memorySource, /기억한 시기|periodKind|period-tag-detail/);
  assert.match(memorySource, /className="inline-tag-composer"/);
  assert.match(memorySource, /aria-label=\{`\$\{TAG_CATEGORY_LABEL\[category\]\} 태그 추가`\}/);
  assert.match(memorySource, /<Plus aria-hidden="true"/);
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
