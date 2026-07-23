"use client";

import type { ReactNode } from "react";
import type { SpaceLayoutId, SpaceThemeId } from "@/lib/archive";
import { MotionLink as Link } from "./editorial-motion";

export type PersonalSpaceShelfItem = {
  id: string;
  title: string;
  trackCount: number;
  artwork: ReactNode;
  href: string;
};

export function PersonalSpaceShelf({
  items,
  ariaLabel,
}: {
  items: PersonalSpaceShelfItem[];
  ariaLabel: string;
}) {
  return (
    <div className="personal-space-shelf" aria-label={ariaLabel} data-tour="home-library">
      {items.map((item, index) => (
        <Link className="personal-space-chapter" href={item.href} intent="shared" sharedId={item.id} key={item.id}>
          <span className="personal-space-chapter-art">{item.artwork}</span>
          <span className="personal-space-chapter-copy">
            <small>{String(index + 1).padStart(2, "0")}</small>
            <strong>{item.title}</strong>
            <em>{item.trackCount}곡</em>
          </span>
        </Link>
      ))}
    </div>
  );
}

export function MusicRoomFrame({
  eyebrow,
  title,
  owner,
  ownerBio,
  themeId,
  layoutId,
  items,
  empty,
  primaryAction,
  footer,
}: {
  eyebrow: ReactNode;
  title: string;
  owner: ReactNode;
  ownerBio?: ReactNode;
  themeId: SpaceThemeId;
  layoutId: SpaceLayoutId;
  items: PersonalSpaceShelfItem[];
  empty: ReactNode;
  primaryAction?: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className={`page-content personal-space-view music-room-frame theme-${themeId} layout-${layoutId}`} data-tour="personal-space">
      <section className="personal-space-intro" data-tour="home-featured">
        <div><span className="section-label">{eyebrow}</span><h1>{title}</h1></div>
        {primaryAction}
      </section>
      <section className="music-room-owner" aria-label={`${title} 주인`}>
        {owner}
        {ownerBio ? <p>{ownerBio}</p> : null}
      </section>
      {items.length ? <PersonalSpaceShelf items={items} ariaLabel={`${title} 대표 챕터`} /> : empty}
      {footer ? <div className="personal-space-library-link">{footer}</div> : null}
    </div>
  );
}
