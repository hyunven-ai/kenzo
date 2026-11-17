// Kenzo POS Service Worker - PWA Offline Caching & Background Sync
const CACHE_NAME = 'kenzo-pos-cache-v1';

const STATIC_PRECACHE = [
  '/',
  '/login',
  '/dashboard',
  '/transaksi/penjualan',
  '/stock',
  '/transaksi/produk-terlaris',
  '/favicon.png',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/logo-kenzo.webp',
  '/logo-struk.png',
  '/manifest.json'
];

// Install: precache essential application shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_PRECACHE).catch((err) => {
        console.warn('[SW] Precache partial error (ignorable):', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate: clean up older caches & claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignore non-GET requests (e.g. POST to /api/neon)
  if (request.method !== 'GET') {
    return;
  }

  // 1. API routes (/api/): Network only (fallback handled by frontend localStorage)
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // 2. Navigation requests (HTML pages): Network First with Cache Fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // If valid response, cache a copy for offline use
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          // Offline fallback: try exact match in cache
          const cachedMatch = await caches.match(request);
          if (cachedMatch) return cachedMatch;

          // Fallback to cached home or sales page
          const fallbackHome = await caches.match('/');
          if (fallbackHome) return fallbackHome;

          const fallbackLogin = await caches.match('/login');
          if (fallbackLogin) return fallbackLogin;

          return new Response(
            `<!DOCTYPE html>
            <html lang="id">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Kenzo POS - Mode Offline</title>
              <style>
                body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0f172a; color: #f8fafc; text-align: center; padding: 20px; }
                .card { background: #1e293b; padding: 32px; border-radius: 16px; max-width: 420px; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
                h1 { font-size: 20px; margin: 0 0 12px; color: #38bdf8; }
                p { font-size: 14px; line-height: 1.6; color: #94a3b8; margin: 0 0 24px; }
                .btn { display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; border: none; cursor: pointer; }
                .btn:hover { background: #1d4ed8; }
              </style>
            </head>
            <body>
              <div class="card">
                <div style="font-size: 48px; margin-bottom: 16px;">📡</div>
                <h1>Koneksi Offline</h1>
                <p>Anda sedang membuka aplikasi tanpa koneksi internet. Buka halaman kasir yang sudah tersimpan di cache.</p>
                <a href="/transaksi/penjualan" class="btn">Buka Kasir Penjualan</a>
              </div>
            </body>
            </html>`,
            { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
          );
        })
    );
    return;
  }

  // 3. Static Next.js assets (_next/static, css, js, fonts): Cache First with background refresh
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.match(/\.(css|js|woff2|woff|ttf|png|jpg|jpeg|svg|webp|ico)$/)
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached, and asynchronously fetch update
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        // Not in cache, fetch from network and cache it
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 4. Default: Network with Cache Fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

