// پوسته اپ برای باز شدن سریع و آفلاین. داده‌ها همیشه زنده از سرور می‌آیند.
const CACHE='amlak-v14';
const SHELL=['./','index.html','app.js','divar.js','config.js','manifest.webmanifest','icons/icon.svg','icons/icon-192.png',
 'fonts/vazirmatn-400.woff2','fonts/vazirmatn-500.woff2','fonts/vazirmatn-700.woff2','fonts/vazirmatn-800.woff2'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('amlak-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET'||u.origin!==location.origin)return;
  // اول شبکه (تا به‌روزرسانی‌ها برسد)، در حالت آفلاین از کش
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(e.request,c))}return r})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||(e.request.mode==='navigate'?caches.match('index.html'):Response.error()))));
});
