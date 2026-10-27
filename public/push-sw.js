/* Loaded into the Workbox service worker (vite.config.ts → workbox.importScripts). Shows message notifications. */

self.addEventListener('push', (e) => {
  let d = {};
  try {
    d = e.data ? e.data.json() : {};
  } catch {
    d = { body: e.data && e.data.text() };
  }
  e.waitUntil(
    self.registration.showNotification(d.title || 'Gym Log', {
      body: d.body || '',
      tag: d.tag,
      renotify: !!d.tag,
      icon: 'icon-192.png',
      badge: 'icon-192.png',
      data: { url: d.url },
    }),
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || './', self.registration.scope).href;
  const hash = new URL(url).hash;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const win = list[0];
      if (win) {
        // the app is open in the background: bring it up and switch to the chat
        win.postMessage({ type: 'open', hash });
        return win.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
