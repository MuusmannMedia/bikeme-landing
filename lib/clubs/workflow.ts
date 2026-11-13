import { clubError, type ClubCommand, type ClubErrorKind, type ClubPerson } from "./membership-types";
export type CommandDraft = Omit<ClubCommand, "actorId" | "requestId">;
type State = { query: string; people: ClubPerson[]; searching: boolean; searched: boolean; searchError: ClubErrorKind | null;
  busy: boolean; pending: Readonly<ClubCommand> | null; error: ClubErrorKind | null; notice: boolean };
const empty = (): State => ({ query: "", people: [], searching: false, searched: false, searchError: null, busy: false, pending: null, error: null, notice: false });

// Only drafts and one immutable intent survive a transient read failure. All
// server-owned rows live in the access gate; search rows are purged on pause.
export function createClubWorkflow(options: {
  userId: string; key: () => string; canAct: () => boolean;
  send: (command: Readonly<ClubCommand>, signal: AbortSignal) => Promise<void>;
  search: (query: string, signal: AbortSignal) => Promise<ClubPerson[]>;
  refresh: () => Promise<void>; identityLost: () => void;
}) {
  let state = empty(), epoch = 0, searchVersion = 0, active = true;
  let writeAbort: AbortController | null = null, searchAbort: AbortController | null = null;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<State>) => { state = {...state, ...patch}; listeners.forEach(l => l()); };
  function pause() { ++searchVersion; searchAbort?.abort(); update({people: [], searching: false, searched: false}); }
  function reset() { ++epoch; ++searchVersion; writeAbort?.abort(); searchAbort?.abort(); state = empty(); listeners.forEach(l => l()); }
  async function execute(command: Readonly<ClubCommand>) {
    const current = epoch;
    writeAbort = new AbortController();
    update({busy: true, pending: command, error: null, notice: false});
    try {
      await options.send(command, writeAbort.signal);
      if (!active || current !== epoch) return false;
      update({pending: null, notice: true, people: [], searched: false});
      await options.refresh();
      return active && current === epoch;
    } catch (error) {
      if (!active || current !== epoch) return false;
      const kind = clubError(error).kind;
      if (kind === "auth") { reset(); options.identityLost(); return false; }
      // The request may have committed. A retry must use this exact intent.
      update({error: kind, pending: kind === "network" ? command : null});
      await options.refresh();
      return false;
    } finally { if (active && current === epoch) update({busy: false}); }
  }
  return {
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    getSnapshot: () => state,
    start() { active = true; },
    pause,
    reset,
    stop() { active = false; reset(); },
    setQuery(query: string) { if (state.busy || state.pending) return; ++searchVersion; searchAbort?.abort(); update({query, people: [], searching: false, searched: false, searchError: null}); },
    async search() {
      if (!active || !options.canAct() || state.busy || state.pending || state.searching || Array.from(state.query.trim()).length < 3) return;
      const current = epoch, version = ++searchVersion;
      searchAbort?.abort(); searchAbort = new AbortController();
      update({searching: true, searchError: null, searched: false, people: []});
      try {
        const people = await options.search(state.query, searchAbort.signal);
        if (active && current === epoch && version === searchVersion && options.canAct()) update({people, searching: false, searched: true});
      } catch (error) {
        if (!active || current !== epoch || version !== searchVersion) return;
        const kind = clubError(error).kind;
        if (kind === "auth") { reset(); options.identityLost(); return; }
        update({people: [], searching: false, searched: true, searchError: kind});
        if (kind === "access") await options.refresh();
      }
    },
    async run(draft: CommandDraft) {
      if (!active || !options.canAct() || state.busy || state.pending) return false;
      return execute(Object.freeze({...draft, actorId: options.userId, requestId: options.key()}));
    },
    async retry() {
      if (!active || !options.canAct() || state.busy || !state.pending) return false;
      return execute(state.pending);
    }
  };
}
export type ClubWorkflow = ReturnType<typeof createClubWorkflow>;
