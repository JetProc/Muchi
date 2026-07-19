"use client";

import { useMemo, useState } from "react";
import { Eye, Palette, Settings2 } from "lucide-react";
import {
  getCubeTracks,
  getRootCubes,
  getVisitorSpaceChapters,
  updatePersonalSpace,
  type ArchiveEnvelopeV1,
  type PersonalSpace,
} from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";
import { ChapterCover } from "./editorial-media";
import { EmptyState } from "./editorial-ui";
import { formatChapterTitle } from "./editorial-format";
import type { ArchiveCommit, Notify } from "./editorial-types";
import { MusicRoomFrame, PersonalSpaceShelf, type PersonalSpaceShelfItem } from "./editorial-music-room";

const THEMES = [
  { id: "paper", label: "종이" },
  { id: "midnight", label: "밤" },
  { id: "moss", label: "이끼" },
] as const;

const LAYOUTS = [
  { id: "shelf", label: "서가" },
  { id: "folio", label: "표지" },
  { id: "stack", label: "쌓기" },
] as const;

function chapterHref(id: string) {
  return `/chapter?id=${encodeURIComponent(id)}`;
}

function SpaceChapterShelf({
  archive,
  chapterIds,
  visitor = false,
}: {
  archive: ArchiveEnvelopeV1;
  chapterIds: string[];
  visitor?: boolean;
}) {
  const chapters = chapterIds
    .map((id) => archive.data.cubes[id])
    .filter((chapter): chapter is NonNullable<typeof chapter> => Boolean(chapter));
  const items: PersonalSpaceShelfItem[] = chapters.map((chapter) => ({
      id: chapter.id,
      title: formatChapterTitle(chapter),
      trackCount: getCubeTracks(archive, chapter.id).length,
      artwork: <ChapterCover archive={archive} chapter={chapter} />,
      href: visitor ? `/space?view=visitor&chapter=${encodeURIComponent(chapter.id)}` : chapterHref(chapter.id),
    }));
  return <PersonalSpaceShelf ariaLabel={visitor ? "공개 챕터 서재" : "대표 챕터 서재"} items={items} />;
}

function SpaceCustomizer({
  archive,
  commit,
  notify,
  onClose,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
  onClose: () => void;
}) {
  const roots = getRootCubes(archive);
  const [draft, setDraft] = useState<PersonalSpace>(archive.data.space);
  function save() {
    try {
      if (commit(updatePersonalSpace(archive, draft), "내 공간을 꾸몄어요.")) onClose();
    } catch (error) {
      notify(error instanceof Error ? error.message : "내 공간을 저장하지 못했어요.");
    }
  }
  function toggleFeatured(id: string) {
    setDraft((current) => {
      const selected = current.featuredCubeIds.includes(id);
      if (selected) return { ...current, featuredCubeIds: current.featuredCubeIds.filter((item) => item !== id) };
      if (current.featuredCubeIds.length >= 3) return current;
      return { ...current, featuredCubeIds: [...current.featuredCubeIds, id] };
    });
  }
  return (
    <div className="dialog-backdrop personal-space-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="dialog personal-space-customizer" role="dialog" aria-modal="true" aria-labelledby="space-customizer-title" onMouseDown={(event) => event.stopPropagation()}>
        <div className="personal-space-sheet-head"><span>내 공간</span><button type="button" onClick={onClose}>닫기</button></div>
        <h2 id="space-customizer-title">꾸미기</h2>
        <div className="personal-space-option-group">
          <span>배경</span>
          <div>{THEMES.map((theme) => <button className={draft.themeId === theme.id ? "is-selected" : ""} type="button" onClick={() => setDraft((current) => ({ ...current, themeId: theme.id }))} key={theme.id}>{theme.label}</button>)}</div>
        </div>
        <div className="personal-space-option-group">
          <span>진열 방식</span>
          <div>{LAYOUTS.map((layout) => <button className={draft.layoutId === layout.id ? "is-selected" : ""} type="button" onClick={() => setDraft((current) => ({ ...current, layoutId: layout.id }))} key={layout.id}>{layout.label}</button>)}</div>
        </div>
        <div className="personal-space-featured-list">
          <span>대표 챕터 <small>{draft.featuredCubeIds.length}/3</small></span>
          {roots.map((chapter) => <button className={draft.featuredCubeIds.includes(chapter.id) ? "is-selected" : ""} type="button" onClick={() => toggleFeatured(chapter.id)} key={chapter.id}><span>{formatChapterTitle(chapter)}</span><small>{draft.featuredCubeIds.includes(chapter.id) ? "진열됨" : ""}</small></button>)}
        </div>
        <div className="dialog-actions"><button className="button" type="button" onClick={onClose}>취소</button><button className="button button-primary" type="button" onClick={save}>저장</button></div>
      </section>
    </div>
  );
}

