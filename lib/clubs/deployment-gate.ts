// Server callers pass environment values. Preview can never use the live backend.
export function clubFeatureEnabled(env:Readonly<Record<string,string|undefined>>,flag:string){
 if(env[flag]!=='true')return false;
 if(env.VERCEL_ENV==='production')return env.NEXT_PUBLIC_SUPABASE_URL==='https://zawilafvdwlnwsdeufts.supabase.co';
 return [undefined,'development','preview'].includes(env.VERCEL_ENV)&&env.NEXT_PUBLIC_SUPABASE_URL==='https://bcskqapoagflshewvzzc.supabase.co';
}
