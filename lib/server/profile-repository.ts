import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingProfile = {
  completed: boolean;
  displayName: string;
};

type ProfileRow = {
  display_name: string;
  onboarding_completed: boolean;
};

function toOnboardingProfile(row: ProfileRow): OnboardingProfile {
  return {
    completed: row.onboarding_completed,
    displayName: row.display_name,
  };
}

export async function readOnboardingProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<OnboardingProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, onboarding_completed")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? toOnboardingProfile(data as ProfileRow)
    : { completed: false, displayName: "" };
}

export async function completeOnboarding(
  supabase: SupabaseClient,
  userId: string,
): Promise<OnboardingProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, onboarding_completed: true }, { onConflict: "id" })
    .select("display_name, onboarding_completed")
    .single();
  if (error) throw error;
  return toOnboardingProfile(data as ProfileRow);
}
