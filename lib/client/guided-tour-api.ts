export class GuidedTourApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

export async function saveGuidedTourComplete(version: number): Promise<number> {
  let response: Response;
  try {
    response = await fetch("/api/guided-tour", {
      method: "PUT",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version }),
    });
  } catch {
    throw new GuidedTourApiError("unavailable", "투어 완료 상태를 저장하지 못했어요.");
  }

  const body = await response.json().catch(() => ({})) as {
    code?: string;
    message?: string;
    guidedTourVersion?: unknown;
  };
  if (!response.ok) {
    throw new GuidedTourApiError(body.code ?? "unavailable", body.message ?? "투어 완료 상태를 저장하지 못했어요.");
  }
  if (!Number.isInteger(body.guidedTourVersion) || Number(body.guidedTourVersion) < 0) {
    throw new GuidedTourApiError("invalid_response", "서버가 올바르지 않은 투어 상태를 반환했습니다.");
  }
  return Number(body.guidedTourVersion);
}
