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
  required = true,
  minimumValue,
  stepSeconds,
  invalidMessage, onValueChange
}: {
  name: string;
  defaultValue?: string | null;
  required?: boolean;
  minimumValue?: string | null;
  stepSeconds?: number;
  invalidMessage?: string; onValueChange?: (iso:string) => void;
}) {
  const [value, setValue] = useState(() => toLocalInputValue(defaultValue));
  const date = value ? new Date(value) : null;
  const iso = date && Number.isFinite(date.getTime()) ? date.toISOString() : "";
  const minimum = minimumValue && stepSeconds ? new Date(Math.floor(Date.parse(minimumValue)/(stepSeconds*1000))*stepSeconds*1000).toISOString() : minimumValue;
  return (
    <>
      <input
        type="datetime-local"
        value={value}
        required={required}
        min={minimum ? toLocalInputValue(minimum) : undefined}
        step={stepSeconds}
        onInvalid={(event) => {
          if (invalidMessage) event.currentTarget.setCustomValidity(invalidMessage);
        }}
        onInput={(event) => {
          event.currentTarget.setCustomValidity("");
          setValue(event.currentTarget.value);
          const next=new Date(event.currentTarget.value);
          onValueChange?.(Number.isFinite(next.getTime())?next.toISOString():"");
        }}
        onChange={(event) => {
          event.currentTarget.setCustomValidity("");
          setValue(event.currentTarget.value);
          const next=new Date(event.currentTarget.value);
          onValueChange?.(Number.isFinite(next.getTime())?next.toISOString():"");
        }}
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
