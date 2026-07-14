import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="page-content">
      <section className="empty-state" aria-labelledby="offline-title">
        <div>
          <span className="section-label">OFFLINE ARCHIVE</span>
          <h1 id="offline-title">잠시 연결이 끊겼어요</h1>
          <p>
            저장해 둔 음악과 기억은 이 기기에 그대로 남아 있어요. 연결이
            돌아오면 새로운 음악도 다시 찾을 수 있습니다.
          </p>
          <Link className="button button-primary" href="/">
            내 음악 아카이브로 돌아가기
          </Link>
          <p className="legal-note">
            음악 검색과 30초 미리듣기는 인터넷 연결이 필요합니다.
          </p>
        </div>
      </section>
    </main>
  );
}
