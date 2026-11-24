import { galleryErrorKind } from "./gallery-client";
import type { GalleryErrorCode } from "./gallery-contract";

type Entry =
  | { status: "loading"; controller: AbortController; url?: string }
  | { status: "ready"; url: string; decoded?: HTMLImageElement }
  | { status: "error"; error: GalleryErrorCode };

// Every instance belongs to one gallery mount and one authenticated actor.
export function createGalleryPhotoCache(options: {
  read: (id: string, signal: AbortSignal, background: boolean) => Promise<Blob>;
  decode?: (url: string) => Promise<HTMLImageElement | void>;
  createUrl?: (blob: Blob) => string;
  revokeUrl?: (url: string) => void;
}) {
  const entries = new Map<string, Entry>();
  const subscribers = new Set<() => void>();
  const empty = new Map<string, Entry>();
  let snapshot: ReadonlyMap<string, Entry> = empty;
  let nearby: readonly string[] = [];
  const maxEntries = 5;
  const backgroundLimit = 2;
  const createUrl = options.createUrl ?? (blob => URL.createObjectURL(blob));
  const revokeUrl = options.revokeUrl ?? (url => URL.revokeObjectURL(url));
  const decode = options.decode ?? (async url => {
    const image = new Image();
    image.src = url;
    await image.decode();
    return image;
  });

  function publish() {
    snapshot = new Map(entries);
    subscribers.forEach(listener => listener());
  }

  function drop(id: string) {
    const entry = entries.get(id);
    if (!entry) return;
    entries.delete(id);
    if (entry.status === "loading") entry.controller.abort();
    if (entry.status !== "error" && entry.url) revokeUrl(entry.url);
  }

  function trim(keep: (id: string, entry: Entry) => boolean) {
    const previousSize = entries.size;
    for (const [id, entry] of entries) if (!keep(id, entry)) drop(id);
    if (entries.size !== previousSize) publish();
  }

  async function load(id: string, background = false) {
    if (!nearby.includes(id) || entries.has(id)) return;
    if (entries.size >= maxEntries) {
      const oldest = [...entries.keys()].find(key => !nearby.includes(key));
      if (oldest) drop(oldest);
    }
    const controller = new AbortController();
    const entry: Entry = { status: "loading", controller };
    entries.set(id, entry);
    publish();
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(25_000)]);
    try {
      const blob = await options.read(id, signal, background);
      if (entries.get(id) !== entry) return;
      signal.throwIfAborted();
      entry.url = createUrl(blob);
      const decoded = await decode(entry.url);
      if (entries.get(id) !== entry) return;
      signal.throwIfAborted();
      entries.set(id, { status: "ready", url: entry.url, decoded: decoded || undefined });
    } catch (error) {
      if (entries.get(id) !== entry) return;
      if (entry.url) revokeUrl(entry.url);
      entries.set(id, { status: "error", error: galleryErrorKind(error) });
    }
    publish();
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => empty,
    subscribe(listener: () => void) {
      subscribers.add(listener);
      return () => { subscribers.delete(listener); };
    },
    select(ids: readonly string[], foregroundOnly = false) {
      const last = nearby[0];
      nearby = ids;
      const current = ids[0];
      trim((id, entry) => entry.status === "ready" || (nearby.includes(id) &&
        !(foregroundOnly && id !== current && entry.status === "loading") &&
        !(id === current && last !== current && entry.status === "error" && entry.error === "network")));
      const entry = entries.get(current);
      if (entry?.status === "ready") {
        entries.delete(current);
        entries.set(current, entry);
      }
    },
    load,
    warm() {
      let pending = [...entries.values()].filter(entry => entry.status === "loading").length;
      for (const id of nearby) {
        if (pending >= backgroundLimit) break;
        if (entries.has(id)) continue;
        pending++;
        void load(id, true);
      }
    },
    async retry(id: string) {
      if (entries.get(id)?.status === "error") drop(id);
      await load(id);
    },
    reconcile(authorizedIds: ReadonlySet<string>) {
      trim(id => authorizedIds.has(id));
    },
    pause() {
      nearby = [];
      trim((_id, entry) => entry.status === "ready");
    },
    clear() {
      nearby = [];
      trim(() => false);
    }
  };
}
