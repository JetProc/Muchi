export function redirectWithSearchParams(
  request: Request,
  pathname: string,
): Response {
  const destination = new URL(request.url);
  destination.pathname = pathname;
  return Response.redirect(destination, 307);
}
