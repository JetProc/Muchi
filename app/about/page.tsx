import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "뮤키 소개",
  description: "뮤키는 음악에 태그, 메모, 사진을 더해 챕터로 보관하는 개인 음악 아카이브입니다.",
};

export default function AboutPage() {
  return (
    <main className="legal-page">
      <article>
        <Link className="legal-brand" href="/">뮤키</Link>
        <h1>뮤키</h1>
        <p className="legal-updated">음악을 기억하는 개인 아카이브</p>

        <section>
          <h2>뮤키는 어떤 서비스인가요?</h2>
          <p>뮤키는 좋아했던 음악에 태그, 메모, 사진을 더해 나만의 챕터로 보관하고 다시 꺼내 볼 수 있는 개인 음악 아카이브입니다.</p>
        </section>
        <section>
          <h2>YouTube Music 연동</h2>
          <p>사용자가 직접 요청한 경우에만 Google 계정의 YouTube 권한을 사용해 검토한 곡을 비공개 YouTube 플레이리스트로 내보냅니다. YouTube 플레이리스트 가져오기는 공개 링크를 이용하며 사용자 계정 권한을 요청하지 않습니다.</p>
        </section>
        <section>
          <h2>개인정보와 이용 안내</h2>
          <p><Link href="/privacy">개인정보처리방침</Link>과 <Link href="/terms">이용약관</Link>에서 데이터 처리 목적과 서비스 이용 조건을 확인할 수 있습니다.</p>
        </section>
        <section>
          <h2>문의</h2>
          <p>서비스 관련 문의는 <a href="mailto:soonjae8297@gmail.com">soonjae8297@gmail.com</a>으로 보내 주세요.</p>
        </section>
      </article>
    </main>
  );
}
