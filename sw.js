// 离线缓存：有网时先取线上最新版，取不到再用本机存的页面，没网也能打开
// GitHub Pages 会让页面缓存 10 分钟（Cache-Control: max-age=600），所以取页面时加一个时间参数、并且不用浏览器缓存，
// 这样刚上线的新版刷新一次就能拿到
const CACHE = 'fupan-v4';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(['./', './index.html'])).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(caches.open(CACHE).then(async cache => {
    try {
      const fresh = new URL(url);
      fresh.searchParams.set('_', Date.now());
      const res = await fetch(fresh, { cache: 'no-store' });
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      return (await cache.match(req, { ignoreSearch: true })) || Response.error();
    }
  }));
});
