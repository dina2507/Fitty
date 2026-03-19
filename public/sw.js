const APP_SHELL_CACHE = 'fitty-app-shell-v2'
const RUNTIME_CACHE = 'fitty-runtime-v2'
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/maskable.svg',
]

function isHttpRequest(request) {
  return request?.url?.startsWith('http://') || request?.url?.startsWith('https://')
}

function isSameOriginRequest(request) {
  try {
    const requestUrl = new URL(request.url)
    return requestUrl.origin === self.location.origin
  } catch {
    return false
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => cache.addAll(CORE_ASSETS)).catch(() => undefined),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => ![APP_SHELL_CACHE, RUNTIME_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      )
    }),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  if (!isHttpRequest(event.request)) return
  if (!isSameOriginRequest(event.request)) return

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, responseClone))
          return response
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  const isStaticAsset = ['style', 'script', 'image', 'font', 'manifest'].includes(event.request.destination)

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request)
          .then((response) => {
            if (response?.ok) {
              const clone = response.clone()
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone))
            }
            return response
          })
          .catch(() => cached)

        return cached || networkFetch
      }),
    )
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response?.ok) {
          const clone = response.clone()
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => caches.match(event.request)),
  )
})
