const CACHE_NAME = "flow-field-v4";
const APP_FILES = ["./","./index.html","./flow.css","./flow.js","./manifest.webmanifest"];

self.addEventListener("install",(e)=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(APP_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",(e)=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch",(e)=>{
  if(new URL(e.request.url).origin!==self.location.origin||e.request.method!=="GET")return;
  e.respondWith(caches.match(e.request).then(cached=>{
    const net=fetch(e.request).then(r=>{if(r&&r.ok){const c=r.clone();caches.open(CACHE_NAME).then(ca=>ca.put(e.request,c));}return r;}).catch(()=>cached);
    return cached||net;
  }));
});
