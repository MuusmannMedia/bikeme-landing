import test from "node:test";
import {isClubRequestOrigin} from "../lib/clubs/request-origin";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseClubCommand, executeClubCommand } from "../lib/clubs/commands";
import { createClubMembershipApi } from "../lib/clubs/membership-api";
import { ClubError, clubResponseError, clubError, allowedMemberActions, type ClubCommand } from "../lib/clubs/membership-types";
import { createClubWorkflow } from "../lib/clubs/workflow";
import { membershipText, membershipDictionary, membershipErrorText } from "../lib/clubs/membership-i18n";
import type { Club } from "../lib/clubs/types";
import { locales } from "../lib/locales";
const actor="11111111-1111-4111-8111-111111111111", clubId="22222222-2222-4222-8222-222222222222", person="33333333-3333-4333-8333-333333333333", requestId="44444444-4444-4444-8444-444444444444";
const command:ClubCommand={actorId:actor,requestId,action:"invite",clubId,targetId:person};
function deferred<T>(){let resolve!:(v:T)=>void, reject!:(e:unknown)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j});return {promise,resolve,reject}}
function workflow(send:(c:Readonly<ClubCommand>)=>Promise<void>,refresh=async()=>{}){let keys=0,lost=0;const w=createClubWorkflow({userId:actor,key:()=>{++keys;return requestId},canAct:()=>true,send,refresh,search:async()=>[],identityLost:()=>{++lost}});return {w,keys:()=>keys,lost:()=>lost}}

test("strict commands reject malformed targets, arbitrary fields, nonboolean responses and unknown operations",()=>{
 assert.deepEqual(parseClubCommand(command),command);
 for(const c of [{...command,action:"create"},{...command,role:"owner"},{...command,requestId:"bad"},{...command,targetId:null},{...command,action:"respondInvite",id:person,accept:"true"},{...command,action:"memberAction",decision:"owner"}])assert.throws(()=>parseClubCommand(c),e=>e instanceof ClubError&&e.kind==="invalid");
});
test("actor mismatch is rejected before touching any client",async()=>{await assert.rejects(executeClubCommand({} as SupabaseClient,person,command),e=>e instanceof ClubError&&e.kind==="auth")});
test("role matrix mirrors iOS: owner controls roles; admin only removes ordinary members; self/owner protected",()=>{
 const base={role:"member",id:clubId,members:[],memberCount:2,name:"QA",owner_id:actor,description:null} as Club;
 for(const role of ["owner","admin","member"] as const){const club={...base,role};const m={user_id:person,display_name:null,avatar_url:null,joined_at:"",role:"member" as const};assert.deepEqual(allowedMemberActions(club,actor,m),role==="owner"?["make_admin","remove"]:role==="admin"?["remove"]:[]);assert.deepEqual(allowedMemberActions(club,actor,{...m,role:"admin"}),role==="owner"?["make_member","remove"]:[]);assert.deepEqual(allowedMemberActions(club,actor,{...m,role:"owner"}),[]);assert.deepEqual(allowedMemberActions(club,person,m),[])}
});
test("double submission has one synchronous lock and one request key",async()=>{const d=deferred<void>();let calls=0;const {w,keys}=workflow(async()=>{++calls;await d.promise});const first=w.run({action:"invite",clubId,targetId:person});assert.equal(await w.run({action:"invite",clubId,targetId:person}),false);assert.equal(calls,1);assert.equal(keys(),1);d.resolve();await first;assert.equal(w.getSnapshot().busy,false)});
test("unknown outcome keeps immutable command, query and key across failed refresh; retry is byte-identical",async()=>{const sent:string[]=[];let calls=0;const {w,keys}=workflow(async c=>{sent.push(JSON.stringify(c));if(++calls===1)throw new ClubError("network")});w.setQuery("Test rider");await w.run({action:"invite",clubId,targetId:person});assert.equal(w.getSnapshot().query,"Test rider");assert.ok(w.getSnapshot().pending);w.setQuery("different");assert.equal(w.getSnapshot().query,"Test rider");assert.equal(await w.run({action:"invite",clubId,targetId:actor}),false);await w.retry();assert.equal(sent[0],sent[1]);assert.equal(keys(),1);assert.equal(w.getSnapshot().pending,null)});
test("known expiry clears intent but preserves input and distinct expiry kind",async()=>{const {w}=workflow(async()=>{throw new ClubError("expired")});w.setQuery("Test");await w.run({action:"respondInvite",id:person,accept:true});assert.equal(w.getSnapshot().error,"expired");assert.equal(w.getSnapshot().query,"Test");assert.equal(w.getSnapshot().pending,null)});
test("account reset purges draft, search and request and ignores a late successful response",async()=>{const d=deferred<void>();let refreshed=0;const {w}=workflow(async()=>d.promise,async()=>{++refreshed});w.setQuery("old user");const p=w.run({action:"invite",clubId,targetId:person});w.reset();d.resolve();await p;assert.equal(w.getSnapshot().query,"");assert.equal(w.getSnapshot().notice,false);assert.equal(w.getSnapshot().pending,null);assert.equal(refreshed,0)});
test("auth failures purge and invalidate identity",async()=>{const {w,lost}=workflow(async()=>{throw new ClubError("auth")});w.setQuery("private draft");await w.run({action:"leave",clubId});assert.equal(lost(),1);assert.equal(w.getSnapshot().query,"")});
test("pause clears search rows and invalidates late search without losing typed query",async()=>{const d=deferred<never[]>();const w=createClubWorkflow({userId:actor,key:()=>requestId,canAct:()=>true,send:async()=>{},refresh:async()=>{},identityLost:()=>{},search:async()=>d.promise});w.setQuery("Test");const p=w.search();w.pause();d.resolve([]);await p;assert.equal(w.getSnapshot().query,"Test");assert.equal(w.getSnapshot().people.length,0);assert.equal(w.getSnapshot().searched,false)});
test("all membership copy exists independently in seven languages, including all server error families",()=>{for(const row of Object.values(membershipText))assert.equal(row.length,7);for(const locale of locales){for(const key of Object.keys(membershipText) as (keyof typeof membershipText)[])assert.ok(membershipDictionary(locale)(key).length>0);for(const kind of ["expired","transferExpired","proposalExpired","transferPending","proposalPending","closed","ownerMustTransfer","targetMustBeAdmin","access","network","conflict"] as const)assert.ok(membershipErrorText(locale,kind).length>0)}});
test("iOS error codes remain distinct",()=>{for(const [message,kind] of [["CLUB_INVITE_EXPIRED","expired"],["CLUB_TRANSFER_EXPIRED","transferExpired"],["CLUB_PROPOSAL_EXPIRED","proposalExpired"],["CLUB_OWNER_MUST_TRANSFER","ownerMustTransfer"],["CLUB_TRANSFER_CLOSED","transferClosed"]])assert.equal(clubError({code:"22023",message}).kind,kind)});

