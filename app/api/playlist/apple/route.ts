import type { TrackReference } from "@/lib/archive";
import { createAppleMusicDeveloperToken } from "@/lib/server/apple-music";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";

type Candidate = { id: string; title: string; artist: string; album: string };
type ExportTrack = Pick<TrackReference, "id" | "title" | "artist" | "album" | "provider" | "providerTrackId">;

function fail(message: string, status = 400) {
  return Response.json({ code: "invalid_request", message }, { status });
}

function validTracks(value: unknown): value is ExportTrack[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every((track) => (
    track && typeof track === "object" && typeof (track as ExportTrack).id === "string"
      && typeof (track as ExportTrack).title === "string" && typeof (track as ExportTrack).artist === "string"
  ));
}

async function appleRequest(path: string, userToken: string, init?: RequestInit) {
  const developerToken = createAppleMusicDeveloperToken();
  if (!developerToken) throw new Error("not_configured");
  return fetch(`https://api.music.apple.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${developerToken}`, "Music-User-Token": userToken, "Content-Type": "application/json", ...init?.headers },
  });
}

async function searchTrack(track: ExportTrack, userToken: string): Promise<Candidate[]> {
  const term = encodeURIComponent(`${track.title} ${track.artist}`.trim());
  const response = await appleRequest(`/v1/catalog/kr/search?term=${term}&types=songs&limit=5`, userToken);
  if (!response.ok) return [];
  const body = await response.json() as { results?: { songs?: { data?: Array<{ id: string; attributes?: { name?: string; artistName?: string; albumName?: string } }> } } };
  return (body.results?.songs?.data ?? []).map((song) => ({
    id: song.id,
    title: song.attributes?.name ?? track.title,
    artist: song.attributes?.artistName ?? track.artist,
    album: song.attributes?.albumName ?? "",
  }));
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json().catch(() => null) as { action?: unknown; userToken?: unknown; tracks?: unknown; playlistName?: unknown; selections?: unknown } | null;
    if (!body || typeof body.userToken !== "string" || !body.userToken || !validTracks(body.tracks)) return fail("내보낼 곡 정보가 올바르지 않습니다.");
    if (body.action === "match") {
      const matches = await Promise.all(body.tracks.map(async (track) => ({ trackId: track.id, candidates: await searchTrack(track, body.userToken as string) })));
      return Response.json({ matches }, { headers: { "Cache-Control": "private, no-store" } });
    }
    if (body.action !== "export" || typeof body.playlistName !== "string" || !body.playlistName.trim() || !Array.isArray(body.selections)) return fail("플레이리스트 정보가 올바르지 않습니다.");
    const ids = body.selections.filter((value): value is string => typeof value === "string" && value.length > 0).slice(0, 100);
    if (!ids.length) return fail("내보낼 곡을 하나 이상 선택해 주세요.");
    const response = await appleRequest("/v1/me/library/playlists", body.userToken, {
      method: "POST",
      body: JSON.stringify({ attributes: { name: body.playlistName.trim() }, relationships: { tracks: { data: ids.map((id) => ({ id, type: "songs" })) } } }),
    });
    if (!response.ok) return Response.json({ code: "apple_error", message: "Apple Music 플레이리스트를 만들지 못했어요." }, { status: response.status >= 400 && response.status < 500 ? 400 : 503 });
    const result = await response.json() as { data?: Array<{ id?: string }> };
    return Response.json({ playlistId: result.data?.[0]?.id ?? null, url: "https://music.apple.com/library/playlist" });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return Response.json({ code: "unauthenticated", message: cause.message }, { status: 401 });
    if (cause instanceof Error && cause.message === "not_configured") return Response.json({ code: "not_configured", message: "Apple Music 연동 설정이 아직 완료되지 않았어요." }, { status: 503 });
    return Response.json({ code: "unavailable", message: "Apple Music 요청을 처리하지 못했어요." }, { status: 503 });
  }
}
