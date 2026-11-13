import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

// Opt-in server configuration. Kept off in the isolated test run: no real push
// is sent. Uses the same saved-invitation endpoint/summary as iOS 132.
export function clubRidePushTransport(client:SupabaseClient,actor:string) {
 if(process.env.BIKE_ME_CLUB_RIDE_PUSH_ENABLED!=="true") return undefined;
 return async (rideId:string,ids:string[]):Promise<boolean>=>{
  const auth=await client.auth.getSession();
  if(auth.error || auth.data.session?.user.id!==actor) return false;
  const token=auth.data.session.access_token;
  const verified=await client.auth.getUser(token);
  if(verified.error || verified.data.user?.id!==actor) return false;
  const {data,error}=await client.functions.invoke("notify_ride_invite",{headers:{Authorization:`Bearer ${token}`},body:{rideId,inviteeUserIds:ids,action:"send"}});
  const keys=["accepted","failed","noToken","unknown","queued","pending","disabled","skipped","receiptOk","receiptErrors","receiptUnknown","receiptPending"];
  if(error || !data || !keys.every(key=>Number.isSafeInteger(data[key])&&data[key]>=0) || !Array.isArray(data.retryIds) || data.retryIds.some((id:unknown)=>typeof id!=="string"||!ids.includes(id))) return false;
  return data.failed===0 && data.unknown===0 && !data.persistenceFailed && !data.receiptCheckFailed && data.receiptErrors===0;
 };
}
