"use client";

export function OnboardingScreen({
  displayName,
  loading,
  error,
  onComplete,
}: {
  displayName: string;
  loading: boolean;
  error: string | null;
  onComplete: () => void;
}) {
  const greeting = displayName ? `${displayName}님, 반가워요.` : "반가워요.";

  return (
    <main className="onboarding-screen" aria-labelledby="onboarding-title">
      <section className="onboarding-card">
        <header className="onboarding-hero">
          <div className="onboarding-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="onboarding-mark" src="/assets/brand/muchi-logo.png" alt="뮤키" width={56} height={56} decoding="async" />
            <p className="onboarding-brand-name">뮤키</p>
          </div>
          <p className="onboarding-greeting">{greeting}</p>
          <p className="entry-eyebrow">YOUR FIRST CHAPTER</p>
          <h1 id="onboarding-title">챕터로 쌓아 올린<br />나만의 음악 세계</h1>
          <p className="onboarding-description">
            좋아한 음악에 그때의 기억을 더해,<br />오직 나다운 세계를 만들어 보세요.
          </p>
        </header>
        <ol className="onboarding-journey" aria-label="뮤키 시작 흐름">
          <li><span>01</span><div><strong>곡을 기록해요</strong><p>지금 마음에 남은 음악부터.</p></div></li>
          <li><span>02</span><div><strong>챕터로 쌓아요</strong><p>태그와 메모로 나만의 장면을 더해요.</p></div></li>
          <li><span>03</span><div><strong>뮤커와 나눠요</strong><p>원하면 공개 탐색으로 이어져요.</p></div></li>
        </ol>
        <footer className="onboarding-action">
          <button
            className="button button-primary onboarding-start"
            type="button"
            onClick={onComplete}
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "시작하는 중…" : "첫 챕터 열기"}
          </button>
          <p>원할 때는 내 챕터를 뮤커와 나눌 수 있어요.</p>
          {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
        </footer>
      </section>
    </main>
  );
}
