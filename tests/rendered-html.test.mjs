import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

const projectRoot = new URL("../", import.meta.url);
const appleThemeMarker = "MUCHI APPLE GALLERY — final theme";

function getAppleTheme(css) {
  const markerIndex = css.lastIndexOf(appleThemeMarker);
  assert.notEqual(markerIndex, -1, "Apple theme marker must exist");
  return css.slice(markerIndex);
}

function sliceBetween(source, startMarker, endMarker, label) {
  const startIndex = source.indexOf(startMarker);
  assert.notEqual(startIndex, -1, `${label} start marker must exist`);
  if (!endMarker) return source.slice(startIndex);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(endIndex, -1, `${label} end marker must exist`);
  return source.slice(startIndex, endIndex);
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

async function loadPublicDiscoveryDomain() {
  const source = await readFile(new URL("../lib/public-discovery.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

async function loadProfileDomain() {
  const source = await readFile(new URL("../lib/profile.ts", import.meta.url), "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(output).toString("base64")}`);
}

test("server-renders a deterministic MUCHI editorial archive shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /<title>뮤키<\/title>/);
  assert.match(html, /좋아했던 음악에 태그와 기억을 더해/);
  assert.match(html, /개인 음악 아카이브/);
  assert.match(html, /href="\/capture"/);
  assert.match(html, /href="\/chapters"/);
  assert.match(html, /id="main-content" tabindex="-1"/);
  assert.match(html, /property="og:image" content="\/og\.png"/);
  assert.doesNotMatch(html, /큐브|캐릭터/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Codex is working/i);

  const componentDirectory = new URL("../app/_components/", import.meta.url);
  const componentFiles = (await readdir(componentDirectory))
    .filter((name) => /\.(?:ts|tsx)$/.test(name));
  const componentSources = await Promise.all(
    componentFiles.map((name) => readFile(new URL(name, componentDirectory), "utf8")),
  );
  assert.doesNotMatch(componentSources.join("\n"), /큐브|캐릭터/);
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
    assert.match(html, /<title>뮤키<\/title>/, pathname);
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
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);
  const appleTheme = getAppleTheme(css);

  assert.match(source, /className="capture-search-compact"/);
  assert.match(source, /<h1>곡 기록<\/h1>/);
  assert.match(source, /외부 음악에서 기록할 곡 찾기/);
  assert.match(source, /placeholder="기록할 곡이나 아티스트"/);
  assert.match(source, /type="search"/);
  assert.match(source, /minLength=\{1\}/);
  assert.match(source, /enterKeyHint="search"/);
  assert.match(source, /autoFocus/);
  assert.match(source, /data-route-autofocus/);
  assert.match(source, /className="capture-search-submit"/);
  assert.match(source, /aria-label="외부 음악 검색"/);
  assert.match(source, /<Search aria-hidden="true"/);
  assert.match(source, /const \[linkDialogOpen, setLinkDialogOpen\] = useState\(false\)/);
  assert.match(source, /className="capture-link-action"[\s\S]*?>\s*링크로 가져오기\s*<\/button>/s);
  assert.match(source, /className="dialog link-import-dialog"/);
  assert.match(source, /<h2 id="link-import-title">음악 앱에서 가져오기<\/h2>/);
  assert.match(source, /className="link-import-description"[\s\S]*?YouTube Music 또는 Apple Music 앱에서 곡을 공유/s);
  assert.doesNotMatch(source, /ADD BY LINK/);
  assert.match(source, /aria-modal="true" aria-labelledby="link-import-title"/);
  assert.doesNotMatch(source, /playlist-import-prototype|기존 플레이리스트 가져오기|MusicServiceIcon/);
  assert.doesNotMatch(source, /<details className="capture-secondary">/);
  assert.doesNotMatch(source, />CLOSE<\/Link>/);
  assert.doesNotMatch(source, /검색 및 30초 미리듣기는 iTunes에서 제공됩니다/);
  assert.doesNotMatch(source, /검색하면 곡 목록이 여기에 표시됩니다/);
  assert.match(source, /className="section-head capture-results-head"/);
  assert.match(source, /resultSource === "link" \|\| !results\.length/);
  assert.doesNotMatch(source, /: "새 음악"/);
  assert.match(source, /"찾은 음악이 없어요"/);
  assert.match(source, /className="section-label">\{results\.length\}곡/);
  assert.doesNotMatch(source, /`검색 결과 \$\{visibleResults\.length\}\$\{results\.length > SEARCH_RESULT_BATCH_SIZE/);
  assert.match(source, /const \[selectedResults, setSelectedResults\] = useState<TrackReference\[\]>\(\[\]\)/);
  assert.match(source, /selectedResults:\s*TrackReference\[\]/);
  assert.match(source, /setSelectedResults\(draft\.selectedResults\.filter/);
  assert.match(source, /className="capture-track-list"/);
  assert.match(source, /className=\{`capture-track-row\$\{selected \? " is-selected" : ""\}`\}/);
  assert.match(source, /className="capture-track-select"/);
  assert.match(source, /aria-pressed=\{selected\}/);
  assert.match(source, /selected \? <Check aria-hidden="true"[\s\S]*?: <Plus aria-hidden="true"/s);
  assert.match(source, /className="capture-floating-action"/);
  assert.match(source, /\{selectedResults\.length\}곡 기록하기/);
  assert.doesNotMatch(source, /className="capture-selection-bar"|type="checkbox"/);
  const changeQuerySource = sliceBetween(source, "function changeQuery(", "async function importLink", "changeQuery");
  assert.doesNotMatch(changeQuerySource, /setSelectedResults/);
  assert.match(source, /function saveSelectedResults\(\)/);
  assert.match(source, /text:\s*`\$\{added\}곡을 보관함에 우선 저장했어요\.`[\s\S]*?label:\s*"보관함 보기"[\s\S]*?href:\s*"\/inbox"/s);
  assert.match(source, /이미 보관함에 저장한 곡이에요\.|보관함에 우선 저장했어요\./);
  assert.match(appleTheme, /\.capture-results-count\s*\{[^}]*font-size:\s*14px !important;/s);
  assert.match(appleTheme, /\.capture-results\s*\{[^}]*margin-top:\s*var\(--apple-space-6\);/s);
  assert.match(appleTheme, /\.capture-link-action\s*\{[^}]*min-height:\s*32px;[^}]*font-size:\s*11px;/s);
  assert.match(appleTheme, /\.capture-search-form\s*\{[^}]*position:\s*relative;[^}]*display:\s*block;/s);
  assert.match(appleTheme, /\.capture-search-submit\s*\{[^}]*position:\s*absolute;[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  assert.match(appleTheme, /\.track-line\.is-selected\s*\{[^}]*border-color:\s*color-mix\(in srgb, var\(--apple-primary\) 54%, var\(--apple-hairline\)\);/s);
  assert.match(appleTheme, /\.capture-track-row\s*\{[^}]*grid-template-columns:\s*52px minmax\(0, 1fr\) 44px;/s);
  assert.match(appleTheme, /\.capture-track-select\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*border-radius:\s*50% !important;/s);
  assert.match(appleTheme, /\.capture-floating-action\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*calc\(70px \+ 12px \+ env\(safe-area-inset-bottom\)\);/s);
  assert.match(source, /muchi:reset-capture/);
  assert.match(source, /className="dialog record-dialog"/);
  assert.match(source, /className="record-dialog-track"/);
  assert.match(source, /보관함에 우선 저장/);
  assert.match(source, /자세히 기록/);
  assert.match(source, /recordMode === "chapter"/);
  assert.match(source, /곡을 기록할 챕터를 하나 이상 선택해 주세요/);
  assert.match(source, /function recordInChapter\(chapterId: string\)/);
  assert.match(source, /moveInboxTrackToCube\(captured, assigning\.id, chapterId\)/);
  assert.match(source, /setCubeTrackTagIds\(/);
  assert.match(source, /InlineChapterCreate onCreate=\{createChapterAndRecord\}/);
  assert.match(appleTheme, /\.record-dialog-track\s*\{[^}]*grid-template-columns:\s*52px minmax\(0, 1fr\);/s);
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

test("locks every viewport to the mobile device frame", async () => {
  const [shellSource, accessibilitySource, offlineSource, globalStyles, appleTheme, motionSource, mediaSource, appSource, layoutSource, dataProviderSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-accessibility.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/offline/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-motion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-media.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-data-provider.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(shellSource, /className="device-stage"/);
  assert.match(appleTheme, /--app-canvas-width:\s*430px;/);
  assert.match(appleTheme, /--app-frame-inset:\s*16px;/);
  assert.match(appleTheme, /--app-frame-radius:\s*28px;/);
  assert.match(appleTheme, /body\s*\{[^}]*overflow:\s*hidden;/s);
  assert.match(appleTheme, /\.app-shell,[\s\S]*?height:\s*100dvh;[^}]*container-type:\s*inline-size;[^}]*overflow:\s*hidden;/s);
  assert.match(appleTheme, /\.shell-main\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(appleTheme, /@media \(min-width:\s*480px\)[\s\S]*?width:\s*var\(--app-canvas-width\);[\s\S]*?height:\s*calc\(100dvh - \(var\(--app-frame-inset\) \+ var\(--app-frame-inset\)\)\);/s);
  assert.doesNotMatch(appleTheme, /@media \(min-width:\s*834px\)/);
  assert.match(shellSource, /const scrollPositions = new Map<string, number>\(\)/);
  assert.match(shellSource, /"--player-progress": Math\.min\(1, preview\.state\.currentTime \/ 30\)/);
  assert.match(appleTheme, /\.mini-player-progress\s*\{[^}]*transform:\s*scaleX\(var\(--player-progress\)\);/s);
  assert.match(shellSource, /dataset\.motionIntent === "back"[\s\S]*?scrollPositions\.get\(routeKey\)/s);
  assert.match(shellSource, /onScroll=\{\(event\) => scrollPositions\.set\(routeKey, event\.currentTarget\.scrollTop\)\}/);
  assert.match(accessibilitySource, /querySelector<HTMLElement>\("\.shell-main"\)/);
  assert.match(offlineSource, /className="device-stage"[\s\S]*?className="app-shell offline-shell"/s);
  assert.doesNotMatch(`${globalStyles}\n${appleTheme}`, /\d(?:\.\d+)?vw\b/);
  assert.match(globalStyles, /html\.has-native-transition \.editorial-header\s*\{[^}]*view-transition-name:\s*editorial-header;/s);
  assert.match(globalStyles, /html\.has-native-transition \.route-stage\s*\{[^}]*view-transition-name:\s*route-content;/s);
  assert.match(globalStyles, /html\.has-native-transition \.text-navigation\s*\{[^}]*view-transition-name:\s*editorial-navigation;/s);
  assert.match(globalStyles, /html\.has-native-transition \.has-shared-transition\s*\{[^}]*view-transition-name:\s*var\(--shared-transition-name\);/s);
  assert.match(globalStyles, /html\[data-reduce-motion="true"\] \.route-stage\s*\{[^}]*animation:\s*none !important;/s);
  assert.match(motionSource, /"--shared-transition-name": `art-\$\{key\}`/);
  assert.doesNotMatch(motionSource, /return \{ viewTransitionName:/);
  assert.doesNotMatch(motionSource, /window\.matchMedia\("\(max-width: 479px\)"\)\.matches/);
  assert.match(motionSource, /return Boolean\(transitionDocument\.startViewTransition\);/);
  assert.match(layoutSource, /<MuchiDataProvider>\{children\}<\/MuchiDataProvider>/);
  assert.match(dataProviderSource, /useState<ArchiveEnvelopeV1>\(\(\) => createEmptyArchive\(\)\)/);
  assert.match(dataProviderSource, /Promise\.all\(\[\s*fetchArchive\(\),\s*fetchOnboardingStatus\(\),\s*\]\)/s);
  assert.match(dataProviderSource, /ensureDiscoveryData[\s\S]*?Promise\.all\(\[fetchPublicDiscoveryCatalog\(\), fetchDiscoveryState\(\)\]\)/s);
  assert.match(dataProviderSource, /saveArchiveRemote\(pending\.archive, archiveRevisionRef\.current, pending\.syncPublicProjection\)/);
  assert.match(dataProviderSource, /publicProjectionSignature\(archive\) !== publicProjectionSignature\(next\)/);
  assert.match(dataProviderSource, /변경사항을 보존하고 다시 저장할게요/);
  assert.doesNotMatch(`${appSource}\n${dataProviderSource}`, /window\.localStorage/);
  assert.doesNotMatch(globalStyles, /@keyframes route-enter\s*\{\s*from \{ opacity: 0;/s);
  assert.match(mediaSource, /data-shared-transition-id=\{sharedArtworkKey\(sharedId\)\}/);
  assert.match(mediaSource, /data-shared-transition-id=\{sharedArtworkKey\(coverId\)\}/);
  assert.doesNotMatch(mediaSource, /has-shared-transition/);
  assert.match(motionSource, /markSharedTransitionElement\(sharedId, sourceElement\)/);
  assert.match(motionSource, /await navigateAndWaitForRouteCommit\(navigate\);\s*markSharedTransitionElement\(sharedId\);/s);
  assert.match(motionSource, /event\.currentTarget/);
  assert.match(motionSource, /clearSharedTransitionElements\(\)/);
  assert.match(shellSource, /transitionEditorialUI\([\s\S]*?`player-\$\{preview\.state\.track\.id\}`/s);
  assert.match(globalStyles, /::view-transition-old\(root\),[\s\S]*?::view-transition-new\(root\)\s*\{[^}]*animation:\s*none;/s);
  assert.match(globalStyles, /::view-transition-new\(route-content\)\s*\{[^}]*animation:\s*page-in/s);
  assert.match(globalStyles, /html\[data-motion-intent="tab"\] \.route-stage\s*\{[^}]*animation:\s*none;/s);
});

test("collects a validated nickname and Google avatar before onboarding completes", async () => {
  const [appSource, dataProviderSource, authSource, onboardingSource, routeSource, repositorySource, baseMigrationSource, profileMigrationSource, profileDomain] = await Promise.all([
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-data-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/auth-gate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/onboarding-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/onboarding/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/server/profile-repository.ts", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/202607200001_create_muchi_user_state.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260720070836_profile_setup_security_hardening.sql", import.meta.url), "utf8"),
    loadProfileDomain(),
  ]);

  assert.match(appSource, /onboarding && !onboarding\.completed/);
  assert.match(dataProviderSource, /saveOnboardingComplete\(nickname\)/);
  assert.match(authSource, /className="auth-gate-brand"[^>]*aria-label="뮤키"[\s\S]*?<strong>뮤키<\/strong>/s);
  assert.match(authSource, /function GoogleMark\(\)[\s\S]*?#4285F4[\s\S]*?#EA4335/s);
  assert.match(authSource, /<GoogleMark \/>Google로 시작하기/);
  assert.match(onboardingSource, /className="onboarding-mark" src="\/assets\/brand\/muchi-logo\.png" alt="뮤키"/);
  assert.match(onboardingSource, /className="onboarding-brand-name">뮤키<\/p>/);
  assert.doesNotMatch(onboardingSource, /className="onboarding-mark">MUCHI<\/span>/);
  assert.match(onboardingSource, /Google 프로필/);
  assert.match(onboardingSource, /id="onboarding-nickname"/);
  assert.doesNotMatch(onboardingSource, /탐색에 챕터를 공개하면 다른 뮤커에게/);
  assert.doesNotMatch(onboardingSource, /프로필 사진은 닉네임 설정에만 표시돼요/);
  assert.doesNotMatch(onboardingSource, /닉네임은 공개 챕터의 작성자 이름으로 사용돼요/);
  assert.match(onboardingSource, /NICKNAME_MAX_LENGTH/);
  assert.match(onboardingSource, /한글·영문·숫자·띄어쓰기만 사용/);
  assert.match(onboardingSource, /setStep\("intro"\)/);
  assert.match(onboardingSource, /기억할 곡 찾기/);
  assert.match(onboardingSource, /순간을 태그로 남기기/);
  assert.match(onboardingSource, /챕터로 음악 세계 쌓기/);
  assert.match(onboardingSource, /첫 곡 기록하기/);
  assert.match(routeSource, /requireAuthenticatedUser\(\)/);
  assert.match(routeSource, /validateNickname\(body\.nickname\)/);
  assert.match(repositorySource, /profile_setup_completed: true/);
  assert.match(baseMigrationSource, /onboarding_completed boolean not null default false/);
  assert.match(profileMigrationSource, /profile_setup_completed boolean not null default false/);
  assert.match(profileMigrationSource, /revoke execute on function public\.handle_new_user\(\) from public, anon, authenticated/);
  assert.deepEqual(profileDomain.validateNickname("  새벽   산책  "), { ok: true, nickname: "새벽 산책" });
  assert.equal(profileDomain.validateNickname("a").ok, false);
  assert.equal(profileDomain.validateNickname("뮤키✨").ok, false);
  assert.doesNotMatch(appSource, /showWelcome|빈 아카이브|샘플 보기/);
});

test("keeps the app shell visible and matches archive loading states to each primary tab", async () => {
  const [appSource, css] = await Promise.all([
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /function HomeLoadingSkeleton\(\)/);
  assert.match(appSource, /function DiscoverLoadingSkeleton\(\)/);
  assert.match(appSource, /function CaptureLoadingSkeleton\(\)/);
  assert.match(appSource, /function ChaptersLoadingSkeleton\(\)/);
  assert.match(appSource, /function SearchLoadingSkeleton\(\)/);
  assert.match(appSource, /function ArchiveLoadingState\(\{ view \}: \{ view: AppView \}\)/);
  assert.match(appSource, /case "home":[\s\S]*?return <HomeLoadingSkeleton \/>/);
  assert.match(appSource, /case "discover":[\s\S]*?return <DiscoverLoadingSkeleton \/>/);
  assert.match(appSource, /case "capture":[\s\S]*?return <CaptureLoadingSkeleton \/>/);
  assert.match(appSource, /case "chapters":[\s\S]*?return <ChaptersLoadingSkeleton \/>/);
  assert.match(appSource, /case "search":[\s\S]*?return <SearchLoadingSkeleton \/>/);
  assert.match(appSource, /role="status"[\s\S]*?aria-busy="true"/);
  assert.match(appSource, /<EditorialShell[\s\S]*?<ArchiveLoadingState view=\{view\} \/>/);
  assert.match(appSource, /function LoadingSpinner\(/);
  assert.match(appSource, /default:[\s\S]*?return <LoadingSpinner \/>/);
  assert.doesNotMatch(appSource, /<div className="archive-boot" role="status">/);
  assert.doesNotMatch(appSource, /나의 음악 기록을 펼치고 있어요/);
  assert.match(css, /\.archive-skeleton-shape::after\s*\{[^}]*animation:\s*archive-skeleton-shimmer/s);
  assert.match(css, /\.loading-spinner-screen\s*\{[^}]*place-items:\s*center/s);
  assert.match(css, /@keyframes archive-skeleton-shimmer/);
});

test("keeps app data in memory across routes and skips unchanged public sync writes", async () => {
  const [providerSource, motionSource] = await Promise.all([
    readFile(new URL("../app/_components/muchi-data-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-motion.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(providerSource, /const STALE_AFTER_MS = 60_000;/);
  assert.match(providerSource, /pendingArchiveRef\.current = \{ archive: next, message, syncPublicProjection \}/);
  assert.match(providerSource, /while \(pendingArchiveRef\.current\)/);
  assert.match(providerSource, /if \(discoveryPromiseRef\.current\) return discoveryPromiseRef\.current;/);
  assert.doesNotMatch(providerSource, /window\.(?:localStorage|sessionStorage)/);
  assert.match(providerSource, /publicProjectionSignature\(archive\) !== publicProjectionSignature\(next\)/);
  assert.match(motionSource, /router\.prefetch\(href\)/);
});

test("keeps mobile archive controls legible, aligned, and touch friendly", async () => {
  const [appleTheme, globalStyles, motionSource, discoverySource, chapterSource] = await Promise.all([
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-motion.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
  ]);
  const styles = `${globalStyles}\n${appleTheme}`;

  assert.doesNotMatch(appleTheme, /\.track-line \.track-actions[^}]*font-size:\s*0;/s);
  assert.doesNotMatch(appleTheme, /\.track-line \.track-actions[^\n]*::first-letter/);
  assert.match(appleTheme, /\.track-line\s*\{[^}]*--track-cover-size:\s*80px;/s);
  assert.match(appleTheme, /\.track-line \.track-art\s*\{[^}]*width:\s*var\(--track-cover-size\);[^}]*height:\s*var\(--track-cover-size\);/s);
  assert.match(appleTheme, /\.tag-manager-row\.tag-manager-edit\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/s);
  assert.match(appleTheme, /\.chapter-choice\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*22px 58px minmax\(0, 1fr\) auto;/s);
  assert.match(appleTheme, /\.chapter-choice \.track-info\s*\{[^}]*grid-column:\s*3;/s);
  assert.match(appleTheme, /\.page-header-actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/s);
  assert.match(appleTheme, /\.shell-main\s*\{[^}]*scrollbar-width:\s*none;/s);
  assert.match(appleTheme, /--apple-ink-muted-48:\s*#6e6e73;/);
  assert.match(styles, /\.chapter-detail-compact \.chapter-actions \.button,[\s\S]*?min-height:\s*34px;[\s\S]*?padding:\s*5px 11px;/s);
  assert.match(styles, /\.chapter-detail-compact \.chapter-actions \.button::after,[\s\S]*?inset:\s*-5px 0;/s);
  assert.match(styles, /\.chapter-detail-compact \.chapter-service-link\s*\{[^}]*width:\s*34px;[^}]*min-height:\s*34px;/s);
  assert.match(styles, /\.chapter-detail-compact \.chapter-service-link\s*\{[^}]*justify-content:\s*center;/s);
  assert.match(styles, /\.chapter-detail-compact \.chapter-service-link::after\s*\{[^}]*inset:\s*-3px;/s);
  assert.match(styles, /\.chapter-memory-link\s*\{[^}]*min-height:\s*30px;[^}]*border:\s*0;/s);
  assert.match(styles, /\.chapter-compact-track-manage button\s*\{[^}]*min-height:\s*44px;/s);
  assert.doesNotMatch(appleTheme, /\.playlist-track-toggle\s*\{/);
  assert.match(appleTheme, /\.playlist-match-actions \.text-button\s*\{[^}]*min-width:\s*36px;[^}]*min-height:\s*34px;/s);
  assert.match(appleTheme, /\.chapter-library-create\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*display:\s*inline-grid;[^}]*place-items:\s*center;[^}]*gap:\s*0;[^}]*border-radius:\s*8px !important;[^}]*background:\s*transparent;/s);
  assert.match(chapterSource, /className="button button-primary chapter-library-create"[\s\S]*?aria-label="새 챕터"[\s\S]*?<Plus aria-hidden="true" size=\{16\} \/>/s);
  assert.match(appleTheme, /\.chapter-library-delete\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*border-radius:\s*8px !important;[^}]*color:\s*var\(--apple-canvas\);[^}]*background:\s*rgba\(23, 19, 15, 0\.72\);/s);
  assert.match(appleTheme, /\.tag-picker-create button\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;[^}]*border-radius:\s*8px !important;/s);
  assert.match(appleTheme, /\.playlist-name-field \.input\s*\{[^}]*font-size:\s*17px;/s);
  assert.match(motionSource, /\.find\(\(candidate\) => !candidate\.closest\("\.sr-only"\)\)/);
  assert.match(motionSource, /querySelector<HTMLElement>\("\.route-stage \[data-route-autofocus\]"\)/);
  assert.match(discoverySource, /<PageHeader[\s\S]*?eyebrow="회고"[\s\S]*?title=\{label\[mode\]\}/s);
  assert.doesNotMatch(appleTheme, /\.track-info \.tag-row\s*\{\s*display:\s*none;/s);
});

test("uses Apple typography, whitespace, and flat mobile surfaces", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /body\s*\{[^}]*font-family:\s*var\(--apple-font-text\);[^}]*font-size:\s*15px;[^}]*line-height:\s*1\.42;/s);
  assert.match(appleTheme, /h1,\s*h2,\s*h3\s*\{[^}]*font-family:\s*var\(--apple-font-display\);[^}]*font-weight:\s*600;/s);
  assert.match(appleTheme, /\.editorial-header\s*\{[^}]*height:\s*44px;[^}]*background:\s*var\(--apple-surface-black\);/s);
  assert.match(appleTheme, /\.page-content\s*\{[^}]*padding:\s*var\(--apple-space-6\) var\(--apple-page-gutter\)/s);
  assert.match(appleTheme, /\.centered-empty-message\s*\{[^}]*min-height:\s*min\(42dvh, 320px\);[^}]*place-items:\s*center;[^}]*color:\s*var\(--apple-ink-muted-48\);/s);
  assert.match(appleTheme, /@container muchi-app \(max-width:\s*419px\)[\s\S]*?h1\s*\{[^}]*font-size:\s*26px;/s);
});

test("keeps toast messages compact below the fixed mobile header", async () => {
  const [css, shellSource, typesSource] = await Promise.all([
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-types.ts", import.meta.url), "utf8"),
  ]);
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /\.toast\s*\{[^}]*top:\s*calc\(56px \+ env\(safe-area-inset-top\)\);[^}]*bottom:\s*auto;[^}]*width:\s*min\(420px, calc\(100% - 32px\)\);/s);
  assert.match(appleTheme, /\.toast\s*\{[^}]*border-radius:\s*var\(--apple-radius-pill\) !important;[^}]*pointer-events:\s*none;/s);
  assert.match(appleTheme, /\.toast-with-action\s*\{[^}]*pointer-events:\s*auto;/s);
  assert.match(appleTheme, /\.toast-action\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px;/s);
  assert.doesNotMatch(appleTheme, /\.app-shell\.has-player \.toast/);
  assert.match(typesSource, /export type ToastMessage\s*=\s*\| string/);
  assert.match(shellSource, /typeof toast === "string"/);
  assert.match(shellSource, /target="_blank"[\s\S]*?rel="noopener noreferrer"/s);
});

test("renders toast and player actions only for safe destinations", async () => {
  const shellSource = await readFile(
    new URL("../app/_components/editorial-shell.tsx", import.meta.url),
    "utf8",
  );

  assert.match(shellSource, /function safeExternalHref[\s\S]*?new URL\(value\)[\s\S]*?url\.protocol === "https:"/s);
  assert.match(shellSource, /function safeInternalHref[\s\S]*?value\.startsWith\("\/"\)[\s\S]*?!value\.startsWith\("\/\/"\)/s);
  assert.match(shellSource, /const externalHref = safeExternalHref\(preview\.state\.track\.externalUrl\)/);
  assert.match(shellSource, /const actionHref = toast\.action[\s\S]*?safeExternalHref\(toast\.action\.href\)[\s\S]*?safeInternalHref\(toast\.action\.href\)/s);
  assert.match(shellSource, /toast\.action && actionHref/);
  assert.doesNotMatch(shellSource, /href=\{toast\.action\.href\}/);
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
  assert.match(source, /className="brand-lockup"[^>]*aria-label="뮤키 홈"[\s\S]*?className="brand-lockup-mark" src="\/assets\/brand\/muchi-logo\.png"[\s\S]*?<strong>뮤키<\/strong>/s);
  assert.doesNotMatch(source, /href="\/settings"[^>]*>SETTINGS<\/Link>/s);
});

test("keeps settings actions in compact, consistent rows", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);
  const settingsSource = source.slice(source.indexOf("export function Settings("));

  assert.match(settingsSource, /className="select setting-motion-select"/);
  assert.doesNotMatch(settingsSource, /내 기록 백업<\/h3><p>|아카이브 초기화<\/h3><p>|로그아웃<\/h3><p>/);
  assert.match(settingsSource, /onClick=\{replace\}>초기화<\/button>/);
  assert.match(css, /\.setting-row\s*\{[^}]*height:\s*72px;[^}]*min-height:\s*72px;[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;[^}]*padding:\s*0 14px;/s);
  assert.match(css, /\.settings-list\s*\{[^}]*display:\s*grid;[^}]*gap:\s*0;/s);
  assert.match(css, /\.setting-row \.button\s*\{[^}]*min-height:\s*40px;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.setting-motion-select\s*\{[^}]*width:\s*170px;[^}]*min-height:\s*40px;/s);
});

test("connects onboarding, the settings guide, and first-record hints", async () => {
  const [appSource, settingsSource, captureSource, guideSource, guideRouteSource] = await Promise.all([
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-guide.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/guide/page.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(settingsSource, /뮤키 사용 방법[\s\S]*?href="\/guide"/s);
  assert.match(appSource, /case "guide":[\s\S]*?<Guide \/>/s);
  assert.match(appSource, /router\.replace\("\/capture\?guide=1", "replace"\)/);
  assert.match(appSource, /guideMode=\{searchParams\.get\("guide"\) === "1"\}/);
  assert.match(captureSource, /className="capture-mini-guide"/);
  assert.match(captureSource, /className="record-tag-guide"/);
  assert.match(guideSource, /YouTube Music[\s\S]*?가져오기[\s\S]*?지원/s);
  assert.match(guideSource, /Apple Music[\s\S]*?내보내기[\s\S]*?준비 중/s);
  assert.match(guideSource, /Spotify[\s\S]*?미지원/s);
  assert.match(guideSource, /Android PWA[\s\S]*?YouTube Music[\s\S]*?뮤키/s);
  assert.match(guideSource, /iPhone \/ iPad[\s\S]*?직접 선택하는 공유는 아직 지원하지 않아요/s);
  assert.match(guideSource, /href="\/capture\?guide=1"/);
  assert.match(guideRouteSource, /MusicWorldApp view="guide"/);
});

test("keeps the global header stable and places contextual back actions inside secondary content", async () => {
  const [shellSource, appSource, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(shellSource, /export type ContextBackAction[\s\S]*?label: string; href: string[\s\S]*?label: string; onActivate:/s);
  assert.match(shellSource, /function ContextBackControl/);
  assert.match(shellSource, /<Link className="content-back-button" href=\{action\.href\} intent="back"/);
  assert.match(shellSource, /<button className="content-back-button"[^>]*onClick=\{action\.onActivate\}/);
  assert.doesNotMatch(shellSource, /className="header-back-button"/);
  assert.equal((appSource.match(/backAction=\{contextBackAction\}/g) ?? []).length, 2);
  assert.match(appSource, /case "discoverChapter":[\s\S]*?label: "탐색으로", href: "\/discover"/s);
  assert.match(appSource, /case "memory":[\s\S]*?href: `\/chapter\?id=\$\{encodeURIComponent\(requestedMemoryChapter\.id\)\}`/s);
  assert.match(appSource, /case "search":[\s\S]*?fromMemoryId[\s\S]*?label: "곡 기록으로"/s);
  assert.match(appSource, /case "playlist":[\s\S]*?label: "이전 단계"[\s\S]*?onActivate:/s);
  assert.doesNotMatch(appSource, /router\.back\(\)/);
  assert.match(css, /\.content-back-row\s*\{[^}]*min-height:\s*44px;/s);
  assert.match(css, /\.content-back-button\s*\{[^}]*min-height:\s*40px;[^}]*background:\s*transparent;/s);
  assert.match(css, /\.content-back-button:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--apple-primary-focus\);/s);
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
  assert.match(design, /High1WonchuriTitle/);
  assert.match(design, /Body copy at 17px/);
  assert.match(design, /single product shadow only to product or album photography/i);
  assert.match(design, /Minimum 44 × 44px/);
});

test("applies the closed Apple palette and High1 Wonchuri typography", async () => {
  const [css, globals] = await Promise.all([
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const appleTheme = getAppleTheme(css);
  const palette = [...new Set(
    (appleTheme.match(/#[0-9a-f]{6}/gi) ?? []).map((color) => color.toLowerCase()),
  )].sort();

  for (const color of [
    "#000000", "#0066cc", "#0071e3", "#1d1d1f", "#252527", "#272729",
    "#2997ff", "#6e6e73", "#cccccc", "#d2d2d7", "#e0e0e0",
    "#f0f0f0", "#f5f5f7", "#fafafc", "#ffffff",
  ]) assert.ok(palette.includes(color), color);
  for (const legacyAccent of ["#e91d2a", "#fcc20f", "#0000ee"]) {
    assert.ok(!palette.includes(legacyAccent), legacyAccent);
  }
  assert.match(appleTheme, /--apple-font-display:\s*"High1WonchuriTitle",\s*sans-serif/);
  assert.match(appleTheme, /--apple-font-text:\s*"High1WonchuriTitle",\s*sans-serif/);
  assert.match(globals, /high1WonchuriTitleL\.woff2[\s\S]*?font-weight:\s*300/);
  assert.match(globals, /high1WonchuriTitleM\.woff2[\s\S]*?font-weight:\s*500/);
  assert.match(globals, /high1WonchuriTitleB\.woff2[\s\S]*?font-weight:\s*700/);
  assert.match(globals, /--font-sans:\s*"High1WonchuriTitle",\s*sans-serif/);
  assert.match(globals, /--font-serif:\s*"High1WonchuriTitle",\s*sans-serif/);
  assert.match(appleTheme, /--apple-product-shadow:\s*rgba\(0, 0, 0, 0\.22\) 3px 5px 30px 0;/);
});

test("keeps common controls readable and touch friendly", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /\.button,[\s\S]*?\.tag-picker-create-trigger\s*\{[^}]*min-height:\s*36px;[^}]*border-radius:\s*10px !important;/s);
  assert.match(appleTheme, /\.icon-button,[\s\S]*?\.preview-icon-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
  assert.match(appleTheme, /\.button:active,[\s\S]*?button\.tag:active\s*\{[^}]*transform:\s*scale\(0\.95\);/s);
  assert.match(appleTheme, /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--apple-primary-focus\);/s);
});

test("uses filled hover feedback instead of underline animations", async () => {
  const [css, globals] = await Promise.all([
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /\.header-links a::after,[\s\S]*?\.text-link::after\s*\{[^}]*content:\s*none;/s);
  assert.match(appleTheme, /\.header-links a:not\(:disabled\):hover,[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.14\);/s);
  assert.match(appleTheme, /\.text-link:not\(:disabled\):hover,[\s\S]*?background:\s*color-mix\(in srgb, var\(--apple-primary\) 8%, transparent\);/s);
  assert.match(globals, /\.chapter-memory-link:hover,[\s\S]*?background:\s*color-mix\(in srgb, var\(--apple-primary\) 8%, transparent\);/s);
  assert.doesNotMatch(globals, /\.chapter-memory-link:hover,[\s\S]*?text-decoration:\s*underline;/s);
});

test("keeps compact Korean navigation inside the mobile shell", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /home:\s*"홈"/);
  assert.match(source, /chapters:\s*"챕터"/);
  assert.match(source, /capture:\s*"기록"/);
  assert.match(source, /search:\s*"찾기"/);
  assert.match(source, /item === "search" \? "내 기록 찾기"/);
  assert.match(source, /className="text-navigation icon-label-nav"/);
  const appleTheme = getAppleTheme(css);
  assert.match(appleTheme, /\.footer-band\s*\{[^}]*position:\s*relative;[^}]*min-height:\s*calc\(70px \+ env\(safe-area-inset-bottom\)\);[^}]*backdrop-filter:\s*saturate\(180%\) blur\(20px\) !important;/s);
});

test("anchors modal backdrops to the mobile app frame", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /\.dialog-backdrop,[\s\S]*?\.player-backdrop\s*\{[^}]*position:\s*fixed;[^}]*inset:\s*0;/s);
  assert.match(appleTheme, /\.dialog,[\s\S]*?\.tag-picker-panel\s*\{[^}]*border:\s*1px solid var\(--apple-hairline\);[^}]*border-radius:\s*var\(--apple-radius-lg\) !important;[^}]*box-shadow:\s*none !important;/s);
});

test("keeps dialog semantics on the focused surface instead of the backdrop", async () => {
  const paths = [
    "editorial-shell.tsx",
    "editorial-views-primary.tsx",
    "editorial-views-chapters.tsx",
    "editorial-views-discovery.tsx",
    "editorial-views-tags.tsx",
    "muchi-app.tsx",
  ];
  const sources = await Promise.all(paths.map((name) => readFile(
    new URL(`../app/_components/${name}`, import.meta.url),
    "utf8",
  )));
  const source = sources.join("\n");

  assert.doesNotMatch(source, /className="(?:dialog|welcome|player)-backdrop"[^>]*role="(?:dialog|alertdialog)"/);
  assert.match(source, /className="dialog[^"\n]*" role="dialog" aria-modal="true"/);
  assert.doesNotMatch(source, /welcome-backdrop|welcome-card/);
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

  assert.ok((searchSource.match(/className="track-list track-list-unified"/g) ?? []).length >= 1);
  assert.match(addSource, /className="capture-track-list"/);
  assert.doesNotMatch(chapterSource, /className="track-list track-list-unified"/);
  assert.match(chapterSource, /className="chapter-compact-track-list"/);
  assert.match(chapterSource, /className="chapter-compact-track-copy"/);
  assert.match(chapterSource, /<strong>\{item\.track\.title\}<\/strong>[\s\S]*?<span>\{item\.track\.artist\}<\/span>/);
  assert.match(chapterSource, /aria-expanded=\{expanded\}/);
  assert.match(chapterSource, /setExpandedTrackId/);
  assert.match(chapterSource, /className="chapter-memory-link"/);
  assert.match(chapterSource, /const canExpand = item\.collapsible \?\? !item\.privateRecord/);
  assert.match(chapterSource, /className="chapter-compact-track-toggle is-static"/);
  assert.match(chapterSource, /item\.tags\.slice\(0, 6\)/);
  assert.doesNotMatch(globals, /@media \(max-width:\s*0px\)/);
  assert.match(globals, /\/\* Chapter detail — compact expandable track list/);
  assert.match(globals, /\.chapter-compact-track-main\s*\{[^}]*min-height:\s*54px;/s);
  assert.match(globals, /\.chapter-compact-track-detail\s*\{[^}]*grid-template-rows:\s*0fr;/s);
  assert.match(globals, /\.chapter-compact-track\.is-expanded \.chapter-compact-track-detail\s*\{[^}]*grid-template-rows:\s*1fr;/s);
  assert.match(globals, /\.chapter-compact-track-tags\s*\{[^}]*gap:\s*5px;[^}]*padding:\s*6px 8px 10px 52px;/s);
  assert.match(globals, /\.chapter-compact-track-tags a,[\s\S]*?\.chapter-compact-track-tags span\s*\{[^}]*min-height:\s*28px;[^}]*border-radius:\s*999px;[^}]*text-decoration:\s*none;/s);
  assert.match(globals, /\.chapter-memory-link\s*\{[^}]*min-height:\s*30px;[^}]*border:\s*0;/s);
});

test("offers nested chapter creation and navigation inside chapter detail", async () => {
  const [chapterSource, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(chapterSource, /getChildCubes/);
  assert.match(chapterSource, /parentId:\s*activeChapter\.id/);
  assert.doesNotMatch(chapterSource, /className="chapter-breadcrumbs"/);
  assert.match(chapterSource, /id="child-chapters-title">하위 챕터<\/h2>/);
  assert.match(chapterSource, /\{!monthlyChapter \? \(\s*<section className="child-chapter-section"/s);
  assert.doesNotMatch(chapterSource, /하위 챕터 · \{childChapters\.length\}/);
  assert.match(chapterSource, /className="text-button compact-section-action"[\s\S]*?>\s*<Plus size=\{15\} aria-hidden="true" \/>\s*추가/s);
  assert.match(chapterSource, /className="child-chapter-list"/);
  assert.match(chapterSource, /getUserVisibleChapters\(archive\)/);
  assert.match(css, /\.child-chapter-row\s*\{[^}]*grid-template-columns:/s);
  assert.doesNotMatch(css, /\.chapter-breadcrumbs\s*\{/);
  assert.match(
    css,
    /\.child-chapter-dialog \.dialog-actions\s*\{[^}]*position:\s*sticky;[^}]*bottom:\s*0;/s,
  );
  assert.match(css, /\.child-chapter-dialog\s*\{[^}]*scroll-padding-bottom:\s*calc\(88px \+ env\(safe-area-inset-bottom\)\);/s);
  assert.match(css, /\.child-chapter-dialog \.dialog-actions\s*\{[^}]*padding:\s*12px var\(--apple-space-2\) env\(safe-area-inset-bottom\);/s);
  assert.match(css, /@container muchi-app \(max-width:\s*430px\)[\s\S]*?\.child-chapter-dialog\s*\{[^}]*padding-bottom:\s*var\(--apple-space-5\);/s);
});

test("keeps chapter actions compact and puts playlist import before the track list", async () => {
  const [chapterSource, deleteSource, appleTheme] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-chapter-delete-dialog.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);
  const chapterDetail = sliceBetween(chapterSource, "export function ChapterDetail(", "export function MemoryPanel(", "ChapterDetail source");

  assert.match(chapterDetail, /utilities=\{entries\.length \? <ChapterPlaylistActions chapterId=\{chapter\.id\} \/>/);
  assert.match(chapterDetail, /meta=\{`\$\{entries\.length\}곡`\}/);
  assert.doesNotMatch(chapterDetail, /개 태그|개 메모/);
  assert.doesNotMatch(chapterDetail, /챕터 ·/);
  assert.doesNotMatch(chapterDetail, /href="\/capture" intent="modal">곡 기록<\/Link>/);
  assert.match(chapterDetail, /className="chapter-menu-trigger"/);
  assert.match(chapterDetail, /className="chapter-menu-popover" role="menu"/);
  assert.doesNotMatch(chapterDetail, /chapter-management-panel/);
  assert.match(chapterDetail, /곡 순서 변경/);
  assert.match(chapterDetail, />챕터 정보 수정<\/button>/);
  assert.match(chapterDetail, />챕터 삭제<\/button>/);
  assert.match(chapterDetail, /title="수록곡"[\s\S]*?className="text-button compact-section-action"/s);
  assert.match(deleteSource, /className="dialog chapter-removal-dialog"/);
  assert.match(appleTheme, /\.chapter-library-delete\s*\{[^}]*color:\s*var\(--apple-canvas\);[^}]*background:\s*rgba\(23, 19, 15, 0\.72\);/s);
  assert.match(appleTheme, /\.chapter-removal-dialog\s*\{[^}]*align-self:\s*center;[^}]*width:\s*min\(calc\(100% - 40px\), 360px\);/s);
});

test("shares chapter hierarchy choices, fields, and delete confirmation across flows", async () => {
  const [chapterSource, primarySource, fieldsSource, deleteSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-chapter-fields.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-chapter-delete-dialog.tsx", import.meta.url), "utf8"),
  ]);

  assert.equal((chapterSource.match(/<ChapterFields/g) ?? []).length, 3);
  assert.equal((chapterSource.match(/<ChapterDeleteDialog/g) ?? []).length, 2);
  assert.equal((primarySource.match(/<ChapterChoice/g) ?? []).length, 2);
  assert.equal((chapterSource.match(/<ChapterChoice/g) ?? []).length, 1);
  assert.match(primarySource, /getCubesInTreeOrder\(archive\)/);
  assert.match(chapterSource, /getCubesInTreeOrder\(archive\)/);
  assert.doesNotMatch(`${primarySource}\n${chapterSource}`, /chapterPathLabel|className="chapter-choice"/);
  assert.match(fieldsSource, /ARCHIVE_LIMITS\.cubeName/);
  assert.match(fieldsSource, /ARCHIVE_LIMITS\.cubeDescription/);
  assert.doesNotMatch(fieldsSource, /onColorChange|CUBE_COLORS|COLOR_HEX|COLOR_LABEL/);
  assert.match(fieldsSource, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(fieldsSource, /prepareCoverImage/);
  assert.match(fieldsSource, /onCoverImageChange\(await prepareCoverImage\(file\)\)/);
  assert.match(deleteSource, /role="alertdialog"/);
  assert.match(deleteSource, /하위 챕터.*한 단계 위로 이동해 그대로 남습니다/);
});

test("keeps the Inbox on a compact static track pattern with a swipeable chapter sheet", async () => {
  const [primarySource, chapterSource, uiSource, appleTheme, globalStyles] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const inboxSource = sliceBetween(primarySource, "export function Inbox(", undefined, "Inbox source");

  assert.match(primarySource, /import \{ ChapterTrackSection \} from "\.\/editorial-views-chapters"/);
  assert.match(inboxSource, /<ChapterTrackSection/);
  assert.match(inboxSource, /action:\s*\(/);
  assert.match(inboxSource, /selectedTrackIds/);
  assert.match(inboxSource, /inbox-track-select/);
  assert.match(inboxSource, /selectedTrackIdList\.length === 1/);
  assert.match(inboxSource, /deleteSelectedTracks/);
  assert.match(inboxSource, /챕터 넣기/);
  assert.match(inboxSource, /assignmentTrackIds\.length > 1/);
  assert.match(inboxSource, /assignmentTrackIds\.map\(\(trackId\)/);
  assert.match(chapterSource, /pendingTrackIds\?: TrackId\[\]/);
  assert.match(chapterSource, /linkedTracks\.length > 1/);
  assert.doesNotMatch(inboxSource, /detailActions:\s*\(/);
  assert.match(inboxSource, /collapsible:\s*false/);
  assert.doesNotMatch(inboxSource, /<TrackLine/);
  assert.match(inboxSource, />\s*삭제\s*<\/button>/);
  assert.match(inboxSource, />\s*기록\s*<\/button>/);
  assert.doesNotMatch(inboxSource, /commit\(removeInboxTrack\(archive, track\.id\)/);
  assert.match(inboxSource, /useSwipeableBottomSheet\(/);
  assert.match(inboxSource, /className=\{`dialog inbox-chapter-sheet is-swipeable-sheet/);
  assert.match(inboxSource, /className="inbox-chapter-sheet-scroll" data-bottom-sheet-scroll="true"/);
  assert.match(inboxSource, /aria-label="챕터 선택 시트 높이 변경"/);
  assert.match(inboxSource, /className="inbox-chapter-sheet-footer"/);
  assert.match(inboxSource, /showSelectionLabel=\{false\}/);
  assert.match(chapterSource, /detailActions\?: ReactNode/);
  assert.match(chapterSource, /collapsible\?: boolean/);
  assert.match(chapterSource, /const canExpand = item\.collapsible \?\? !item\.privateRecord/);
  assert.match(chapterSource, /const inlineSummary = item\.collapsible === false \? item\.summary : null/);
  assert.match(chapterSource, /className="chapter-compact-track-detail-actions"/);
  assert.match(uiSource, /showSelectionLabel = true/);
  assert.match(uiSource, /showSelectionLabel \? <em>선택<\/em> : null/);
  assert.match(appleTheme, /\.inbox-chapter-sheet\s*\{[^}]*display:\s*grid;[^}]*grid-template-rows:\s*minmax\(0, 1fr\) auto;[^}]*overflow:\s*hidden;/s);
  assert.match(appleTheme, /\.inbox-chapter-sheet-scroll\s*\{[^}]*overflow-y:\s*auto;/s);
  assert.match(appleTheme, /\.inbox-chapter-sheet-footer\s*\{[^}]*position:\s*relative;[^}]*border-top:/s);
  assert.match(appleTheme, /\.is-swipeable-sheet\s*\{[^}]*overscroll-behavior:\s*contain;[^}]*transition:\s*transform/s);
  assert.match(appleTheme, /\.inbox-chapter-sheet\.is-swipeable-sheet\s*\{[^}]*grid-template-rows:\s*auto minmax\(0, 1fr\) auto;/s);
  assert.match(appleTheme, /\.inbox-track-actions\s*\{[^}]*display:\s*flex;[^}]*gap:\s*6px;/s);
  assert.match(appleTheme, /\.inbox-selection-actions\s*\{[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;[^}]*justify-content:\s*flex-end;/s);
  assert.match(appleTheme, /\.inbox-selection-actions \.button\s*\{[^}]*min-height:\s*36px;[^}]*white-space:\s*nowrap;/s);
  assert.match(globalStyles, /\.chapter-compact-track-toggle\.is-static\s*\{[^}]*grid-template-columns:\s*40px minmax\(0, 1fr\);[^}]*cursor:\s*default;/s);
  assert.match(globalStyles, /\.chapter-compact-track-copy > small\s*\{[^}]*font-size:\s*10px;/s);
  assert.match(appleTheme, /\.text-button:not\(:disabled\):hover,[\s\S]*?background:\s*color-mix/s);
});

