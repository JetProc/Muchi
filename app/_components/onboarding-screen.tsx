"use client";

import { useState, type FormEvent } from "react";
import {
  NICKNAME_MAX_LENGTH,
  validateNickname,
} from "@/lib/profile";

export function OnboardingScreen({
  displayName,
  avatarUrl,
  loading,
  error,
  onComplete,
}: {
  displayName: string;
  avatarUrl: string | null;
  loading: boolean;
  error: string | null;
  onComplete: (nickname: string) => void;
}) {
  const suggested = validateNickname(displayName);
  const [nickname, setNickname] = useState(suggested.ok ? suggested.nickname : "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const nicknameLength = Array.from(nickname).length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNickname(nickname);
    if (!validation.ok) {
      setValidationError(validation.message);
      return;
    }
    setValidationError(null);
    onComplete(validation.nickname);
  }

  return (
    <main className="onboarding-screen" aria-labelledby="onboarding-title">
      <form className="onboarding-card" onSubmit={submit}>
        <header className="onboarding-hero">
          <div className="onboarding-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="onboarding-mark" src="/assets/brand/muchi-logo.png" alt="뮤키" width={56} height={56} decoding="async" />
            <p className="onboarding-brand-name">뮤키</p>
          </div>
          <p className="entry-eyebrow">WELCOME TO MUCHI</p>
          <h1 id="onboarding-title">뮤키에서 사용할<br />이름을 정해 주세요</h1>
          <p className="onboarding-description">
            탐색에 챕터를 공개하면 다른 뮤커에게<br />이 닉네임으로 보여요.
          </p>
        </header>
        <section className="onboarding-profile" aria-labelledby="nickname-label">
          <div className="onboarding-google-profile">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Google 프로필" width={64} height={64} referrerPolicy="no-referrer" />
            ) : (
              <span aria-hidden="true">{displayName.trim().slice(0, 1) || "뮤"}</span>
            )}
            <div><strong>Google 계정으로 연결됨</strong><small>프로필 사진은 닉네임 설정에만 표시돼요.</small></div>
          </div>
          <label className="field onboarding-nickname" htmlFor="onboarding-nickname">
            <span id="nickname-label">닉네임</span>
            <input
              id="onboarding-nickname"
              className="input"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value);
                setValidationError(null);
              }}
              minLength={2}
              maxLength={NICKNAME_MAX_LENGTH}
              placeholder="예: 새벽산책"
              autoComplete="nickname"
              autoFocus
              required
              aria-describedby="nickname-rules"
              aria-invalid={Boolean(validationError)}
            />
            <small id="nickname-rules">한글·영문·숫자·띄어쓰기만 사용 · {nicknameLength}/{NICKNAME_MAX_LENGTH}</small>
          </label>
        </section>
        <footer className="onboarding-action">
          <button
            className="button button-primary onboarding-start"
            type="submit"
            disabled={loading}
            aria-busy={loading}
          >
            {loading ? "시작하는 중…" : "첫 챕터 열기"}
          </button>
          <p>닉네임은 공개 챕터의 작성자 이름으로 사용돼요.</p>
          {validationError || error ? <p className="onboarding-error" role="alert">{validationError ?? error}</p> : null}
        </footer>
      </form>
    </main>
  );
}
