import {
  createDiscoveryInteractionState,
  parseDiscoveryInteractionState,
  type DiscoveryInteractionState,
} from "@/lib/public-discovery";
import type { SupabaseClient } from "@supabase/supabase-js";

export type VersionedDiscoveryState = { state: DiscoveryInteractionState; revision: number };

function rowToState(row: { payload: unknown; revision: number }): VersionedDiscoveryState {
  return { state: parseDiscoveryInteractionState(JSON.stringify(row.payload)), revision: row.revision };
}

export async function readDiscoveryState(supabase: SupabaseClient, userId: string): Promise<VersionedDiscoveryState> {
  const { data, error } = await supabase.from("discovery_states").select("payload, revision").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data) return rowToState(data as { payload: unknown; revision: number });
  const state = createDiscoveryInteractionState();
  const { data: inserted, error: insertError } = await supabase
    .from("discovery_states")
    .insert({ user_id: userId, payload: state, revision: 0 })
    .select("payload, revision")
    .single();
  if (!insertError) return rowToState(inserted as { payload: unknown; revision: number });
  const { data: retry, error: retryError } = await supabase.from("discovery_states").select("payload, revision").eq("user_id", userId).single();
  if (retryError) throw insertError;
  return rowToState(retry as { payload: unknown; revision: number });
}

export async function replaceDiscoveryState(
  supabase: SupabaseClient,
  userId: string,
  state: DiscoveryInteractionState,
  expectedRevision: number,
): Promise<{ status: "ok"; value: VersionedDiscoveryState } | { status: "conflict"; value: VersionedDiscoveryState }> {
  const { data, error } = await supabase
    .from("discovery_states")
    .update({ payload: state, revision: expectedRevision + 1 })
    .eq("user_id", userId)
    .eq("revision", expectedRevision)
    .select("payload, revision")
    .maybeSingle();
  if (error) throw error;
  if (data) return { status: "ok", value: rowToState(data as { payload: unknown; revision: number }) };
  return { status: "conflict", value: await readDiscoveryState(supabase, userId) };
}
