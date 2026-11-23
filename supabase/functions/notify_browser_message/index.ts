import {createClient} from 'npm:@supabase/supabase-js@2.109.0';
import webpush from 'npm:web-push@3.6.7';
import {handleBrowserPush} from './shared/edge-handler.ts';
Deno.serve(request=>handleBrowserPush(request,{
 env:name=>Deno.env.get(name),
 createRpc:(url,key)=>{const c=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});return async(name,args={})=>{const r=await c.rpc(name,args).abortSignal(AbortSignal.timeout(5000));if(r.error)throw Error('rpc');return r.data;};},
 createSend:(subject,publicKey,privateKey)=>{webpush.setVapidDetails(subject,publicKey,privateKey);return(row,payload)=>webpush.sendNotification({endpoint:row.endpoint,keys:row.keys},payload,{TTL:3600,timeout:10000});}
}));
