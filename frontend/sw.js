/* ============================================================
   SERVICE WORKER — Stock Manager PWA
   Network-first strategy (kay API calls kinahanglan live)
   ============================================================ */

const CACHE_NAME = 'stock-manager-v1';

// Assets to pre-cache on install (optional)
const PRECACHE_URLS = [
    '/',
    '/css/style.css',
    '/css/sidebar.css',
    '/css/theme.css',
    '/js/api.js',
    '/js/auth-sidebar.js',
    '/js/theme.js',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Pre-cache best-effort (dili mo-fail kung naay usa nga wala)
            return Promise.allSettled(
                PRECACHE_URLS.map((url) =>
                    cache.add(url).catch(() => null)
                )
            );
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;

    // Skip non-GET requests (POST/PUT/DELETE — always go to network)
    if (req.method !== 'GET') return;

    // Skip API calls — always live
    if (req.url.includes('/api/')) return;

    // Network-first
    event.respondWith(
        fetch(req)
        .then((res) => {
            // Cache successful responses
            if (res && res.status === 200 && res.type === 'basic') {
                const clone = res.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            }
            return res;
        })
        .catch(() => caches.match(req))
    );
});