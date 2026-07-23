import type { OnboardingStatus } from "./onboarding-api";

export type ProfileUpdate = { nickname: string; bio: string };

export async function updateProfile(update: ProfileUpdate): Promise<OnboardingStatus> {
  let response: Response;
  try {
    response = await fetch("/api/profile", {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
  } catch {
    throw new Error("서버와 연결하지 못했어요. 네트워크를 확인해 주세요.");
  }
  const body = await response.json().catch(() => null) as Partial<OnboardingStatus> & { message?: string } | null;
  if (!response.ok) throw new Error(body?.message ?? "프로필을 저장하지 못했어요.");
  if (!body || typeof body.completed !== "boolean" || !Number.isInteger(body.guidedTourVersion) || typeof body.displayName !== "string" || typeof body.bio !== "string" || !(body.avatarUrl === null || typeof body.avatarUrl === "string")) {
    throw new Error("서버가 올바르지 않은 프로필 정보를 반환했습니다.");
  }
  return {
    completed: body.completed,
    guidedTourVersion: body.guidedTourVersion as number,
    displayName: body.displayName,
    avatarUrl: body.avatarUrl,
    bio: body.bio,
  };
}
