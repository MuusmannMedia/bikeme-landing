// Server-only callers provide environment values. This is separate from the
// private profile/image editor and club ride push opt-ins.
export function visitsEnabled(env:Readonly<Record<string,string|undefined>>){
 const url=env.NEXT_PUBLIC_SUPABASE_URL;
 if(env.VERCEL_ENV==='production')return url==='https://zawilafvdwlnwsdeufts.supabase.co'&&env.BIKE_ME_CLUB_VISITS_ENABLED==='true';
 return [undefined,'development','preview'].includes(env.VERCEL_ENV)&&url==='https://bcskqapoagflshewvzzc.supabase.co';
}
