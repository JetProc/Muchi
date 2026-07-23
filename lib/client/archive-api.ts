import { parseArchive, type ArchiveEnvelopeV1 } from "@/lib/archive";
import type { ArchivePatchOperation } from "@/lib/archive-patch";

export type VersionedArchive = { archive: ArchiveEnvelopeV1; revision: number };
export type ArchiveSaveResult = { revision: number };

export class ArchiveApiError extends Error {
  constructor(readonly code: string, message: string, readonly latest?: VersionedArchive) {
    super(message);
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ArchiveApiError("unavailable", "서버와 연결하지 못했어요. 네트워크를 확인한 뒤 다시 시도해 주세요.");
  }
}

async function decodeArchive(response: Response): Promise<VersionedArchive> {
  const body = await response.json().catch(() => ({})) as { archive?: unknown; revision?: unknown; code?: string; message?: string };
  if (!response.ok) {
    const latest = body.archive && typeof body.revision === "number" ? parseVersioned(body.archive, body.revision) : undefined;
    throw new ArchiveApiError(body.code ?? "unavailable", body.message ?? "아카이브를 불러오지 못했어요.", latest);
  }
  return parseVersioned(body.archive, body.revision);
}

async function decodeSave(response: Response): Promise<ArchiveSaveResult> {
  const body = await response.json().catch(() => ({})) as { archive?: unknown; revision?: unknown; code?: string; message?: string };
  if (!response.ok) {
    const latest = body.archive && typeof body.revision === "number" ? parseVersioned(body.archive, body.revision) : undefined;
    throw new ArchiveApiError(body.code ?? "unavailable", body.message ?? "아카이브를 저장하지 못했어요.", latest);
  }
  if (!Number.isInteger(body.revision) || typeof body.revision !== "number") {
    throw new ArchiveApiError("invalid_response", "서버가 올바르지 않은 저장 결과를 반환했습니다.");
  }
  return { revision: body.revision };
}

function parseVersioned(payload: unknown, revision: unknown): VersionedArchive {
  const parsed = parseArchive(JSON.stringify(payload));
  if (parsed.status !== "ok" || !Number.isInteger(revision) || typeof revision !== "number") {
    throw new ArchiveApiError("invalid_response", "서버가 올바르지 않은 아카이브를 반환했습니다.");
  }
  return { archive: parsed.archive, revision };
}

export async function fetchArchive(): Promise<VersionedArchive> {
  return decodeArchive(await request("/api/archive", { cache: "no-store" }));
}

export async function saveArchivePatch(
  operations: ArchivePatchOperation[],
  expectedRevision: number,
  syncPublicProjection: boolean,
): Promise<ArchiveSaveResult> {
  return decodeSave(await request("/api/archive", {
    method: "PUT",
    body: JSON.stringify({ operations, expectedRevision, syncPublicProjection }),
  }));
}
