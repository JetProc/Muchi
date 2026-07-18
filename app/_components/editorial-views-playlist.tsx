"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Check,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  ListMusic,
  Search,
} from "lucide-react";
import {
  getCubeTracks,
  isUserVisibleChapter,
  type ArchiveEnvelopeV1,
  type TrackId,
  type TrackReference,
} from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";
import { EmptyState, TrackLine } from "./editorial-ui";
import { MusicServiceIcon, type MusicServiceId } from "./editorial-service-icon";

export type PlaylistStep = 1 | 2 | 3 | "done";
type MatchStatus = "matched" | "review" | "missing";

export type PlaylistSource = {
  id: string;
  name: string;
  description: string;
  tracks: TrackReference[];
  returnHref: string;
};

type MusicService = {
  id: MusicServiceId;
  name: string;
  url: string;
};

const MUSIC_SERVICES: MusicService[] = [
  {
    id: "apple",
    name: "Apple Music",
    url: "https://music.apple.com/",
  },
  {
    id: "spotify",
    name: "Spotify",
    url: "https://open.spotify.com/",
  },
  {
    id: "youtube",
    name: "YouTube Music",
    url: "https://music.youtube.com/",
  },
];

const STEP_LABEL = ["곡 확인", "서비스 선택", "매칭 확인"] as const;

function isMusicServiceId(value: string | null): value is MusicServiceId {
  return value === "apple" || value === "spotify" || value === "youtube";
}

function initialMatchStatus(index: number, total: number): MatchStatus {
  if (total >= 3 && index === total - 1) return "missing";
  if (total >= 3 && index === total - 2) return "review";
  if (total === 2 && index === total - 1) return "review";
  return "matched";
}

