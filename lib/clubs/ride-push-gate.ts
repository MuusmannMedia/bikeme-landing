// Web push stays test-only. Visitor activation is an independent opt-in.
export function clubRidePushEnabled(env:Readonly<Record<string,string|undefined>>){
 return env.BIKE_ME_CLUB_RIDE_PUSH_ENABLED==='true'&&env.NEXT_PUBLIC_SUPABASE_URL==='https://bcskqapoagflshewvzzc.supabase.co'&&env.VERCEL_ENV!=='production';
}
