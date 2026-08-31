const CACHE='pcgdxmc-v1.18.0-xmc-ranges-v24';
const CORE=[
  './','./index.html','./styles.css','./excel-runtime-v15.js','./app.js',
  './nationwide-v13.js','./gdmn-high-level-v14.js','./auth-v14.js','./auth-v15.js',
  './admin-users-v15.js','./three-level-ui-v16.js','./three-level-ui-v17.js','./local-mode-v18.js','./th-manual-input-v20.js','./survey-tab-layout-v21.js','./aggregate-export-v14.js',
  './manifest.webmanifest','./core-v02.js','./rounding-v22.js','./reports-v02.js','./groups-v03.js',
  './viewer-v04.js','./xmc-lists-v09.js','./xmc-age-summary-v10.js','./xmc-menu-v11.js','./xmc-standard-15-25-v23.js','./xmc-standard-ranges-v24.js'
];
const STATIC_ASSET=/\.(?:css|js|json|webmanifest|png|jpg|jpeg|gif|svg|ico|woff2?)$/i;

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    if(self.registration.navigationPreload){
      try{await self.registration.navigationPreload.enable()}catch(_){}
    }
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

async function cacheResponse(request,response){
  if(response&&response.ok){
    const cache=await caches.open(CACHE);
    await cache.put(request,response.clone());
  }
  return response;
}

async function navigationResponse(event){
  try{
    const preload=await event.preloadResponse;
    if(preload)return cacheResponse(event.request,preload);
    const response=await fetch(event.request,{cache:'no-store'});
    return cacheResponse(event.request,response);
  }catch(_){
    return (await caches.match(event.request))||(await caches.match('./index.html'))||Response.error();
  }
}

async function networkFirstStatic(event){
  try{
    const response=await fetch(event.request,{cache:'no-store'});
    return cacheResponse(event.request,response);
  }catch(_){
    return (await caches.match(event.request))||Response.error();
  }
}

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;

  if(event.request.mode==='navigate'){
    event.respondWith(navigationResponse(event));
    return;
  }

  if(STATIC_ASSET.test(url.pathname)){
    event.respondWith(networkFirstStatic(event));
    return;
  }

  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
