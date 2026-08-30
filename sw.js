const CACHE='pcgdxmc-v1.9.0';
const CORE=['./','./index.html','./styles.css','./excel-runtime-v15.js','./app.js','./nationwide-v13.js','./gdmn-high-level-v14.js','./auth-v14.js','./admin-users-v15.js','./three-level-ui-v16.js','./manifest.webmanifest'];
self.addEventListener('install',e=>{self.skipWaiting();e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([self.clients.claim(),caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const url=new URL(e.request.url);if(url.origin!==self.location.origin)return;e.respondWith(fetch(e.request).then(res=>{const copy=res.clone();if(res.ok)caches.open(CACHE).then(c=>c.put(e.request,copy));return res}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))))});