type Result={data:unknown;error:unknown};
function apiBackend(respond:(name:string,args:Record<string,unknown>|undefined)=>Result){const calls:{name:string;args?:Record<string,unknown>;header?:string}[]=[];const query=(name:string,args?:Record<string,unknown>)=>{const call={name,args,header:undefined as string|undefined};const chain={select(){return chain},eq(){return chain},order(){return chain},range(){return chain},maybeSingle(){return chain},abortSignal(){return chain},setHeader(_k:string,v:string){call.header=v;return chain},then(resolve:(r:Result)=>unknown,reject:(e:unknown)=>unknown){calls.push(call);return Promise.resolve(respond(name,args)).then(resolve,reject)}};return chain};const client={auth:{getSession:async()=>({data:{session:{user:{id:actor},access_token:"captured-token"}},error:null})},rpc:query,from:query} as unknown as SupabaseClient;return {client,calls}}
test("invitation retry checks returned row status and expiry rather than claiming a new invitation",async()=>{for(const [status,expires_at,kind] of [["accepted","2099-01-01","closed"],["pending","2000-01-01","expired"]]){const db=apiBackend(name=>({data:name==="club_invite"?person:{status,expires_at},error:null}));await assert.rejects(createClubMembershipApi(db.client,actor).invite(clubId,person,requestId),e=>e instanceof ClubError&&e.kind===kind);assert.deepEqual(db.calls[0].args,{p_club_id:clubId,p_invitee_id:person,p_request_key:requestId});assert.ok(db.calls.every(c=>c.header==="Bearer captured-token"))}});
test("ownership proposal verifies its current state after an idempotent RPC response",async()=>{const db=apiBackend(name=>({data:name==="club_propose_ownership"?person:{status:"pending",expires_at:"2000-01-01"},error:null}));await assert.rejects(createClubMembershipApi(db.client,actor).proposeOwnership(clubId,person),e=>e instanceof ClubError&&e.kind==="transferExpired")});
test("search respects three Unicode characters and strips unexpected fields",async()=>{const db=apiBackend(()=>({data:[{id:person,display_name:"QA",avatar_url:null,is_member:false,has_invitation:false,has_proposal:false,email:"never forward"}],error:null}));const api=createClubMembershipApi(db.client,actor);assert.deepEqual(await api.searchPeople("🚴x",clubId),[]);assert.equal(db.calls.length,0);const people=await api.searchPeople(" 🚴xy ",clubId);assert.equal((people[0] as unknown as {email?:string}).email,undefined);assert.equal(db.calls[0].args?.p_query,"🚴xy")});


test("request origin uses actual authority without accepting foreign origins or scheme changes",()=>{
 assert.equal(isClubRequestOrigin("http://127.0.0.1:3110","127.0.0.1:3110","http"),true);
 assert.equal(isClubRequestOrigin("https://www.bikeme.one","www.bikeme.one","https"),true);
 for(const origin of [null,"null","https://evil.example","http://www.bikeme.one","https://www.bikeme.one/path","https://user@www.bikeme.one"])assert.equal(isClubRequestOrigin(origin,"www.bikeme.one","https"),false);
});


test("unknown gateway errors preserve uncertain-outcome semantics",()=>{
 for(const error of [null,undefined,"gateway_timeout",{},502])assert.equal(clubResponseError(error).kind,"network");
 assert.equal(clubResponseError("access").kind,"access");
 assert.equal(clubResponseError("expired").kind,"expired");
});
