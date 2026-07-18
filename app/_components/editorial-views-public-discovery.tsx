"use client";

import { Bell, ChevronRight, Heart, ListMusic, UserPlus, Users } from "lucide-react";
import {
  getFollowingActivities,
  getProfileChapters,
  getPublicChapter,
  getPublicProfile,
  rankPublicChapters,
  type DiscoveryInteractionState,
  type PublicChapter,
  type PublicDiscoveryCatalog,
  type PublicProfile,
  type RankedPublicChapter,
} from "@/lib/public-discovery";
import type { ArchiveEnvelopeV1 } from "@/lib/archive";
import { AlbumArtwork } from "./editorial-media";
import { MotionLink as Link } from "./editorial-motion";
import { EmptyState, PageHeader } from "./editorial-ui";

type DiscoveryActions = {
  onToggleFollow: (profileId: string) => void;
  onToggleLike: (chapterId: string) => void;
  onActivityRead: (activityId: string) => void;
};

function initials(profile: PublicProfile): string {
  return profile.name.slice(0, 1);
}

function ProfileStamp({ profile, compact = false }: { profile: PublicProfile; compact?: boolean }) {
  return (
    <span className={`public-profile-stamp${compact ? " is-compact" : ""}`}>
      <span className="public-profile-avatar" style={{ backgroundColor: profile.avatarTone }} aria-hidden="true">{initials(profile)}</span>
      <span>
        <strong>{profile.name}</strong>
        <small>@{profile.handle}</small>
      </span>
    </span>
  );
}

function ChapterFeedLine({ item, index }: { item: RankedPublicChapter; index: number }) {
  const { chapter, profile, reason } = item;
  const leadTrack = chapter.tracks[0]?.track;
  if (!leadTrack) return null;
  return (
    <Link
      className="public-chapter-line"
      href={`/discover/chapter?id=${encodeURIComponent(chapter.id)}`}
      intent="shared"
      sharedId={chapter.id}
    >
      <span className="public-chapter-index">{String(index + 1).padStart(2, "0")}</span>
      <AlbumArtwork track={leadTrack} sharedId={chapter.id} className="public-chapter-art" decorative />
      <span className="public-chapter-copy">
        <ProfileStamp profile={profile} compact />
        <strong>{chapter.name}</strong>
        <small>{chapter.description}</small>
        <em>{reason} · {chapter.tracks.length}곡</em>
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </Link>
  );
}

function ActivityFeed({
  catalog,
  state,
  onActivityRead,
}: {
  catalog: PublicDiscoveryCatalog;
  state: DiscoveryInteractionState;
  onActivityRead: (activityId: string) => void;
}) {
  const activities = getFollowingActivities(catalog, state);
  if (!activities.length) {
    return <EmptyState title="팔로우한 기록이 아직 없어요" action={<p>마음에 드는 아카이버를 팔로우해 보세요.</p>} />;
  }
  return (
    <section className="public-activity-list" aria-label="새 공개 챕터">
      {activities.map((activity) => {
        const profile = catalog.profiles[activity.profileId];
        const chapter = catalog.chapters[activity.chapterId];
        const unread = !state.readActivityIds.includes(activity.id);
        if (!profile || !chapter) return null;
        return (
          <Link
            className={`public-activity-line${unread ? " is-unread" : ""}`}
            href={`/discover/chapter?id=${encodeURIComponent(chapter.id)}`}
            intent="shared"
            sharedId={chapter.id}
            key={activity.id}
            onClick={() => onActivityRead(activity.id)}
          >
            <ProfileStamp profile={profile} />
            <span><strong>{chapter.name}</strong><small>새 공개 챕터</small></span>
            {unread ? <i aria-label="읽지 않음" /> : null}
          </Link>
        );
      })}
    </section>
  );
}

export function Discover({
  archive,
  catalog,
  state,
  activityOnly,
  actions,
}: {
  archive: ArchiveEnvelopeV1;
  catalog: PublicDiscoveryCatalog;
  state: DiscoveryInteractionState;
  activityOnly: boolean;
  actions: DiscoveryActions;
}) {
  const ranked = rankPublicChapters(archive, catalog, state);
  const unreadCount = getFollowingActivities(catalog, state)
    .filter((activity) => !state.readActivityIds.includes(activity.id)).length;
  return (
    <div className="page-content discover-view">
      <PageHeader
        eyebrow={activityOnly ? "FOLLOWING" : "DISCOVER"}
        title={activityOnly ? "새로 열린 챕터" : "비슷한 결의 기록"}
        description={activityOnly ? "팔로우한 아카이버의 새 공개 기록" : "곡이 함께 묶인 방식을 따라가 보세요."}
        action={(
          <Link className={`discover-activity-button${activityOnly ? " is-active" : ""}`} href={activityOnly ? "/discover" : "/discover?activity=1"} intent="tab" aria-label={unreadCount ? `새 활동 ${unreadCount}개` : "팔로우 활동"}>
            <Bell size={18} aria-hidden="true" />
            {unreadCount ? <span>{unreadCount}</span> : null}
          </Link>
        )}
      />
      {activityOnly ? <ActivityFeed catalog={catalog} state={state} onActivityRead={actions.onActivityRead} /> : (
        <section className="public-chapter-feed" aria-label="추천 공개 챕터">
          {ranked.slice(0, 18).map((item, index) => <ChapterFeedLine item={item} index={index} key={item.chapter.id} />)}
        </section>
      )}
    </div>
  );
}

