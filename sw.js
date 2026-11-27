const CACHE='lexicon-shell-v55-optional-gap-autoplay';
const AUTH_SDK='./vendor/supabase.js?v=34';
const ASSETS=['./','./index.html','./styles.css?v=54','./app.js?v=55','./wiktionary.js?v=13','./favorites.js?v=37','./core.js','./known.js','./study-navigation.js?v=40','./shared-decks.js','./storage.js','./sync-state.js','./session-draft.js','./cloud.js?v=52','./cloud-config.js','./speaking-config.js','./account-panel.js?v=52','./auth-screen.js?v=34','./auth-screen.css?v=33',AUTH_SDK,'./data/seed.js','./icon.svg','./manifest.webmanifest','./data/starter.json','./data/import.schema.json','./catalog.js','./credits.js','./data/english-b1b2-1000.json','./data/course-manifest.json','./data/sources.md'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('lexicon-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||u.pathname.includes('/auth/')||u.pathname.includes('/api/'))return;
  if(u.href===new URL(AUTH_SDK,self.location.href).href){
    e.respondWith(caches.open(CACHE).then(cache=>cache.match(e.request)).then(cached=>cached||fetch(e.request)));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{if(r.ok&&r.type!=='opaque'){const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));}return r;}).catch(()=>caches.match(e.request).then(r=>r||(e.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));
});
