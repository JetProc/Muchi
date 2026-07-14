import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-card" aria-labelledby="offline-title">
        <div className="offline-symbol" aria-hidden="true">
          <span className="offline-symbol-note">♪</span>
          <span className="offline-symbol-pulse" />
        </div>

        <p className="offline-eyebrow">OFFLINE MODE</p>
        <h1 className="offline-title" id="offline-title">
          잠시 연결이 끊겼어요
        </h1>
        <p className="offline-description">
          저장해 둔 음악과 기억은 이 기기에 그대로 남아 있어요. 연결이
          돌아오면 새로운 음악도 다시 찾을 수 있습니다.
        </p>

        <Link className="offline-action" href="/">
          내 음악 세계로 돌아가기
        </Link>

        <p className="offline-hint">
          음악 검색과 30초 미리듣기는 인터넷 연결이 필요합니다.
        </p>
      </section>
    </main>
  );
}
