import { createPublicDiscoveryCatalog, parseDiscoveryInteractionState, type DiscoveryInteractionState } from "@/lib/public-discovery";
import { ArchiveApiError } from "./archive-api";

export type VersionedDiscoveryState = { state: DiscoveryInteractionState; revision: number };
const catalog = createPublicDiscoveryCatalog();

async function decode(response: Response): Promise<VersionedDiscoveryState> {
  const body = await response.json().catch(() => ({})) as { state?: unknown; revision?: unknown; code?: string; message?: string };
  const value = body.state && typeof body.revision === "number"
    ? { state: parseDiscoveryInteractionState(JSON.stringify(body.state), catalog), revision: body.revision }
    : undefined;
  if (!response.ok || !value) throw new ArchiveApiError(body.code ?? "unavailable", body.message ?? "탐색 상태를 불러오지 못했어요.");
  return value;
}

export async function fetchDiscoveryState(): Promise<VersionedDiscoveryState> {
  try { return await decode(await fetch("/api/discovery-state", { cache: "no-store" })); }
  catch (cause) { if (cause instanceof ArchiveApiError) throw cause; throw new ArchiveApiError("unavailable", "탐색 상태를 불러오지 못했어요."); }
}

export async function saveDiscoveryState(state: DiscoveryInteractionState, expectedRevision: number): Promise<VersionedDiscoveryState> {
  try {
    return await decode(await fetch("/api/discovery-state", {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state, expectedRevision }),
    }));
  } catch (cause) { if (cause instanceof ArchiveApiError) throw cause; throw new ArchiveApiError("unavailable", "탐색 상태를 저장하지 못했어요."); }
}