export function PlaylistBuilder({
  archive,
  chapterId,
  playlistSource,
  initialServiceId,
  step,
  onStepChange,
}: {
  archive: ArchiveEnvelopeV1;
  chapterId: string | null;
  playlistSource?: PlaylistSource | null;
  initialServiceId: string | null;
  step: PlaylistStep;
  onStepChange: (step: PlaylistStep) => void;
}) {
  const requestedChapter = chapterId ? archive.data.cubes[chapterId] : null;
  const chapter = isUserVisibleChapter(requestedChapter) ? requestedChapter : null;
  const localPlaylistSource = chapter ? {
    id: chapter.id,
    name: chapter.name,
    description: chapter.description,
    tracks: getCubeTracks(archive, chapter.id).map((entry) => entry.track),
    returnHref: `/chapter?id=${encodeURIComponent(chapter.id)}`,
  } satisfies PlaylistSource : null;
  const source = playlistSource ?? localPlaylistSource;
  const presetServiceId = isMusicServiceId(initialServiceId) ? initialServiceId : null;
  const entries = useMemo(
    () => source?.tracks.map((track) => ({ id: `${source.id}:${track.id}`, track })) ?? [],
    [source],
  );
  const [playlistName, setPlaylistName] = useState(source?.name ?? "");
  const [selectedTrackIds, setSelectedTrackIds] = useState<TrackId[]>(
    () => entries.map((entry) => entry.track.id),
  );
  const [serviceId, setServiceId] = useState<MusicServiceId>(() => presetServiceId ?? "apple");
  const [resolvedTrackIds, setResolvedTrackIds] = useState<TrackId[]>([]);
  const viewRef = useRef<HTMLDivElement>(null);
  const selectedService = MUSIC_SERVICES.find((service) => service.id === serviceId) ?? MUSIC_SERVICES[0];
  const serviceParticle = selectedService.id === "spotify" ? "로" : "으로";
  const selectedEntries = entries.filter((entry) => selectedTrackIds.includes(entry.track.id));
  const statusByTrackId = new Map(entries.map((entry, index) => [
    entry.track.id,
    initialMatchStatus(index, entries.length),
  ]));
  const matchStatus = (trackId: TrackId): MatchStatus => (
    resolvedTrackIds.includes(trackId) ? "matched" : statusByTrackId.get(trackId) ?? "matched"
  );
  const matchedCount = selectedEntries.filter((entry) => matchStatus(entry.track.id) === "matched").length;
  const reviewCount = selectedEntries.filter((entry) => matchStatus(entry.track.id) === "review").length;
  const missingCount = selectedEntries.filter((entry) => matchStatus(entry.track.id) === "missing").length;

  useLayoutEffect(() => {
    viewRef.current?.closest<HTMLElement>(".shell-main")?.scrollTo({ top: 0 });
  }, [step]);

  if (!source) {
    return <div className="page-content"><EmptyState title="챕터를 찾을 수 없어요" action={<Link className="button" href="/chapters" intent="back">챕터 목록으로</Link>} /></div>;
  }

  function toggleTrack(trackId: TrackId) {
    setSelectedTrackIds((current) => current.includes(trackId)
      ? current.filter((id) => id !== trackId)
      : [...current, trackId]);
  }

  if (step === "done") {
    return (
      <div ref={viewRef} className="page-content playlist-builder-view playlist-builder-complete">
        <div className={`playlist-complete-mark is-${selectedService.id}`} aria-hidden="true">
          <MusicServiceIcon service={selectedService.id} size={68} />
          <Check size={18} strokeWidth={2.4} />
        </div>
        <span className="section-label">플레이리스트 내보내기 준비 완료</span>
        <h1>내보낼 준비가 됐어요</h1>
        <div className="playlist-complete-summary">
          <strong>{playlistName || source.name}</strong>
          <span>{selectedService.name} · {selectedEntries.length - missingCount}곡</span>
        </div>
        <a className="button button-primary playlist-open-service" href={selectedService.url} target="_blank" rel="noopener noreferrer">
          {selectedService.name} 열기
          <ExternalLink size={15} aria-hidden="true" />
        </a>
        {missingCount ? <p className="playlist-complete-note">{missingCount}곡은 찾지 못해 제외했어요.</p> : null}
        <Link className="text-link" href={source.returnHref} intent="back">챕터로 돌아가기</Link>
      </div>
    );
  }

  return (
    <div ref={viewRef} className="page-content playlist-builder-view">
      <header className="playlist-builder-header">
        <div>
          <span className="section-label">플레이리스트 만들기</span>
          <h1>{STEP_LABEL[step - 1]}</h1>
        </div>
        <span className="playlist-step-count" aria-label={`${step}단계, 전체 3단계`}>{step} / 3</span>
      </header>

      <ol className="playlist-stepper" aria-label="플레이리스트 생성 단계">
        {STEP_LABEL.map((label, index) => (
          <li className={step >= index + 1 ? "is-active" : ""} key={label}>
            <span>{index + 1}</span>
            <em>{label}</em>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <section className="playlist-builder-section" aria-labelledby="playlist-name-label">
          <label className="field playlist-name-field" htmlFor="playlist-name">
            <span id="playlist-name-label">플레이리스트 이름</span>
            <input id="playlist-name" className="input" value={playlistName} onChange={(event) => setPlaylistName(event.target.value)} maxLength={80} />
          </label>
          <div className="playlist-selection-head">
            <strong>{selectedTrackIds.length}곡 선택</strong>
            <button className="text-button" type="button" onClick={() => setSelectedTrackIds(selectedTrackIds.length === entries.length ? [] : entries.map((entry) => entry.track.id))}>
              {selectedTrackIds.length === entries.length ? "전체 해제" : "전체 선택"}
            </button>
          </div>
          <div className="track-list track-list-unified playlist-track-list">
            {entries.map((entry, index) => {
              const selected = selectedTrackIds.includes(entry.track.id);
              return (
                <TrackLine
                  key={entry.id}
                  track={entry.track}
                  index={index}
                  sharedId={entry.id}
                  selectable
                  selected={selected}
                  showAlbum={false}
                  showIndex={false}
                  onRowClick={() => toggleTrack(entry.track.id)}
                />
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 2 ? (
        <section className="playlist-builder-section">
          <div className="playlist-service-list" role="radiogroup" aria-label="음악 서비스">
            {MUSIC_SERVICES.map((service) => {
              const selected = serviceId === service.id;
              return (
                <button className={`playlist-service-row${selected ? " is-selected" : ""}`} type="button" role="radio" aria-checked={selected} onClick={() => setServiceId(service.id)} key={service.id}>
                  <span className={`playlist-service-icon is-${service.id}`} aria-hidden="true"><MusicServiceIcon service={service.id} size={42} /></span>
                  <span className="playlist-service-copy"><strong>{service.name}</strong></span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section className="playlist-builder-section">
          <div className="playlist-match-summary" aria-label="곡 매칭 결과">
            <div><CircleCheck size={17} aria-hidden="true" /><span>정확히 찾음</span><strong>{matchedCount}</strong></div>
            <div><CircleAlert size={17} aria-hidden="true" /><span>확인 필요</span><strong>{reviewCount}</strong></div>
            <div><Search size={17} aria-hidden="true" /><span>찾지 못함</span><strong>{missingCount}</strong></div>
          </div>
          <p className="playlist-simulation-note">현재 매칭 결과는 실제 서비스 연동 전 미리보기예요.</p>
          <div className="playlist-match-list">
            {selectedEntries.map((entry) => {
              const status = matchStatus(entry.track.id);
              return (
                <div className={`playlist-match-row is-${status}`} key={entry.id}>
                  <span className="playlist-match-status">
                    {status === "matched" ? <CircleCheck size={17} aria-hidden="true" /> : <CircleAlert size={17} aria-hidden="true" />}
                  </span>
                  <span className="playlist-match-copy"><strong>{entry.track.title}</strong><small>{entry.track.artist}</small></span>
                  {status === "matched" ? <em>찾음</em> : (
                    <span className="playlist-match-actions">
                      <button className="text-button" type="button" onClick={() => setResolvedTrackIds((current) => [...current, entry.track.id])}>다른 곡 찾기</button>
                      <button className="text-button" type="button" onClick={() => toggleTrack(entry.track.id)}>제외</button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="playlist-builder-actions">
        {step === 1 ? <button className="button button-primary" type="button" disabled={!selectedTrackIds.length || !playlistName.trim()} onClick={() => onStepChange(2)}>다음</button> : null}
        {step === 2 ? <button className="button button-primary" type="button" onClick={() => onStepChange(3)}>{selectedService.name}{serviceParticle} 계속</button> : null}
        {step === 3 ? <button className="button button-primary" type="button" disabled={!matchedCount} onClick={() => onStepChange("done")}><ListMusic size={16} aria-hidden="true" />{matchedCount + reviewCount}곡 내보내기 준비</button> : null}
      </div>
    </div>
  );
}
