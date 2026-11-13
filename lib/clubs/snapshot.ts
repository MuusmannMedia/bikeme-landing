import { createHash } from "node:crypto";

// Only a digest crosses the verification endpoint: never member/profile data.
export function clubSnapshotStamp(userId: string, snapshot: unknown): string {
  return createHash("sha256").update(JSON.stringify({ userId, snapshot })).digest("hex");
}
