const TRANSIENT_AUTH_PARAMS = [
  "code",
  "state",
  "error",
  "error_code",
  "error_description",
];

export function normalizeAuthDestination(value: string | null | undefined): string {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";

  const destination = new URL(value, "https://muchi.local");
  if (destination.pathname === "/auth" || destination.pathname.startsWith("/auth/")) return "/";

  TRANSIENT_AUTH_PARAMS.forEach((param) => destination.searchParams.delete(param));
  const search = destination.searchParams.toString();
  return `${destination.pathname}${search ? `?${search}` : ""}${destination.hash}`;
}
