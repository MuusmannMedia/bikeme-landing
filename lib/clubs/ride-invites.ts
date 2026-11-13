import { clubError } from "./membership-types";
import { validateInviteResults, type RideInviteResult } from "./ride-contract";

// RPC has no request-key argument. Stable, distinct ID batches are idempotent;
// replay cannot reset accepted/declined decisions. A lost batch response retries
// that same batch, never any previously acknowledged batch or the ride creation.
export async function sendClubRideInvites(ids: string[], send: (batch:string[])=>Promise<unknown>) {
  const ordered=[...new Set(ids)].sort();
  const results: RideInviteResult[]=[];
  for(let offset=0;offset<ordered.length;offset+=200) {
    const batch=ordered.slice(offset,offset+200);
    try {results.push(...validateInviteResults(await send(batch),batch));}
    catch(error) {return {results,retryIds:ordered.slice(offset),error:clubError(error).kind,push:"not_requested" as const};}
  }
  return {results,retryIds:[],push:"not_requested" as const};
}

export async function settleClubRidePush<T extends {results:RideInviteResult[];retryIds:string[]}>(result:T, notify?: (ids:string[])=>Promise<boolean>) {
 const ids=result.results.filter(r=>r.status==="created"||r.status==="pending").map(r=>r.user_id);
 let push:"not_requested"|"sent"|"failed"="not_requested";
 if(notify && ids.length) try {push=await notify(ids)?"sent":"failed";} catch {push="failed";}
 // Push cannot throw or turn an acknowledged invitation into an invitation retry.
 return {...result,push};
}
