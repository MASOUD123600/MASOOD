// App shell cache. Data always comes live from GitHub and is never cached here.
const CACHE='mozif-v1';
const SHELL=['./','index.html','app.js','manifest.webmanifest','icons/logo.webp','icons/logo-192.png',
 'fonts/vazirmatn-400.woff2','fonts/vazirmatn-500.woff2','fonts/vazirmatn-700.woff2','fonts/vazirmatn-800.woff2','fonts/aref-ruqaa-700.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return; // GitHub API goes straight to network
  // network first (so updates arrive), cache as fallback when offline
  e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('index.html'))));
});
