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