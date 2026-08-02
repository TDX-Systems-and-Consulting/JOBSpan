// JOBSMETRIX service worker — app-shell caching only.
//
// Scope on purpose: this handles installability and "the app still loads
// with no signal." It deliberately does NOT touch Firestore or Storage
// network calls — those have their own offline handling (Firestore's
// built-in IndexedDB persistence, and the custom photo-upload queue in
// kytrac-app.js). Layering a generic cache-first strategy on top of
// those would fight their retry/sync logic, so this worker only ever
// intercepts same-origin static assets.
//
// Bump CACHE_NAME whenever the static asset list below changes, so
// returning users get the new shell instead of a stale cached one.
const CACHE_NAME = 'jobsmetrix-shell-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET, same-origin requests. Everything else (Firestore,
  // Storage, Cloud Functions, Google auth popups, any cross-origin call)
  // passes straight through untouched.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never intercept the app's own JS — it's version-stamped via the
  // ?v=YYYYMMDDHHMM query string in index.html specifically so browsers
  // (and this worker) fetch a fresh copy whenever that stamp changes.
  // Caching it here would undermine that mechanism.
  if (url.pathname === '/kytrac-app.js') return;

  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Only cache successful, basic (same-origin) responses.
        if (res && res.status === 200 && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
        }
        return res;
      }).catch(() => {
        // Offline and not cached — fall back to the shell for navigations
        // so the app still opens instead of showing a browser error page.
        if (req.mode === 'navigate') return caches.match('/index.html');
      });
    })
  );
});
