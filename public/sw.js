self.addEventListener('push', function(event) {
  const data = event.data ? event.data.json() : {}
  const title = data.title || 'Pulse'
  const body = data.body || ''

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: '/' },
      actions: [
        { action: 'open', title: 'Öppna Pulse' },
        { action: 'dismiss', title: 'Stäng' }
      ]
    })
  )
})

self.addEventListener('notificationclick', function(event) {
  event.notification.close()
  if (event.action === 'open' || !event.action) {
    event.waitUntil(clients.openWindow('/'))
  }
})
