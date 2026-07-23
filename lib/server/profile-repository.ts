import type { SupabaseClient } from "@supabase/supabase-js";
import { validateNickname } from "@/lib/profile";
import { syncPublishedAuthorProfile } from "./public-discovery-repository";

export type OnboardingProfile = {
  completed: boolean;
  guidedTourVersion: number;
  displayName: string;
  avatarUrl: string | null;
  bio: string;
};

export type ProfileUpdate = { nickname: string; bio: string };

type ProfileRow = {
  display_name: string;
  onboarding_completed: boolean;
  profile_setup_completed: boolean;
  guided_tour_version: number;
  avatar_url: string | null;
  bio: string;
};

function safeAvatarUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function toOnboardingProfile(row: ProfileRow): OnboardingProfile {
  return {
    completed: row.onboarding_completed && row.profile_setup_completed,
    guidedTourVersion: row.guided_tour_version,
    displayName: row.display_name,
    avatarUrl: safeAvatarUrl(row.avatar_url),
    bio: row.bio.trim(),
  };
}

export async function readOnboardingProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<OnboardingProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, onboarding_completed, profile_setup_completed, guided_tour_version, avatar_url, bio")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? toOnboardingProfile(data as ProfileRow)
    : { completed: false, guidedTourVersion: 0, displayName: "", avatarUrl: null, bio: "" };
}

export async function completeOnboarding(
  supabase: SupabaseClient,
  userId: string,
  nicknameInput: string,
): Promise<OnboardingProfile> {
  const validation = validateNickname(nicknameInput);
  if (!validation.ok) throw new Error(validation.message);
  const { data, error } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      display_name: validation.nickname,
      onboarding_completed: true,
      profile_setup_completed: true,
    }, { onConflict: "id" })
    .select("display_name, onboarding_completed, profile_setup_completed, guided_tour_version, avatar_url, bio")
    .single();
  if (error) throw error;
  const profile = toOnboardingProfile(data as ProfileRow);
  await syncPublishedAuthorProfile(supabase, userId);
  return profile;
}

function normalizeBio(value: string): string {
  return value.trim().replace(/\r\n/g, "\n");
}

export async function updateProfile(
  supabase: SupabaseClient,
  userId: string,
  update: ProfileUpdate,
): Promise<OnboardingProfile> {
  const nickname = validateNickname(update.nickname);
  if (!nickname.ok) throw new Error(nickname.message);
  const bio = normalizeBio(update.bio);
  if (Array.from(bio).length > 160) throw new Error("소개는 160자 이내로 입력해 주세요.");
  const { data, error } = await supabase
    .from("profiles")
    .update({ display_name: nickname.nickname, bio })
    .eq("id", userId)
    .select("display_name, onboarding_completed, profile_setup_completed, guided_tour_version, avatar_url, bio")
    .single();
  if (error) throw error;
  await syncPublishedAuthorProfile(supabase, userId);
  return toOnboardingProfile(data as ProfileRow);
}

export async function completeGuidedTour(
  supabase: SupabaseClient,
  userId: string,
  version: number,
): Promise<number> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ guided_tour_version: version })
    .eq("id", userId)
    .select("guided_tour_version")
    .single();
  if (error) throw error;
  return (data as { guided_tour_version: number }).guided_tour_version;
}
