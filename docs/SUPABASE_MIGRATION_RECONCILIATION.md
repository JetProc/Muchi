# Supabase 마이그레이션 정합성

뮤키의 프로덕션 프로젝트는 초기 개발 중 Dashboard SQL 적용과 로컬 파일 적용이 섞여 있어, 과거 적용 이력이 로컬 파일명과 완전히 일치하지 않을 수 있습니다. 데이터베이스 스키마를 다시 실행하거나 `schema_migrations`를 직접 수정하지 마세요.

## 현재 기준

- 로컬 `supabase/migrations/`에는 초기 상태, 공개 탐색, 프로필 보안, 소셜, 애정도, 원자 저장/대표 이미지 저장소 변경이 모두 들어 있습니다.
- 프로덕션에는 `20260723004112_atomic_archive_sync_and_public_covers`, `20260723004146_remove_public_cover_listing_policy`가 적용되어 있습니다.
- 새 환경은 파일을 시간순으로 모두 적용합니다.

## 기존 프로덕션을 CLI와 연결할 때

1. 먼저 `supabase migration list`로 원격 이력을 확인합니다.
2. 이미 실제 스키마에 반영된 과거 파일은 `supabase migration repair --status applied <version>`으로 **적용 완료 표시만** 맞춥니다.
3. 아직 적용되지 않은 파일만 `supabase db push`로 실행합니다.
4. `supabase db pull` 후 생성된 차이가 없는지 검토합니다.

과거 버전은 데이터가 존재하는 운영 환경이므로, 같은 SQL을 다시 실행하거나 원격 이력 테이블을 SQL로 수정하는 방식은 사용하지 않습니다.
