// Manager panel service worker: push notifications only.
//
// It caches nothing and never answers a fetch — the panel shows guest personal
// data and must always come from the network, behind Cloudflare Access. All it
// does is show a notification when worker/push.js sends one, and open the
// panel on that request when it is tapped.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let msg = {};
  try {
    msg = event.data ? event.data.json() : {};
  } catch {
    /* not JSON: fall back to a plain notice */
  }
  event.waitUntil(
    self.registration.showNotification(msg.title || 'Vikendica Meri', {
      body: msg.body || 'Novi upit',
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      // One notification per request: a repeat replaces instead of stacking.
      tag: msg.tag || 'vm',
      data: { url: msg.url || '/manager/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/manager/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      // Reuse an open panel rather than stacking windows.
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const panel = open.find((c) => new URL(c.url).pathname.startsWith('/manager'));
      if (panel) {
        await panel.focus();
        return panel.navigate(url);
      }
      return self.clients.openWindow(url);
    })()
  );
});
