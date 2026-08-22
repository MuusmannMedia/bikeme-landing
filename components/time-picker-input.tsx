"use client";

import { useRef, type ComponentPropsWithoutRef, type MouseEvent } from "react";

type TimePickerInputProps = Omit<ComponentPropsWithoutRef<"input">, "type">;

export function TimePickerInput({ className, onClick, ...props }: TimePickerInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = (event: MouseEvent<HTMLInputElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;

    const input = inputRef.current;
    if (!input || input.disabled || input.readOnly || typeof input.showPicker !== "function") return;

    try {
      input.showPicker();
      event.preventDefault();
    } catch {
      // Browsers without an available programmatic picker retain their native input behavior.
    }
  };

  return (
    <input
      {...props}
      ref={inputRef}
      className={["bike-app-time-picker", className].filter(Boolean).join(" ")}
      type="time"
      onClick={handleClick}
    />
  );
}
