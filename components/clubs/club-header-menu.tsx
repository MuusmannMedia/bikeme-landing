"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function ClubHeaderMenu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  function closeAndFocus() {
    setOpen(false);
    trigger.current?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (!open) return;

    function dismissOutside(event: Event) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }

    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeAndFocus();
    }

    document.addEventListener("pointerdown", dismissOutside);
    document.addEventListener("focusin", dismissOutside);
    document.addEventListener("keydown", dismissOnEscape);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      document.removeEventListener("focusin", dismissOutside);
      document.removeEventListener("keydown", dismissOnEscape);
    };
  }, [open]);

  return (
    <div className="bike-app-nav-group bike-app-club-menu" ref={container}>
      <button ref={trigger} type="button" className="bike-app-nav-trigger bike-app-club-menu-trigger"
        aria-label={label} title={label} aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(value => !value)}>
        <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d={open ? "m6 6 12 12M18 6 6 18" : "M4 6h16M4 12h16M4 18h16"}
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      <nav id={panelId} className="bike-app-nav-panel" aria-label={label} hidden={!open}
        onClick={event => {
          if (event.target instanceof Element && event.target.closest("a")) closeAndFocus();
        }}>
        {children}
      </nav>
    </div>
  );
}
