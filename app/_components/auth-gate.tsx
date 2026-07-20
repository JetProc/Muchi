"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/` },
      });
      if (authError) throw authError;
    } catch (cause) {
      setLoading(false);
      setError(cause instanceof Error ? cause.message : "Google 로그인을 시작하지 못했어요.");
    }
  }

  return (
    <main className="auth-gate" aria-labelledby="login-title">
      <div className="auth-gate-card">
        <span className="auth-gate-mark">MUCHI</span>
        <h1 id="login-title">나만의 음악 기록을 시작하세요</h1>
        <p>{message ?? "Google 계정으로 로그인하면 어떤 기기에서도 내 음악 아카이브를 이어서 볼 수 있어요."}</p>
        <button className="button auth-google-button" type="button" onClick={signIn} disabled={loading}>
          {loading ? "로그인으로 이동 중…" : "Google로 계속하기"}
        </button>
        {error ? <p className="auth-gate-error" role="alert">{error}</p> : null}
      </div>
    </main>
  );
}
