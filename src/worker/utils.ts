export function json(
  data: unknown,
  status = 200,
  headers: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

/**
 * Returns true when the request Origin matches the app's own origin.
 * Returns true when Origin is absent (non-browser request — not a CSRF risk).
 * Returns false when Origin is present but doesn't match — reject with 403.
 */
export function checkOrigin(request: Request): boolean {
  const origin = request.headers.get("Origin");
  if (!origin) {return true;}
  try {
    const appOrigin = new URL(request.url).origin;
    return origin === appOrigin;
  } catch {
    return false;
  }
}