export function PersonalSpace({
  archive,
  commit,
  notify,
}: {
  archive: ArchiveEnvelopeV1;
  commit: ArchiveCommit;
  notify: Notify;
}) {
  const [customizing, setCustomizing] = useState(false);
  const roots = useMemo(() => getRootCubes(archive), [archive]);
  const featuredIds = archive.data.space.featuredCubeIds.length
    ? archive.data.space.featuredCubeIds
    : roots.slice(0, 3).map((chapter) => chapter.id);
  const featuredChapters = featuredIds
    .map((id) => archive.data.cubes[id])
    .filter((chapter): chapter is NonNullable<typeof chapter> => Boolean(chapter));
  const items: PersonalSpaceShelfItem[] = featuredChapters.map((chapter) => ({
    id: chapter.id,
    title: formatChapterTitle(chapter),
    trackCount: getCubeTracks(archive, chapter.id).length,
    artwork: <ChapterCover archive={archive} chapter={chapter} />,
    href: chapterHref(chapter.id),
  }));
  return <>
    <MusicRoomFrame
      eyebrow="MY MUSIC ROOM"
      title="나의 음악 서재"
      owner={<span className="music-room-owner-self"><span aria-hidden="true">나</span><strong>나</strong></span>}
      themeId={archive.data.space.themeId}
      layoutId={archive.data.space.layoutId}
      items={items}
      empty={<EmptyState title="첫 챕터" action={<Link className="button button-primary" href="/chapters">챕터 만들기</Link>} />}
      primaryAction={<button className="personal-space-utility" type="button" onClick={() => setCustomizing(true)} aria-label="내 공간 꾸미기"><Palette size={17} aria-hidden="true" /><span>꾸미기</span></button>}
      footer={roots.length ? <><Link href="/chapters" intent="tab">전체 챕터 보기</Link><Link href="/space?view=visitor" intent="forward"><Eye size={15} aria-hidden="true" /> 방문자 보기</Link></> : undefined}
    />
    {customizing ? <SpaceCustomizer archive={archive} commit={commit} notify={notify} onClose={() => setCustomizing(false)} /> : null}
  </>;
}

export function VisitorSpace({ archive, chapterId }: { archive: ArchiveEnvelopeV1; chapterId: string | null }) {
  const publicChapters = getVisitorSpaceChapters(archive);
  const selectedChapter = chapterId ? publicChapters.find(({ chapter }) => chapter.id === chapterId) ?? null : null;
  return (
    <div className={`page-content personal-space-view personal-space-visitor theme-${archive.data.space.themeId} layout-${archive.data.space.layoutId}`}>
      <section className="personal-space-intro"><div><span className="section-label">VISITOR VIEW</span><h1>나의 음악 서재</h1></div><Link className="personal-space-utility" href="/"><Settings2 size={17} aria-hidden="true" /><span>내 공간</span></Link></section>
      {selectedChapter ? (
        <section className="visitor-space-detail" aria-labelledby="visitor-chapter-title">
          <Link className="text-link" href="/space?view=visitor">서재로</Link>
          <h2 id="visitor-chapter-title">{formatChapterTitle(selectedChapter.chapter)}</h2>
          <div className="visitor-space-track-list">
            {selectedChapter.tracks.map(({ cubeTrack, track, tags, privateRecord }) => (
              <article key={cubeTrack.id}>
                <span><strong>{track.title}</strong><small>{track.artist}</small></span>
                {privateRecord ? <em>기록이 비공개입니다</em> : <div>{cubeTrack.notes[0]?.body ? <p>{cubeTrack.notes[0].body}</p> : null}{tags.length ? <small>{tags.map((tag) => `#${tag.label}`).join(" ")}</small> : null}</div>}
              </article>
            ))}
          </div>
        </section>
      ) : publicChapters.length ? <SpaceChapterShelf archive={archive} chapterIds={publicChapters.map(({ chapter }) => chapter.id)} visitor /> : <EmptyState title="공개한 챕터 없음" action={<Link className="button" href="/">내 공간으로</Link>} />}
    </div>
  );
}
