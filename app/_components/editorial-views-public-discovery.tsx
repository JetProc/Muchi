"use client";

import { Bell, ChevronRight, Heart, UserPlus, Users, X } from "lucide-react";
import {
  getFollowingActivities,
  getProfileChapters,
  getPublicChapter,
  getPublicProfile,
  rankPublicChapters,
  type DiscoveryInteractionState,
  type PublicDiscoveryCatalog,
  type PublicProfile,
  type RankedPublicChapter,
} from "@/lib/public-discovery";
import type { ArchiveEnvelopeV1 } from "@/lib/archive";
import { ChapterCover } from "./editorial-media";
import { MotionLink as Link } from "./editorial-motion";
import { EmptyState, PageHeader } from "./editorial-ui";
import { MusicRoomFrame, type PersonalSpaceShelfItem } from "./editorial-music-room";
import {
  ChapterDetailHero,
  ChapterPlaylistActions,
  ChapterTrackSection,
  type ChapterTrackDetailItem,
} from "./editorial-views-chapters";
import { chapterColorStyle, formatDate } from "./editorial-format";

type DiscoveryActions = {
  onToggleFollow: (profileId: string) => void;
  onToggleLike: (chapterId: string) => void;
  onActivityRead: (activityId: string) => void;
};

function initials(profile: PublicProfile): string {
  return profile.name.slice(0, 1);
}

function ProfileStamp({
  profile,
  compact = false,
  showHandle = true,
}: {
  profile: PublicProfile;
  compact?: boolean;
  showHandle?: boolean;
}) {
  return (
    <span className={`public-profile-stamp${compact ? " is-compact" : ""}`}>
      <span className="public-profile-avatar" style={{ backgroundColor: profile.avatarTone }} aria-hidden="true">{initials(profile)}</span>
      <span>
        <strong>{profile.name}</strong>
        {showHandle ? <small>@{profile.handle}</small> : null}
      </span>
    </span>
  );
}

function ChapterFeedLine({ item, index }: { item: RankedPublicChapter; index: number }) {
  const { chapter, profile, reason } = item;
  if (!chapter.tracks.length) return null;
  return (
    <Link
      className="public-chapter-line"
      href={`/discover/chapter?id=${encodeURIComponent(chapter.id)}`}
      intent="shared"
      sharedId={chapter.id}
    >
      <span className="public-chapter-index">{String(index + 1).padStart(2, "0")}</span>
      <ChapterCover
        tracks={chapter.tracks.map((item) => item.track)}
        sharedId={chapter.id}
        title={chapter.name}
        color="violet"
        className="public-chapter-art"
      />
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
        action={activityOnly ? (
          <Link className="discover-activity-button is-active" href="/discover" intent="back" aria-label="팔로잉 활동 닫기">
            <X size={18} aria-hidden="true" />
          </Link>
        ) : (
          <Link className="discover-activity-button" href="/discover?activity=1" intent="tab" aria-label={unreadCount ? `새 활동 ${unreadCount}개` : "팔로우 활동"}>
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
  const liked = state.likedChapterIds.includes(chapter.id);
  const trackItems: ChapterTrackDetailItem[] = chapter.tracks.map((item) => ({
    id: item.id,
    track: item.track,
    summary: item.visibility === "public" ? item.note ?? "남긴 기록 없음" : "기록이 비공개입니다",
    tags: item.visibility === "public"
      ? item.tags.map((tag) => ({ id: `${item.id}:${tag}`, label: tag }))
      : [],
    privateRecord: item.visibility === "private",
    action: item.visibility === "private"
      ? <span className="chapter-memory-status">기록 비공개</span>
      : undefined,
  }));
  const publicRecordCount = chapter.tracks.filter((item) => item.visibility === "public").length;
  return (
    <div className="page-content chapter-view chapter-detail-compact public-chapter-detail">
      <Link
        className="public-chapter-owner"
        href={`/discover/profile?id=${encodeURIComponent(profile.id)}`}
        intent="forward"
        aria-label={`${profile.name} 프로필 보기`}
      >
        <ProfileStamp profile={profile} showHandle={false} />
        <ChevronRight size={16} aria-hidden="true" />
      </Link>
      <ChapterDetailHero
        cover={<ChapterCover tracks={chapter.tracks.map((item) => item.track)} sharedId={chapter.id} title={chapter.name} color="violet" />}
        eyebrow={<>공개 챕터 · {formatDate(chapter.createdAt)}</>}
        title={chapter.name}
        description={chapter.description}
        meta={`${chapter.tracks.length}곡 · ${publicRecordCount}개 공개 기록`}
        actions={<LikeButton chapterId={chapter.id} liked={liked} likeCount={chapter.likeCount} onToggle={actions.onToggleLike} />}
        actionsOutsideCopy
        utilities={<ChapterPlaylistActions chapterId={chapter.id} source="discover" />}
        utilitiesOutsideCopy
        style={chapterColorStyle("violet")}
      />
      <ChapterTrackSection items={trackItems} label={`${chapter.tracks.length}곡`} title="수록곡" />
    </div>
  );
}

export function PublicProfileDetail({
  catalog,
  state,
  profileId,
  showAll,
  actions,
}: {
  catalog: PublicDiscoveryCatalog;
  state: DiscoveryInteractionState;
  profileId: string | null;
  showAll: boolean;
  actions: DiscoveryActions;
}) {
  const profile = getPublicProfile(catalog, profileId);
  if (!profile) return <div className="page-content"><EmptyState title="아카이버를 찾지 못했어요" action={<Link className="button" href="/discover">탐색으로 돌아가기</Link>} /></div>;
  const chapters = getProfileChapters(catalog, profile.id);
  const followed = state.followedProfileIds.includes(profile.id);
  const featured = profile.space.featuredChapterIds
    .map((id) => catalog.chapters[id])
    .filter((chapter): chapter is NonNullable<typeof chapter> => Boolean(chapter && chapter.profileId === profile.id));
  const visibleChapters = showAll ? chapters : featured;
  const items: PersonalSpaceShelfItem[] = visibleChapters.map((chapter) => ({
    id: chapter.id,
    title: chapter.name,
    trackCount: chapter.tracks.length,
    artwork: <ChapterCover tracks={chapter.tracks.map((item) => item.track)} sharedId={chapter.id} title={chapter.name} color="violet" />,
    href: `/discover/chapter?id=${encodeURIComponent(chapter.id)}`,
  }));
  const profileHref = `/discover/profile?id=${encodeURIComponent(profile.id)}`;
  return <MusicRoomFrame
    eyebrow={showAll ? "ALL CHAPTERS" : "MUSIC ROOM"}
    title={showAll ? `${profile.name}의 모든 챕터` : `${profile.name}의 음악 서재`}
    owner={<ProfileStamp profile={profile} showHandle={false} />}
    ownerBio={profile.bio}
    themeId={profile.space.themeId}
    layoutId={showAll ? "stack" : profile.space.layoutId}
    items={items}
    empty={<EmptyState title="공개한 챕터 없음" />}
    primaryAction={<FollowButton profileId={profile.id} followed={followed} onToggle={actions.onToggleFollow} />}
    footer={chapters.length && !showAll ? <Link href={`${profileHref}&view=all`} intent="forward">전체 챕터 보기</Link> : showAll ? <Link href={profileHref} intent="back">대표 챕터 보기</Link> : undefined}
  />;
}
