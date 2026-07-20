"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function GoogleMark() {
  return (
    <svg className="google-mark" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.703-1.568 2.684-3.875 2.684-6.616Z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.26c-.806.54-1.838.86-3.048.86-2.344 0-4.328-1.584-5.036-3.71H.957v2.332A9 9 0 0 0 9 18Z" />
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.594.102-1.17.282-1.71V4.96H.957A9 9 0 0 0 0 9c0 1.453.348 2.83.957 4.04l3.007-2.33Z" />
      <path fill="#EA4335" d="M9 3.58c1.322 0 2.51.454 3.444 1.344l2.584-2.584C13.462.88 11.426 0 9 0A9 9 0 0 0 .957 4.96l3.007 2.33C4.672 5.164 6.656 3.58 9 3.58Z" />
    </svg>
  );
}

export function AuthGate({ message }: { message?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function signIn() {
    setLoading(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (authError) throw authError;
    } catch (cause) {
      setLoading(false);
      setError(cause instanceof Error ? cause.message : "Google 로그인을 시작하지 못했어요.");
    }
  }

  return (
    <main className="auth-gate" aria-labelledby="login-title">
      <section className="auth-gate-card">
        <div className="auth-gate-brand" aria-label="뮤키">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="auth-gate-mark" src="/assets/brand/muchi-logo.png" alt="" width={64} height={64} decoding="async" />
          <strong>뮤키</strong>
        </div>
        <p className="entry-eyebrow">MY MUSIC WORLD</p>
        <h1 id="login-title">챕터로 쌓아 올린<br />나만의 음악 세계</h1>
        <p className="auth-gate-intro">{message ?? "좋아한 곡을 기록하고, 장면을 더하고, 나만의 음악 세계로 쌓아 보세요."}</p>
        <ol className="entry-path" aria-label="뮤키로 만드는 음악 세계">
          <li><span>01</span><strong>곡을 담고</strong></li>
          <li><span>02</span><strong>기억을 더하고</strong></li>
          <li><span>03</span><strong>뮤커와 나눠요</strong></li>
        </ol>
        <div className="entry-action">
          <button className="button auth-google-button" type="button" onClick={signIn} disabled={loading} aria-busy={loading}>
            {loading ? "로그인으로 이동 중…" : <><GoogleMark />Google로 시작하기</>}
          </button>
          <p className="entry-notice">로그인하면 어떤 기기에서도 내 음악 세계를 이어갈 수 있어요.</p>
          {error ? <p className="auth-gate-error" role="alert">{error}</p> : null}
        </div>
      </section>
    </main>
  );
}
