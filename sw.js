// ============================================================================
// HymnDesk Control · Service Worker
// ============================================================================

const CACHE_VERSION = 'hdctl-v0.12.0';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/js/config.js',
  '/js/project.js',
  '/js/app.js',
  '/js/team.js',
  '/js/phases.js',
  '/js/tasks.js',
  '/js/mytasks.js',
  '/js/sessions.js',
  '/js/hymns.js',
  '/js/budget.js',
  '/js/income.js',
  '/js/expenses.js',
  '/js/royalty.js',
  '/js/advices.js',
  '/js/sponsorship.js',
  '/js/marketing.js',
  '/js/beta.js',
  '/js/appdev.js',
  '/js/founder.js',
  '/js/risks.js',
  '/js/agm.js',
  '/js/dashboard.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isHtml = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  const isJs   = url.pathname.endsWith('.js');
  if (isHtml || isJs) {
    event.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(req).then((r) => r || caches.match('/index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
