# MUCHI 베타 배포 점검표

이 문서는 배포 직전에 한 번씩 확인한다. 애플리케이션 코드로 확인할 수 없는 Supabase·Google Cloud 콘솔 설정도 포함한다.

## 1. Supabase 데이터베이스

Supabase Dashboard의 SQL Editor 또는 CLI에서 아래 마이그레이션이 **모두** 적용됐는지 확인한다.

1. `202607200001_create_muchi_user_state.sql`
2. `20260720054510_public_discovery_feed.sql`
3. `20260720070836_profile_setup_security_hardening.sql`
4. `20260720084502_social_interactions_and_publication_sync.sql`
5. `20260721040553_add_affection_to_archive_payloads.sql`
6. `20260721093000_public_profile_metadata_and_follows.sql`

마지막 마이그레이션은 공개 프로필 사진·소개, 실제 팔로워 수, 비로그인 공개 챕터 열람에 필요하다. 적용 전에는 이 버전을 배포하지 않는다.

## 2. 인증·배포 설정

- Vercel Production에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`가 설정됐는지 확인한다.
- Supabase Auth → URL Configuration의 Site URL을 `https://muchi-demo.vercel.app`로 설정한다.
- Redirect URLs에 다음 정확한 주소를 추가한다.
  - `https://muchi-demo.vercel.app/auth/callback`
  - 로컬 개발 주소: `http://localhost:3001/auth/callback`
- Google Auth Platform → Audience에서 외부 사용자용 Production 상태인지 확인한다.
- Google OAuth 클라이언트의 Authorized redirect URI에 Supabase 콜백을 등록한다.
  - `https://ugmggmzhfxkxtnmxkvao.supabase.co/auth/v1/callback`

## 3. 베타 시나리오

1. 시크릿 창의 새 Google 계정으로 로그인 → 닉네임 → 태그 스타터팩 → 곡 기록 → 챕터 공개까지 완료한다.
2. 다른 계정 또는 로그아웃 상태로 공개 챕터 링크와 공개 프로필 링크를 열어 본다. 읽기는 가능하고 팔로우·좋아요는 로그인 후 원래 화면으로 돌아와야 한다.
3. Android PWA에서 YouTube Music 공유 → 뮤키 → 곡 기록 완료를 확인한다.
4. iPhone/iPad에서는 음악 앱에서 링크 복사 → 뮤키의 링크로 가져오기 입력칸에 붙여넣는 흐름을 확인한다.
5. 저장 직후 네트워크를 끊고, 안내 문구와 자동 재시도 후 기록이 보존되는지 확인한다.

## 4. 배포 뒤 빠른 확인

- `/manifest.webmanifest`가 200으로 응답하는지 확인한다.
- 비로그인 `/discover`와 공개 챕터 링크가 로그인 화면 없이 열리는지 확인한다.
- `npm audit --omit=dev`가 취약점 0건인지 확인한다.
- Vercel Function 로그에서 `/api/public-discovery`, `/api/music-metadata` 오류를 확인한다.
