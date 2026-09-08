// 루게더 웹 서비스워커 — 앱 셸(정적 번들·에셋)은 캐시 우선, HTML은 네트워크 우선.
// 목적: PWA 설치 요건 충족 + 재방문 시 즉시 시작. 오프라인 전체 동작은 범위 밖(API 필요).
const VERSION = 'rougether-web-v1';
const STATIC = /\/(_expo\/static|assets|icons|fonts)\//;
// 오프라인 내비게이션 폴백 — 설치 때 미리 담고, 내비게이션이 성공할 때마다 갱신한다.
const SHELL = '/index.html';

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.add(SHELL))
      .then(() => self.skipWaiting()),
  );
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  if (STATIC.test(request.url)) {
    e.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const hit = await cache.match(request);
        if (hit) return hit;
        const res = await fetch(request);
        if (res.ok) cache.put(request, res.clone());
        return res;
      }),
    );
    return;
  }
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) caches.open(VERSION).then((cache) => cache.put(SHELL, res.clone()));
          return res;
        })
        .catch(async () => {
          // respondWith에 undefined를 주면 네트워크 오류로 취급되므로 항상 Response를 돌려준다.
          const shell = await caches.match(SHELL);
          return (
            shell ??
            new Response('오프라인 상태예요. 연결 후 다시 열어 주세요.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain; charset=utf-8' },
            })
          );
        }),
    );
  }
});