function FollowButton({
  profileId,
  followed,
  onToggle,
}: {
  profileId: string;
  followed: boolean;
  onToggle: (profileId: string) => void;
}) {
  return (
    <button className={`public-follow-button${followed ? " is-following" : ""}`} type="button" onClick={() => onToggle(profileId)} aria-pressed={followed}>
      {followed ? <Users size={16} aria-hidden="true" /> : <UserPlus size={16} aria-hidden="true" />}
      {followed ? "팔로잉" : "팔로우"}
    </button>
  );
}

function LikeButton({
  chapterId,
  liked,
  likeCount,
  onToggle,
}: {
  chapterId: string;
  liked: boolean;
  likeCount: number;
  onToggle: (chapterId: string) => void;
}) {
  return (
    <button className={`public-like-button${liked ? " is-liked" : ""}`} type="button" onClick={() => onToggle(chapterId)} aria-pressed={liked}>
      <Heart size={17} aria-hidden="true" fill={liked ? "currentColor" : "none"} />
      {likeCount + (liked ? 1 : 0)}
    </button>
  );
}

function PublicTrackRecord({ chapter, index }: { chapter: PublicChapter; index: number }) {
  const item = chapter.tracks[index];
  if (!item) return null;
  return (
    <article className="public-track-record">
      <span className="public-track-number">{String(index + 1).padStart(2, "0")}</span>
      <AlbumArtwork track={item.track} className="public-track-art" decorative />
      <div className="public-track-copy">
        <strong>{item.track.title}</strong>
        <small>{item.track.artist} · {item.track.album}</small>
        {item.visibility === "public" ? (
          <div className="public-record-copy">
            <p>{item.note}</p>
            <div className="tag-row">{item.tags.map((tag) => <span className="tag" key={tag}>#{tag}</span>)}</div>
          </div>
        ) : <p className="private-record-notice">기록이 비공개입니다</p>}
      </div>
    </article>
  );
}

export function PublicChapterDetail({
  catalog,
  state,
  chapterId,
  actions,
}: {
  catalog: PublicDiscoveryCatalog;
  state: DiscoveryInteractionState;
  chapterId: string | null;
  actions: DiscoveryActions;
}) {
  const chapter = getPublicChapter(catalog, chapterId);
  const profile = chapter ? catalog.profiles[chapter.profileId] : null;
  if (!chapter || !profile) return <div className="page-content"><EmptyState title="공개 챕터를 찾지 못했어요" action={<Link className="button" href="/discover">탐색으로 돌아가기</Link>} /></div>;
  const followed = state.followedProfileIds.includes(profile.id);
  const liked = state.likedChapterIds.includes(chapter.id);
  const leadTrack = chapter.tracks[0]?.track;
  return (
    <div className="page-content public-chapter-detail">
      <section className="public-chapter-hero">
        {leadTrack ? <AlbumArtwork track={leadTrack} sharedId={chapter.id} className="public-chapter-hero-art" priority decorative /> : null}
        <div className="public-chapter-hero-copy">
          <Link className="public-profile-link" href={`/discover/profile?id=${encodeURIComponent(profile.id)}`} intent="forward"><ProfileStamp profile={profile} /></Link>
          <h1>{chapter.name}</h1>
          <p>{chapter.description}</p>
          <div className="public-chapter-actions">
            <FollowButton profileId={profile.id} followed={followed} onToggle={actions.onToggleFollow} />
            <LikeButton chapterId={chapter.id} liked={liked} likeCount={chapter.likeCount} onToggle={actions.onToggleLike} />
          </div>
        </div>
      </section>
      <section className="public-record-section" aria-labelledby="public-records-title">
        <div className="section-heading"><span className="section-label">TRACK NOTES</span><h2 id="public-records-title">{chapter.tracks.length}곡의 기록</h2></div>
        {chapter.tracks.map((_, index) => <PublicTrackRecord chapter={chapter} index={index} key={chapter.tracks[index].id} />)}
      </section>
      <Link className="public-playlist-button" href={`/playlist?source=discover&id=${encodeURIComponent(chapter.id)}`} intent="modal">
        <ListMusic size={18} aria-hidden="true" />
        플레이리스트로 듣기
      </Link>
    </div>
  );
}

export function PublicProfileDetail({
  catalog,
  state,
  profileId,
  actions,
}: {
  catalog: PublicDiscoveryCatalog;
  state: DiscoveryInteractionState;
  profileId: string | null;
  actions: DiscoveryActions;
}) {
  const profile = getPublicProfile(catalog, profileId);
  if (!profile) return <div className="page-content"><EmptyState title="아카이버를 찾지 못했어요" action={<Link className="button" href="/discover">탐색으로 돌아가기</Link>} /></div>;
  const chapters = getProfileChapters(catalog, profile.id);
  const followed = state.followedProfileIds.includes(profile.id);
  return (
    <div className="page-content public-profile-detail">
      <section className="public-profile-hero">
        <ProfileStamp profile={profile} />
        <p>{profile.bio}</p>
        <small>{profile.followerCount.toLocaleString("ko-KR")}명이 팔로우</small>
        <FollowButton profileId={profile.id} followed={followed} onToggle={actions.onToggleFollow} />
      </section>
      <section className="public-profile-chapters" aria-labelledby="profile-chapter-title">
        <div className="section-heading"><span className="section-label">PUBLIC CHAPTERS</span><h2 id="profile-chapter-title">공개한 챕터</h2></div>
        {chapters.map((chapter, index) => {
          const item: RankedPublicChapter = { chapter, profile, sharedTrackCount: 0, sharedTrackDensity: 0, reason: "공개 챕터" };
          return <ChapterFeedLine item={item} index={index} key={chapter.id} />;
        })}
      </section>
    </div>
  );
}
