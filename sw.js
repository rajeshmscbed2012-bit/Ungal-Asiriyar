```javascript
// PWA Cache பெயர் (வெர்ஷனை மாற்றும் போது இதையும் மாற்ற வேண்டும்)
const CACHE_NAME = 'ungal-asiriyar-v9';

// ஆஃப்லைனில் வேலை செய்ய Cache செய்ய வேண்டிய ஃபைல்கள்
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './20260315_085358.png' // உங்கள் ஆப் ஐகான்
];

// 1. Install Event (ஃபைல்களை டவுன்லோட் செய்து Cache-ல் சேமிக்க)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('Service Worker: Caching Files');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// 2. Activate Event (பழைய Cache-களை அழிக்க)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// 3. Fetch Event (நெட்வொர்க் இல்லாத போது Cache-ல் இருந்து எடுக்க)
self.addEventListener('fetch', (event) => {
  // ஃபயர்பேஸ் போன்ற வெளி API அழைப்புகளை Cache செய்யாமல் தவிர்க்க
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Cache-ல் ஃபைல் இருந்தால் அதைக் கொடு, இல்லையென்றால் இன்டர்நெட்டில் இருந்து எடு
      return cachedResponse || fetch(event.request).then((response) => {
        // புதிய ஃபைல்களை Cache-ல் அப்டேட் செய்
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    }).catch(() => {
      // இன்டர்நெட்டும் இல்லை, Cache-லும் இல்லை என்றால் Index.html ஐ காட்டு
      if (event.request.mode === 'navigate') {
        return caches.match('./index.html');
      }
    })
  );
});

```