test("does not ask for a visual color while creating chapters", async () => {
  const chapterSource = await readFile(
    new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url),
    "utf8",
  );
  const rootCreateDialog = sliceBetween(
    chapterSource,
    'aria-labelledby="create-chapter-title"',
    "{deleteTarget ? (",
    "root chapter create dialog",
  );
  const childCreateDialog = sliceBetween(
    chapterSource,
    'aria-labelledby="create-child-chapter-title"',
    "{deletingCurrent ? (",
    "child chapter create dialog",
  );

  assert.doesNotMatch(rootCreateDialog, /color=|onColorChange=/);
  assert.doesNotMatch(childCreateDialog, /color=|onColorChange=/);
  const editChapterDialog = sliceBetween(
    chapterSource,
    'aria-labelledby="edit-chapter-title"',
    '{creatingChild ? (',
    "chapter edit dialog",
  );
  assert.doesNotMatch(editChapterDialog, /color=|onColorChange=/);
  assert.match(editChapterDialog, /<h2 id="edit-chapter-title">챕터 정보<\/h2>/);
  assert.match(chapterSource, /createCube\(archive, \{ name, description, coverImageUrl, visibility \}\)/);
  assert.match(chapterSource, /color: activeChapter\.color,/);
  assert.match(rootCreateDialog, /onCoverImageChange=\{setCoverImageUrl\}/);
  assert.match(childCreateDialog, /onCoverImageChange=\{setChildCoverImageUrl\}/);
  assert.match(rootCreateDialog, /onVisibilityChange=\{setVisibility\}/);
  assert.match(childCreateDialog, /onVisibilityChange=\{setChildVisibility\}/);
  assert.doesNotMatch(chapterSource, /탐색에서 내리기|탐색에 공개하기/);
});

