export type OnboardingStatus = {
  completed: boolean;
  displayName: string;
};

export class OnboardingApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

async function request(method: "GET" | "PUT"): Promise<OnboardingStatus> {
  let response: Response;
  try {
    response = await fetch("/api/onboarding", { method, cache: "no-store" });
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
  if (typeof body.completed !== "boolean" || typeof body.displayName !== "string") {
    throw new OnboardingApiError("invalid_response", "서버가 올바르지 않은 온보딩 정보를 반환했습니다.");
  }
  return { completed: body.completed, displayName: body.displayName };
}

export function fetchOnboardingStatus(): Promise<OnboardingStatus> {
  return request("GET");
}

export function saveOnboardingComplete(): Promise<OnboardingStatus> {
  return request("PUT");
}
