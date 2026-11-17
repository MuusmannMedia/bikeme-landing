import { ClubReadError, clubReadError } from "./types";

export type ClubPageState<T> = {
  status: "loading" | "ready" | "error" | "access" | "auth";
  data: T | null;
  error: "network" | "unavailable" | "quota" | null;
};

// The only active club-data store. No server-rendered children, router payload,
// persisted state or successful-response cache can resurrect a revoked page.
export function createClubPageGuard<T>(options: {
  userId: string;
  read: (signal: AbortSignal) => Promise<{ userId: string; snapshot: T }>;
  identityLost: () => void;
}) {
  const empty: ClubPageState<T> = { status: "loading", data: null, error: null };
  let state = empty, generation = 0, stopped = false;
  let controller: AbortController | null = null;
  const listeners = new Set<() => void>();
  function update(next: ClubPageState<T>) { state = next; listeners.forEach(listener => listener()); }
  function invalidate() { ++generation; controller?.abort(); controller = null; }
  function pause() { invalidate(); update(empty); }
  function revoke() { stopped = true; invalidate(); update({ status: "auth", data: null, error: null }); }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    getServerSnapshot: () => empty,
    pause,
    revoke,
    start() { stopped = false; pause(); },
    async verify(retain = false) {
      if (stopped) return;
      if(retain) invalidate(); else pause();
      const current = generation;
      const request = new AbortController();
      controller = request;
      const timer = setTimeout(() => request.abort(), 25000);
      try {
        const result = await options.read(request.signal);
        if (stopped || generation !== current) return;
        if (request.signal.aborted) throw new ClubReadError("network");
        if (result.userId !== options.userId) { revoke(); options.identityLost(); return; }
        update({ status: "ready", data: result.snapshot, error: null });
      } catch (error) {
        if (stopped || generation !== current) return;
        const failure = clubReadError(error);
        if (failure.kind === "auth") { revoke(); options.identityLost(); }
        else if (failure.kind === "access") update({ status: "access", data: null, error: null });
        else update({ status: "error", data: null, error: failure.kind });
      } finally { clearTimeout(timer); }
    },
    stop() { stopped = true; pause(); }
  };
}
