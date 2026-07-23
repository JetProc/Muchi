import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadMatcher() {
  const source = await readFile(
    new URL("../lib/server/youtube-track-matcher.ts", import.meta.url),
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  return import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
}

const track = {
  id: "itunes:1",
  provider: "itunes",
  providerTrackId: 1,
  title: "Radio",
  artist: "Lana Del Rey",
  album: "Did you know that there's a tunnel under Ocean Blvd",
  durationMs: 229_000,
};

function video(overrides = {}) {
  return {
    id: "abcdefghijk",
    title: "Lana Del Rey - Radio (Official Audio)",
    channelTitle: "Lana Del Rey - Topic",
    description: "Did you know that there's a tunnel under Ocean Blvd",
    thumbnailUrl: "https://i.ytimg.com/vi/abcdefghijk/hqdefault.jpg",
    durationMs: 229_000,
    categoryId: "10",
    ...overrides,
  };
}

test("auto-selects a strong official YouTube music match", async () => {
  const matcher = await loadMatcher();
  const candidates = matcher.rankYoutubeCandidates(track, [video()]);
  const result = matcher.classifyYoutubeMatch(track.id, candidates);

  assert.ok(candidates[0].score >= 90);
  assert.equal(candidates[0].confidence, "high");
  assert.equal(result.status, "matched");
  assert.equal(result.selectedId, "abcdefghijk");
});

test("penalizes an unintended live or cover variant", async () => {
  const matcher = await loadMatcher();
  const original = matcher.scoreYoutubeCandidate(track, video());
  const liveCover = matcher.scoreYoutubeCandidate(
    track,
    video({
      id: "lmnopqrstuv",
      title: "Radio (Live Cover)",
      channelTitle: "Fan Sessions",
    }),
  );

  assert.ok(liveCover.score < original.score);
  assert.ok(liveCover.reasons.some((reason) => reason.includes("라이브 버전")));
  assert.ok(liveCover.reasons.some((reason) => reason.includes("커버 버전")));
});

test("requires review when the leading candidates are too close", async () => {
  const matcher = await loadMatcher();
  const result = matcher.classifyYoutubeMatch(track.id, [
    {
      ...matcher.scoreYoutubeCandidate(track, video()),
      score: 92,
    },
    {
      ...matcher.scoreYoutubeCandidate(
        track,
        video({ id: "lmnopqrstuv", channelTitle: "Lana Del Rey VEVO" }),
      ),
      score: 87,
    },
  ]);

  assert.equal(result.status, "review");
  assert.equal(result.selectedId, null);
  assert.equal(result.candidates.length, 2);
});

test("hides candidates below the minimum review score", async () => {
  const matcher = await loadMatcher();
  const result = matcher.classifyYoutubeMatch(track.id, [{
    ...matcher.scoreYoutubeCandidate(
      track,
      video({
        title: "Unrelated karaoke night",
        channelTitle: "Unknown",
        description: "",
        durationMs: 40_000,
      }),
    ),
    score: matcher.YOUTUBE_REVIEW_SCORE - 1,
  }]);

  assert.equal(result.status, "missing");
  assert.equal(result.selectedId, null);
  assert.deepEqual(result.candidates, []);
});
