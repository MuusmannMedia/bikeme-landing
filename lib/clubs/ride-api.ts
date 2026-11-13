import type { SupabaseClient } from "@supabase/supabase-js";
import { allRideRows, AppDataError, loadRideDetail, normalizeRide, rideProjection, listHotspots, loadViewer } from "../app-data";
import type { RideDetail, RideSummary, Hotspot, UnitSystem, Viewer } from "../app-model";
import { createClubReadApi } from "./api";
import { clubError, ClubError } from "./membership-types";
import { clubRideAvailable, parseClubRide } from "./ride-contract";
import { sendClubRideInvites, settleClubRidePush } from "./ride-invites";
import { isClubId } from "./types";
export type ClubRideData = { invitedIds: string[]; rides: RideSummary[]; selected: RideDetail | null; selectedUnavailable: boolean; hotspots: Hotspot[]; units: UnitSystem; viewer: Viewer };
export function createClubRideApi(client: SupabaseClient, actor: string, notify?: (rideId:string,ids:string[])=>Promise<boolean>) {
  async function club(id: string) { return createClubReadApi(client, actor).detail(id); }
  async function ride(clubId: string, rideId: string) {
    if (!isClubId(rideId)) throw new ClubError("invalid");
    await club(clubId);
    const result=await loadRideDetail(client,actor,rideId,true).catch(error => { throw new ClubError(error instanceof AppDataError && error.code === "NOT_FOUND" ? "rideUnavailable" : "network"); });
    if(result.clubId !== clubId || result.clubClosedAt) throw new ClubError("rideUnavailable");
    return result;
  }
  async function result<T>(query: PromiseLike<{data:T;error:unknown}>): Promise<T> { const r=await query; if(r.error) throw clubError(r.error); return r.data; }
  return {
    async load(clubId: string, selectedId: string | null, creation=false): Promise<ClubRideData> {
      const membership=await club(clubId);
      const viewer=await loadViewer(client);
      const rows: Record<string,unknown>[]=[];
      for(let offset=0;;offset+=200) {
        const page=await result(client.from("rides").select(rideProjection).eq("club_id",clubId).is("club_closed_at",null).eq("status","ACTIVE").gt("start_time",new Date().toISOString()).order("start_time").order("id").range(offset,offset+199));
        rows.push(...(page??[]) as unknown as Record<string,unknown>[]); if(!page || page.length<200) break;
      }
      const joined=(await allRideRows(offset=>client.from("participants").select("ride_id").eq("user_id",actor).order("ride_id").range(offset,offset+199))).data;
      const ids=new Set((joined??[]).map(r=>String(r.ride_id)));
      let selected: RideDetail|null=null, selectedUnavailable=false;
      if(selectedId) {
        try { selected=await ride(clubId,selectedId); }
        catch(error) { if(error instanceof ClubError && error.kind === "rideUnavailable") selectedUnavailable=true; else throw error; }
      }
      const invitations=await allRideRows(offset=>client.from("ride_invites").select("ride_id").eq("invitee_id",actor).is("accepted_at",null).is("declined_at",null).order("ride_id").range(offset,offset+199));
      const rideIds=new Set(rows.map(r=>r.id));
      // Recheck membership after the payload is assembled, not only before it.
      await club(clubId);
      return {invitedIds:invitations.data.map(r=>String(r.ride_id)).filter(id=>rideIds.has(id)),viewer,rides:rows.map(row=>normalizeRide(row,membership.members.find(m=>m.user_id===row.host_id)?.display_name??null,ids)),selected,selectedUnavailable,hotspots:creation?await listHotspots(client):[],units:viewer.profile.unitSystem};
    },
    async create(form: FormData) {
      const viewer=await loadViewer(client);
      const input=parseClubRide(form,actor,viewer.profile.unitSystem);
      await club(input.clubId);
      let meeting=input.meeting;
      if(input.hotspotId) {
        const row=await result(client.from("hotspots").select("latitude,longitude,name,address").eq("id",input.hotspotId).maybeSingle());
        if(!row || row.latitude==null || row.longitude==null) throw new ClubError("invalid");
        meeting={latitude:row.latitude,longitude:row.longitude,address:row.address||row.name};
      }
      if(!meeting) throw new ClubError("invalid");
      const inserted=await client.from("rides").insert({...input.row,latitude:meeting.latitude,longitude:meeting.longitude,meeting_address:meeting.address}).select("id").single();
      if(inserted.error?.code === "23505") {
        const existing=await result(client.from("rides").select("id,host_id,club_id,club_closed_at").eq("id",input.id).maybeSingle());
        if(!existing || existing.host_id !== actor || existing.club_id !== input.clubId || existing.club_closed_at) throw new ClubError("access");
      } else if(inserted.error) throw clubError(inserted.error);
      // The ride is committed. Any later failure is a separate outcome, including on replay.
      let routeFailed=false;
      if(input.route) try {
        await result(client.from("ride_planned_routes").upsert({ride_id:input.id,route_coordinates:input.route.routeCoordinates,point_count:input.route.pointCount,source_type:input.route.sourceType,source_filename:input.route.fileName,source_size_bytes:input.route.fileSizeBytes,bounds:input.route.bounds,created_by:actor},{onConflict:"ride_id"}));
      } catch { routeFailed=true; }
      return {rideId:input.id,clubId:input.clubId,routeFailed};
    },
    async act(input: {clubId:string;rideId:string;action:string;ids?:string[];accept?:boolean}) {
      const current=await ride(input.clubId,input.rideId);
      if(input.action === "invite") {
        if(current.hostId!==actor || !clubRideAvailable(current)) throw new ClubError("rideUnavailable");
        const ids=[...new Set(input.ids??[])].sort();
        if(!ids.length || ids.some(id=>!isClubId(id)||id===actor) || ids.length>2000) throw new ClubError("invalid");
        const invited=await sendClubRideInvites(ids,batch=>result(client.rpc("club_ride_invite_members",{p_ride_id:input.rideId,p_user_ids:batch})));
        return settleClubRidePush(invited,notify?ids=>notify(input.rideId,ids):undefined);
      }
      if(input.action === "cancel" && current.hostId===actor && current.status==="CANCELLED") return {results:[],retryIds:[],push:"not_requested"};
      if(!clubRideAvailable(current)) throw new ClubError("rideUnavailable");
      if(input.action === "respond") {
        if(typeof input.accept!=="boolean") throw new ClubError("invalid");
        const decision=await result(client.rpc("club_ride_respond_invite",{p_ride_id:input.rideId,p_accept:input.accept}));
        if(decision!==(input.accept?"accepted":"declined")) throw new ClubError("network");
      } else if(input.action === "join") {
        if(current.hostId===actor) throw new ClubError("invalid");
        const response=await client.from("participants").insert({ride_id:input.rideId,user_id:actor,role:"RIDER",status:"joined"});
        if(response.error && response.error.code!=="23505") throw clubError(response.error);
      } else if(input.action === "leave") {
        if(current.hostId===actor) throw new ClubError("invalid");
        await result(client.from("participants").delete().eq("ride_id",input.rideId).eq("user_id",actor).eq("role","RIDER"));
      } else if(input.action === "cancel") {
        if(current.hostId!==actor) throw new ClubError("access");
        await result(client.from("rides").update({status:"CANCELLED"}).eq("id",input.rideId).eq("host_id",actor).eq("status","ACTIVE").select("id").single());
      } else throw new ClubError("invalid");
      return {results:[],retryIds:[],push:"not_requested"};
    }
  };
}
