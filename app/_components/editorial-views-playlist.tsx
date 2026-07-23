"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, CircleCheck, ExternalLink, ListMusic, Play, Search } from "lucide-react";
import { getCubeTracks, isUserVisibleChapter, type ArchiveEnvelopeV1, type TrackId, type TrackReference } from "@/lib/archive";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MotionLink as Link } from "./editorial-motion";
import { formatTrackArtist } from "./editorial-format";
import { EmptyState, TrackLine } from "./editorial-ui";
import { MusicServiceIcon, type MusicServiceId } from "./editorial-service-icon";

export type PlaylistStep = 1 | 2 | 3 | "done";
export type PlaylistSource = { id: string; name: string; description: string; tracks: TrackReference[]; returnHref: string };
type Candidate = {
  id: string;
  title: string;
  artist?: string;
  album?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  durationMs?: number | null;
  score?: number;
  confidence?: "high" | "medium" | "low";
  reasons?: string[];
  url?: string;
  youtubeMusicUrl?: string;
};
type MatchStatus = "auto" | "review" | "missing";
type TrackMatch = {
  trackId: TrackId;
  status: MatchStatus;
  candidates: Candidate[];
  selectedId: string | null;
  excluded: boolean;
  errorCode?: string;
};
type MusicService = { id: MusicServiceId; name: string; url: string; status?: "soon" };

const MUSIC_SERVICES: MusicService[] = [
  { id: "apple", name: "Apple Music", url: "https://music.apple.com/", status: "soon" },
  { id: "youtube", name: "YouTube Music", url: "https://music.youtube.com/" },
];
const STEP_LABEL = ["곡 확인", "서비스 선택", "매칭 확인"] as const;
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube";

function isMusicServiceId(value: string | null): value is MusicServiceId { return value === "apple" || value === "youtube"; }
function youtubeErrorMessage(errorCode: string | undefined) {
  if (errorCode === "insufficientPermissions" || errorCode === "forbidden" || errorCode === "unauthorized") return "Google 계정의 YouTube 권한이 필요해요. 권한을 다시 연결해 주세요.";
  if (errorCode === "quotaExceeded") return "YouTube 검색 한도를 초과했어요. 잠시 후 다시 시도해 주세요.";
  if (errorCode === "accessNotConfigured") return "YouTube Data API가 아직 활성화되지 않았어요.";
  return "YouTube 검색 중 오류가 발생했어요. 다시 연결해 주세요.";
}
function canReconnectYoutube(errorCode: string | undefined) {
  return errorCode === "insufficientPermissions" || errorCode === "forbidden" || errorCode === "unauthorized" || errorCode === "youtubeSignupRequired";
}
function isMatchStatus(value: unknown): value is MatchStatus {
  return value === "auto" || value === "review" || value === "missing";
}
function formatDuration(durationMs: number | null | undefined) {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs)) return null;
  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}
function candidateMusicUrl(candidate: Candidate) {
  return candidate.url ?? candidate.youtubeMusicUrl ?? `https://music.youtube.com/watch?v=${encodeURIComponent(candidate.id)}`;
}
function youtubeOAuthCallbackUrl() {
  const next = new URL(window.location.href);
  next.searchParams.delete("code");
  next.searchParams.set("youtubeAuth", "granted");
  const callback = new URL("/auth/callback", next.origin);
  callback.searchParams.set("next", `${next.pathname}${next.search}${next.hash}`);
  return callback.toString();
}
async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: unknown; errorCode?: unknown; code?: unknown };
  if (!response.ok) {
    const error = new Error(typeof body.message === "string" ? body.message : "음악 서비스를 연결하지 못했어요.") as Error & { code?: string };
    const code = typeof body.errorCode === "string" ? body.errorCode : typeof body.code === "string" ? body.code : undefined;
    error.code = code;
    throw error;
  }
  return body;
}

