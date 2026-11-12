// Hyperscale — service worker : le jeu reste jouable sans connexion.
// Règle : le réseau d'abord. En ligne, on reçoit toujours la dernière version du jeu
// et on en garde une copie ; hors ligne, on ressort cette copie.
// Les polices (Google Fonts) ne changent pas : la copie gardée sert d'abord.
const CACHE = 'hyperscale-v1';
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'icon.svg', 'icon-192.png', 'icon-512.png',
  'dc/data.js', 'dc/sim.js', 'dc/actions.js', 'dc/learn.js', 'dc/console.js', 'dc/view.js', 'dc/room.js',
  'dc/cours.js', 'dc/md.js', 'dc/audio.js', 'dc/ui.js',
];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
const keep = (req, res) => caches.open(CACHE).then(c => c.put(req, res)).catch(() => { });

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { keep(req, res.clone()); return res; })));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith(
    fetch(req)
      .then(res => { if (res.ok) keep(req, res.clone()); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true })
        .then(hit => hit || (req.mode === 'navigate' ? caches.match('index.html') : Response.error())))
  );
});
