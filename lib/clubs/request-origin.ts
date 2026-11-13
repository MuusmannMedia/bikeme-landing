// Next may normalize request.nextUrl to localhost behind its local/proxy server.
// Compare against the original request authority, as its server actions do.
export function isClubRequestOrigin(origin: string | null, host: string | null, protocol: string): boolean {
  if (!origin || !host || !["http", "https"].includes(protocol)) return false;
  try {
    const value = new URL(origin);
    return value.origin === origin && value.host === host.toLowerCase() && value.protocol === `${protocol}:`;
  } catch { return false; }
}
