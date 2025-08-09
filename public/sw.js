// Service Worker for Push Notifications
const CACHE_NAME = 'neighborhood-app-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install event
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Push event
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);

  let notificationData = {
    title: 'New Notification',
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: 'default',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/icons/view-icon.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss',
        icon: '/icons/dismiss-icon.png'
      }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: data // Store original data for click handling
      };
    } catch (error) {
      console.error('Error parsing push data:', error);
      notificationData.body = event.data.text() || notificationData.body;
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);

  event.notification.close();

  const notificationData = event.notification.data || {};
  const action = event.action;

  if (action === 'dismiss') {
    return;
  }

  // Determine URL based on notification type
  let targetUrl = '/';
  
  if (notificationData.type) {
    switch (notificationData.type) {
      case 'friendRequest':
        targetUrl = '/contacts?tab=friends';
        break;
      case 'message':
      case 'privateMessage':
        targetUrl = notificationData.chatId 
          ? `/private-chat/${notificationData.chatId}` 
          : '/private-chat';
        break;
      case 'notice':
        targetUrl = notificationData.referenceId 
          ? `/notices/${notificationData.referenceId}` 
          : '/notices';
        break;
      case 'report':
        targetUrl = notificationData.referenceId 
          ? `/reports/${notificationData.referenceId}` 
          : '/reports';
        break;
      case 'like':
      case 'comment':
        targetUrl = notificationData.referenceId 
          ? `/notices/${notificationData.referenceId}` 
          : '/dashboard';
        break;
      default:
        targetUrl = '/notifications';
    }
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if app is already open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin)) {
            // Focus existing window and navigate
            client.focus();
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              url: targetUrl,
              data: notificationData
            });
            return;
          }
        }
        
        // Open new window if app is not open
        return clients.openWindow(self.location.origin + targetUrl);
      })
  );
});

// Background sync for offline notifications
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-notification-sync') {
    event.waitUntil(
      // Sync any pending notifications when back online
      syncPendingNotifications()
    );
  }
});

async function syncPendingNotifications() {
  try {
    // Check for pending notifications in IndexedDB or localStorage
    const pendingNotifications = await getPendingNotifications();
    
    for (const notification of pendingNotifications) {
      await self.registration.showNotification(notification.title, notification.options);
    }
    
    // Clear pending notifications after showing
    await clearPendingNotifications();
  } catch (error) {
    console.error('Error syncing pending notifications:', error);
  }
}

async function getPendingNotifications() {
  // Implementation would depend on your offline storage strategy
  return [];
}

async function clearPendingNotifications() {
  // Implementation would depend on your offline storage strategy
}

// Handle message from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activate event
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});