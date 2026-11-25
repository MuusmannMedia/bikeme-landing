import type { ClubProfile } from "./profile-contract";

type Images = { profile: ClubProfile; logo: string | null };
type State = { status: "waiting" | "ready" | "error"; images: Images | null };

export function createClubHeaderImages(options: {
  actor: string;
  clubId: string;
  read: (clubId: string, signal: AbortSignal) => Promise<{ userId: string; profile: ClubProfile }>;
  download: (path: string, actor: string, signal: AbortSignal) => Promise<Blob>;
  failure: (error: unknown) => string;
  createUrl?: (blob: Blob) => string;
  revokeUrl?: (url: string) => void;
}) {
  const createUrl = options.createUrl ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeUrl = options.revokeUrl ?? ((url: string) => URL.revokeObjectURL(url));
  const waiting: State = { status: "waiting", images: null };
  const listeners = new Set<() => void>();
  let state = waiting;
  let retained: Images | null = null;
  let pending: AbortController | null = null;
  let job: Promise<void> | null = null;
  let stopped = false;

  function publish(next: State) {
    if (state === next) return;
    state = next;
    listeners.forEach(listener => listener());
  }

  function pause() {
    pending?.abort();
    pending = null;
    job = null;
    publish(waiting);
  }

  function clear() {
    pause();
    if (retained?.logo) revokeUrl(retained.logo);
    retained = null;
  }

  function revoke() {
    stopped = true;
    clear();
  }

  function verify() {
    if (stopped) return Promise.resolve();
    if (job) return job;
    const request = new AbortController();
    pending = request;
    job = load(request);
    return job;
  }

  async function load(request: AbortController) {
    const timer = setTimeout(() => request.abort(), 25_000);
    const current = () => {
      if (pending !== request) return false;
      if (request.signal.aborted) throw new Error("Club image check timed out");
      return true;
    };

    try {
      const { userId, profile } = await options.read(options.clubId, request.signal);
      if (!current()) return;
      if (userId !== options.actor || profile.id !== options.clubId) {
        revoke();
        return;
      }

      const previous = retained;
      const path = profile.logo_path;
      const sameLogo = previous?.profile.profile_revision === profile.profile_revision && previous.profile.logo_path === path;
      const logo = sameLogo && previous.logo
        ? previous.logo
        : path ? await options.download(path, options.actor, request.signal) : null;
      if (!current()) return;

      const next = {
        profile,
        logo: typeof logo === "string" ? logo : logo && createUrl(logo)
      };
      if (previous?.logo && previous.logo !== next.logo) revokeUrl(previous.logo);
      retained = next;
      publish({ status: "ready", images: next });
    } catch (error) {
      if (pending !== request) return;
      const kind = options.failure(error);
      if (kind === "auth") revoke();
      else if (kind === "access") clear();
      else {
        clear();
        publish({ status: "error", images: null });
      }
    } finally {
      clearTimeout(timer);
      if (pending === request) {
        pending = null;
        job = null;
      }
    }
  }

  return {
    getSnapshot: () => state,
    getServerSnapshot: () => waiting,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    start() { stopped = false; },
    prepare() {
      if (!retained && state.status === "waiting") void verify();
    },
    confirm(revision: number | undefined) {
      if (stopped) return;
      // The caller has freshly authenticated the same club and actor.
      if (retained && revision === retained.profile.profile_revision) {
        if (state.images !== retained) publish({ status: "ready", images: retained });
        return;
      }
      void verify();
    },
    pause,
    clear,
    revoke,
    verify
  };
}

export type ClubHeaderImages = ReturnType<typeof createClubHeaderImages>;
