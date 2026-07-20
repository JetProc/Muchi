"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Check, CircleAlert, CircleCheck, ExternalLink, ListMusic, Search } from "lucide-react";
import { getCubeTracks, isUserVisibleChapter, type ArchiveEnvelopeV1, type TrackId, type TrackReference } from "@/lib/archive";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { MotionLink as Link } from "./editorial-motion";
import { EmptyState, TrackLine } from "./editorial-ui";
import { MusicServiceIcon, type MusicServiceId } from "./editorial-service-icon";

export type PlaylistStep = 1 | 2 | 3 | "done";
export type PlaylistSource = { id: string; name: string; description: string; tracks: TrackReference[]; returnHref: string };
type Candidate = { id: string; title: string; artist: string; album: string };
type TrackMatch = { trackId: TrackId; candidates: Candidate[]; selectedId: string | null };
type MusicService = { id: MusicServiceId; name: string; url: string };
type MusicKitInstance = { authorize: () => Promise<string> };

const MUSIC_SERVICES: MusicService[] = [
  { id: "apple", name: "Apple Music", url: "https://music.apple.com/" },
  { id: "youtube", name: "YouTube Music", url: "https://music.youtube.com/" },
];
const STEP_LABEL = ["곡 확인", "서비스 선택", "매칭 확인"] as const;
const YOUTUBE_SCOPE = "https://www.googleapis.com/auth/youtube";

function isMusicServiceId(value: string | null): value is MusicServiceId { return value === "apple" || value === "youtube"; }
async function responseJson(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: unknown };
  if (!response.ok) throw new Error(typeof body.message === "string" ? body.message : "음악 서비스를 연결하지 못했어요.");
  return body;
}
async function loadAppleMusicKit() {
  if (typeof window === "undefined") throw new Error("Apple Music은 브라우저에서만 연결할 수 있어요.");
  const musicWindow = window as Window & { MusicKit?: { configure: (options: { developerToken: string; app: { name: string; build: string } }) => void; getInstance: () => MusicKitInstance } };
  if (!musicWindow.MusicKit) await new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Apple Music 연결 도구를 불러오지 못했어요."));
    document.head.appendChild(script);
  });
  if (!musicWindow.MusicKit) throw new Error("Apple Music 연결 도구를 시작하지 못했어요.");
  const tokenResponse = await fetch("/api/playlist/apple/developer-token", { cache: "no-store" });
  const { token } = await responseJson(tokenResponse) as { token?: unknown };
  if (typeof token !== "string") throw new Error("Apple Music 연결 설정을 확인해 주세요.");
  musicWindow.MusicKit.configure({ developerToken: token, app: { name: "Muchi", build: "1.0.0" } });
  return musicWindow.MusicKit.getInstance().authorize();
}

