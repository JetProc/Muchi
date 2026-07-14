import { redirectWithSearchParams } from "../_lib/redirect-with-search-params";

export function GET(request: Request) {
  return redirectWithSearchParams(request, "/chapters");
}
