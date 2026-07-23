import {
  createSeedArchive,
  getCubeTracks,
  getLatestCubeTrackNote,
  type ArchiveEnvelopeV1,
  type TrackId,
} from "./archive";
import type { PublicDiscoveryCatalog } from "./public-discovery";

export const CURRENT_GUIDED_TOUR_VERSION = 1;
export const GUIDED_TOUR_PUBLIC_PROFILE_ID = "tour:profile";
export const GUIDED_TOUR_PUBLIC_CHAPTER_ID = "tour:chapter";
export const GUIDED_TOUR_CHAPTER_ID = "seed:cube:dawn-drive";
export const GUIDED_TOUR_MEMORY_ID = "seed:cube-track:dawn-radio";

export type GuidedTourStep = {
  stepId: string;
  href: string;
  target: string;
  eyebrow: string;
  title: string;
  description: string;
};

export const GUIDED_TOUR_STEPS: readonly GuidedTourStep[] = [
  { stepId: "navigation", href: "/", target: "navigation", eyebrow: "둘러보기", title: "다섯 탭에서 음악 세계를 만들어요", description: "홈, 탐색, 기록, 챕터, 찾기를 차례로 둘러볼게요. 아래의 이전·다음 버튼으로 이동할 수 있어요." },
  { stepId: "home-featured", href: "/", target: "home-featured", eyebrow: "홈", title: "대표 음악을 다시 들어보세요", description: "가장 선명한 기억을 홈에서 바로 열고, 30초 미리듣기를 재생할 수 있어요." },
  { stepId: "home-library", href: "/", target: "home-library", eyebrow: "홈", title: "기록이 태그와 챕터로 쌓여요", description: "정리 대기 곡, 자주 쓴 태그, 최근 챕터와 다시 듣고 싶은 순간을 한곳에서 확인해요." },
  { stepId: "discover", href: "/discover", target: "discover-feed", eyebrow: "탐색", title: "다른 뮤커의 챕터를 둘러보세요", description: "비슷한 곡과 태그를 가진 공개 챕터를 추천받고 팔로잉의 새 글도 확인할 수 있어요." },
  { stepId: "public-actions", href: `/discover/chapter?id=${encodeURIComponent(GUIDED_TOUR_PUBLIC_CHAPTER_ID)}`, target: "public-actions", eyebrow: "탐색", title: "좋아요와 팔로우로 취향을 이어가요", description: "공개된 태그·메모·사진을 보고 챕터에 좋아요를 누르거나 작성자를 팔로우할 수 있어요." },
  { stepId: "capture-search", href: "/capture", target: "capture-search", eyebrow: "기록", title: "곡명이나 아티스트로 찾아보세요", description: "기록 탭에서 외부 음악 카탈로그를 검색해 남기고 싶은 곡을 찾을 수 있어요." },
  { stepId: "capture-link", href: "/capture", target: "capture-link", eyebrow: "기록", title: "음악 앱 링크도 바로 가져와요", description: "YouTube Music·Apple Music 링크를 붙여 넣거나 Android 공유 메뉴에서 뮤키로 보낼 수 있어요." },
  { stepId: "capture-results", href: "/capture", target: "capture-results", eyebrow: "기록", title: "미리 듣고 여러 곡을 고를 수 있어요", description: "검색 결과를 재생해 확인하고, 여러 곡을 선택해 한 챕터에 함께 담을 수 있어요." },
  { stepId: "memory-tags", href: `/memory?id=${encodeURIComponent(GUIDED_TOUR_MEMORY_ID)}`, target: "memory-tags", eyebrow: "곡 기록", title: "태그와 애정도로 순간을 표시해요", description: "날짜와 나만의 태그, 애정도를 더하면 나중에 같은 기분의 곡을 쉽게 다시 찾을 수 있어요." },
  { stepId: "memory-notes", href: `/memory?id=${encodeURIComponent(GUIDED_TOUR_MEMORY_ID)}`, target: "memory-notes", eyebrow: "곡 기록", title: "메모와 사진을 날짜별로 남겨요", description: "같은 곡에도 여러 날의 감상과 사진을 쌓고, 공개 여부를 곡 기록마다 선택할 수 있어요." },
  { stepId: "inbox", href: "/inbox", target: "inbox", eyebrow: "보관함", title: "아직 정리하지 않은 곡을 모아둬요", description: "여러 곡을 선택해 한 챕터로 옮기거나 필요 없는 대기 기록을 한꺼번에 정리할 수 있어요." },
  { stepId: "chapter-library", href: "/chapters", target: "chapter-library", eyebrow: "챕터", title: "장면과 시기별로 음악을 엮어요", description: "직접 만든 챕터와 자동으로 모인 월별 챕터를 나눠 보고 새 챕터를 만들 수 있어요." },
  { stepId: "chapter-detail", href: `/chapter?id=${encodeURIComponent(GUIDED_TOUR_CHAPTER_ID)}`, target: "chapter-detail", eyebrow: "챕터", title: "챕터의 표지와 공개 범위를 정해요", description: "소개와 표지를 바꾸고, 챕터를 공개하거나 비공개로 두며 하위 챕터도 만들 수 있어요." },
  { stepId: "chapter-management", href: `/chapter?id=${encodeURIComponent(GUIDED_TOUR_CHAPTER_ID)}`, target: "chapter-management", eyebrow: "챕터", title: "곡 순서와 정렬 방식을 관리해요", description: "추가순·애정도순으로 보고, 관리 메뉴에서 곡 순서 변경과 챕터 수정을 할 수 있어요." },
  { stepId: "share", href: `/chapter/share?id=${encodeURIComponent(GUIDED_TOUR_CHAPTER_ID)}`, target: "share", eyebrow: "공유", title: "인스타그램용 이미지를 만들어요", description: "형식, 배경색, 표시 정보, 곡 순서와 한 줄 설명을 골라 공유 이미지를 저장할 수 있어요." },
  { stepId: "playlist", href: `/playlist?id=${encodeURIComponent(GUIDED_TOUR_CHAPTER_ID)}`, target: "playlist", eyebrow: "내보내기", title: "YouTube Music 플레이리스트로 옮겨요", description: "곡 매칭을 확인하고 체크박스로 포함할 곡을 고른 뒤 비공개 플레이리스트로 내보낼 수 있어요." },
  { stepId: "search", href: "/search", target: "search", eyebrow: "찾기", title: "기록 속 단서를 조합해 찾아요", description: "곡명, 아티스트, 태그, 메모를 검색하고 태그의 AND·OR 조건으로 결과를 좁힐 수 있어요." },
  { stepId: "recap", href: "/recap", target: "recap", eyebrow: "회고", title: "그때 들었던 음악을 다시 펼쳐보세요", description: "기간을 고르면 당시 기록한 곡과 메모를 모아 한 번에 돌아볼 수 있어요." },
  { stepId: "personal-space", href: "/", target: "personal-space", eyebrow: "내 음악 서재", title: "나만의 음악 공간을 꾸며요", description: "테마와 배치를 바꾸고 방문자 화면에서 공개 챕터가 어떻게 보이는지 확인할 수 있어요." },
  { stepId: "settings", href: "/settings", target: "settings", eyebrow: "설정", title: "나머지 도구도 설정에서 관리해요", description: "모션, 회고, 태그, 백업, 공개 프로필, 전체 가이드, 초기화와 로그아웃을 관리해요. 이제 실제 첫 곡을 기록해 볼게요." },
] as const;