test("removes selectors for retired chapter, community, and tag interfaces", async () => {
  const styles = (await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ])).join("\n");

  assert.doesNotMatch(
    styles,
    /\.(?:chapter-index[\w-]*|chapter-number|chapter-delete|chapter-stage[\w-]*|chapter-lp-[\w-]*|home-discovery[\w-]*|home-monthly[\w-]*|community-[\w-]*|inline-tag-[\w-]*|period-tag-group|tag-kind|tag-remove|chapter-back|meta-row|managed-tag-groups?|managed-tag-option)\b/,
  );
});

test("shows chapters as a sortable playlist-folder grid", async () => {
  const [source, formatSource, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-format.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(source, /useEmblaCarousel|chapter-carousel|chapter-stage-controls/);
  assert.match(source, /className="chapter-library-tabs" aria-label="챕터 종류"/);
  assert.match(source, />내가 만든 챕터<\/button>/);
  assert.match(source, />월별 챕터<\/button>/);
  assert.match(source, /isMonthlyChapter\(chapter\)/);
  assert.match(source, /className="chapter-library-sort"/);
  assert.match(source, /<option value="recent">최근 활동<\/option>/);
  assert.match(source, /<option value="tracks">곡 많은 순<\/option>/);
  assert.match(source, /className="chapter-library-grid"/);
  assert.match(source, /className="chapter-library-card"/);
  assert.match(source, /<ChapterCover archive=\{archive\} chapter=\{chapter\} \/>/);
  assert.match(formatSource, /export function formatChapterTitle/);
  assert.match(source, /formatChapterTitle\(chapter\)/);
  assert.match(css, /\.chapter-library-grid\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/s);
  assert.match(css, /\.chapter-library-cover\s*\{[^}]*aspect-ratio:\s*1;/s);
  assert.equal(
    (css.match(/\.chapter-library-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/gs) ?? []).length,
    1,
  );
  assert.match(css, /\.chapter-library-copy strong\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.chapter-library-copy strong\s*\{[^}]*font-size:\s*14px;/s);
  assert.doesNotMatch(source, /내 챕터"\s*:\s*"월별 챕터"|내 챕터"} ·|월별 챕터"} ·/);
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

test("keeps destructive chapter actions managed and Inbox actions visible in each track row", async () => {
  const [primarySource, chapterSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
  ]);

  const inboxSource = sliceBetween(primarySource, "export function Inbox(", undefined, "Inbox source");
  assert.doesNotMatch(inboxSource, /const \[managing, setManaging\] = useState\(false\)|목록 관리/);
  assert.match(inboxSource, /action:\s*\([\s\S]*?button-danger[\s\S]*?>\s*삭제\s*<\/button>/s);
  assert.match(inboxSource, /<ChapterTrackSection/);
  assert.match(chapterSource, /const \[managing, setManaging\] = useState\(false\)/);
  assert.match(chapterSource, /className="chapter-menu-trigger"/);
  assert.match(chapterSource, /managing \? "곡 순서 변경 완료" : "곡 순서 변경"/);
  assert.match(chapterSource, /className="chapter-compact-track-manage"/);
  assert.match(chapterSource, /: \(\s*<Link className="chapter-memory-link"[^>]*>기억 열기<\/Link>/s);
});

test("defers new memory tags until the memory form is saved", async () => {
  const source = await readFile(
    new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url),
    "utf8",
  );
  const addTagSource = source.slice(source.indexOf("function addTag("), source.indexOf("function clearDraft("));
  const saveSource = source.slice(source.indexOf("function persist("), source.indexOf("function addToOtherChapter("));

  assert.match(source, /const \[pendingTags, setPendingTags\] = useState<TagDefinition\[\]>\(\[\]\)/);
  assert.match(addTagSource, /createTags\(archive, \[label\]\)/);
  assert.match(addTagSource, /setPendingTags/);
  assert.doesNotMatch(addTagSource, /commit\(/);
  assert.match(saveSource, /createTags\(archive, selectedPendingLabels\)/);
  assert.match(saveSource, /setCubeTrackTagIds\(created\.archive/);
  assert.doesNotMatch(saveSource, /updateCubeTrack\(/);
  assert.doesNotMatch(saveSource, /\bcharacter\b|\bmemoryPeriod\b/);
  assert.match(saveSource, /commit\(next/);
});

test("keeps the archive-first mobile flow free of duplicate navigation and dead view props", async () => {
  const [shellSource, accessibilitySource, appSource, uiSource, chapterSource, playlistSource, primarySource, discoverySource, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-accessibility.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-ui.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-playlist.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(appSource, /hydrated=\{hydrated\}/);
  assert.doesNotMatch(`${chapterSource}\n${playlistSource}`, /hydrated:\s*boolean|!hydrated/);
  assert.doesNotMatch(`${uiSource}\n${primarySource}\n${discoverySource}\n${playlistSource}`, /showPreview/);
  assert.doesNotMatch(uiSource, /preview:\s*PreviewControls/);

  const trackSectionIndex = chapterSource.indexOf('className="section chapter-track-section"');
  const exportSectionIndex = chapterSource.indexOf('className="chapter-service-actions"');
  assert.ok(trackSectionIndex > -1 && exportSectionIndex > trackSectionIndex);
  assert.match(chapterSource, /!monthlyChapter[\s\S]*?>챕터 정보 수정<\/button>/);

  assert.match(playlistSource, /className="playlist-builder-header"/);
  assert.doesNotMatch(playlistSource, /playlist-back-button/);
  assert.match(playlistSource, /useLayoutEffect\(\(\) =>/);
  assert.match(playlistSource, /closest<HTMLElement>\("\.shell-main"\)\?\.scrollTo\(\{ top: 0 \}\)/);
  assert.match(appSource, /case "playlist":[\s\S]*?typeof playlistStep === "number" && playlistStep > 1/s);
  assert.match(appSource, /backAction=\{contextBackAction\}/);
  assert.match(css, /\.playlist-builder-header\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s);

  assert.match(shellSource, /onDismiss:\s*\(\) => void/);
  assert.match(shellSource, />플레이어 종료<\/button>/);
  assert.match(shellSource, /preview\.close\(\)/);
  assert.match(shellSource, /requestAnimationFrame\(\(\) => scrollViewportRef\.current\?\.focus/);
  assert.match(accessibilitySource, /previousFocus\?\.isConnected/);
  assert.match(accessibilitySource, /fallbackFocus\?\.focus/);
});

test("keeps memory details and player surfaces legible on the mobile canvas", async () => {
  const [css, globals] = await Promise.all([
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const appleTheme = getAppleTheme(css);

  assert.match(appleTheme, /\.memory-note-date-row\s*\{[^}]*min-height:\s*44px;[^}]*display:\s*flex;/s);
  assert.match(appleTheme, /\.memory-record-submit\s*\{[^}]*width:\s*100%;[^}]*min-height:\s*50px;/s);
  assert.match(appleTheme, /\.mini-player-copy strong\s*\{[^}]*font-family:\s*var\(--apple-font-text\);/s);
  assert.match(appleTheme, /\.full-player-copy > span\s*\{[^}]*color:\s*var\(--apple-body-muted\);[^}]*font-family:\s*var\(--apple-font-text\);/s);
  assert.match(appleTheme, /\.sheet-handle\s*\{[^}]*background:\s*var\(--apple-body-muted\);/s);
  assert.match(appleTheme, /\.player-dismiss-control\s*\{[^}]*position:\s*absolute;[^}]*min-height:\s*44px;/s);
  assert.match(appleTheme, /\.player-dismiss-control\s*\{[^}]*right:\s*20px;/s);
  assert.match(appleTheme, /\.player-dismiss-control:focus-visible\s*\{[^}]*outline-offset:\s*-2px;/s);
  assert.match(appleTheme, /\.app-shell\.has-player\s*\{[^}]*grid-template-rows:\s*44px minmax\(0, 1fr\) 68px calc\(70px \+ env\(safe-area-inset-bottom\)\);/s);
  assert.match(appleTheme, /\.app-shell\.has-player \.mini-player\s*\{[^}]*position:\s*relative;[^}]*grid-row:\s*3;/s);
  assert.match(appleTheme, /\.full-player-art\s*\{[^}]*padding-top:\s*var\(--apple-space-3\);/s);
  assert.doesNotMatch(globals, /\.full-player :focus-visible\s*\{[^}]*outline-color:\s*var\(--signal\);/s);
});

test("puts tag creation in a modal and keeps the library first", async () => {
  const source = await readFile(
    new URL("../app/_components/editorial-views-tags.tsx", import.meta.url),
    "utf8",
  );

  assert.match(source, /const \[createOpen, setCreateOpen\] = useState\(false\)/);
  assert.match(source, /maxLength=\{ARCHIVE_LIMITS\.tagLabel\}/);
  assert.match(source, /id="tag-library-title" className="sr-only"/);
  assert.doesNotMatch(source, /tag-manager-menu|<summary/);
  assert.match(source, /className="tag-manager-actions"[\s\S]*?수정[\s\S]*?삭제/);
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
  assert.match(heroSource, /aria-label="이전 음악"/);
  assert.match(heroSource, /aria-label="다음 음악"/);
  assert.match(heroSource, /aria-live="polite"/);
  assert.doesNotMatch(source, /showPreview|preview=\{preview\}/);
  assert.doesNotMatch(uiSource, /showPreview|PreviewButton|PreviewControls/);
  assert.match(source, /className="chapter-preview-art"/);
  assert.match(source, /className="chapter-preview-art"[\s\S]*?<ChapterCover archive=\{archive\} chapter=\{chapter\} \/>/);
  const appleTheme = getAppleTheme(css);
  assert.match(appleTheme, /\.editorial-header\s*\{[^}]*position:\s*relative;[^}]*height:\s*44px;/s);
  assert.match(appleTheme, /@container muchi-app \(max-width: 430px\)[\s\S]*?\.album-feature\s*\{[^}]*grid-template-columns:\s*128px minmax\(0, 1fr\);/s);
  assert.match(appleTheme, /@container muchi-app \(max-width: 419px\)[\s\S]*?\.album-feature\s*\{[^}]*grid-template-columns:\s*112px minmax\(0, 1fr\);/s);
  assert.match(appleTheme, /@container muchi-app \(max-width: 419px\)[\s\S]*?\.track-list-unified \.track-line\s*\{[^}]*--track-cover-size:\s*60px;/s);
  assert.match(appleTheme, /\.hero-carousel-controls button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;/s);
});

test("keeps automatic monthly chapters readable but out of manual assignment and memory editing", async () => {
  const [formatSource, primarySource, chapterSource, appSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-format.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(formatSource, /export function isAssignableChapter/);
  assert.match(formatSource, /return isUserVisibleChapter\(chapter\)/);
  assert.ok((primarySource.match(/isAssignableChapter\(chapter\)/g) ?? []).length >= 1);
  assert.match(chapterSource, /isAssignableChapter\(item\)/);
  assert.match(chapterSource, /<ChapterDetailHero[\s\S]*?title=\{formatChapterTitle\(chapter\)\}/s);
  assert.match(appSource, /requestedChapter\?\.kind === "capture"/);
  assert.match(appSource, /requestedMemoryChapter\?\.kind === "monthly"/);
  assert.match(appSource, /router\.replace\(`\/chapter\?id=\$\{encodeURIComponent\(requestedMemoryChapter\.id\)\}`\)/);
});

test("removes redundant helper copy and keeps preview controls compact outside memory recording", async () => {
  const paths = [
    "editorial-media.tsx",
    "editorial-ui.tsx",
    "editorial-views-primary.tsx",
    "editorial-views-chapters.tsx",
    "editorial-views-discovery.tsx",
    "editorial-views-tags.tsx",
    "muchi-app.tsx",
    "editorial-chapter-delete-dialog.tsx",
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
  const appleTheme = getAppleTheme(css);

  assert.doesNotMatch(source, /\bcopy=/);
  assert.doesNotMatch(source, /같은 곡도 순간마다 다르게 느껴집니다/);
  assert.doesNotMatch(source, /같은 곡도 이 챕터 안에서는 고유한 태그와 기억을 가집니다/);
  assert.doesNotMatch(source, /완벽하게 정리하지 않아도 괜찮아요/);
  assert.doesNotMatch(source, /welcome-steps/);
  assert.match(source, /다른 챕터의 같은 곡과 기억은 그대로 남습니다/);
  assert.doesNotMatch(source, /기록은 로그인한 계정에 저장돼요/);
  assert.doesNotMatch(chapterSource, /ITUNES_PREVIEW_USAGE_NOTICE|미리듣기는 홍보 목적으로만/);
  assert.doesNotMatch(itunesSource, /ITUNES_PREVIEW_USAGE_NOTICE|미리듣기는 홍보 목적으로만/);
  assert.match(mediaSource, /className="play-button preview-icon-button"/);
  assert.match(mediaSource, /const previewLabel = !track\.previewUrl[\s\S]*?\? `\$\{track\.title\} 미리듣기 정지`[\s\S]*?: `\$\{track\.title\} 30초 미리듣기`/);
  assert.match(mediaSource, /aria-label=\{previewLabel\}/);
  assert.match(mediaSource, /playing \? <Pause[^>]*aria-hidden="true"[^>]*\/> : <Play[^>]*aria-hidden="true"[^>]*\/>/);
  assert.doesNotMatch(mediaSource, /\{playing \? "정지" : "미리듣기"\}/);
  assert.match(appleTheme, /\.icon-button,\s*\.preview-icon-button\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px;[^}]*padding:\s*0;/s);
  assert.doesNotMatch(appleTheme, /\.memory-preview-actions\s*\{/s);
});

test("keeps archive search compact with the shared tag picker", async () => {
  const [source, pickerSource, css] = await Promise.all([
    readFile(
      new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url),
      "utf8",
    ),
    readFile(new URL("../app/_components/editorial-tag-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(source, /className="page-content search-view"/);
  assert.match(source, /<h1 className="archive-find-title">내 기록 찾기<\/h1>/);
  assert.match(source, /className="input search-input archive-find-input"\s*\n\s*type="search"/);
  assert.match(source, /className="search-tag-controls"/);
  assert.match(source, /<TagPicker\s+label="태그로 찾기"/);
  assert.match(source, /suggestedTagIds=\{quickTagIds\}/);
  assert.match(source, /suggestionsLabel="빠른 찾기"/);
  assert.match(source, /actionLabel="태그로 찾기"/);
  assert.match(source, /panelTitle="태그 찾기"/);
  assert.match(source, /manageHref="\/tags"/);
  assert.match(source, /onCreate=\{addTag\}/);
  assert.match(source, /\sinline\s/);
  assert.match(source, /function addTag\(label: string\): boolean/);
  assert.match(source, /createTags\(archive, \[label\]\)/);
  assert.match(source, /commit\(result\.archive, `‘\$\{tag\.label\}’ 태그를 추가했어요\.`\)/);
  assert.match(source, /headingAction=\{tagIds\.length > 1/);
  assert.match(source, /placeholder="곡, 챕터, 태그, 메모로 찾기"/);
  assert.match(source, /내 음악 기록에서 찾기/);
  assert.doesNotMatch(source, /eyebrow="내 태그"|className="page-content search-view tag-group-view"/);
  assert.doesNotMatch(source, /getTagGroupResults|expandedTrackId|tag-manager-memory-link/);
  assert.match(source, /const legacyGroupView = requestedView === "group"/);
  assert.match(source, /router\.replace\(rawSearchHref\(initialQuery, validRequestedTagIds, fromMemoryId\)\)/);
  assert.doesNotMatch(source, /search-tag-categories|search-tag-list|SEARCH_TAG_CATEGORIES/);
  assert.match(source, /tagMatch/);
  const searchResultLine = sliceBetween(source, "function SearchResultLine(", "function rawSearchHref(", "search result row");
  assert.match(searchResultLine, /className="search-track-row"/);
  assert.match(searchResultLine, /className="search-track-main"[\s\S]*?href=\{`\/memory\?id=/s);
  assert.doesNotMatch(searchResultLine, /기억 열기|className="button"/);
  assert.match(searchResultLine, /const uniqueTags = result\.tags\.filter/);
  assert.match(searchResultLine, /className="search-track-tags"/);
  assert.doesNotMatch(searchResultLine, /formatCalendarDate|날짜 미지정|listenedOn/);
  assert.match(source, /function searchByTag\(tagId: string\)/);
  assert.match(source, /setQuery\(""\);[\s\S]*?setTagIds\(\[tagId\]\);[\s\S]*?router\.push\(rawSearchHref\("", \[tagId\], fromMemoryId\)\)/s);
  assert.match(source, /className="search-results-section archive-find-results"/);
  assert.match(source, /const hasSearch = Boolean\(query\.trim\(\) \|\| tagIds\.length\)/);
  assert.match(source, /const results = hasSearch/);
  assert.match(source, /내 음악 세계에서 찾고 싶은 것을 입력하세요/);
  assert.doesNotMatch(source, /capture-track-select|capture-floating-action|곡 기록하기/);
  assert.doesNotMatch(source, /내 언어로 음악을 다시 찾기/);
  assert.doesNotMatch(source, /className="search-editor/);
  assert.ok(source.lastIndexOf("search-tag-controls") < source.lastIndexOf("search-results-section"));
  assert.match(pickerSource, /role="dialog"/);
  assert.match(pickerSource, /className="tag-picker-inline-list"/);
  assert.match(pickerSource, /className="tag-picker-open"/);
  assert.match(pickerSource, /aria-label="태그 목록"/);
  assert.doesNotMatch(pickerSource, /TAG_PICKER_CATEGORIES|CATEGORY_LABEL|role="tablist"|"frequent"/);
  assert.match(css, /@container muchi-app \(max-width:\s*430px\)[\s\S]*?\.tag-picker-panel\s*\{[^}]*bottom:\s*0;/s);
  assert.match(css, /\.tag-picker-open\s*\{[^}]*border:\s*1px solid var\(--apple-hairline\);/s);
  assert.match(css, /\.tag-picker-options\s*\{[^}]*flex:\s*1 1 auto;[^}]*display:\s*flex;[^}]*flex-wrap:\s*wrap;/s);
  assert.match(css, /\.tag-picker-option\s*\{[^}]*width:\s*fit-content;[^}]*min-height:\s*36px;/s);
  assert.match(css, /\.tag-picker-open-meta\s*\{[^}]*flex:\s*0 0 auto;/s);
  assert.match(css, /\.tag-picker-option > span\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/s);
  assert.match(css, /\.search-track-main\s*\{[^}]*grid-template-columns:\s*52px minmax\(0, 1fr\) 18px;/s);
  assert.match(css, /\.search-track-tags\s*\{[^}]*display:\s*flex;[^}]*margin:\s*2px 0 0 67px;/s);
  assert.match(css, /\.archive-find-title\s*\{[^}]*font-size:\s*20px;/s);
  assert.match(css, /\.archive-find-results \.search-results-head h2\s*\{[^}]*font-size:\s*20px;/s);
  assert.match(css, /\.tag-manager-copy \.tag\s*\{[^}]*overflow-wrap:\s*anywhere;[^}]*white-space:\s*normal;/s);
  assert.match(css, /@container muchi-app \(max-width:\s*430px\)[\s\S]*?\.album-hero\s*\{[^}]*min-height:\s*clamp\(360px, 54dvh, 400px\);/s);
  assert.match(css, /\.album-memory-reveal\s*\{[^}]*max-height:\s*0;/s);
  assert.match(css, /\.album-hero\.is-expanded \.album-memory-reveal\s*\{[^}]*max-height:\s*none;/s);
  assert.match(css, /\.track-info \.tag-row\s*\{[^}]*overflow-x:\s*auto;[^}]*scrollbar-width:\s*none;/s);
  assert.match(css, /\.search-view \.track-info em,[\s\S]*?\.recap-view \.track-info em\s*\{[^}]*-webkit-line-clamp:\s*2;/s);
});

test("builds a mobile playlist export UI with Apple Music pending and YouTube Music connected", async () => {
  const [chapterSource, playlistSource, serviceIconSource, appSource, typesSource, routeSource, css, appleIcon, youtubeIcon, appleRoute, youtubeRoute] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-playlist.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-service-icon.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/playlist/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/services/apple-music.svg", import.meta.url), "utf8"),
    readFile(new URL("../public/assets/services/youtube-music.svg", import.meta.url), "utf8"),
    readFile(new URL("../app/api/playlist/apple/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/playlist/youtube/route.ts", import.meta.url), "utf8"),
  ]);
  const appleTheme = getAppleTheme(css);

  assert.match(chapterSource, /className="chapter-service-grid"/);
  assert.match(chapterSource, /playlistHref\("youtube"\)/);
  assert.match(chapterSource, /className="chapter-service-actions" aria-label="플레이리스트로 내보내기"/);
  assert.match(chapterSource, /Apple Music 내보내기 준비 중/);
  assert.match(chapterSource, /Apple Music 준비 중/);
  assert.match(chapterSource, /YouTube Music으로 내보내기/);
  assert.doesNotMatch(chapterSource, /Spotify/);
  assert.match(playlistSource, /Apple Music/);
  assert.match(playlistSource, /YouTube Music/);
  assert.match(chapterSource, /<MusicServiceIcon service="apple"/);
  assert.match(chapterSource, /<MusicServiceIcon service="youtube"/);
  assert.match(playlistSource, /<MusicServiceIcon service=\{service\.id\}/);
  assert.match(serviceIconSource, /\/assets\/services\/apple-music\.svg/);
  assert.match(serviceIconSource, /\/assets\/services\/youtube-music\.svg/);
  assert.match(appleIcon, /apple-music-gradient/);
  assert.match(youtubeIcon, /#ff0033/);
  assert.match(playlistSource, /곡 확인/);
  assert.match(playlistSource, /서비스 선택/);
  assert.match(playlistSource, /매칭 확인/);
  assert.match(playlistSource, /플레이리스트 만들기 완료/);
  assert.match(playlistSource, /서비스를 연결해 곡을 실제로 찾아볼게요/);
  assert.match(playlistSource, /\/api\/playlist\/\$\{serviceId\}/);
  assert.match(playlistSource, /Apple Music 내보내기는 준비 중이에요/);
  assert.match(playlistSource, /status:\s*"soon"/);
  assert.match(playlistSource, /disabled=\{service\.status === "soon"\}/);
  assert.doesNotMatch(playlistSource, /MusicKit/);
  assert.doesNotMatch(playlistSource, /music\.apple\.com\/musickit/);
  assert.match(playlistSource, /https:\/\/www\.googleapis\.com\/auth\/youtube/);
  assert.match(playlistSource, /selectable[\s\S]*?showAlbum=\{false\}[\s\S]*?showIndex=\{false\}[\s\S]*?onRowClick=\{\(\) => toggleTrack\(entry\.track\.id\)\}/s);
  assert.doesNotMatch(playlistSource, /playlist-track-toggle|service\.description|ChevronRight/);
  assert.doesNotMatch(playlistSource, /presetServiceId \? 3 : 2/);
  assert.match(playlistSource, /onClick=\{\(\) => onStepChange\(2\)\}>다음<\/button>/);
  assert.match(appSource, /initialServiceId=\{searchParams\.get\("service"\)\}/);
  assert.doesNotMatch(playlistSource, /localStorage|sessionStorage/);
  assert.match(appSource, /case "playlist":/);
  assert.match(typesSource, /\| "playlist"/);
  assert.match(routeSource, /<MusicWorldApp view="playlist" \/>/);
  assert.match(appleTheme, /\.playlist-stepper\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/s);
  assert.match(appleTheme, /\.playlist-service-list\s*\{[^}]*display:\s*grid;/s);
  assert.match(appleTheme, /\.chapter-service-link:disabled,[\s\S]*?\.playlist-service-row:disabled\s*\{[^}]*cursor:\s*not-allowed;/s);
  assert.match(appleTheme, /\.playlist-builder-actions\s*\{[^}]*position:\s*sticky;/s);
  assert.match(appleTheme, /\.music-service-mark\s*\{[^}]*object-fit:\s*contain;/s);
  assert.match(appleTheme, /\.playlist-simulation-note\s*\{[^}]*margin:\s*0 0 var\(--apple-space-3\);/s);
  assert.match(appleTheme, /\.public-chapter-detail \.chapter-hero-copy\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto;/s);
  assert.match(appleTheme, /\.chapter-detail-meta-row\s*\{[^}]*justify-content:\s*space-between;/s);
  assert.match(appleTheme, /\.chapter-detail-utilities\.is-inline \.chapter-service-grid\s*\{[^}]*display:\s*flex;/s);
  assert.match(appleTheme, /\.chapter-detail-utilities\.is-inline \.chapter-service-link\s*\{[^}]*width:\s*32px;[^}]*height:\s*32px;/s);
  assert.doesNotMatch(appleTheme, /\.public-chapter-detail \.chapter-actions\s*\{/);
  assert.match(appleRoute, /\/v1\/me\/library\/playlists/);
  assert.match(youtubeRoute, /\/playlists\?part=snippet,status/);
  assert.match(youtubeRoute, /\/playlistItems\?part=snippet/);
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

test("limits link imports to YouTube Music and Apple Music share URLs", async () => {
  const [routeSource, musicLinksSource] = await Promise.all([
    readFile(new URL("../app/api/music-metadata/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/music-links.ts", import.meta.url), "utf8"),
  ]);

  assert.match(routeSource, /parseCaptureMusicShareUrl\(requestedUrl\)/);
  assert.match(routeSource, /appleMusicMetadata/);
  assert.match(routeSource, /https:\/\/itunes\.apple\.com\/lookup/);
  assert.match(musicLinksSource, /url\.hostname === "music\.youtube\.com"/);
  assert.match(musicLinksSource, /url\.hostname === "music\.apple\.com"/);
  assert.match(musicLinksSource, /YouTube Music 또는 Apple Music 앱에서 공유한 곡 링크/);
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
  assert.match(manifest, /id:\s*"\/"/);
  assert.match(manifest, /short_name:\s*"뮤키"/);
  assert.match(manifest, /orientation:\s*"portrait"/);
  assert.match(manifest, /나만의 챕터/);
  assert.match(serviceWorker, /v6-ios-pwa/);
  assert.match(serviceWorker, /"\/chapters"/);
  assert.match(serviceWorker, /request\.mode === "navigate"/);
  assert.match(serviceWorker, /!isSameOrigin\(url\) \|\| request\.destination === "audio"/);

  await assert.rejects(access(new URL("../app/_sites-preview", import.meta.url)));
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../public/favicon.png", import.meta.url));
  await access(new URL("../public/sw.js", import.meta.url));
  await access(projectRoot);
});

test("stores optional affection per chapter record and migrates older records to no selection", async () => {
  const archiveDomain = await loadArchiveDomain();
  const track = {
    id: archiveDomain.makeProviderTrackId("youtube", "affection01"),
    provider: "youtube",
    providerTrackId: "affection01",
    title: "애정도 테스트",
    artist: "뮤키",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
  };
  const chapter = archiveDomain.createCube(archiveDomain.createEmptyArchive(), { name: "테스트 챕터" });
  const captured = archiveDomain.captureTrackToInbox(chapter.archive, track);
  const moved = archiveDomain.moveInboxTrackToCube(captured, track.id, chapter.cube.id);
  const red = archiveDomain.setCubeTrackAffection(moved.archive, moved.cubeTrack.id, "red");
  assert.equal(red.data.cubeTracks[moved.cubeTrack.id].affection, "red");
  const cleared = archiveDomain.setCubeTrackAffection(red, moved.cubeTrack.id, null);
  assert.equal(cleared.data.cubeTracks[moved.cubeTrack.id].affection, null);

  const legacy = structuredClone(cleared);
  legacy.schemaVersion = 8;
  delete legacy.data.cubeTracks[moved.cubeTrack.id].affection;
  const parsed = archiveDomain.parseArchive(JSON.stringify(legacy));
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.archive.data.cubeTracks[moved.cubeTrack.id].affection, null);
});

test("keeps the same song's tags and memory independent in each cube", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const radioContexts = Object.values(seed.data.cubeTracks).filter(
    (item) => item.trackId === "itunes:1569294423",
  );

  assert.equal(Object.keys(seed.data.cubes).length, 7);
  assert.equal(Object.keys(seed.data.tracks).length, 7);
  assert.equal(radioContexts.length, 4);

  const dawnRadio = seed.data.cubeTracks["seed:cube-track:dawn-radio"];
  const winterRadio = seed.data.cubeTracks["seed:cube-track:winter-radio"];
  const winterBefore = structuredClone(winterRadio);
  const updated = archiveDomain.setCubeTrackTags(seed, dawnRadio.id, [
    "차가운",
    "질주하는",
    "한밤중",
  ]);
  const withCharacter = archiveDomain.updateCubeTrack(updated, dawnRadio.id, {
    character: "도시를 가르는 야간 주행곡",
  });
  const withMemory = archiveDomain.addCubeTrackNote(withCharacter, dawnRadio.id, {
    listenedOn: "2026-07-16",
    body: "새로 덧붙인 개인 기억",
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
  assert.equal(
    archiveDomain.getCubeTrackNotes(withMemory.data.cubeTracks[dawnRadio.id])[0].body,
    "새로 덧붙인 개인 기억",
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

test("accumulates dated notes without overwriting another chapter's memory", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const radioContexts = Object.values(seed.data.cubeTracks).filter(
    (item) => item.trackId === "itunes:1569294423",
  );
  const [dawnRadio, winterRadio] = radioContexts;
  const winterBefore = structuredClone(winterRadio.notes);
  const firstRegisteredAt = dawnRadio.createdAt;
  const legacyCharacter = dawnRadio.character;
  const legacyMemoryPeriod = structuredClone(dawnRadio.memoryPeriod);

  const first = archiveDomain.addCubeTrackNote(
    seed,
    dawnRadio.id,
    { listenedOn: "2026-07-14", body: "퇴근길에 다시 들으니 기타가 먼저 들렸다." },
    "2026-07-14T12:00:00.000Z",
  );
  const firstNote = archiveDomain.getCubeTrackNotes(first.data.cubeTracks[dawnRadio.id])[0];
  const second = archiveDomain.addCubeTrackNote(
    first,
    dawnRadio.id,
    { listenedOn: "2026-07-16", body: "비 오는 아침에는 속도가 조금 다르게 느껴졌다." },
    "2026-07-16T01:00:00.000Z",
  );

  assert.equal(second.data.cubeTracks[dawnRadio.id].notes.length, dawnRadio.notes.length + 2);
  assert.equal(second.data.cubeTracks[dawnRadio.id].createdAt, firstRegisteredAt);
  assert.deepEqual(second.data.cubeTracks[winterRadio.id].notes, winterBefore);
  assert.deepEqual(
    archiveDomain.getCubeTrackNotes(second.data.cubeTracks[dawnRadio.id])
      .slice(0, 2)
      .map((note) => note.listenedOn),
    ["2026-07-16", "2026-07-14"],
  );

  const edited = archiveDomain.updateCubeTrackNote(
    second,
    dawnRadio.id,
    firstNote.id,
    { listenedOn: "2026-07-15", body: "수정한 감상" },
    "2026-07-16T02:00:00.000Z",
  );
  assert.equal(
    edited.data.cubeTracks[dawnRadio.id].notes.find((note) => note.id === firstNote.id)?.body,
    "수정한 감상",
  );

  const removed = archiveDomain.removeCubeTrackNote(
    edited,
    dawnRadio.id,
    firstNote.id,
    "2026-07-16T03:00:00.000Z",
  );
  assert.equal(
    removed.data.cubeTracks[dawnRadio.id].notes.some((note) => note.id === firstNote.id),
    false,
  );
  assert.throws(
    () => archiveDomain.addCubeTrackNote(seed, dawnRadio.id, {
      listenedOn: "2026-02-30",
      body: "존재하지 않는 날짜",
    }),
    /감상 날짜/,
  );
  assert.ok(
    archiveDomain.searchArchive(second, { query: "비 오는 아침" })
      .some((result) => result.kind === "cube-track" && result.cubeTrack.id === dawnRadio.id),
  );

  const roundTrip = archiveDomain.parseArchive(archiveDomain.serializeArchive(second));
  assert.equal(roundTrip.status, "ok");
  assert.deepEqual(roundTrip.archive, second);
  assert.equal(roundTrip.archive.data.cubeTracks[dawnRadio.id].character, legacyCharacter);
  assert.deepEqual(roundTrip.archive.data.cubeTracks[dawnRadio.id].memoryPeriod, legacyMemoryPeriod);
});

test("orders same-day listening notes by creation time without changing the first registration date", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const cubeTrack = seed.data.cubeTracks["seed:cube-track:dawn-radio"];
  const registeredAt = cubeTrack.createdAt;
  const first = archiveDomain.addCubeTrackNote(
    seed,
    cubeTrack.id,
    { listenedOn: "2026-07-18", body: "아침에 남긴 메모" },
    "2026-07-18T01:00:00.000Z",
  );
  const second = archiveDomain.addCubeTrackNote(
    first,
    cubeTrack.id,
    { listenedOn: "2026-07-18", body: "밤에 남긴 메모" },
    "2026-07-18T12:00:00.000Z",
  );

  assert.equal(second.data.cubeTracks[cubeTrack.id].createdAt, registeredAt);
  assert.deepEqual(
    archiveDomain.getCubeTrackNotes(second.data.cubeTracks[cubeTrack.id])
      .filter((note) => note.listenedOn === "2026-07-18")
      .map((note) => note.body),
    ["밤에 남긴 메모", "아침에 남긴 메모"],
  );
});

test("migrates v4 single memos into undated note history without data loss", async () => {
  const archiveDomain = await loadArchiveDomain();
  const current = archiveDomain.createSeedArchive();
  const legacy = structuredClone(current);
  legacy.schemaVersion = 4;
  Object.values(legacy.data.cubeTracks).forEach((cubeTrack) => {
    cubeTrack.memo = cubeTrack.notes[0]?.body ?? "";
    delete cubeTrack.notes;
  });

  const parsed = archiveDomain.parseArchive(JSON.stringify(legacy));

  assert.equal(parsed.status, "ok");
  assert.equal(parsed.migrated, true);
  assert.equal(parsed.archive.schemaVersion, archiveDomain.ARCHIVE_SCHEMA_VERSION);
  assert.ok(Object.values(parsed.archive.data.cubeTracks).every((cubeTrack) => (
    cubeTrack.notes.length === 0 || cubeTrack.notes[0].listenedOn === null
  )));
  assert.equal(
    parsed.archive.data.cubeTracks["seed:cube-track:dawn-radio"].notes[0].body,
    "새벽 두 시, 신호가 모두 초록색이었던 날. 이 곡의 속도와 도로가 정확히 맞았다.",
  );
  const migratedTrack = parsed.archive.data.cubeTracks["seed:cube-track:dawn-radio"];
  const migratedNote = migratedTrack.notes[0];
  const edited = archiveDomain.updateCubeTrackNoteBody(
    parsed.archive,
    migratedTrack.id,
    migratedNote.id,
    "문장만 다듬은 기존 기록",
    "2026-07-18T08:00:00.000Z",
  );
  const editedNote = edited.data.cubeTracks[migratedTrack.id].notes[0];
  assert.equal(editedNote.body, "문장만 다듬은 기존 기록");
  assert.equal(editedNote.listenedOn, null);
});

test("reconciles local tag choices with newer tags loaded from another tab", async () => {
  const archiveDomain = await loadArchiveDomain();

  assert.deepEqual(
    archiveDomain.reconcileTagSelection(
      ["tag:kept", "tag:removed-locally", "tag:added-remotely"],
      ["tag:kept", "tag:removed-locally"],
      ["tag:kept", "tag:added-locally"],
    ),
    ["tag:kept", "tag:added-remotely", "tag:added-locally"],
  );
});

test("builds recap from dated notes and ignores automatic chapter duplicates without notes", async () => {
  const archiveDomain = await loadArchiveDomain();
  const track = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"),
    provider: "youtube",
    providerTrackId: "M7lc1UVf-VE",
    title: "다시 들은 여름 노래",
    artist: "기억 속 아티스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
  };
  const empty = archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z");
  const captured = archiveDomain.captureTrackToInbox(
    empty,
    track,
    "2026-07-01T01:00:00.000Z",
  );
  const chapter = archiveDomain.createCube(captured, {
    id: "cube:manual-summer",
    name: "내 여름",
  }, "2026-07-01T02:00:00.000Z");
  const moved = archiveDomain.moveInboxTrackToCube(
    chapter.archive,
    track.id,
    chapter.cube.id,
    "2026-07-01T03:00:00.000Z",
  );
  const first = archiveDomain.addCubeTrackNote(
    moved.archive,
    moved.cubeTrack.id,
    { listenedOn: "2024-07-16", body: "두 해 전 같은 달의 감상" },
    "2026-07-01T04:00:00.000Z",
  );
  const withTwoNotes = archiveDomain.addCubeTrackNote(
    first,
    moved.cubeTrack.id,
    { listenedOn: "2025-07-18", body: "지난해 다시 들은 감상" },
    "2026-07-01T05:00:00.000Z",
  );

  const thisTime = archiveDomain.selectRecap(withTwoNotes, {
    mode: "this-time",
    now: "2026-07-16T12:00:00.000Z",
    limit: 10,
  });
  assert.equal(thisTime.length, 2);
  assert.ok(thisTime.every((entry) => entry.cube.id === chapter.cube.id));
  assert.ok(thisTime.every((entry) => entry.note.body.includes("감상")));

  const timeline = archiveDomain.selectRecap(withTwoNotes, { mode: "timeline", limit: 10 });
  assert.deepEqual(
    timeline.map((entry) => entry.note.listenedOn),
    ["2025-07-18", "2024-07-16"],
  );
});

test("keeps interview-driven capture paths while simplifying memory completion", async () => {
  const [primarySource, chapterSource, appSource, discoverySource, pickerSource, manifestSource, musicLinksSource, appleThemeSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-primary.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-tag-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/manifest.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/music-links.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(primarySource, /보관함에 우선 저장/);
  assert.match(primarySource, /자세히 기록/);
  assert.match(primarySource, /다른 챕터에도 담기/);
  assert.match(primarySource, /InlineChapterCreate onCreate=\{createChapterAndAssign\}/);
  assert.match(primarySource, /기억 더 남기기/);
  assert.match(primarySource, /링크로 가져오기/);
  assert.doesNotMatch(primarySource, /기존 플레이리스트 가져오기|실제 곡을 가져오지는 않아요/);
  assert.doesNotMatch(chapterSource, /기록 이미지 만들기 · 실험/);
  assert.doesNotMatch(chapterSource, /기록하고 \{providerName\}으로 돌아가기/);
  assert.match(chapterSource, /className="button button-primary memory-record-submit"/);
  assert.match(chapterSource, /muchi:memory-draft:v1/);
  assert.match(appSource, /searchParams\.get\("url"\) \?\? searchParams\.get\("text"\)/);
  assert.match(manifestSource, /share_target:/);
  assert.match(manifestSource, /action: "\/capture\?source=music-share"/);
  assert.match(primarySource, /startDetailedRecord\(payload\.track\)/);
  assert.match(primarySource, /aria-label=\{`\$\{label\} 태그 삭제`\}/);
  assert.match(primarySource, /<X size=\{14\}/);
  assert.match(musicLinksSource, /YouTube Music 또는 Apple Music 앱에서 공유한 곡 링크/);
  assert.match(appleThemeSource, /\.record-dialog \.field > \.search-form\s*\{\s*margin-top:\s*0;/s);
  assert.match(appleThemeSource, /\.input:focus,[\s\S]*?\.tag-picker-inline-create input:focus,[\s\S]*?\.tag-picker-search:focus-within\s*\{[^}]*border-color:\s*var\(--apple-hairline\);[^}]*box-shadow:\s*none;[^}]*outline:\s*none;/s);
  assert.match(appleThemeSource, /input:focus-visible,[\s\S]*?select:focus-visible\s*\{\s*outline:\s*none;/s);
  assert.match(chapterSource, /recordVisibilityAction=\{cube\.kind === "manual"/);
  assert.match(chapterSource, /recordVisibility === "public" \? "태그\/메모 공개" : "태그\/메모 비공개"/);
  assert.match(chapterSource, /function toggleChapterVisibility\(\)/);
  assert.match(chapterSource, /aria-label=\{`챕터 \$\{activeChapter\.visibility === "public" \? "공개" : "비공개"\}`\}/);
  assert.match(chapterSource, /activeChapter\.visibility === "public" \? "챕터 공개" : "챕터 비공개"/);
  assert.match(chapterSource, /className="chapter-detail-visibility"/);
  assert.match(appleThemeSource, /\.chapter-detail-meta-row\s*\{[^}]*justify-content:\s*space-between;[^}]*margin-top:\s*auto;/s);
  assert.match(chapterSource, /\sinline\s/);
  assert.match(pickerSource, /tag-picker-inline-list/);
  assert.match(pickerSource, /tag-picker-inline-toggle/);
  assert.match(pickerSource, /inlineHasOverflow/);
  assert.match(pickerSource, /list\.scrollHeight > INLINE_COLLAPSED_HEIGHT \+ 1/);
  assert.match(pickerSource, /new ResizeObserver\(measureOverflow\)/);
  assert.match(pickerSource, /tag-picker-inline-create-trigger/);
  assert.match(pickerSource, /tag-picker-inline-manage.*전체 태그 관리/s);
  assert.match(pickerSource, /placeholder="새 태그 입력"/);
  assert.match(pickerSource, /setInlineExpanded\(true\)/);
  assert.match(pickerSource, /sortedTags\.map/);
  assert.match(appleThemeSource, /\.tag-picker-inline\.has-overflow:not\(\.is-expanded\) \.tag-picker-inline-list\s*\{[^}]*max-height:\s*110px;/s);
  assert.match(appleThemeSource, /\.tag-picker-inline-create\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) 32px 28px;/s);
  assert.match(appleThemeSource, /\.tag-picker-inline-manage\s*\{[^}]*justify-self:\s*end;[^}]*margin-bottom:\s*-16px;/s);
  assert.doesNotMatch(chapterSource, /선택한 태그의 기록/);
  assert.doesNotMatch(chapterSource, /태그의 기록 보기/);
  assert.doesNotMatch(chapterSource, /#\{tag\.label\} 모아보기/);
  assert.doesNotMatch(discoverySource, /window\.localStorage/);
  assert.doesNotMatch(discoverySource, /기록은 로그인한 계정에 저장돼요/);
  assert.match(pickerSource, /빠른 선택/);
  assert.match(pickerSource, /비슷한 기존 태그/);
});

test("creates nested chapters with sibling-local ordering and rejects hierarchy cycles", async () => {
  const archiveDomain = await loadArchiveDomain();
  const empty = archiveDomain.createEmptyArchive("2026-07-15T00:00:00.000Z");
  const root = archiveDomain.createCube(empty, {
    id: "cube:root",
    name: "새벽의 기록",
  }, "2026-07-15T00:01:00.000Z");
  const otherRoot = archiveDomain.createCube(root.archive, {
    id: "cube:other-root",
    name: "다른 기록",
  }, "2026-07-15T00:02:00.000Z");
  const child = archiveDomain.createCube(otherRoot.archive, {
    id: "cube:child",
    name: "비 오는 새벽",
    parentId: root.cube.id,
  }, "2026-07-15T00:03:00.000Z");
  const sibling = archiveDomain.createCube(child.archive, {
    id: "cube:sibling",
    name: "맑은 새벽",
    parentId: root.cube.id,
  }, "2026-07-15T00:04:00.000Z");
  const grandchild = archiveDomain.createCube(sibling.archive, {
    id: "cube:grandchild",
    name: "첫차가 오기 전",
    parentId: child.cube.id,
  }, "2026-07-15T00:05:00.000Z");

  assert.equal(child.cube.parentId, root.cube.id);
  assert.equal(child.cube.sortOrder, 0);
  assert.equal(sibling.cube.sortOrder, 1);
  assert.deepEqual(
    archiveDomain.getRootCubes(grandchild.archive).map((chapter) => chapter.id),
    [root.cube.id, otherRoot.cube.id],
  );
  assert.deepEqual(
    archiveDomain.getChildCubes(grandchild.archive, root.cube.id).map((chapter) => chapter.id),
    [child.cube.id, sibling.cube.id],
  );
  assert.deepEqual(
    archiveDomain.getCubeAncestors(grandchild.archive, grandchild.cube.id).map((chapter) => chapter.id),
    [root.cube.id, child.cube.id],
  );
  assert.deepEqual(
    archiveDomain.getCubesInTreeOrder(grandchild.archive).map((chapter) => chapter.id),
    [
      root.cube.id,
      child.cube.id,
      grandchild.cube.id,
      sibling.cube.id,
      otherRoot.cube.id,
    ],
  );

  assert.throws(
    () => archiveDomain.createCube(grandchild.archive, {
      name: "길을 잃은 챕터",
      parentId: "cube:missing",
    }),
    /찾을 수 없습니다/,
  );
  assert.throws(
    () => archiveDomain.updateCube(grandchild.archive, root.cube.id, {
      parentId: grandchild.cube.id,
    }),
    /순환/,
  );

  const orphaned = structuredClone(grandchild.archive);
  orphaned.data.cubes[child.cube.id].parentId = "cube:missing";
  assert.equal(archiveDomain.validateArchiveEnvelope(orphaned), false);
  assert.throws(() => archiveDomain.serializeArchive(orphaned), /올바르지 않습니다/);

  const cyclic = structuredClone(grandchild.archive);
  cyclic.data.cubes[root.cube.id].parentId = grandchild.cube.id;
  assert.equal(archiveDomain.validateArchiveEnvelope(cyclic), false);
});

test("reorders only the complete set of tracks inside one chapter", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const chapterId = "seed:cube:dawn-drive";
  const originalIds = archiveDomain.getCubeTracks(seed, chapterId)
    .map((entry) => entry.cubeTrack.id);
  const reversedIds = [...originalIds].reverse();

  const reordered = archiveDomain.reorderCubeTracks(
    seed,
    chapterId,
    reversedIds,
    "2026-07-15T01:00:00.000Z",
  );

  assert.deepEqual(
    archiveDomain.getCubeTracks(reordered, chapterId).map((entry) => entry.cubeTrack.id),
    reversedIds,
  );
  assert.throws(
    () => archiveDomain.reorderCubeTracks(seed, chapterId, originalIds.slice(0, 1)),
    /현재 항목과 일치하지 않습니다/,
  );
  assert.throws(
    () => archiveDomain.reorderCubeTracks(seed, chapterId, [originalIds[0], originalIds[0]]),
    /현재 항목과 일치하지 않습니다/,
  );
  assert.throws(
    () => archiveDomain.reorderCubeTracks(seed, chapterId, [...originalIds, "missing:track"]),
    /현재 항목과 일치하지 않습니다/,
  );
});

test("promotes child chapters without data loss when a parent chapter is deleted", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const root = archiveDomain.createCube(seed, {
    id: "cube:root",
    name: "루트",
  });
  const parent = archiveDomain.createCube(root.archive, {
    id: "cube:parent",
    name: "부모",
    parentId: root.cube.id,
  });
  const child = archiveDomain.createCube(parent.archive, {
    id: "cube:child",
    name: "자식",
    parentId: parent.cube.id,
  });
  const grandchild = archiveDomain.createCube(child.archive, {
    id: "cube:grandchild",
    name: "손자",
    parentId: child.cube.id,
  });
  const trackId = Object.keys(grandchild.archive.data.tracks)[0];
  const withTrack = archiveDomain.addTrackToCube(
    grandchild.archive,
    trackId,
    child.cube.id,
  ).archive;
  const parentOnlyTrack = {
    id: archiveDomain.makeProviderTrackId("youtube", "delOnly0001"),
    provider: "youtube",
    providerTrackId: "delOnly0001",
    title: "삭제한 챕터에만 있던 곡",
    artist: "테스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
  };
  const capturedParentOnly = archiveDomain.captureTrack(withTrack, parentOnlyTrack);
  const parentOnly = archiveDomain.addTrackToCube(
    capturedParentOnly,
    parentOnlyTrack.id,
    parent.cube.id,
  );

  const deleted = archiveDomain.deleteCube(parentOnly.archive, parent.cube.id);

  assert.equal(deleted.data.cubes[parent.cube.id], undefined);
  assert.equal(deleted.data.cubes[child.cube.id].parentId, root.cube.id);
  assert.equal(deleted.data.cubes[grandchild.cube.id].parentId, child.cube.id);
  assert.equal(archiveDomain.getCubeTracks(deleted, child.cube.id).length, 1);
  assert.equal(deleted.data.cubeTracks[parentOnly.cubeTrack.id], undefined);
  assert.equal(archiveDomain.searchArchive(deleted, { query: parentOnlyTrack.title }).length, 0);
});

test("migrates flat v3 chapters into root chapters", async () => {
  const archiveDomain = await loadArchiveDomain();
  const legacy = structuredClone(archiveDomain.createSeedArchive());
  legacy.schemaVersion = 3;
  Object.values(legacy.data.cubes).forEach((chapter) => {
    delete chapter.parentId;
  });

  const parsed = archiveDomain.parseArchive(JSON.stringify(legacy));

  assert.equal(parsed.status, "ok");
  assert.equal(parsed.migrated, true);
  assert.equal(parsed.archive.schemaVersion, archiveDomain.ARCHIVE_SCHEMA_VERSION);
  assert.ok(Object.values(parsed.archive.data.cubes).every(
    (chapter) => chapter.parentId === null,
  ));
});

test("keeps user child chapters when bundled seed data is removed", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const seedParent = seed.data.cubes["seed:cube:dawn-drive"];
  const child = archiveDomain.createCube(seed, {
    id: "cube:under-seed",
    name: "나만의 새벽 장면",
    parentId: seedParent.id,
  });
  const trackId = Object.keys(child.archive.data.tracks)[0];
  const withMemory = archiveDomain.addTrackToCube(
    child.archive,
    trackId,
    child.cube.id,
  ).archive;

  const cleaned = archiveDomain.removeSeedData(withMemory);

  assert.equal(cleaned.data.cubes[seedParent.id], undefined);
  assert.equal(cleaned.data.cubes[child.cube.id].parentId, null);
  assert.equal(archiveDomain.getCubeTracks(cleaned, child.cube.id).length, 1);
});

test("stores a stable registration date without exposing monthly indexes as editable search memories", async () => {
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

  const monthlyCubeTrackId = archiveDomain.getCubeTracks(recaptured, monthlyChapters[0].id)[0].cubeTrack.id;
  assert.equal(
    archiveDomain.searchArchive(recaptured, { query: "2026-07" })
      .some((result) => result.kind === "cube-track" && result.cube.id === monthlyChapters[0].id),
    false,
  );
  assert.throws(
    () => archiveDomain.setCubeTrackTagIds(recaptured, monthlyCubeTrackId, []),
    /월별 자동 기록은 편집할 수 없습니다/,
  );
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

test("seeds flat custom tags with experience-first phrases", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const tags = Object.values(seed.data.tags);
  const labels = new Set(tags.map((tag) => tag.label));
  const oldAdjectiveLabels = [
    "차가운",
    "도시적인",
    "질주하는",
    "그리운",
    "따뜻한",
    "눈부신",
    "탁 트인",
    "몽환적인",
    "혼자 듣는",
    "들뜬",
    "방 안의",
  ];

  assert.ok(tags.length > 0);
  assert.ok(tags.every((tag) => tag.category === "custom"));
  assert.ok(labels.has("운동할 때"));
  assert.ok(labels.has("과거에 좋아했던 음악"));
  assert.ok(tags.some((tag) => tag.label.includes("때") || tag.label.includes("시절")));
  assert.ok(oldAdjectiveLabels.every((label) => !labels.has(label)));
});

test("migrates bundled adjective tags without changing user tags", async () => {
  const archiveDomain = await loadArchiveDomain();
  const legacy = structuredClone(archiveDomain.createSeedArchive());
  legacy.data.tags["seed:tag:cold"].label = "차가운";
  legacy.data.tags["seed:tag:cold"].normalizedLabel = "차가운";
  legacy.data.tags["seed:tag:cold"].category = "emotion";
  legacy.data.tags["user:tag:custom"] = {
    id: "user:tag:custom",
    label: "차가운",
    normalizedLabel: "차가운",
    category: "emotion",
    source: "user",
    createdAt: "2026-07-01T00:00:00.000Z",
  };

  const parsed = archiveDomain.parseArchive(archiveDomain.serializeArchive(legacy));

  assert.equal(parsed.status, "ok");
  assert.equal(parsed.migrated, true);
  assert.equal(parsed.archive.data.tags["seed:tag:cold"].label, "혼자 걷는 밤");
  assert.equal(parsed.archive.data.tags["seed:tag:cold"].category, "custom");
  assert.equal(parsed.archive.data.tags["user:tag:custom"].label, "차가운");
});

test("seeds dated listening history and refreshes legacy seed records without losing user notes", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const seedRecords = Object.values(seed.data.cubeTracks)
    .filter((cubeTrack) => cubeTrack.source === "seed");

  assert.equal(seedRecords.length, 21);
  assert.ok(seedRecords.every((cubeTrack) => cubeTrack.notes.length >= 2));
  assert.ok(seedRecords.every((cubeTrack) => (
    cubeTrack.notes.every((note) => /^\d{4}-\d{2}-\d{2}$/.test(note.listenedOn ?? ""))
  )));

  const legacy = structuredClone(seed);
  const dawnRadio = legacy.data.cubeTracks["seed:cube-track:dawn-radio"];
  const bundledNote = dawnRadio.notes[0];
  dawnRadio.notes = [
    { ...bundledNote, listenedOn: null },
    {
      id: "memory-note:user-kept",
      listenedOn: "2026-07-16",
      body: "사용자가 직접 남긴 감상",
      createdAt: "2026-07-16T09:00:00.000Z",
      updatedAt: "2026-07-16T09:00:00.000Z",
    },
  ];

  const parsed = archiveDomain.parseArchive(JSON.stringify(legacy));
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.migrated, true);
  const refreshedNotes = parsed.archive.data.cubeTracks["seed:cube-track:dawn-radio"].notes;
  assert.ok(refreshedNotes.length >= 3);
  assert.ok(refreshedNotes.every((note) => note.listenedOn !== null));
  assert.ok(refreshedNotes.some((note) => note.id === "memory-note:user-kept"));
});

test("ships a contextual sample archive and upgrades older local archives without deleting user data", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const userChapter = archiveDomain.createCube(seed, {
    id: "cube:user-kept-on-seed-upgrade",
    name: "내가 만든 챕터",
  }).archive;
  const legacySeed = structuredClone(userChapter);
  legacySeed.seedVersion = 1;
  delete legacySeed.data.cubes["seed:cube:workout"];
  Object.entries(legacySeed.data.cubeTracks).forEach(([id, cubeTrack]) => {
    if (cubeTrack.cubeId === "seed:cube:workout") delete legacySeed.data.cubeTracks[id];
  });
  legacySeed.data.preferences.seedDismissed = true;

  const parsed = archiveDomain.parseArchive(JSON.stringify(legacySeed));

  assert.equal(parsed.status, "ok");
  assert.equal(parsed.migrated, true);
  assert.equal(parsed.archive.seedVersion, archiveDomain.ARCHIVE_SEED_VERSION);
  assert.ok(parsed.archive.data.cubes["cube:user-kept-on-seed-upgrade"]);
  assert.ok(parsed.archive.data.cubes["seed:cube:workout"]);
  assert.equal(parsed.archive.data.preferences.seedDismissed, false);
  assert.equal(Object.values(parsed.archive.data.cubes).filter((cube) => cube.source === "seed").length, 7);
  assert.equal(Object.values(parsed.archive.data.cubeTracks).filter((item) => item.source === "seed").length, 21);
  assert.equal(Object.values(parsed.archive.data.tags).filter((tag) => tag.source === "seed").length, 20);
  assert.equal(parsed.archive.data.cubes["seed:cube:winter-2018"].parentId, "seed:cube:past-favorites");
  assert.ok(Object.values(parsed.archive.data.cubeTracks).every((item) => item.source !== "seed" || item.notes.length >= 2));

  const radioContexts = Object.values(parsed.archive.data.cubeTracks)
    .filter((item) => item.trackId === archiveDomain.makeTrackId(1569294423));
  assert.equal(radioContexts.length, 4);
  assert.ok(new Set(radioContexts.map((item) => item.tagIds.join("|"))).size > 1);
});

test("manages a reusable tag library independently from track memories", async () => {
  const archiveDomain = await loadArchiveDomain();
  const empty = archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z");
  const created = archiveDomain.createTags(empty, [
    { label: "잔잔한", category: "energy" },
    { label: "몽환적인", category: "texture" },
    { label: " 잔잔한 ", category: "emotion" },
  ], "2026-07-02T00:00:00.000Z");
  assert.throws(
    () => archiveDomain.createTags(empty, ["1234567890123456789012345678901"]),
    /태그은\(는\) 30자까지 입력할 수 있습니다/,
  );

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

test("reuses tag definitions while preserving raw per-memory tag limits", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const [target, untouched] = Object.values(seed.data.cubeTracks);
  const existing = seed.data.tags[target.tagIds[0]];
  const untouchedBefore = structuredClone(untouched);

  const tagged = archiveDomain.setCubeTrackTags(seed, target.id, [
    { label: existing.label, category: existing.category },
    "새로운 결",
    " 새로운 결 ",
  ]);
  const assigned = tagged.data.cubeTracks[target.id].tagIds;
  const created = Object.values(tagged.data.tags)
    .find((tag) => tag.normalizedLabel === archiveDomain.normalizeTagLabel("새로운 결"));

  assert.ok(created);
  assert.deepEqual(assigned, [existing.id, created.id]);
  assert.deepEqual(tagged.data.cubeTracks[untouched.id], untouchedBefore);
  assert.throws(
    () => archiveDomain.setCubeTrackTags(
      seed,
      target.id,
      Array.from(
        { length: archiveDomain.ARCHIVE_LIMITS.tagsPerCubeTrack + 1 },
        () => "중복 태그",
      ),
    ),
    /태그를 20개까지/,
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

test("migrates schema v5 chapter signatures to current kinds, covers, and private personal-space defaults without guessing ambiguous chapters", async () => {
  const archiveDomain = await loadArchiveDomain();
  const track = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"),
    provider: "youtube",
    providerTrackId: "M7lc1UVf-VE",
    title: "마이그레이션 곡",
    artist: "테스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
  };
  const current = archiveDomain.captureTrackToInbox(
    archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z"),
    track,
    "2026-07-10T00:00:00.000Z",
  );
  const legacy = structuredClone(current);
  legacy.schemaVersion = 5;
  Object.values(legacy.data.cubes).forEach((cube) => {
    delete cube.kind;
    delete cube.systemKey;
  });
  legacy.data.cubes["month:2026-08"] = {
    id: "month:2026-08",
    parentId: null,
    name: "8월",
    description: "8월에 등록한 곡들",
    color: "blue",
    sortOrder: 2,
    source: "user",
    createdAt: legacy.updatedAt,
    updatedAt: legacy.updatedAt,
  };

  const parsed = archiveDomain.parseArchive(JSON.stringify(legacy));
  assert.equal(parsed.status, "ok");
  assert.equal(parsed.archive.schemaVersion, archiveDomain.ARCHIVE_SCHEMA_VERSION);
  assert.equal(parsed.archive.data.cubes["month:2026-07"].kind, "monthly");
  assert.equal(parsed.archive.data.cubes["month:2026-07"].systemKey, "month:2026-07");
  assert.equal(parsed.archive.data.cubes["month:2026-08"].kind, "manual");
  assert.equal(parsed.archive.data.cubes["month:2026-08"].systemKey, null);
  assert.equal(parsed.archive.data.cubes["month:2026-08"].visibility, "private");
  assert.equal(parsed.archive.data.cubes["month:2026-08"].coverImageUrl, null);
  assert.equal(parsed.archive.data.space.themeId, "paper");
});

test("keeps personal space private by default and strips private records from visitor projections", async () => {
  const archiveDomain = await loadArchiveDomain();
  const track = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"),
    provider: "youtube",
    providerTrackId: "M7lc1UVf-VE",
    title: "방문자 테스트 곡",
    artist: "테스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
  };
  const chapter = archiveDomain.createCube(archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z"), { name: "나의 서재" });
  const withTrack = archiveDomain.captureTrackToInbox(chapter.archive, track, "2026-07-02T00:00:00.000Z");
  const memory = archiveDomain.moveInboxTrackToCube(withTrack, track.id, chapter.cube.id, "2026-07-02T00:00:00.000Z");
  const privateProjection = archiveDomain.getVisitorSpaceChapters(memory.archive);
  assert.equal(privateProjection.length, 0);

  const publicChapter = archiveDomain.updateCube(memory.archive, chapter.cube.id, { visibility: "public" });
  const privateRecordProjection = archiveDomain.getVisitorSpaceChapters(publicChapter);
  assert.equal(privateRecordProjection.length, 1);
  assert.equal(privateRecordProjection[0].tracks[0].privateRecord, true);
  assert.deepEqual(privateRecordProjection[0].tracks[0].tags, []);

  const publicRecord = archiveDomain.setCubeTrackRecordVisibility(publicChapter, memory.cubeTrack.id, "public");
  const publicProjection = archiveDomain.getVisitorSpaceChapters(publicRecord);
  assert.equal(publicProjection[0].tracks[0].privateRecord, false);
  assert.equal(publicProjection[0].tracks[0].track.title, "방문자 테스트 곡");
  const space = archiveDomain.updatePersonalSpace(publicRecord, { featuredCubeIds: [chapter.cube.id], themeId: "moss", layoutId: "folio" });
  assert.deepEqual(space.data.space.featuredCubeIds, [chapter.cube.id]);
});

test("includes public child chapters in visitor projections", async () => {
  const archiveDomain = await loadArchiveDomain();
  const parent = archiveDomain.createCube(archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z"), { name: "상위 챕터" });
  const child = archiveDomain.createCube(parent.archive, { name: "공개 하위 챕터", parentId: parent.cube.id, visibility: "public" });
  const projection = archiveDomain.getVisitorSpaceChapters(child.archive);
  assert.equal(projection.length, 1);
  assert.equal(projection[0].chapter.id, child.cube.id);
});

test("stores a custom chapter cover while keeping the album collage as the null default", async () => {
  const archiveDomain = await loadArchiveDomain();
  const image = "data:image/png;base64,aA==";
  const created = archiveDomain.createCube(
    archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z"),
    { name: "표지가 있는 챕터", coverImageUrl: image },
  );
  assert.equal(created.cube.coverImageUrl, image);
  const cleared = archiveDomain.updateCube(created.archive, created.cube.id, { coverImageUrl: null });
  assert.equal(cleared.data.cubes[created.cube.id].coverImageUrl, null);
  assert.throws(
    () => archiveDomain.updateCube(created.archive, created.cube.id, { coverImageUrl: "https://example.com/cover.jpg" }),
    /대표 이미지/,
  );
});

test("makes a custom chapter cover fill the full artwork area", async () => {
  const css = await readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8");
  assert.match(css, /\.chapter-artwork-custom \.chapter-custom-cover\s*\{[^}]*grid-column:\s*1\s*\/\s*-1;[^}]*grid-row:\s*1\s*\/\s*-1;[^}]*object-fit:\s*cover;/s);
});

test("keeps canonical monthly id collisions visible and creates one collision-safe monthly index", async () => {
  const archiveDomain = await loadArchiveDomain();
  const empty = archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z");
  const manual = archiveDomain.createCube(empty, {
    id: "month:2026-07",
    name: "내가 만든 7월",
  }).archive;
  const track = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"),
    provider: "youtube",
    providerTrackId: "M7lc1UVf-VE",
    title: "7월 곡",
    artist: "테스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
  };
  const captured = archiveDomain.captureTrackToInbox(manual, track, "2026-07-10T00:00:00.000Z");
  const monthly = Object.values(captured.data.cubes).filter(
    (cube) => cube.systemKey === "month:2026-07",
  );

  assert.equal(captured.data.cubes["month:2026-07"].kind, "manual");
  assert.equal(monthly.length, 1);
  assert.notEqual(monthly[0].id, "month:2026-07");
  assert.ok(archiveDomain.getUserVisibleChapters(captured).some((cube) => cube.id === "month:2026-07"));
});

test("rejects malformed capture and duplicate monthly system invariants", async () => {
  const archiveDomain = await loadArchiveDomain();
  const empty = archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z");
  const invalidCapture = structuredClone(empty);
  invalidCapture.data.cubes.captureA = {
    id: "captureA", parentId: null, name: "A", description: "", color: "violet",
    kind: "capture", systemKey: "capture", sortOrder: 0, source: "user",
    createdAt: empty.updatedAt, updatedAt: empty.updatedAt,
  };
  invalidCapture.data.cubes.captureB = {
    ...invalidCapture.data.cubes.captureA,
    id: "captureB",
    sortOrder: 1,
  };
  assert.equal(archiveDomain.parseArchive(JSON.stringify(invalidCapture)).status, "invalid");

  const duplicateMonths = structuredClone(empty);
  for (const id of ["month-a", "month-b"]) {
    duplicateMonths.data.cubes[id] = {
      id, parentId: null, name: "7월", description: "7월에 등록한 곡들", color: "violet",
      kind: "monthly", systemKey: "month:2026-07", sortOrder: 0, source: "user",
      createdAt: empty.updatedAt, updatedAt: empty.updatedAt,
    };
  }
  assert.equal(archiveDomain.parseArchive(JSON.stringify(duplicateMonths)).status, "invalid");
});

test("applies capture, tag removal, and identity-preserving move transitions atomically", async () => {
  const archiveDomain = await loadArchiveDomain();
  const track = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"),
    provider: "youtube",
    providerTrackId: "M7lc1UVf-VE",
    title: "전이 테스트",
    artist: "테스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
  };
  const inbox = archiveDomain.captureTrackToInbox(
    archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z"),
    track,
    "2026-07-10T00:00:00.000Z",
  );
  const emptyTagged = archiveDomain.archiveInboxTrackWithTags(
    inbox,
    track.id,
    [],
    "2026-07-11T00:00:00.000Z",
  );
  assert.equal(emptyTagged.archive.data.inbox[track.id], undefined);
  assert.deepEqual(emptyTagged.cubeTrack.tagIds, []);
  assert.equal(archiveDomain.getContextArchiveState(emptyTagged.archive, emptyTagged.cubeTrack.id), "unassigned-draft");

  const archived = archiveDomain.archiveInboxTrackWithTags(
    inbox,
    track.id,
    ["새벽에 달릴 때"],
    "2026-07-11T00:00:00.000Z",
  );
  assert.equal(archived.archive.data.inbox[track.id], undefined);
  assert.equal(archiveDomain.getContextArchiveState(archived.archive, archived.cubeTrack.id), "unassigned-archived");
  assert.equal(archiveDomain.getTrackArchiveSummary(archived.archive, track.id).monthlyContextIds.length, 1);

  const chapter = archiveDomain.createCube(archived.archive, { name: "달리기" }).archive;
  const destination = archiveDomain.getUserVisibleChapters(chapter).find((cube) => cube.name === "달리기");
  const moved = archiveDomain.moveCaptureTrackToCube(
    chapter,
    archived.cubeTrack.id,
    destination.id,
    "2026-07-12T00:00:00.000Z",
  );
  assert.equal(moved.status, "moved");
  assert.equal(moved.cubeTrack.id, archived.cubeTrack.id);
  assert.equal(moved.cubeTrack.createdAt, archived.cubeTrack.createdAt);
  assert.deepEqual(moved.cubeTrack.tagIds, archived.cubeTrack.tagIds);

  const onlyTagId = moved.cubeTrack.tagIds[0];
  const chapterOnly = archiveDomain.setCubeTrackTagIds(
    moved.archive,
    moved.cubeTrack.id,
    [],
    "2026-07-13T00:00:00.000Z",
  );
  assert.equal(archiveDomain.getContextArchiveState(chapterOnly, moved.cubeTrack.id), "chapter-only");
  assert.ok(chapterOnly.data.tags[onlyTagId]);
});

test("merges duplicate unassigned memories into the destination chapter when moving", async () => {
  const archiveDomain = await loadArchiveDomain();
  const track = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"),
    provider: "youtube",
    providerTrackId: "M7lc1UVf-VE",
    title: "Fever",
    artist: "테스트",
    album: "",
    genre: "",
    durationMs: null,
    artworkUrl: null,
    previewUrl: null,
    externalUrl: null,
  };
  const inbox = archiveDomain.captureTrackToInbox(
    archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z"),
    track,
    "2026-07-10T00:00:00.000Z",
  );
  const unassigned = archiveDomain.archiveInboxTrackWithTags(
    inbox,
    track.id,
    ["우연히 들은 노래"],
    "2026-07-11T00:00:00.000Z",
  );
  const chapter = archiveDomain.createCube(unassigned.archive, {
    id: "cube:destination",
    name: "이전 챕터",
  });
  const existing = archiveDomain.addTrackToCube(
    chapter.archive,
    track.id,
    chapter.cube.id,
    "2026-07-12T00:00:00.000Z",
  );

  const moved = archiveDomain.moveCaptureTrackToCube(
    existing.archive,
    unassigned.cubeTrack.id,
    chapter.cube.id,
    "2026-07-13T00:00:00.000Z",
  );

  assert.equal(moved.status, "duplicate");
  assert.equal(moved.archive.data.cubeTracks[unassigned.cubeTrack.id], undefined);
  assert.equal(
    archiveDomain.searchArchive(moved.archive, { tagLabels: ["우연히 들은 노래"] }).length,
    1,
  );
  assert.equal(
    archiveDomain.searchArchive(archiveDomain.deleteCube(moved.archive, chapter.cube.id), { tagLabels: ["우연히 들은 노래"] }).length,
    0,
  );
});

test("keeps empty unassigned memories and restores Inbox only when the memory is removed", async () => {
  const archiveDomain = await loadArchiveDomain();
  const track = {
    id: archiveDomain.makeProviderTrackId("youtube", "M7lc1UVf-VE"), provider: "youtube",
    providerTrackId: "M7lc1UVf-VE", title: "태그 제거", artist: "테스트", album: "", genre: "",
    durationMs: null, artworkUrl: null, previewUrl: null, externalUrl: null,
  };
  const inbox = archiveDomain.captureTrackToInbox(
    archiveDomain.createEmptyArchive("2026-07-01T00:00:00.000Z"), track, "2026-07-10T00:00:00.000Z",
  );
  const archived = archiveDomain.archiveInboxTrackWithTags(inbox, track.id, ["다시 찾기"]);
  const reverted = archiveDomain.setCubeTrackTagIds(archived.archive, archived.cubeTrack.id, []);
  assert.deepEqual(reverted.data.cubeTracks[archived.cubeTrack.id].tagIds, []);
  assert.equal(reverted.data.inbox[track.id], undefined);

  const restored = archiveDomain.removeCubeTrack(reverted, archived.cubeTrack.id);
  assert.equal(restored.data.cubeTracks[archived.cubeTrack.id], undefined);
  assert.ok(restored.data.inbox[track.id]);

  const archivedAgain = archiveDomain.archiveInboxTrackWithTags(restored, track.id, ["메모 있음"]);
  const withNote = archiveDomain.addCubeTrackNote(
    archivedAgain.archive,
    archivedAgain.cubeTrack.id,
    { listenedOn: "2026-07-17", body: "나중에도 남길 메모" },
  );
  const draft = archiveDomain.setCubeTrackTagIds(withNote, archivedAgain.cubeTrack.id, []);
  assert.equal(archiveDomain.getContextArchiveState(draft, archivedAgain.cubeTrack.id), "unassigned-draft");
  assert.equal(draft.data.inbox[track.id], undefined);
});

test("deduplicates tag groups by track while preserving each contextual memory", async () => {
  const archiveDomain = await loadArchiveDomain();
  const seed = archiveDomain.createSeedArchive();
  const radioMemories = Object.values(seed.data.cubeTracks).filter(
    (memory) => memory.trackId === archiveDomain.makeTrackId(1569294423),
  );
  const tagged = radioMemories.reduce(
    (archive, memory) => archiveDomain.setCubeTrackTags(archive, memory.id, ["Radio 다시 찾기"]),
    seed,
  );
  const tag = Object.values(tagged.data.tags).find((item) => item.label === "Radio 다시 찾기");
  const results = archiveDomain.getTagGroupResults(tagged, [tag.id]);
  const radio = results.find((result) => result.track.id === archiveDomain.makeTrackId(1569294423));

  assert.equal(results.filter((result) => result.track.id === radio.track.id).length, 1);
  assert.equal(radio.memories.length, 4);
  assert.notEqual(radio.memories[0].cubeTrack.id, radio.memories[1].cubeTrack.id);
  assert.equal(archiveDomain.getTagGroups(tagged).find((group) => group.tag.id === tag.id).trackCount, 1);
});

test("uses one flat library of personal experience tags", async () => {
  const [memorySource, pickerSource, managerSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-tag-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-tags.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(memorySource, /TAG_SUGGESTIONS|id="custom-tag"/);
  assert.match(pickerSource, /manageHref = "\/tags"/);
  assert.match(pickerSource, /어떤 순간에 다시 찾고 싶나요\?/);
  assert.match(pickerSource, /태그 검색 또는 새 태그 만들기/);
  assert.match(pickerSource, /onCreate\?: \(label: string\) => boolean/);
  assert.doesNotMatch(pickerSource, /TAG_PICKER_CATEGORIES|CATEGORY_LABEL|activeCategory|EditableTagCategory/);
  assert.match(managerSource, /id="bulk-tags"/);
  assert.match(managerSource, /\.split\(\/\[\\n,;\]\+\//);
  assert.match(managerSource, /newCandidates\.map\(\(label\) => label\)/);
  assert.doesNotMatch(managerSource, /MANUAL_TAG_CATEGORIES|bulk-category|editCategory|태그 카테고리/);
});

test("keeps the memory form focused on tags, an optional dated memo, and one completion action", async () => {
  const [chapterSource, managerSource, discoverySource, pickerSource, archiveSource, tagLinkSource, css, appSource] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-tags.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-tag-picker.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/archive.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-tag-link.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
  ]);
  const memoryPanelSource = sliceBetween(
    chapterSource,
    "export function MemoryPanel(",
    "interface TagEditorProps {",
    "MemoryPanel source",
  );
  const memorySource = sliceBetween(
    chapterSource,
    "export function Memory(",
    undefined,
    "Memory source",
  );
  const memoryFormSource = sliceBetween(
    memorySource,
    '<form className="memory-form form-stack"',
    "{assigning ? (",
    "Memory form source",
  );
  const persistSource = sliceBetween(
    memorySource,
    "function persist(",
    "function save(",
    "Memory persist source",
  );

  assert.match(memorySource, /title="곡 기록"/);
  assert.match(memorySource, /eyebrow=\{cube\.kind === "capture" \? "챕터 미분류" : formatChapterTitle\(cube\)\}/);
  assert.doesNotMatch(memorySource, /개인 기록 · \$\{formatChapterTitle\(cube\)\}/);
  assert.match(memoryFormSource, /<TagEditor/);
  assert.doesNotMatch(memoryFormSource, /memory-record-visibility/);
  assert.match(memorySource, /recordVisibilityAction/);
  assert.match(memorySource, /<Unlock size=\{14\}/);
  assert.match(memorySource, /<Lock size=\{14\}/);
  assert.doesNotMatch(memoryFormSource, /기록 공개|기록 비공개/);
  assert.match(discoverySource, /<TagPicker/);
  assert.doesNotMatch(memoryFormSource, /managed-tag-groups|managed-tag-option|inline-tag-composer|period-tag-group|추가 시기 · 자동/);
  assert.doesNotMatch(managerSource, /TAG_LIBRARY_CATEGORIES|category === "period"|추가일 기준 자동/);
  assert.match(pickerSource, /role="group" aria-label="태그 목록"/);
  assert.match(pickerSource, /panelTitle = "태그"/);
  assert.match(pickerSource, /tag-picker-create-wide/);
  assert.match(pickerSource, /className="button button-primary tag-picker-confirm"/);
  assert.match(chapterSource, /manageHref=\{memoryReturnId[\s\S]*?\/tags\?fromMemory=\$\{encodeURIComponent\(memoryReturnId\)\}/s);
  assert.match(appSource, /case "tags":[\s\S]*?fromMemoryId && archive\.data\.cubeTracks\[fromMemoryId\][\s\S]*?label: "곡 기록으로"/s);
  assert.doesNotMatch(pickerSource, /카테고리|category/);
  assert.doesNotMatch(archiveSource, /"period",\s*\n\] as const/);
  assert.match(css, /\.page-header-description\s*\{[^}]*font-size:\s*14px;[^}]*word-break:\s*keep-all;/s);
  assert.match(css, /\.page-header h1,[\s\S]*?\.capture-search-header h1\s*\{[^}]*overflow-wrap:\s*normal;[^}]*word-break:\s*keep-all;/s);
  assert.doesNotMatch(css, /\.memory-view \.page-header h1\s*\{[^}]*overflow-wrap:\s*anywhere;/s);
  assert.match(memorySource, /htmlFor="memory-note-date"/);
  assert.match(memoryFormSource, /className="memory-note-date-row"/);
  assert.match(memorySource, /id="memory-note-body"/);
  assert.match(memorySource, /getCubeTrackNotes\(activeCubeTrack\)/);
  assert.match(memorySource, /function deleteCurrentMemory\(\)/);
  assert.match(memorySource, /removeCubeTrack\(archive, activeCubeTrack\.id\)/);
  assert.match(memorySource, /router\.push\(\s*activeCube\.kind === "capture" \? "\/inbox" : `\/chapter\?id=\$\{encodeURIComponent\(activeCube\.id\)\}`/s);
  assert.doesNotMatch(memoryFormSource, /자동 저장됨|저장 중…|memory-autosave-status/);
  assert.match(memoryFormSource, /className="button memory-record-delete"[\s\S]*?곡 기록 삭제/s);
  assert.match(memoryFormSource, /className="button button-primary memory-record-submit"[\s\S]*?기록하기/s);
  assert.match(memoryFormSource, /<h2 id="memory-note-title"(?: className="field-label")?>메모<\/h2>/);
  assert.doesNotMatch(memoryFormSource, /메모 · 선택|한 줄 남기기/);
  assert.match(memoryFormSource, /memoryReturnId=\{activeCubeTrack\.id\}/);
  assert.match(tagLinkSource, /options: \{ fromMemoryId\?: string \}/);
  assert.match(tagLinkSource, /params\.set\("fromMemory", options\.fromMemoryId\)/);
  assert.doesNotMatch(memoryFormSource, /htmlFor="character"|id="character"|memory-period-|기억한 시기|더 남기기/);
  assert.doesNotMatch(memoryFormSource, /나중에 이어서|다른 챕터에도 기록|기록하고 .*으로 돌아가기/);
  assert.doesNotMatch(memoryPanelSource, /PreviewButton|target="_blank"|기록 이미지 만들기 · 실험|memory-preview-actions/);
  assert.doesNotMatch(persistSource, /updateCubeTrack\(|\bcharacter\b|\bmemoryPeriod\b/);
  assert.match(persistSource, /setCubeTrackTagIds\(created\.archive/);
  assert.match(persistSource, /if \(noteBody\.trim\(\)\) \{/);
  assert.match(persistSource, /editingNote\?\.listenedOn === null[\s\S]*?updateCubeTrackNoteBody/s);
  assert.doesNotMatch(persistSource, /action:\s*\{[\s\S]*?href:\s*activeTrack\.externalUrl[\s\S]*?external:\s*true/s);
  assert.match(persistSource, /commit\(next, message\)/);
  assert.match(memoryFormSource, /날짜 미지정 · 기존 기록/);
  assert.match(memorySource, /reconcileTagSelection\([\s\S]*?baselineTagIdsRef\.current/s);
  assert.match(memorySource, /setTimeout\(\(\) => setAssigning\(openChapterMove\), 0\);[\s\S]*?\[cubeTrackId, openChapterMove\]/s);
  assert.doesNotMatch(discoverySource, /cubeTrack\.character \|\| formatMemory|formatMemory\(memory\.cubeTrack\.memoryPeriod\)/);
  assert.match(css, /\.memory-note-date-row\s*\{[^}]*min-height:\s*44px;/s);
  assert.doesNotMatch(css, /\.memory-autosave-status\s*\{/);
  assert.match(css, /\.memory-record-footer\s*\{[^}]*position:\s*fixed;[^}]*bottom:\s*calc\(70px \+ 12px \+ env\(safe-area-inset-bottom\)\);/s);
  assert.match(css, /\.memory-record-footer\s*\{[^}]*grid-template-columns:\s*minmax\(0, 0\.42fr\) minmax\(0, 0\.58fr\);/s);
  assert.match(css, /\.memory-record-delete\s*\{[^}]*min-height:\s*50px;[^}]*var\(--apple-danger\)/s);
  assert.match(css, /\.memory-record-submit\s*\{[^}]*min-height:\s*50px;/s);
  assert.doesNotMatch(css, /\.memory-details-disclosure|\.memory-period-controls|\.memory-preview-actions/);
});

test("keeps recap creation contextual and modal blur calm", async () => {
  const [source, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-views-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);
  const recapSource = source.slice(source.indexOf("export function Recap("), source.indexOf("export function Settings("));
  const appleTheme = getAppleTheme(css);

  assert.match(recapSource, /<PageHeader[\s\S]*?eyebrow="회고"[\s\S]*?title=\{label\[mode\]\}/s);
  assert.match(recapSource, />회고 만들기<\/button>/);
  assert.match(recapSource, /className="dialog recap-create-dialog"/);
  assert.doesNotMatch(recapSource, /2026-06-07 데일리 요약/);
  assert.match(
    appleTheme,
    /\.dialog-backdrop,[\s\S]*?\.player-backdrop\s*\{[^}]*background:\s*rgba\(0, 0, 0, 0\.38\);[^}]*backdrop-filter:\s*saturate\(110%\) blur\(20px\) !important;/s,
  );
});

test("builds a published public discovery catalog with explainable similarity and local interactions", async () => {
  const [archiveDomain, discoveryDomain] = await Promise.all([
    loadArchiveDomain(),
    loadPublicDiscoveryDomain(),
  ]);
  const archive = archiveDomain.createSeedArchive();
  const sharedTrack = Object.values(archive.data.tracks)[0];
  const catalog = discoveryDomain.createPublicDiscoveryCatalog([{
    authorId: "user-1",
    authorName: "뮤키 사용자",
    payload: {
      id: "public:user-1:chapter-1",
      profileId: "user-1",
      name: "공개한 챕터",
      description: "실제 사용자 공개 피드 fixture",
      color: "violet",
      artworkUrl: null,
      createdAt: "2026-07-20T12:00:00.000Z",
      likeCount: 0,
      tracks: [
        { id: "record-1", track: sharedTrack, visibility: "public", note: "공개 메모", tags: ["밤 산책"] },
        { id: "record-2", track: sharedTrack, visibility: "private", note: null, tags: [] },
      ],
    },
  }]);
  const state = discoveryDomain.createDiscoveryInteractionState();
  const profiles = Object.values(catalog.profiles);
  const chapters = Object.values(catalog.chapters);

  assert.equal(profiles.length, 1);
  assert.equal(chapters.length, 1);
  assert.ok(profiles.every((profile) => chapters.filter((chapter) => chapter.profileId === profile.id).length === 1));
  assert.ok(profiles.every((profile) => profile.space.featuredChapterIds.length === 1));
  assert.ok(profiles.every((profile) => profile.space.featuredChapterIds.every((chapterId) => catalog.chapters[chapterId]?.profileId === profile.id)));
  assert.ok(chapters.every((chapter) => chapter.tracks.length === 2));

  const ranked = discoveryDomain.rankPublicChapters(archive, catalog);
  assert.ok(ranked.length > 0);
  assert.ok(ranked[0].sharedTrackCount > 0);
  assert.match(ranked[0].reason, /겹치는 곡/);

  const privateRecord = chapters.flatMap((chapter) => chapter.tracks).find((track) => track.visibility === "private");
  assert.ok(privateRecord);
  assert.equal(privateRecord.note, null);
  assert.deepEqual(privateRecord.tags, []);

  const profileId = profiles[0].id;
  const followed = discoveryDomain.toggleFollow(state, profileId);
  assert.ok(followed.followedProfileIds.includes(profileId));
  assert.deepEqual(discoveryDomain.parseDiscoveryInteractionState(
    discoveryDomain.serializeDiscoveryInteractionState(followed),
    catalog,
  ), followed);

  assert.deepEqual(discoveryDomain.createEmptyPublicDiscoveryCatalog(), {
    profiles: {}, chapters: {}, activities: [],
  });
});

test("uses shared chapter components for public discovery details and playlist export", async () => {
  const [typesSource, shellSource, appSource, dataProviderSource, discoverySource, chapterSource, playlistSource, css] = await Promise.all([
    readFile(new URL("../app/_components/editorial-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-shell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-app.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/muchi-data-provider.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-public-discovery.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-chapters.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/_components/editorial-views-playlist.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/apple-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(typesSource, /\| "discover"/);
  assert.match(typesSource, /\| "discoverChapter"/);
  assert.match(shellSource, /MOBILE_NAV = \["home", "discover", "capture", "chapters", "search"\]/);
  assert.match(shellSource, /item === "discover" && \(view === "discoverChapter" \|\| view === "discoverProfile" \|\| discoverPlaylist\)/);
  assert.match(shellSource, /discoverPlaylist = view === "playlist" && searchParams\.get\("source"\) === "discover"/);
  assert.match(appSource, /case "discover":/);
  assert.match(appSource, /case "discoverChapter":/);
  assert.match(dataProviderSource, /fetchDiscoveryState/);
  assert.match(dataProviderSource, /fetchPublicDiscoveryCatalog/);
  assert.match(dataProviderSource, /setCatalog\(catalogResult\)/);
  assert.match(discoverySource, /기록이 비공개입니다/);
  assert.match(discoverySource, /ChapterDetailHero/);
  assert.match(discoverySource, /ChapterTrackSection/);
  assert.match(discoverySource, /ChapterPlaylistActions/);
  assert.match(discoverySource, /ChapterCover/);
  assert.doesNotMatch(discoverySource, /PublicTrackRecord|public-chapter-hero|public-playlist-button/);
  assert.match(chapterSource, /export function ChapterDetailHero/);
  assert.match(chapterSource, /export function ChapterTrackSection/);
  assert.match(chapterSource, /export function ChapterPlaylistActions/);
  const publicChapterSource = discoverySource.slice(
    discoverySource.indexOf("export function PublicChapterDetail("),
    discoverySource.indexOf("export function PublicProfileDetail("),
  );
  const publicProfileSource = discoverySource.slice(discoverySource.indexOf("export function PublicProfileDetail("));
  assert.match(publicChapterSource, /public-like-button/);
  assert.match(publicChapterSource, /좋아요 \{chapter\.likeCount\}/);
  assert.doesNotMatch(publicChapterSource, /utilitiesOutsideCopy/);
  assert.match(publicChapterSource, /meta=\{`\$\{chapter\.tracks\.length\}곡`\}/);
  assert.doesNotMatch(publicChapterSource, /공개 챕터 ·|공개 기록/);
  assert.match(publicChapterSource, /className="public-chapter-owner"/);
  assert.match(publicChapterSource, /<ProfileStamp profile=\{profile\} showHandle=\{false\} \/>/);
  assert.match(publicChapterSource, /item\.visibility === "private"[\s\S]*?기록 비공개[\s\S]*?: undefined/);
  assert.match(chapterSource, /canExpand \? \([\s\S]*?<ChevronDown[\s\S]*?\) : \([\s\S]*?is-static/s);
  assert.doesNotMatch(publicChapterSource, /"공개 기록"\s*:\s*"비공개 기록"/);
  assert.doesNotMatch(publicChapterSource, /leading=\{/);
  assert.doesNotMatch(publicChapterSource, /FollowButton/);
  assert.match(publicProfileSource, /<FollowButton/);
  assert.match(discoverySource, /팔로잉 새 글/);
  assert.match(discoverySource, /Bell/);
  assert.match(publicProfileSource, /<MusicRoomFrame/);
  assert.match(publicProfileSource, /profile\.space\.featuredChapterIds/);
  assert.match(publicProfileSource, /전체 챕터 보기/);
  assert.doesNotMatch(publicProfileSource, /<ChapterFeedLine item=/);
  assert.match(playlistSource, /export type PlaylistSource/);
  assert.match(playlistSource, /playlistSource\?: PlaylistSource \| null/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
  assert.match(css, /\.public-chapter-owner\s*\{[^}]*display:\s*flex;[^}]*background:\s*var\(--apple-canvas\);/s);
  assert.doesNotMatch(css, /\.public-chapter-hero\s*\{/);

  for (const pathname of ["/discover", "/discover/chapter?id=public%3Achapter%3Asoyeon%3A1", "/discover/profile?id=public%3Aprofile%3Asoyeon"]) {
    const response = await render(pathname);
    assert.equal(response.status, 200, pathname);
  }
});
