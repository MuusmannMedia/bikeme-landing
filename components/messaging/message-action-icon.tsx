const paths = {
  minimize: "M6 12h12",
  restore: "M6 12h12M12 6v12",
  close: "m6 6 12 12M18 6 6 18",
  emoji: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8 14a4.5 4.5 0 0 0 8 0M8.5 9h.01m7 0h.01",
  reply: "m9 10-4 4 4 4m-4-4h10a4 4 0 0 0 4-4V6",
  edit: "m14 6 4 4M4 20l4.6-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z",
  delete: "M4 7h16m-10 4v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3",
  report: "M5 21V4m0 1c5-4 9 4 14 0v9c-5 4-9-4-14 0",
  copy: "M9 9h11v11H9zM15 5V4H4v11h1",
  block: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM5 5l14 14",
  unblock: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm-4-10 3 3 5-6",
  dm: "M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4 3v-3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z",
};

export function MessageActionIcon({ name }: { name: keyof typeof paths }) {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}
