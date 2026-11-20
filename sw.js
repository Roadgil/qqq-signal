/* QQQ 적립 신호판 — 서비스 워커: 앱 화면 캐시 + 백그라운드 푸시 수신 + 알림 클릭 */
const CACHE = 'qdca-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// 같은 출처 파일만 처리(네트워크 우선, 오프라인이면 캐시). 시세·푸시 서버 요청은 건드리지 않음.
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

// 서버(Cloudflare Worker)가 보낸 푸시 → 앱이 꺼져 있어도 알림 표시
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data ? e.data.text() : '' }; }
  const title = d.title || 'QQQ 적립 신호';
  e.waitUntil(self.registration.showNotification(title, {
    body: d.body || '앱을 열어 오늘의 액션을 확인하세요',
    tag: d.tag || 'qqq-signal',
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    vibrate: [120, 60, 120],
    data: { url: d.url || './' }
  }));
});

// 알림을 누르면 열려 있는 앱 창을 앞으로, 없으면 대시보드를 새로 열기
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const target = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) {
      if (c.url.startsWith(self.registration.scope) && 'focus' in c) return c.focus();
    }
    return self.clients.openWindow(target);
  }));
});
