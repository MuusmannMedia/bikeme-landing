"use client";

import { useState } from "react";

function toLocalInputValue(value: string | null | undefined): string {
  const date = value ? new Date(value) : new Date(Date.now() + 24 * 60 * 60 * 1000);
  if (!Number.isFinite(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

export function LocalDateTimeInput({
  name,
  defaultValue,
  required = true
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  const [value, setValue] = useState(() => toLocalInputValue(defaultValue));
  const date = value ? new Date(value) : null;
  const iso = date && Number.isFinite(date.getTime()) ? date.toISOString() : "";
  return (
    <>
      <input
        type="datetime-local"
        value={value}
        required={required}
        onChange={(event) => setValue(event.target.value)}
      />
      <input type="hidden" name={name} value={iso} />
    </>
  );
}

export function BrowserTimezoneInput() {
  const [timezone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      return "UTC";
    }
  });
  return <input type="hidden" name="timezone" value={timezone} />;
}