export function createGuidedTourArchive(): ArchiveEnvelopeV1 {
  const archive = createSeedArchive();
  const trackId = Object.keys(archive.data.tracks)[0] as TrackId | undefined;
  const memory = archive.data.cubeTracks[GUIDED_TOUR_MEMORY_ID];
  return {
    ...archive,
    data: {
      ...archive.data,
      inbox: trackId ? {
        [trackId]: {
          trackId,
          capturedAt: archive.updatedAt,
          source: "seed" as const,
        },
      } : {},
      cubeTracks: memory ? {
        ...archive.data.cubeTracks,
        [memory.id]: {
          ...memory,
          affection: "red",
          recordVisibility: "public",
        },
      } : archive.data.cubeTracks,
    },
  };
}

export function createGuidedTourCatalog(
  archive: ArchiveEnvelopeV1,
): PublicDiscoveryCatalog {
  const entries = getCubeTracks(archive, GUIDED_TOUR_CHAPTER_ID).slice(0, 3);
  const profile = {
    id: GUIDED_TOUR_PUBLIC_PROFILE_ID,
    name: "새벽수집가",
    bio: "도시가 조용해진 뒤의 음악을 모아요.",
    avatarUrl: null,
    avatarTone: "#6f7898",
    followerCount: 24,
    followedByViewer: false,
    space: {
      themeId: "paper" as const,
      layoutId: "shelf" as const,
      featuredChapterIds: [GUIDED_TOUR_PUBLIC_CHAPTER_ID],
    },
  };
  const chapter = {
    id: GUIDED_TOUR_PUBLIC_CHAPTER_ID,
    profileId: profile.id,
    name: "새벽 드라이브",
    description: "도시의 불빛이 길게 이어지던 밤",
    color: "#5f617c",
    artworkUrl: entries[0]?.track.artworkUrl ?? null,
    createdAt: archive.updatedAt,
    trackSort: "affection" as const,
    likeCount: 18,
    likedByViewer: false,
    tracks: entries.map(({ cubeTrack, track, tags }) => ({
      id: `tour:${cubeTrack.id}`,
      track,
      visibility: "public" as const,
      note: getLatestCubeTrackNote(cubeTrack)?.body ?? cubeTrack.character,
      tags: tags.map((tag) => tag.label),
      affection: cubeTrack.affection,
      recordPhoto: null,
    })),
  };
  return {
    profiles: { [profile.id]: profile },
    chapters: { [chapter.id]: chapter },
    activities: [{
      id: `tour:activity:${chapter.id}`,
      profileId: profile.id,
      chapterId: chapter.id,
      publishedAt: chapter.createdAt,
    }],
  };
}
