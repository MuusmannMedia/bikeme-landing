import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccessRefresh} from '../lib/clubs/access-refresh';
function setup(){let visible=true,focused=true,pauses=0,checks=0;const scheduled=new Set<()=>void>(),done:Array<()=>void>=[];const controller=createAccessRefresh({visible:()=>visible,focused:()=>focused,pause:()=>{pauses++;},verify:()=>{checks++;return new Promise<void>(r=>done.push(r));},schedule:fn=>{scheduled.add(fn);return()=>{scheduled.delete(fn);};}});return{controller,get pauses(){return pauses;},get checks(){return checks;},hide(){visible=false;focused=false;controller.suspend();},show(){visible=true;focused=true;},flush(){for(const fn of scheduled){scheduled.delete(fn);fn();}},finish(){done.shift()?.();}};}
test('visible/focus/pageshow burst starts one fresh authorization without a grace cache',async()=>{const s=setup();s.controller.resume();s.controller.resume();s.controller.check();assert.equal(s.pauses,1);s.flush();assert.equal(s.checks,1);s.controller.resume();assert.equal(s.checks,1);s.finish();await Promise.resolve();s.hide();assert.equal(s.pauses,2);s.show();s.controller.resume();s.controller.resume();s.flush();assert.equal(s.checks,2);s.finish();});
test('hiding clears immediately and cancels a queued check before it can run',()=>{const s=setup();s.controller.resume();s.hide();s.flush();assert.equal(s.checks,0);assert.equal(s.pauses,2);s.controller.stop();});
test('late completion from previous activation does not unlock a newer check',async()=>{const s=setup();s.controller.resume();s.flush();s.hide();s.show();s.controller.resume();s.flush();assert.equal(s.checks,2);s.finish();await Promise.resolve();assert.equal(s.controller.checking,true);s.finish();await Promise.resolve();assert.equal(s.controller.checking,false);});
test('interval/online requests coalesce while checking and recheck after completion',async()=>{const s=setup();s.controller.check();s.flush();s.controller.check();assert.equal(s.checks,1);s.finish();await Promise.resolve();s.controller.check();s.flush();assert.equal(s.checks,2);s.finish();});
test('stopped lifecycle cannot issue or resume an authorization request',()=>{const s=setup();s.controller.resume();s.controller.stop();s.flush();s.controller.check();s.controller.resume();assert.equal(s.checks,0);});

test('retained activation preserves presentation and serializes older and newer checks',async()=>{
 let visible=true,focused=true,clears=0,retains=0,settled=0,calls=0;const scheduled:Array<()=>void>=[],done:Array<()=>void>=[];
 const c=createAccessRefresh({visible:()=>visible,focused:()=>focused,pause:()=>{clears++;},retain:()=>{retains++;},settled:()=>{settled++;},verify:()=>{calls++;return new Promise<void>(r=>done.push(r));},schedule:f=>{scheduled.push(f);return()=>{const i=scheduled.indexOf(f);if(i>=0)scheduled.splice(i,1);};}});
 c.check();scheduled.shift()!();await Promise.resolve();assert.equal(calls,1);
 focused=false;c.deactivate();visible=false;c.deactivate();assert.equal(clears,0);
 visible=true;focused=true;c.resume();c.resume();scheduled.shift()!();await Promise.resolve();assert.equal(calls,1);assert.equal(settled,0);
 done.shift()!();await new Promise(r=>setImmediate(r));assert.equal(calls,2);assert.equal(settled,0);assert.equal(c.checking,true);
 done.shift()!();await new Promise(r=>setImmediate(r));assert.equal(settled,1);assert.equal(clears,0);assert.equal(retains,4);
 c.suspend();assert.equal(clears,1);c.stop();
});
test('hidden return canceled before dispatch cannot reveal retained presentation',async()=>{
 let visible=true,settled=0,reads=0;const scheduled=new Set<()=>void>();const c=createAccessRefresh({visible:()=>visible,focused:()=>true,pause:()=>{},retain:()=>{},settled:()=>{settled++;},verify:async()=>{reads++;},schedule:f=>{scheduled.add(f);return()=>{scheduled.delete(f);};}});
 c.check();visible=false;c.deactivate();for(const f of scheduled)f();await Promise.resolve();assert.equal(reads,0);assert.equal(settled,0);c.stop();
});
