import type { TrackReference } from "@/lib/archive";
import { ApiAuthError, requireAuthenticatedUser } from "@/lib/server/auth";

type ExportTrack = Pick<TrackReference, "id" | "title" | "artist" | "album" | "provider" | "providerTrackId">;
type Candidate = { id: string; title: string; artist: string; album: string };
type SearchResult = { candidates: Candidate[]; errorCode?: string };

function validTracks(value: unknown): value is ExportTrack[] {
  return Array.isArray(value) && value.length > 0 && value.length <= 100 && value.every((track) => track && typeof track === "object" && typeof (track as ExportTrack).id === "string" && typeof (track as ExportTrack).title === "string" && typeof (track as ExportTrack).artist === "string");
}

async function youtube(token: string, path: string, init?: RequestInit) {
  return fetch(`https://www.googleapis.com/youtube/v3${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers } });
}

async function searchTrack(track: ExportTrack, token: string): Promise<SearchResult> {
  if (track.provider === "youtube" && typeof track.providerTrackId === "string") return { candidates: [{ id: track.providerTrackId, title: track.title, artist: track.artist, album: track.album }] };
  const response = await youtube(token, `/search?part=snippet&type=video&maxResults=5&regionCode=KR&relevanceLanguage=ko&q=${encodeURIComponent(`${track.title} ${track.artist}`)}`);
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { errors?: Array<{ reason?: string }>; status?: string } } | null;
    return { candidates: [], errorCode: body?.error?.errors?.[0]?.reason ?? body?.error?.status ?? `http_${response.status}` };
  }
  const body = await response.json() as { items?: Array<{ id?: { videoId?: string }; snippet?: { title?: string; channelTitle?: string } }> };
  return { candidates: (body.items ?? []).flatMap((item) => item.id?.videoId ? [{ id: item.id.videoId, title: item.snippet?.title ?? track.title, artist: item.snippet?.channelTitle ?? track.artist, album: "" }] : []) };
}

export async function POST(request: Request) {
  try {
    await requireAuthenticatedUser();
    const body = await request.json().catch(() => null) as { action?: unknown; accessToken?: unknown; tracks?: unknown; playlistName?: unknown; selections?: unknown } | null;
    if (!body || typeof body.accessToken !== "string" || !body.accessToken || !validTracks(body.tracks)) return Response.json({ code: "invalid_request", message: "내보낼 곡 정보가 올바르지 않습니다." }, { status: 400 });
    if (body.action === "match") {
      const matches = await Promise.all(body.tracks.map(async (track) => {
        const result = await searchTrack(track, body.accessToken as string);
        return { trackId: track.id, candidates: result.candidates, errorCode: result.errorCode };
      }));
      const errorCode = matches.find((match) => match.errorCode)?.errorCode;
      return Response.json({ matches, errorCode });
    }
    if (body.action !== "export" || typeof body.playlistName !== "string" || !Array.isArray(body.selections)) return Response.json({ code: "invalid_request", message: "플레이리스트 정보가 올바르지 않습니다." }, { status: 400 });
    const videoIds = body.selections.filter((value): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{11}$/.test(value)).slice(0, 100);
    if (!videoIds.length) return Response.json({ code: "invalid_request", message: "내보낼 곡을 하나 이상 선택해 주세요." }, { status: 400 });
    const created = await youtube(body.accessToken, "/playlists?part=snippet,status", { method: "POST", body: JSON.stringify({ snippet: { title: body.playlistName.trim() }, status: { privacyStatus: "private" } }) });
    if (!created.ok) return Response.json({ code: "youtube_error", message: "YouTube Music 플레이리스트를 만들지 못했어요. 연결 권한을 다시 확인해 주세요." }, { status: 400 });
    const playlist = await created.json() as { id?: string };
    if (!playlist.id) throw new Error("missing_playlist");
    const added = await Promise.all(videoIds.map((videoId) => youtube(body.accessToken as string, "/playlistItems?part=snippet", { method: "POST", body: JSON.stringify({ snippet: { playlistId: playlist.id, resourceId: { kind: "youtube#video", videoId } } }) })));
    const addedCount = added.filter((response) => response.ok).length;
    return Response.json({ playlistId: playlist.id, addedCount, url: `https://music.youtube.com/playlist?list=${encodeURIComponent(playlist.id)}` });
  } catch (cause) {
    if (cause instanceof ApiAuthError) return Response.json({ code: "unauthenticated", message: cause.message }, { status: 401 });
    return Response.json({ code: "unavailable", message: "YouTube Music 요청을 처리하지 못했어요." }, { status: 503 });
  }
}
