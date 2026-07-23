export async function GET() {
  return Response.json(
    { code: "not_ready", message: "Apple Music 내보내기는 준비 중이에요." },
    { status: 501, headers: { "Cache-Control": "no-store" } },
  );
}
