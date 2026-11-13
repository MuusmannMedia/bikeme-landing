// Non-secret invalidation only. Never carries a session or club payload.
export const CLUB_AUTH_EVENT = "bikeme:club-auth-transition";
export function announceClubAuthTransition(phase: "changing" | "settled") {
  const value = JSON.stringify({ phase, nonce: crypto.randomUUID() });
  window.dispatchEvent(new CustomEvent(CLUB_AUTH_EVENT, { detail: phase }));
  try { localStorage.setItem(CLUB_AUTH_EVENT, value); } catch { /* SDK/focus/interval checks remain active. */ }
}
export function clubAuthPhase(value: string | null): "changing" | "settled" | null {
  try { const phase = JSON.parse(value ?? "null")?.phase; return phase === "changing" || phase === "settled" ? phase : null; }
  catch { return null; }
}
