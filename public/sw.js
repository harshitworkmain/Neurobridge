// ============================================
// NeuroBridge AI — Service Worker
// Handles push notifications and offline caching
// ============================================

const CACHE_NAME = 'neurobridge-v2';

// Install event — cache essential assets
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

// Activate event — clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// Push event — handle incoming push notifications
self.addEventListener('push', (event) => {
    let data = {
        title: 'NeuroBridge AI',
        body: 'You have a new notification',
        icon: '/brain-icon.png',
        badge: '/badge-icon.png',
        tag: 'neurobridge-default',
        data: { url: '/' }
    };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (e) {
            data.body = event.data.text();
        }
    }

    const options = {
        body: data.body,
        icon: data.icon || '/brain-icon.png',
        badge: data.badge || '/badge-icon.png',
        tag: data.tag || 'neurobridge-default',
        data: data.data || { url: '/' },
        actions: data.actions || [],
        vibrate: [100, 50, 100],
        requireInteraction: data.tag === 'therapy-reminder' || data.tag === 'appointment-reminder',
        silent: false
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Notification click — navigate to the relevant page
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = event.notification.data?.url || '/';
    const action = event.action;

    let targetUrl = url;
    if (action === 'start') targetUrl = '/therapy';
    else if (action === 'join') targetUrl = '/appointments';
    else if (action === 'reschedule') targetUrl = '/appointments';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Focus existing window if open
            for (const client of windowClients) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // Open new window
            return clients.openWindow(targetUrl);
        })
    );
});

// Notification close event
self.addEventListener('notificationclose', (event) => {
    // Analytics: track dismissed notifications
    console.log('Notification dismissed:', event.notification.tag);
});
