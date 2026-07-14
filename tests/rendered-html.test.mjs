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
  const source = await readFile(
    new URL("../app/_components/editorial-views-primary.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /className="capture-search-compact"/);
  assert.match(source, /minLength=\{1\}/);
  assert.match(source, /const \[linkDialogOpen, setLinkDialogOpen\] = useState\(false\)/);
  assert.match(source, /className="dialog link-import-dialog"/);
  assert.match(source, /aria-modal="true" aria-labelledby="link-import-title"/);
  assert.doesNotMatch(source, /<details className="capture-secondary">/);
});

test("uses whitespace and tone instead of decorative divider lines", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.doesNotMatch(
    css,
    /border-(?:top|right|bottom|left):\s*1px solid var\(--line\)/,
  );
  assert.doesNotMatch(css, /border:\s*1px solid var\(--line-strong\)/);
  assert.match(css, /\.track-list\s*{[^}]*gap:\s*4px;/s);
  assert.match(css, /\.chapter-stats\s*{[^}]*gap:\s*8px;/s);
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
    assert.equal(upstreamInit.redirect, "manual");
    assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/i);
    const payload = await response.json();
    assert.equal(payload.results[0].trackName, "Radio");
  } finally {
    globalThis.fetch = originalFetch;
  }
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
  assert.equal(withMemory.data.cubeTracks[dawnRadio.id].tagIds.length, 3);
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
  assert.equal(removed.data.tags[disposableTagId], undefined);
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
});