export function PlaylistBuilder({ archive, chapterId, playlistSource, initialServiceId, youtubeAuthGranted, step, onStepChange }: {
  archive: ArchiveEnvelopeV1; chapterId: string | null; playlistSource?: PlaylistSource | null; initialServiceId: string | null; youtubeAuthGranted: boolean; step: PlaylistStep; onStepChange: (step: PlaylistStep) => void;
}) {
  const requestedChapter = chapterId ? archive.data.cubes[chapterId] : null;
  const chapter = isUserVisibleChapter(requestedChapter) ? requestedChapter : null;
  const localSource = chapter ? { id: chapter.id, name: chapter.name, description: chapter.description, tracks: getCubeTracks(archive, chapter.id).map((entry) => entry.track), returnHref: `/chapter?id=${encodeURIComponent(chapter.id)}` } satisfies PlaylistSource : null;
  const source = playlistSource ?? localSource;
  const entries = useMemo(() => source?.tracks.map((track) => ({ id: `${source.id}:${track.id}`, track })) ?? [], [source]);
  const [playlistName, setPlaylistName] = useState(source?.name ?? "");
  const [selectedTrackIds, setSelectedTrackIds] = useState<TrackId[]>(() => entries.map((entry) => entry.track.id));
  const [serviceId, setServiceId] = useState<MusicServiceId>(() => isMusicServiceId(initialServiceId) && initialServiceId !== "apple" ? initialServiceId : "youtube");
  const [matches, setMatches] = useState<TrackMatch[]>([]);
  const [connectionToken, setConnectionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [youtubeErrorCode, setYoutubeErrorCode] = useState<string | undefined>();
  const [result, setResult] = useState<{ url: string; addedCount: number; failedCount: number } | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const selectedService = MUSIC_SERVICES.find((service) => service.id === serviceId) ?? MUSIC_SERVICES[0];
  const selectedEntries = entries.filter((entry) => selectedTrackIds.includes(entry.track.id));
  const matchedCount = matches.filter((match) => match.selectedId && !match.excluded).length;
  const autoCount = matches.filter((match) => match.status === "auto" && match.selectedId && !match.excluded).length;
  const missingCount = matches.filter((match) => match.status === "missing").length;
  const unresolvedCount = matches.filter((match) => match.status === "review" && !match.selectedId && !match.excluded).length;
  const excludedCount = matches.filter((match) => match.excluded).length + missingCount;

  useLayoutEffect(() => { viewRef.current?.closest<HTMLElement>(".shell-main")?.scrollTo({ top: 0 }); }, [step]);
  if (!source) return <div className="page-content"><EmptyState title="챕터를 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;

  function resetMatches() { setMatches([]); setConnectionToken(null); setError(null); setYoutubeErrorCode(undefined); }
  function toggleTrack(trackId: TrackId) { resetMatches(); setSelectedTrackIds((current) => current.includes(trackId) ? current.filter((id) => id !== trackId) : [...current, trackId]); }
  async function connectAndMatch(forceReconnect = false) {
    setLoading(true); setError(null);
    try {
      if (serviceId !== "youtube") throw new Error("Apple Music 내보내기는 준비 중이에요. 지금은 YouTube Music으로 만들어 주세요.");
      const supabase = createSupabaseBrowserClient();
      if (!youtubeAuthGranted || forceReconnect) {
        const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo: youtubeOAuthCallbackUrl(),
            scopes: YOUTUBE_SCOPE,
            queryParams: {
              include_granted_scopes: "true",
            },
            skipBrowserRedirect: true,
          },
        });
        if (oauthError) throw oauthError;
        if (!data.url) throw new Error("Google YouTube 권한 연결 주소를 만들지 못했어요.");
        window.location.assign(data.url);
        return;
      }
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      const token = (data.session as unknown as { provider_token?: string } | null)?.provider_token;
      if (!token) {
        const missingToken = new Error("Google YouTube 권한 토큰을 받지 못했어요.") as Error & { code?: string };
        missingToken.code = "unauthorized";
        throw missingToken;
      }
      setConnectionToken(token);
      const response = await fetch(`/api/playlist/${serviceId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "match", tracks: selectedEntries.map((entry) => entry.track) }) });
      const body = await responseJson(response) as { matches?: Array<{ trackId?: string; status?: unknown; confidence?: unknown; candidates?: Candidate[]; selectedId?: unknown; errorCode?: string }>; errorCode?: string };
      setYoutubeErrorCode(body.errorCode);
      setError(body.errorCode ? youtubeErrorMessage(body.errorCode) : null);
      setMatches((body.matches ?? []).map((match) => {
        const candidates = match.candidates ?? [];
        const normalizedStatus = match.status === "matched" ? "auto" : match.status;
        const status = isMatchStatus(normalizedStatus)
          ? normalizedStatus
          : candidates.length
            ? match.confidence === "high" ? "auto" : "review"
            : "missing";
        const responseSelectedId = typeof match.selectedId === "string" ? match.selectedId : null;
        return {
          trackId: match.trackId as TrackId,
          status,
          candidates,
          selectedId: status === "auto" ? responseSelectedId ?? candidates[0]?.id ?? null : null,
          excluded: false,
          errorCode: match.errorCode,
        };
      }));
      onStepChange(3);
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.delete("youtubeAuth");
      currentUrl.searchParams.delete("code");
      window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    } catch (cause) {
      const errorCode = cause instanceof Error && "code" in cause && typeof cause.code === "string" ? cause.code : undefined;
      setYoutubeErrorCode(errorCode);
      setError(errorCode ? youtubeErrorMessage(errorCode) : cause instanceof Error ? cause.message : "곡을 매칭하지 못했어요.");
    }
    finally { setLoading(false); }
  }
  async function exportPlaylist() {
    if (!connectionToken) return;
    setLoading(true); setError(null);
    try {
      const selections = matches.flatMap((match) => match.selectedId && !match.excluded ? [match.selectedId] : []);
      const response = await fetch(`/api/playlist/${serviceId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${connectionToken}` },
        body: JSON.stringify({ action: "export", playlistName, selections }),
      });
      const body = await responseJson(response) as { url?: unknown; addedCount?: unknown; failedCount?: unknown };
      setResult({
        url: typeof body.url === "string" ? body.url : selectedService.url,
        addedCount: typeof body.addedCount === "number" ? body.addedCount : selections.length,
        failedCount: typeof body.failedCount === "number" ? body.failedCount : 0,
      });
      onStepChange("done");
    } catch (cause) {
      const errorCode = cause instanceof Error && "code" in cause && typeof cause.code === "string" ? cause.code : undefined;
      setYoutubeErrorCode(errorCode);
      setError(errorCode ? youtubeErrorMessage(errorCode) : cause instanceof Error ? cause.message : "플레이리스트를 만들지 못했어요.");
    }
    finally { setLoading(false); }
  }

  if (step === "done") return <div ref={viewRef} className="page-content playlist-builder-view playlist-builder-complete"><div className={`playlist-complete-mark is-${selectedService.id}`} aria-hidden="true"><MusicServiceIcon service={selectedService.id} size={68} /><Check size={18} strokeWidth={2.4} /></div><span className="section-label">플레이리스트 만들기 완료</span><h1>내보냈어요</h1><div className="playlist-complete-summary"><strong>{playlistName || source.name}</strong><span>{selectedService.name} · {result?.addedCount ?? matchedCount}곡</span></div><a className="button button-primary playlist-open-service" href={result?.url ?? selectedService.url} target="_blank" rel="noopener noreferrer">{selectedService.name}에서 열기 <ExternalLink size={15} aria-hidden="true" /></a>{result?.failedCount ? <p className="playlist-complete-note">{result.failedCount}곡은 YouTube에 추가하지 못했어요. 만들어진 플레이리스트는 그대로 유지했어요.</p> : null}{excludedCount ? <p className="playlist-complete-note">{excludedCount}곡은 매칭 결과에서 제외했어요.</p> : null}<Link className="text-link" href={source.returnHref} intent="back">챕터로 돌아가기</Link></div>;

  return <div ref={viewRef} className="page-content playlist-builder-view"><header className="playlist-builder-header"><div><span className="section-label">플레이리스트로 내보내기</span><h1>{STEP_LABEL[step - 1]}</h1></div><span className="playlist-step-count" aria-label={`${step}단계, 전체 3단계`}>{step} / 3</span></header><ol className="playlist-stepper" aria-label="플레이리스트 생성 단계">{STEP_LABEL.map((label, index) => <li className={step >= index + 1 ? "is-active" : ""} key={label}><span>{index + 1}</span><em>{label}</em></li>)}</ol>
    {step === 1 ? <section className="playlist-builder-section" aria-labelledby="playlist-name-label"><label className="field playlist-name-field" htmlFor="playlist-name"><span id="playlist-name-label">플레이리스트 이름</span><input id="playlist-name" className="input" value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} maxLength={80} /></label><div className="playlist-selection-head"><strong>{selectedTrackIds.length}곡 선택</strong><button className="text-button" type="button" onClick={() => { resetMatches(); setSelectedTrackIds(selectedTrackIds.length === entries.length ? [] : entries.map((entry) => entry.track.id)); }}>{selectedTrackIds.length === entries.length ? "전체 해제" : "전체 선택"}</button></div><div className="track-list track-list-unified playlist-track-list">{entries.map((entry, index) => <TrackLine key={entry.id} track={entry.track} index={index} sharedId={entry.id} selectable selected={selectedTrackIds.includes(entry.track.id)} showAlbum={false} showIndex={false} onRowClick={() => toggleTrack(entry.track.id)} />)}</div></section> : null}
    {step === 2 ? <section className="playlist-builder-section"><p className="playlist-service-copy">내보낼 음악 서비스를 선택하세요.</p><div className="playlist-service-list" role="radiogroup" aria-label="음악 서비스">{MUSIC_SERVICES.map((service) => <button className={`playlist-service-row${serviceId === service.id ? " is-selected" : ""}`} type="button" role="radio" aria-checked={serviceId === service.id} disabled={service.status === "soon"} onClick={() => { resetMatches(); setServiceId(service.id); }} key={service.id}><span className={`playlist-service-icon is-${service.id}`} aria-hidden="true"><MusicServiceIcon service={service.id} size={42} /></span><span className="playlist-service-copy"><strong>{service.name}</strong>{service.status === "soon" ? <small>준비 중</small> : null}</span></button>)}</div></section> : null}
    {step === 3 ? <section className="playlist-builder-section"><div className="playlist-match-summary" aria-label="곡 매칭 결과"><div><CircleCheck size={17} aria-hidden="true" /><span>자동 매칭</span><strong>{autoCount}</strong></div><div><Search size={17} aria-hidden="true" /><span>확인 필요</span><strong>{unresolvedCount}</strong></div><div><CircleAlert size={17} aria-hidden="true" /><span>찾지 못함</span><strong>{missingCount}</strong></div></div>{!matches.length && !loading ? <p className="playlist-simulation-note">서비스를 연결해 곡을 실제로 찾아볼게요. 연결 토큰은 저장하지 않아요.</p> : null}{matches.length ? <div className="playlist-match-list">{matches.map((match) => {
      const track = selectedEntries.find((entry) => entry.track.id === match.trackId)?.track;
      const selectedCandidate = match.candidates.find((candidate) => candidate.id === match.selectedId) ?? null;
      const candidateMeta = [
        selectedCandidate?.channelTitle ?? selectedCandidate?.artist,
        selectedCandidate?.durationMs ? formatDuration(selectedCandidate.durationMs) : null,
        typeof selectedCandidate?.score === "number" ? `${Math.round(selectedCandidate.score)}점` : null,
      ].filter((value): value is string => Boolean(value));
      const statusLabel = match.excluded ? "제외" : match.status === "auto" ? "자동" : match.status === "review" ? "확인 필요" : "없음";
      return <article className={`playlist-match-row is-${match.status}${match.excluded ? " is-excluded" : ""}`} key={match.trackId}>
        <div className="playlist-match-head">
          <label className="playlist-match-toggle">
            <input
              type="checkbox"
              checked={match.status !== "missing" && !match.excluded}
              disabled={match.status === "missing"}
              onChange={(event) => setMatches((current) => current.map((item) => item.trackId === match.trackId ? { ...item, excluded: !event.target.checked } : item))}
              aria-label={`${track?.title ?? "곡"} 내보내기 포함`}
            />
          </label>
          <span className="playlist-match-copy"><strong>{track?.title}</strong><small>{track ? formatTrackArtist(track) : ""}</small></span>
          <em className="playlist-match-badge">{statusLabel}</em>
        </div>
        {match.status === "missing" ? <p className="playlist-match-empty">YouTube Music에서 신뢰할 수 있는 후보를 찾지 못했어요.</p> : (
          <div className="playlist-match-choice">
            {selectedCandidate?.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selectedCandidate.thumbnailUrl} alt="" loading="lazy" />
            ) : <span className="playlist-candidate-placeholder" aria-hidden="true"><MusicServiceIcon service="youtube" size={20} /></span>}
            <span className="playlist-match-choice-copy">
              {match.status === "review" ? (
                <select
                  aria-label={`${track?.title ?? "곡"} 매칭 후보`}
                  value={match.selectedId ?? ""}
                  onChange={(event) => setMatches((current) => current.map((item) => item.trackId === match.trackId ? { ...item, selectedId: event.target.value || null, excluded: false } : item))}
                >
                  <option value="">후보를 선택하세요</option>
                  {match.candidates.map((candidate) => <option value={candidate.id} key={candidate.id}>{candidate.title} · {candidate.artist} · {Math.round(candidate.score ?? 0)}점</option>)}
                </select>
              ) : <strong>{selectedCandidate?.title ?? "선택된 후보 없음"}</strong>}
              <small>{candidateMeta.join(" · ") || "후보 정보 없음"}</small>
            </span>
            {selectedCandidate ? <a className="playlist-candidate-play" href={candidateMusicUrl(selectedCandidate)} target="_blank" rel="noopener noreferrer" aria-label={`${selectedCandidate.title} YouTube Music에서 재생`}><Play size={14} fill="currentColor" aria-hidden="true" /></a> : null}
          </div>
        )}
      </article>;
    })}</div> : null}{unresolvedCount ? <p className="playlist-match-guidance" role="status">확인 필요한 {unresolvedCount}곡의 후보를 선택하거나 제외해 주세요.</p> : null}</section> : null}
    {error ? <p className="auth-gate-error" role="alert">{error}</p> : null}<div className="playlist-builder-actions">{step === 1 ? <button className="button button-primary" type="button" disabled={!selectedTrackIds.length || !playlistName.trim()} onClick={() => onStepChange(2)}>다음</button> : null}{step === 2 ? <button className="button button-primary" type="button" disabled={selectedService.status === "soon"} onClick={() => onStepChange(3)}>{selectedService.name}으로 계속</button> : null}{step === 3 && !matches.length && !youtubeErrorCode ? <button className="button button-primary" type="button" disabled={loading} onClick={() => void connectAndMatch()}>{loading ? "서비스 연결 중…" : `${selectedService.name} 연결하고 곡 찾기`}</button> : null}{step === 3 && youtubeErrorCode ? <button className="button button-primary" type="button" disabled={loading} onClick={() => void connectAndMatch(canReconnectYoutube(youtubeErrorCode))}>{loading ? canReconnectYoutube(youtubeErrorCode) ? "권한 연결 중…" : "다시 검색 중…" : canReconnectYoutube(youtubeErrorCode) ? "Google YouTube 권한 다시 연결" : "다시 검색"}</button> : null}{step === 3 && matches.length && !youtubeErrorCode ? <button className="button button-primary" type="button" disabled={!matchedCount || unresolvedCount > 0 || loading} onClick={() => void exportPlaylist()}><ListMusic size={16} aria-hidden="true" />{loading ? "만드는 중…" : unresolvedCount ? `${unresolvedCount}곡 확인 필요` : `${matchedCount}곡 내보내기`}</button> : null}</div></div>;
}
