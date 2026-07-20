import type { SupabaseClient } from "@supabase/supabase-js";
import { validateNickname } from "@/lib/profile";

export type OnboardingProfile = {
  completed: boolean;
  displayName: string;
  avatarUrl: string | null;
};

type ProfileRow = {
  display_name: string;
  onboarding_completed: boolean;
  profile_setup_completed: boolean;
  avatar_url: string | null;
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
    displayName: row.display_name,
    avatarUrl: safeAvatarUrl(row.avatar_url),
  };
}

export async function readOnboardingProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<OnboardingProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, onboarding_completed, profile_setup_completed, avatar_url")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? toOnboardingProfile(data as ProfileRow)
    : { completed: false, displayName: "", avatarUrl: null };
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
    .select("display_name, onboarding_completed, profile_setup_completed, avatar_url")
    .single();
  if (error) throw error;
  return toOnboardingProfile(data as ProfileRow);
}
