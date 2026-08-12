"use client";

import { useMemo, useRef, useState, type CSSProperties } from "react";

import { getLocaleTag } from "@/lib/app-format";
import type { UnitSystem } from "@/lib/app-model";
import type { StatusBucket, StatusMetric } from "@/lib/app-status";
import {
  formatStatusDistance,
  formatStatusDuration,
  formatStatusElevation,
  statusDistanceValue,
  statusElevationUnit,
  statusElevationValue,
  statusText
} from "@/lib/status-format";
import type { Locale } from "@/lib/locales";

function rawValue(bucket: StatusBucket, metric: StatusMetric): number {
  return metric === "distance" ? bucket.distanceKm : metric === "elevation" ? bucket.elevationMeters : bucket.durationMinutes;
}

function displayValue(bucket: StatusBucket, metric: StatusMetric, unitSystem: UnitSystem): number {
  const value = rawValue(bucket, metric);
  if (metric === "distance") return statusDistanceValue(value, unitSystem);
  if (metric === "elevation") return statusElevationValue(value, unitSystem);
  return Math.max(0, value) / 60;
}

function formattedValue(bucket: StatusBucket, metric: StatusMetric, locale: Locale, unitSystem: UnitSystem): string {
  if (metric === "distance") return formatStatusDistance(locale, bucket.distanceKm, unitSystem, "tooltip");
  if (metric === "elevation") return formatStatusElevation(locale, bucket.elevationMeters, unitSystem);
  return formatStatusDuration(locale, bucket.durationMinutes);
}

export function StatusBars({
  buckets,
  metric,
  label,
  locale,
  unitSystem,
  timeZone
}: {
  buckets: StatusBucket[];
  metric: StatusMetric;
  label: string;
  locale: Locale;
  unitSystem: UnitSystem;
  timeZone: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeSelection = () => {
    setSelectedIndex(null);
    requestAnimationFrame(() => selectedTriggerRef.current?.focus());
  };
  const values = useMemo(() => buckets.map((bucket) => displayValue(bucket, metric, unitSystem)), [buckets, metric, unitSystem]);
  const maximum = Math.max(1, ...values);
  const width = 720;
  const height = 250;
  const insetX = 18;
  const insetY = 18;
  const plotWidth = width - insetX * 2;
  const plotHeight = height - insetY * 2;
  const points = values.map((value, index) => ({
    x: buckets.length === 1 ? width / 2 : insetX + (plotWidth * index) / (buckets.length - 1),
    y: insetY + plotHeight - (value / maximum) * plotHeight
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(" ");
  const area = `${insetX},${height - insetY} ${line} ${width - insetX},${height - insetY}`;
  const selected = selectedIndex == null ? null : buckets[selectedIndex];
  const dateFormatter = new Intl.DateTimeFormat(getLocaleTag(locale), { timeZone, day: "numeric", month: "short", year: "numeric" });
  const formatRange = (bucket: StatusBucket) => {
    const start = dateFormatter.format(new Date(bucket.start));
    const end = dateFormatter.format(new Date(bucket.end));
    return start === end ? start : `${start} – ${end}`;
  };
  const axis = [maximum, maximum / 2, 0];
  const plotStyle = {
    "--status-count": buckets.length,
    "--status-point-min-width": "24px"
  } as CSSProperties;

  return (
    <div className="bike-app-status-visual">
      <div className="bike-app-status-axis" aria-hidden="true">
        {axis.map((value, index) => {
          const formatted = new Intl.NumberFormat(getLocaleTag(locale), { maximumFractionDigits: metric === "elevation" || value >= 100 ? 0 : 1 }).format(value);
          return <span key={index}>{metric === "duration" ? `${Math.round(value)} ${statusText(locale, "status.hoursUnit")}` : metric === "elevation" ? `${formatted} ${statusElevationUnit(unitSystem)}` : formatted}</span>;
        })}
      </div>
      <div className="bike-app-status-plot-scroll">
      <div
        className="bike-app-status-plot"
        role="group"
        aria-label={label}
        style={plotStyle}
        onKeyDown={(event) => {
          if (event.key === "Escape" && selectedIndex != null) {
            event.preventDefault();
            closeSelection();
          }
        }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} aria-hidden="true" preserveAspectRatio="none">
          <defs>
            <linearGradient id="bike-status-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8fa8ff" stopOpacity=".62" /><stop offset="1" stopColor="#802782" stopOpacity=".08" /></linearGradient>
            <linearGradient id="bike-status-line" x1="0" x2="1"><stop offset="0" stopColor="#8fa8ff" /><stop offset="1" stopColor="#d49cff" /></linearGradient>
          </defs>
          <line x1={insetX} x2={width - insetX} y1={insetY} y2={insetY} className="bike-app-status-gridline" />
          <line x1={insetX} x2={width - insetX} y1={height / 2} y2={height / 2} className="bike-app-status-gridline" />
          <line x1={insetX} x2={width - insetX} y1={height - insetY} y2={height - insetY} className="bike-app-status-gridline" />
          <polygon points={area} fill="url(#bike-status-fill)" />
          <polyline points={line} fill="none" stroke="url(#bike-status-line)" strokeWidth="4" vectorEffect="non-scaling-stroke" />
          {points.map((point, index) => <circle key={buckets[index].id} cx={point.x} cy={point.y} r={selectedIndex === index ? 7 : 4} className="bike-app-status-dot" />)}
        </svg>
        <div className="bike-app-status-hit-zones">
          {buckets.map((bucket, index) => {
            const aria = `${statusText(locale, "status.dataPointA11y", { index: index + 1 })}: ${formatRange(bucket)}, ${formattedValue(bucket, metric, locale, unitSystem)}`;
            return <button key={bucket.id} type="button" aria-label={aria} aria-pressed={selectedIndex === index} onClick={(event) => {
              selectedTriggerRef.current = event.currentTarget;
              if (selectedIndex === index) closeSelection();
              else setSelectedIndex(index);
            }} />;
          })}
        </div>
        {selected ? <div className="bike-app-status-tooltip"><div role="status" aria-live="polite"><strong className="bike-app-status-row-value">{formattedValue(selected, metric, locale, unitSystem)}</strong><span className="bike-app-status-meta">{formatRange(selected)}</span></div><button type="button" onClick={closeSelection} aria-label={statusText(locale, "common.close")}>×</button></div> : null}
        <div className="bike-app-status-x-axis" aria-hidden="true">
          {buckets.map((bucket, index) => <small key={bucket.id} data-visible={index === 0 || index === Math.floor((buckets.length - 1) / 2) || index === buckets.length - 1}>{bucket.label}</small>)}
        </div>
      </div>
      </div>
    </div>
  );
}
