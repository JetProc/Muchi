export async function POST() {
  return Response.json(
    { code: "not_ready", message: "YouTube Music 내보내기는 준비 중이에요." },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
