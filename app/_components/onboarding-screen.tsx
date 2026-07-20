"use client";

import { useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Search, Tags } from "lucide-react";
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
  onComplete: (nickname: string, destination: "capture") => void;
}) {
  const suggested = validateNickname(displayName);
  const [nickname, setNickname] = useState(suggested.ok ? suggested.nickname : "");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [step, setStep] = useState<"profile" | "intro">("profile");
  const nicknameLength = Array.from(nickname).length;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validation = validateNickname(nickname);
    if (!validation.ok) {
      setValidationError(validation.message);
      return;
    }
    setValidationError(null);
    setNickname(validation.nickname);
    setStep("intro");
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
          <p className="entry-eyebrow">{step === "profile" ? "WELCOME TO MUCHI" : "YOUR MUSIC WORLD"}</p>
          <h1 id="onboarding-title">{step === "profile" ? <>뮤키에서 사용할<br />이름을 정해 주세요</> : <>좋아한 곡을<br />나만의 세계로 쌓아 보세요</>}</h1>
          {step === "intro" ? <p className="onboarding-description">한 곡의 순간을 남기고, 태그로 다시 찾고,<br />챕터로 이어 보세요.</p> : null}
        </header>
        {step === "profile" ? <section className="onboarding-profile" aria-labelledby="nickname-label">
          <div className="onboarding-google-profile">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="Google 프로필" width={64} height={64} referrerPolicy="no-referrer" />
            ) : (
              <span aria-hidden="true">{displayName.trim().slice(0, 1) || "뮤"}</span>
            )}
            <div><strong>Google 계정으로 연결됨</strong></div>
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
        </section> : <section className="onboarding-journey" aria-label="뮤키 사용 방법">
          <div><span>01</span><Search aria-hidden="true" size={18} /><p><strong>기억할 곡 찾기</strong><small>직접 검색하거나 음악 앱 링크로 가져와요.</small></p></div>
          <div><span>02</span><Tags aria-hidden="true" size={18} /><p><strong>순간을 태그로 남기기</strong><small>나만의 언어로 다시 찾을 단서를 만들어요.</small></p></div>
          <div><span>03</span><BookOpen aria-hidden="true" size={18} /><p><strong>챕터로 음악 세계 쌓기</strong><small>기록한 곡들을 하나의 장면으로 엮어요.</small></p></div>
        </section>}
        <footer className="onboarding-action">
          {step === "profile" ? <>
            <button className="button button-primary onboarding-start" type="submit">다음 <ArrowRight aria-hidden="true" size={17} /></button>
          </> : <>
            <button className="button button-primary onboarding-start" type="button" disabled={loading} aria-busy={loading} onClick={() => onComplete(nickname, "capture")}>
              {loading ? "시작하는 중…" : "첫 곡 기록하기"} {!loading ? <ArrowRight aria-hidden="true" size={17} /> : null}
            </button>
            <button className="onboarding-back" type="button" disabled={loading} onClick={() => setStep("profile")}><ArrowLeft aria-hidden="true" size={15} /> 닉네임 다시 수정</button>
          </>}
          {validationError || error ? <p className="onboarding-error" role="alert">{validationError ?? error}</p> : null}
        </footer>
      </form>
    </main>
  );
}