export function PlaylistBuilder({ archive, chapterId, playlistSource, initialServiceId, step, onStepChange }: {
  archive: ArchiveEnvelopeV1; chapterId: string | null; playlistSource?: PlaylistSource | null; initialServiceId: string | null; step: PlaylistStep; onStepChange: (step: PlaylistStep) => void;
}) {
  const requestedChapter = chapterId ? archive.data.cubes[chapterId] : null;
  const chapter = isUserVisibleChapter(requestedChapter) ? requestedChapter : null;
  const localSource = chapter ? { id: chapter.id, name: chapter.name, description: chapter.description, tracks: getCubeTracks(archive, chapter.id).map((entry) => entry.track), returnHref: `/chapter?id=${encodeURIComponent(chapter.id)}` } satisfies PlaylistSource : null;
  const source = playlistSource ?? localSource;
  const entries = useMemo(() => source?.tracks.map((track) => ({ id: `${source.id}:${track.id}`, track })) ?? [], [source]);
  const [playlistName, setPlaylistName] = useState(source?.name ?? "");
  const [selectedTrackIds, setSelectedTrackIds] = useState<TrackId[]>(() => entries.map((entry) => entry.track.id));
  const [serviceId, setServiceId] = useState<MusicServiceId>(() => isMusicServiceId(initialServiceId) ? initialServiceId : "apple");
  const [matches, setMatches] = useState<TrackMatch[]>([]);
  const [connectionToken, setConnectionToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ url: string; addedCount: number } | null>(null);
  const viewRef = useRef<HTMLDivElement>(null);
  const selectedService = MUSIC_SERVICES.find((service) => service.id === serviceId) ?? MUSIC_SERVICES[0];
  const selectedEntries = entries.filter((entry) => selectedTrackIds.includes(entry.track.id));
  const matchedCount = matches.filter((match) => match.selectedId).length;
  const missingCount = matches.filter((match) => !match.candidates.length).length;

  useLayoutEffect(() => { viewRef.current?.closest<HTMLElement>(".shell-main")?.scrollTo({ top: 0 }); }, [step]);
  if (!source) return <div className="page-content"><EmptyState title="챕터를 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;

  function resetMatches() { setMatches([]); setConnectionToken(null); setError(null); }
  function toggleTrack(trackId: TrackId) { resetMatches(); setSelectedTrackIds((current) => current.includes(trackId) ? current.filter((id) => id !== trackId) : [...current, trackId]); }
  async function connectAndMatch() {
    setLoading(true); setError(null);
    try {
      let token: string;
      if (serviceId === "apple") token = await loadAppleMusicKit();
      else {
        const { data } = await createSupabaseBrowserClient().auth.getSession();
        const providerToken = (data.session as unknown as { provider_token?: string } | null)?.provider_token;
        if (!providerToken) {
          await createSupabaseBrowserClient().auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`, scopes: YOUTUBE_SCOPE, queryParams: { access_type: "offline", prompt: "consent" } } });
          return;
        }
        token = providerToken;
      }
      setConnectionToken(token);
      const response = await fetch(`/api/playlist/${serviceId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "match", [serviceId === "apple" ? "userToken" : "accessToken"]: token, tracks: selectedEntries.map((entry) => entry.track) }) });
      const body = await responseJson(response) as { matches?: Array<{ trackId?: string; candidates?: Candidate[] }> };
      setMatches((body.matches ?? []).map((match) => ({ trackId: match.trackId as TrackId, candidates: match.candidates ?? [], selectedId: match.candidates?.[0]?.id ?? null })));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "곡을 매칭하지 못했어요."); }
    finally { setLoading(false); }
  }
  async function exportPlaylist() {
    if (!connectionToken) return;
    setLoading(true); setError(null);
    try {
      const selections = matches.flatMap((match) => match.selectedId ? [match.selectedId] : []);
      const response = await fetch(`/api/playlist/${serviceId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "export", [serviceId === "apple" ? "userToken" : "accessToken"]: connectionToken, tracks: selectedEntries.map((entry) => entry.track), playlistName, selections }) });
      const body = await responseJson(response) as { url?: unknown; addedCount?: unknown };
      setResult({ url: typeof body.url === "string" ? body.url : selectedService.url, addedCount: typeof body.addedCount === "number" ? body.addedCount : selections.length });
      onStepChange("done");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "플레이리스트를 만들지 못했어요."); }
    finally { setLoading(false); }
  }

  if (step === "done") return <div ref={viewRef} className="page-content playlist-builder-view playlist-builder-complete"><div className={`playlist-complete-mark is-${selectedService.id}`} aria-hidden="true"><MusicServiceIcon service={selectedService.id} size={68} /><Check size={18} strokeWidth={2.4} /></div><span className="section-label">플레이리스트 만들기 완료</span><h1>내보냈어요</h1><div className="playlist-complete-summary"><strong>{playlistName || source.name}</strong><span>{selectedService.name} · {result?.addedCount ?? matchedCount}곡</span></div><a className="button button-primary playlist-open-service" href={result?.url ?? selectedService.url} target="_blank" rel="noopener noreferrer">{selectedService.name}에서 열기 <ExternalLink size={15} aria-hidden="true" /></a>{missingCount ? <p className="playlist-complete-note">{missingCount}곡은 찾지 못해 제외했어요.</p> : null}<Link className="text-link" href={source.returnHref} intent="back">챕터로 돌아가기</Link></div>;

  return <div ref={viewRef} className="page-content playlist-builder-view"><header className="playlist-builder-header"><div><span className="section-label">플레이리스트로 내보내기</span><h1>{STEP_LABEL[step - 1]}</h1></div><span className="playlist-step-count" aria-label={`${step}단계, 전체 3단계`}>{step} / 3</span></header><ol className="playlist-stepper" aria-label="플레이리스트 생성 단계">{STEP_LABEL.map((label, index) => <li className={step >= index + 1 ? "is-active" : ""} key={label}><span>{index + 1}</span><em>{label}</em></li>)}</ol>
    {step === 1 ? <section className="playlist-builder-section" aria-labelledby="playlist-name-label"><label className="field playlist-name-field" htmlFor="playlist-name"><span id="playlist-name-label">플레이리스트 이름</span><input id="playlist-name" className="input" value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} maxLength={80} /></label><div className="playlist-selection-head"><strong>{selectedTrackIds.length}곡 선택</strong><button className="text-button" type="button" onClick={() => { resetMatches(); setSelectedTrackIds(selectedTrackIds.length === entries.length ? [] : entries.map((entry) => entry.track.id)); }}>{selectedTrackIds.length === entries.length ? "전체 해제" : "전체 선택"}</button></div><div className="track-list track-list-unified playlist-track-list">{entries.map((entry, index) => <TrackLine key={entry.id} track={entry.track} index={index} sharedId={entry.id} selectable selected={selectedTrackIds.includes(entry.track.id)} showAlbum={false} showIndex={false} onRowClick={() => toggleTrack(entry.track.id)} />)}</div></section> : null}
    {step === 2 ? <section className="playlist-builder-section"><p className="playlist-service-copy">내보낼 음악 서비스를 선택하세요.</p><div className="playlist-service-list" role="radiogroup" aria-label="음악 서비스">{MUSIC_SERVICES.map((service) => <button className={`playlist-service-row${serviceId === service.id ? " is-selected" : ""}`} type="button" role="radio" aria-checked={serviceId === service.id} onClick={() => { resetMatches(); setServiceId(service.id); }} key={service.id}><span className={`playlist-service-icon is-${service.id}`} aria-hidden="true"><MusicServiceIcon service={service.id} size={42} /></span><span className="playlist-service-copy"><strong>{service.name}</strong></span></button>)}</div></section> : null}
    {step === 3 ? <section className="playlist-builder-section"><div className="playlist-match-summary" aria-label="곡 매칭 결과"><div><CircleCheck size={17} aria-hidden="true" /><span>내보낼 곡</span><strong>{matchedCount}</strong></div><div><CircleAlert size={17} aria-hidden="true" /><span>찾지 못함</span><strong>{missingCount}</strong></div><div><Search size={17} aria-hidden="true" /><span>확인 필요</span><strong>{Math.max(0, matches.length - matchedCount - missingCount)}</strong></div></div>{!matches.length && !loading ? <p className="playlist-simulation-note">서비스를 연결해 곡을 실제로 찾아볼게요. 연결 토큰은 저장하지 않아요.</p> : null}{matches.length ? <div className="playlist-match-list">{matches.map((match) => { const track = selectedEntries.find((entry) => entry.track.id === match.trackId)?.track; return <div className={`playlist-match-row is-${match.selectedId ? "matched" : "missing"}`} key={match.trackId}><span className="playlist-match-status">{match.selectedId ? <CircleCheck size={17} /> : <CircleAlert size={17} />}</span><span className="playlist-match-copy"><strong>{track?.title}</strong><small>{track?.artist}</small></span>{match.candidates.length > 1 ? <select aria-label={`${track?.title} 매칭 곡`} value={match.selectedId ?? ""} onChange={(event) => setMatches((current) => current.map((item) => item.trackId === match.trackId ? { ...item, selectedId: event.target.value || null } : item))}>{match.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title} · {candidate.artist}</option>)}</select> : <em>{match.selectedId ? "찾음" : "없음"}</em>}</div>; })}</div> : null}</section> : null}
    {error ? <p className="auth-gate-error" role="alert">{error}</p> : null}<div className="playlist-builder-actions">{step === 1 ? <button className="button button-primary" type="button" disabled={!selectedTrackIds.length || !playlistName.trim()} onClick={() => onStepChange(2)}>다음</button> : null}{step === 2 ? <button className="button button-primary" type="button" onClick={() => onStepChange(3)}>{selectedService.name}으로 계속</button> : null}{step === 3 && !matches.length ? <button className="button button-primary" type="button" disabled={loading} onClick={() => void connectAndMatch()}>{loading ? "서비스 연결 중…" : `${selectedService.name} 연결하고 곡 찾기`}</button> : null}{step === 3 && matches.length ? <button className="button button-primary" type="button" disabled={!matchedCount || loading} onClick={() => void exportPlaylist()}><ListMusic size={16} aria-hidden="true" />{loading ? "만드는 중…" : `${matchedCount}곡 내보내기`}</button> : null}</div></div>;
}
