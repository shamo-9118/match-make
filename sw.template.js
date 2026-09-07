// ビルド時に next.config.ts が __BUILD_ID__ を置換して public/sw.js を生成する。
// キャッシュ戦略は network-first のため、オンラインなら常に最新を返す。
const CACHE_NAME = 'match-make-__BUILD_ID__';

self.addEventListener('install', (event) => {
  // 待機せず即座に新 SW をアクティブ化
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.add('/')));
});

self.addEventListener('activate', (event) => {
  // 旧バージョンのキャッシュを削除
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  // 既に開いている全タブの制御を即座に取得
  // → sw-register.tsx の controllerchange リスナーが自動リロードを実行
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Network-first: オンラインならネットワーク優先、オフラインならキャッシュ
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || new Response('Offline', { status: 503 }))
      )
  );
});
