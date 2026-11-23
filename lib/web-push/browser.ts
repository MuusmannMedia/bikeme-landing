export async function removeBrowserPush(){// Disable delivery before auth transition; browser unsubscribe is the offline safety net.
 let failed=false;try{const r=await fetch('/api/messages/push',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'remove'}),signal:AbortSignal.timeout(8000)});failed=!r.ok;}catch{failed=true;}
 if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration('/');const sub=await reg?.pushManager?.getSubscription();if(sub&&!await sub.unsubscribe())throw Error('unsubscribe');reg?.active?.postMessage({type:'BIKE_PUSH_CLEAR'});}
 if(failed){/* Unsubscribed endpoint is unusable even if the server is temporarily offline. */}
}
export function browserPushSupport(){return typeof window!=='undefined'&&isSecureContext&&'Notification'in window&&'serviceWorker'in navigator&&'PushManager'in window;}
