import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

async function loadYoutubeApi() {
  const source = await readFile(
    new URL("../lib/server/youtube-api.ts", import.meta.url),
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

test("creates a private YouTube playlist with the provider bearer token", async () => {
  const api = await loadYoutubeApi();
  const originalFetch = globalThis.fetch;
  let requestUrl;
  let requestInit;
  globalThis.fetch = async (input, init) => {
    requestUrl = new URL(
      typeof input === "string" || input instanceof URL ? input : input.url,
    );
    requestInit = init;
    return Response.json({ id: "PL-private-list" });
  };

  try {
    const playlistId = await api.createYoutubePlaylist(
      "provider-token",
      "My playlist",
    );
    assert.equal(playlistId, "PL-private-list");
    assert.equal(requestUrl.pathname, "/youtube/v3/playlists");
    assert.equal(requestUrl.searchParams.get("part"), "snippet,status");
    assert.equal(requestInit.method, "POST");
    assert.equal(requestInit.headers.Authorization, "Bearer provider-token");
    assert.deepEqual(JSON.parse(requestInit.body), {
      snippet: { title: "My playlist" },
      status: { privacyStatus: "private" },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("preserves YouTube permission error reasons for reconnect guidance", async () => {
  const api = await loadYoutubeApi();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({
    error: {
      code: 403,
      message: "Insufficient Permission",
      errors: [{ reason: "insufficientPermissions" }],
    },
  }, { status: 403 });

  try {
    await assert.rejects(
      api.insertYoutubePlaylistItem(
        "provider-token",
        "PL-private-list",
        "abcdefghijk",
      ),
      (error) => (
        error instanceof api.YoutubeApiError
        && error.status === 403
        && error.reason === "insufficientPermissions"
      ),
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
