import {test} from "node:test";
import assert from "node:assert/strict";
import {clubRideAvailable,parseClubRide,validateInviteResults,clubRideHref} from "../lib/clubs/ride-contract";
import {clubRideKeys,clubRideText} from "../lib/clubs/ride-i18n";
import {getRideMoodOptions,getRideTitleSuggestions} from "../lib/create-ride";
import {locales} from "../lib/locales";
const actor="00000000-0000-4000-8000-000000000001",club="00000000-0000-4000-8000-000000000002";
function form() {const f=new FormData();Object.entries({actorId:actor,clubId:club,createRequestId:"00000000-0000-4000-8000-000000000003",type:"EVENT",visibility:"private",title:"Club ride",description:"",discipline:"ROAD",distance:"30",paceText:"",startTimeIso:new Date(Date.now()+86400000).toISOString(),durationHours:"2",meetingMode:"map",meetingLatitude:"55.67",meetingLongitude:"12.56",meetingAddress:"Copenhagen"}).forEach(([k,v])=>f.set(k,v));return f;}
test("club creation fixes actual club scope, EVENT and private fields",()=>{const input=parseClubRide(form(),actor,"metric");assert.equal(input.row.club_id,club);assert.equal(input.row.visibility,"private");assert.equal(input.row.type,"EVENT");assert.equal(input.row.host_id,actor);assert.equal(input.row.status,"ACTIVE");});
for(const [key,value] of Object.entries({visibility:"public",type:"PING",actorId:club,clubId:"no",createRequestId:"bad",distance:"0",discipline:"CITY",title:"ab",startTimeIso:"2000-01-01",durationHours:"0",meetingLatitude:"91",paceText:"invented"}))test(`reject ${key}=${value}`,()=>{const f=form();f.set(key,value);assert.throws(()=>parseClubRide(f,actor,"metric"));});
test("GPX invalidity fails before insert; invitations cannot piggyback creation",()=>{const f=form();f.set("plannedRoute","bad");assert.throws(()=>parseClubRide(f,actor,"metric"));f.delete("plannedRoute");f.append("inviteeIds",actor);assert.throws(()=>parseClubRide(f,actor,"metric"));});
test("imperial distance converts once",()=>assert.equal(parseClubRide(form(),actor,"imperial").row.distance_km,48.28032));
test("closed, cancelled, past and expired rides are not actionable",()=>{const now=Date.now(),r={status:"ACTIVE",startTime:new Date(now+10000).toISOString(),expiresAt:null};assert(clubRideAvailable(r,now));for(const overrides of [{clubClosedAt:new Date().toISOString()},{status:"CANCELLED"},{status:"COMPLETED"},{startTime:new Date(now-1).toISOString()},{expiresAt:new Date(now-1).toISOString()}])assert(!clubRideAvailable({...r,...overrides},now));});
test("invitation response validates exact IDs, uniqueness, count and status",()=>{assert.deepEqual(validateInviteResults([{user_id:actor,status:"created"}],[actor]),[{user_id:actor,status:"created"}]);for(const value of [null,[],[{user_id:club,status:"created"}],[{user_id:actor,status:"surprise"}],[{user_id:actor,status:"created"},{user_id:actor,status:"pending"}]])assert.throws(()=>validateInviteResults(value,[actor]));});
test("all seven languages have every club ride text",()=>{for(const locale of locales)for(const key of clubRideKeys){const text=clubRideText(locale,key);assert.equal(typeof text,"string",`${locale}.${key}`);assert(text.length>1);}});
test("canonical address preserves club and selected ride",()=>assert.equal(clubRideHref("da",club,actor),`/da/app/clubs/${club}/rides?rideId=${actor}`));

test("reused creation presets are localized in all seven languages",()=>{for(const locale of locales){assert.equal(getRideMoodOptions(locale).length,10);assert.equal(getRideTitleSuggestions(locale).length,10);if(locale!=="en"){assert.notEqual(getRideTitleSuggestions(locale)[0],getRideTitleSuggestions("en")[0]);assert.notEqual(getRideMoodOptions(locale)[0].label,getRideMoodOptions("en")[0].label);}}});

test("partial invitations preserve acknowledged results and retry the unchanged uncertain batch",async()=>{
 const {sendClubRideInvites}=await import("../lib/clubs/ride-invites");
 const ids=Array.from({length:250},(_,i)=>`00000000-0000-4000-8000-${String(i).padStart(12,"0")}`),sent:string[][]=[];
 const first=await sendClubRideInvites(ids,async batch=>{sent.push(batch);if(sent.length===2)throw Error("lost response");return batch.map(user_id=>({user_id,status:"created"}));});
 assert.equal(first.results.length,200);assert.deepEqual(first.retryIds,sent[1]);assert.equal(first.error,"network");assert.equal(first.push,"not_requested");
 const retried:string[][]=[];const second=await sendClubRideInvites(first.retryIds,async batch=>{retried.push(batch);return batch.map(user_id=>({user_id,status:"pending"}));});
 assert.deepEqual(retried[0],sent[1]);assert.equal(second.retryIds.length,0);assert.equal(second.results.length,50);
});
test("malformed invitation acknowledgement retains every uncertain ID",async()=>{const {sendClubRideInvites}=await import("../lib/clubs/ride-invites");const result=await sendClubRideInvites([actor,club],async()=>[{user_id:actor,status:"created"}]);assert.deepEqual(result.retryIds,[...new Set([actor,club])].sort());assert.equal(result.results.length,0);});

test("failed push remains a saved-invitation outcome and never adds invitation retries",async()=>{const {settleClubRidePush}=await import("../lib/clubs/ride-invites");const saved={results:[{user_id:actor,status:"created" as const}],retryIds:[]};const notified:string[][]=[];const result=await settleClubRidePush(saved,async ids=>{notified.push(ids);throw Error("push unavailable");});assert.equal(result.push,"failed");assert.deepEqual(result.results,saved.results);assert.deepEqual(result.retryIds,[]);assert.deepEqual(notified,[[actor]]);assert.equal((await settleClubRidePush(saved)).push,"not_requested");});
