export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const requestUrl = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    requestUrl.protocol.replace(":", "");

  return origin === `${protocol}://${host ?? requestUrl.host}`;
}
