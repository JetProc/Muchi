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
        <span className="onboarding-mark">MUMU</span>
        <p className="onboarding-greeting">{greeting}</p>
        <h1 id="onboarding-title">좋아한 음악을<br />나만의 기억으로.</h1>
        <p className="onboarding-description">
          곡을 담고, 태그와 메모를 더해<br />나만의 음악 아카이브를 만들어 보세요.
        </p>
        <div className="onboarding-features" aria-label="MUMU 주요 기능">
          <span>곡 기록</span>
          <span>챕터 정리</span>
          <span>기억 회고</span>
        </div>
        <button
          className="button button-primary onboarding-start"
          type="button"
          onClick={onComplete}
          disabled={loading}
        >
          {loading ? "시작하는 중…" : "MUMU 시작하기"}
        </button>
        {error ? <p className="onboarding-error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
