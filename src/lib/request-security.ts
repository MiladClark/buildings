function normalizeOrigin(origin: string) {
  try {
    const url = new URL(origin);
    return `${url.protocol}//${url.host}`;
  } catch {
    return origin;
  }
}

export function isSameOriginRequest(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  const originClean = normalizeOrigin(origin);
  const requestUrl = new URL(request.url);
  const host =
    request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const protocol =
    request.headers.get("x-forwarded-proto") ??
    requestUrl.protocol.replace(":", "");

  const expectedOrigin = normalizeOrigin(
    `${protocol}://${host ?? requestUrl.host}`,
  );
  if (originClean === expectedOrigin) return true;
  if (originClean === normalizeOrigin(requestUrl.origin)) return true;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.BETTER_AUTH_URL;
  if (appUrl && originClean === normalizeOrigin(appUrl)) return true;

  const trusted = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((o) => normalizeOrigin(o.trim()))
    .filter(Boolean);
  if (trusted.includes(originClean)) return true;

  // In local development, permit localhost <-> 127.0.0.1 <-> [::1] on the same port
  try {
    const originUrl = new URL(originClean);
    const expectedUrl = new URL(expectedOrigin);
    const isLocalHost = (h: string) =>
      h === "localhost" || h === "127.0.0.1" || h === "[::1]";

    if (
      isLocalHost(originUrl.hostname) &&
      isLocalHost(expectedUrl.hostname) &&
      originUrl.port === expectedUrl.port
    ) {
      return true;
    }
  } catch {
    // ignore URL parsing errors
  }

  return false;
}
