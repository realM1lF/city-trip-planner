/** Basis-URL für Share-Links (Netlify: x-forwarded-*). */
export function publicOriginFromRequest(req: Request): string {
  const url = new URL(req.url);
  const proto =
    req.headers.get("x-forwarded-proto") ??
    (url.protocol.replace(":", "") || "https");
  const host =
    req.headers.get("x-forwarded-host") ??
    req.headers.get("host") ??
    url.host;
  return `${proto}://${host}`;
}
