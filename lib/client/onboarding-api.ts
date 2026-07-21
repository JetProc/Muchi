export type OnboardingStatus = {
  completed: boolean;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
};

export class OnboardingApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

async function request(method: "GET" | "PUT", nickname?: string): Promise<OnboardingStatus> {
  let response: Response;
  try {
    response = await fetch("/api/onboarding", {
      method,
      cache: "no-store",
      headers: method === "PUT" ? { "Content-Type": "application/json" } : undefined,
      body: method === "PUT" ? JSON.stringify({ nickname }) : undefined,
    });
  } catch {
    throw new OnboardingApiError("unavailable", "서버와 연결하지 못했어요. 네트워크를 확인해 주세요.");
  }

  const body = await response.json().catch(() => ({})) as Partial<OnboardingStatus> & {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    throw new OnboardingApiError(body.code ?? "unavailable", body.message ?? "온보딩 정보를 처리하지 못했어요.");
  }
  if (
    typeof body.completed !== "boolean"
    || typeof body.displayName !== "string"
    || !(body.avatarUrl === null || typeof body.avatarUrl === "string")
    || typeof body.bio !== "string"
  ) {
    throw new OnboardingApiError("invalid_response", "서버가 올바르지 않은 온보딩 정보를 반환했습니다.");
  }
  return { completed: body.completed, displayName: body.displayName, avatarUrl: body.avatarUrl, bio: body.bio };
}

export function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  return request("GET");
}

export function saveOnboardingComplete(nickname: string): Promise<OnboardingStatus> {
  return request("PUT", nickname);
}
