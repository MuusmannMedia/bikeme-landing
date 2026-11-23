/* No offline page cache, message cache, tokens or permanent notification text. */
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
const bikeLanguages=['da','en','de','es','it','fr','nl'];
const bikeFallback={da:'Åbn Bike Me for at se opdateringer.',en:'Open Bike Me to see updates.',de:'Öffne Bike Me, um Aktualisierungen zu sehen.',es:'Abre Bike Me para ver novedades.',it:'Apri Bike Me per vedere gli aggiornamenti.',fr:'Ouvrez Bike Me pour voir les mises à jour.',nl:'Open Bike Me om updates te bekijken.'};
const bikePrivateTarget=/^\/(da|en|de|es|it|fr|nl)\/app\/messages\/open\?conversation=[a-f0-9-]{36}&message=[a-f0-9-]{36}$/i;
self.addEventListener('push',event=>{event.waitUntil((async()=>{let locale='en',options;
 try{const p=event.data?.json();if(bikeLanguages.includes(p?.language))locale=p.language;
 if(p?.type==='private_message'&&bikePrivateTarget.test(p.target)&&typeof p.body==='string'&&p.body.length<=1024){
 // Every private preview requires current session, account, binding and message access.
 const r=await fetch('/api/messages/push/authorize',{method:'POST',credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json'},body:JSON.stringify({subscription:p.subscription,recipient:p.recipient,conversation:p.conversation,message:p.message,language:locale})});
 if(r.ok){const current=await r.json();if(current.ok===true&&typeof current.body==='string'&&current.body.length<=1024)options={body:current.body,tag:'bike-dm-'+p.message,data:{target:p.target}};}
 }
 }catch{/* Unverifiable content is never displayed or retried. */}
 // Safari/Chrome require a visible effect for every push. A neutral notice reveals
 // no sender, old account, private text, conversation identifier or unread count.
 await self.registration.showNotification('Bike Me',{...(options??{body:bikeFallback[locale],tag:'bike-update',data:{target:`/${locale}/app/messages`}}),icon:'/brand/bike-me-logo-white.png',lang:locale});
 })());});
self.addEventListener('notificationclick',event=>{event.notification.close();const path=event.notification.data?.target;if(typeof path!=='string'||!(bikePrivateTarget.test(path)||/^\/(da|en|de|es|it|fr|nl)\/app\/messages$/.test(path)))return;event.waitUntil((async()=>{const url=new URL(path,self.location.origin).href,windows=await self.clients.matchAll({type:'window',includeUncontrolled:true}),current=windows.find(c=>new URL(c.url).origin===self.location.origin);if(current){await current.navigate(url);await current.focus();}else await self.clients.openWindow(url);})());});
self.addEventListener('message',event=>{if(event.data?.type==='BIKE_PUSH_CLEAR')event.waitUntil(self.registration.getNotifications().then(rows=>Promise.all(rows.map(n=>n.close()))));});
// Renewal needs an authenticated page and fresh ownership binding, never a background account.
self.addEventListener('pushsubscriptionchange',event=>event.waitUntil(self.clients.matchAll({type:'window'}).then(rows=>rows.forEach(c=>c.postMessage({type:'BIKE_PUSH_RENEW'})))));
