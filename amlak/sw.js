// نشانی سامانه عوض شده؛ این فایل نسخه ذخیره‌شده قبلی را پاک می‌کند و به نشانی تازه می‌برد.
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const ks = await caches.keys();
    await Promise.all(ks.filter(k => k.startsWith('amlak-')).map(k => caches.delete(k)));
    await self.registration.unregister();
    const cs = await self.clients.matchAll({ type: 'window' });
    cs.forEach(c => { try { const u = new URL(c.url); c.navigate('https://kmm110.github.io/amlak/' + u.search + u.hash); } catch (_) {} });
  })());
});
