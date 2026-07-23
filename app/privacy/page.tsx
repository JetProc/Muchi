import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "뮤키 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <main className="legal-page">
      <article>
        <Link className="legal-brand" href="/">뮤키</Link>
        <h1>개인정보처리방침</h1>
        <p className="legal-updated">시행일: 2026년 7월 23일</p>

        <section>
          <h2>1. 수집하는 정보</h2>
          <p>뮤키는 서비스 제공을 위해 Google 계정의 이름, 이메일 주소, 프로필 이미지와 사용자가 직접 저장한 음악 기록, 태그, 메모 및 사진을 처리합니다.</p>
        </section>
        <section>
          <h2>2. 이용 목적</h2>
          <p>수집한 정보는 사용자 인증, 음악 기록 보관과 동기화, 공개로 설정한 챕터의 공유, 사용자가 요청한 YouTube 플레이리스트 생성에만 사용합니다.</p>
        </section>
        <section>
          <h2>3. Google 및 YouTube 데이터</h2>
          <p>Google 로그인 과정에서 YouTube 플레이리스트 생성에 필요한 OAuth 권한을 함께 요청합니다. 권한은 사용자가 직접 내보내기를 요청했을 때 검토한 곡으로 비공개 YouTube 플레이리스트를 만들고 곡을 추가하는 데만 사용합니다. OAuth 액세스 토큰은 뮤키 데이터베이스에 저장하지 않습니다.</p>
        </section>
        <section>
          <h2>4. 보관과 삭제</h2>
          <p>계정과 음악 기록은 사용자가 서비스를 이용하는 동안 보관합니다. 사용자는 서비스 설정에서 기록을 초기화하거나 Google 계정의 보안 설정에서 뮤키의 접근 권한을 철회할 수 있습니다.</p>
        </section>
        <section>
          <h2>5. 처리 위탁 및 국외 처리</h2>
          <p>뮤키는 인증과 데이터 보관을 위해 Supabase, 서비스 배포를 위해 Vercel, 사용자가 요청한 플레이리스트 처리를 위해 Google 및 YouTube API를 사용합니다. 각 사업자는 자체 개인정보처리방침과 보안 기준에 따라 정보를 처리할 수 있습니다.</p>
        </section>
        <section>
          <h2>6. 문의</h2>
          <p>개인정보 관련 문의는 <a href="mailto:soonjae8297@gmail.com">soonjae8297@gmail.com</a>으로 보내 주세요.</p>
        </section>
      </article>
    </main>
  );
}
