const CACHE='doagim-v206-archive';
self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const r=e.request;
  if(r.method!=='GET')return;
  if(r.mode==='navigate'||/\.(?:html|js|json|webmanifest)$/.test(new URL(r.url).pathname)){
    e.respondWith(fetch(r,{cache:'no-store'}).then(resp=>resp).catch(()=>caches.match(r)));
    return;
  }
  e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(r);if(hit)return hit;const resp=await fetch(r);if(resp.ok)c.put(r,resp.clone());return resp}));
});

self.addEventListener('push',e=>{
  let data={};
  try{data=e.data?e.data.json():{}}catch{data={body:e.data?.text?.()||''}}
  const title=data.title||'דואגים ביחד';
  const options={
    body:data.body||'יש עדכון חדש באפליקציה',
    icon:'/icons/icon-192.png',
    badge:'/icons/icon-192.png',
    data:{url:data.url||'/'},
    tag:'doagim-'+(data.kind||'general'),
    renotify:true
  };
  e.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  const target=e.notification?.data?.url||'/';
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
    for(const client of list){
      if('focus' in client){client.navigate(target).catch(()=>{});return client.focus()}
    }
    return clients.openWindow?clients.openWindow(target):undefined;
  }));
});