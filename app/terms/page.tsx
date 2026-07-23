import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "이용약관",
  description: "뮤키 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <main className="legal-page">
      <article>
        <Link className="legal-brand" href="/">뮤키</Link>
        <h1>이용약관</h1>
        <p className="legal-updated">시행일: 2026년 7월 23일</p>

        <section>
          <h2>1. 서비스</h2>
          <p>뮤키는 사용자가 음악을 기록하고 태그, 메모, 사진을 더해 챕터로 보관하거나 선택적으로 공유할 수 있는 개인 음악 아카이브입니다.</p>
        </section>
        <section>
          <h2>2. 계정과 책임</h2>
          <p>사용자는 본인의 Google 계정으로 서비스를 이용하며 계정과 기기의 안전을 관리해야 합니다. 타인의 권리를 침해하거나 불법적인 콘텐츠를 저장하거나 공유해서는 안 됩니다.</p>
        </section>
        <section>
          <h2>3. YouTube Music 내보내기</h2>
          <p>내보내기는 사용자의 명시적인 요청에 따라 비공개 YouTube 플레이리스트를 생성합니다. 검색 결과와 YouTube에서 제공하는 콘텐츠의 정확성, 이용 가능 여부 및 정책은 YouTube의 운영 상태에 따라 달라질 수 있습니다.</p>
        </section>
        <section>
          <h2>4. 서비스 변경</h2>
          <p>안정성, 보안, 외부 API 정책 변경 또는 운영상 필요에 따라 기능을 변경하거나 일시 중단할 수 있습니다. 중요한 변경은 서비스 내에서 안내합니다.</p>
        </section>
        <section>
          <h2>5. 책임의 범위</h2>
          <p>뮤키는 합리적인 범위에서 서비스를 안정적으로 제공하기 위해 노력합니다. 다만 외부 서비스 장애, 사용자의 설정이나 네트워크 환경 등 통제하기 어려운 사유로 발생한 손해에는 관련 법령이 허용하는 범위에서 책임이 제한될 수 있습니다.</p>
        </section>
        <section>
          <h2>6. 문의</h2>
          <p>서비스 관련 문의는 <a href="mailto:soonjae8297@gmail.com">soonjae8297@gmail.com</a>으로 보내 주세요.</p>
        </section>
      </article>
    </main>
  );
}
