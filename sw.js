const CACHE='lexicon-shell-v10-overview';
const ASSETS=['./','./index.html','./styles.css?v=10','./app.js?v=10','./core.js','./known.js','./shared-decks.js','./storage.js','./sync-state.js','./session-draft.js','./cloud.js','./cloud-config.js','./account-panel.js?v=8','./vendor/supabase.js','./data/seed.js','./icon.svg','./manifest.webmanifest','./data/starter.json','./data/import.schema.json','./catalog.js','./credits.js','./data/english-b1b2-1000.json','./data/course-manifest.json','./data/sources.md'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lexicon-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.includes('/auth/')||u.pathname.includes('/api/'))return;
  e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.type!=='opaque'){const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}return r;}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
