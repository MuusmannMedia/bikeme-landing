import type { StatusBucket, StatusMetric } from "@/lib/app-status";

export function StatusBars({ buckets, metric, label }: { buckets: StatusBucket[]; metric: StatusMetric; label: string }) {
  const values = buckets.map((bucket) => metric === "distance" ? bucket.distanceKm : metric === "elevation" ? bucket.elevationMeters : bucket.durationMinutes);
  const maximum = Math.max(1, ...values);
  return (
    <div className="bike-app-status-chart" role="img" aria-label={label}>
      {buckets.map((bucket, index) => <div className="bike-app-status-column" key={bucket.id}><div className="bike-app-status-track"><span style={{ height: `${Math.max(values[index] > 0 ? 4 : 0, (values[index] / maximum) * 100)}%` }} /></div><small>{bucket.label}</small></div>)}
    </div>
  );
}
