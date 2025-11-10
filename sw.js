const CACHE_NAME = "cerita-sekitarmu-v3.0.0";
const APP_SHELL_CACHE = "app-shell-v3";

// ✅ FIX: Gunakan absolute path untuk GitHub Pages
const BASE_PATH = "/ceritamu";

const ESSENTIAL_FILES = [
  `${BASE_PATH}/`,
  `${BASE_PATH}/index.html`,
  `${BASE_PATH}/main.bundle.js`,
  `${BASE_PATH}/styles.css`,
  `${BASE_PATH}/manifest.json`,
  // ✅ TAMBAH: Cache semua chunk files
  `${BASE_PATH}/283.main.bundle.js`,
  `${BASE_PATH}/327.main.bundle.js`,
  `${BASE_PATH}/395.main.bundle.js`,
  `${BASE_PATH}/408.main.bundle.js`,
  `${BASE_PATH}/451.main.bundle.js`,
  `${BASE_PATH}/611.main.bundle.js`,
  `${BASE_PATH}/724.main.bundle.js`,
];

const OPTIONAL_FILES = [
  `${BASE_PATH}/favicon.png`,
  `${BASE_PATH}/icons/icon-72x72.png`,
  `${BASE_PATH}/icons/icon-96x96.png`,
  `${BASE_PATH}/icons/icon-128x128.png`,
  `${BASE_PATH}/icons/icon-144x144.png`,
  `${BASE_PATH}/icons/icon-152x152.png`,
  `${BASE_PATH}/icons/icon-192x192.png`,
  `${BASE_PATH}/icons/icon-384x384.png`,
  `${BASE_PATH}/icons/icon-512x512.png`,
];

// === INSTALL ===
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker: Memulai instalasi...");
  console.log("📍 Base Path:", BASE_PATH);

  // Skip waiting - langsung aktifkan SW baru
  event.waitUntil(self.skipWaiting());

  // Cache App Shell dengan error handling yang robust
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(APP_SHELL_CACHE);
        console.log("💾 Membuka cache...");

        // 1. Cache ESSENTIAL files - harus berhasil
        console.log("📦 Caching file essential...");
        const essentialResults = await Promise.allSettled(
          ESSENTIAL_FILES.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`⚠️ Gagal cache essential ${url}:`, err.message);
              return null;
            })
          )
        );

        // Log results
        const essentialSuccess = essentialResults.filter(
          (r) => r.status === "fulfilled" && r.value !== null
        ).length;

        console.log(
          `✅ ${essentialSuccess}/${ESSENTIAL_FILES.length} file essential berhasil di-cache`
        );

        // 2. Cache OPTIONAL files - boleh gagal
        console.log("📦 Caching file optional...");
        const optionalResults = await Promise.allSettled(
          OPTIONAL_FILES.map(async (url) => {
            try {
              await cache.add(url);
              console.log(`✅ Berhasil cache optional: ${url}`);
              return { success: true, url };
            } catch (err) {
              console.warn(`⚠️ Gagal cache optional ${url}:`, err.message);
              return { success: false, url, error: err.message };
            }
          })
        );

        const optionalSuccess = optionalResults.filter(
          (r) => r.status === "fulfilled" && r.value.success
        ).length;

        console.log(
          `📊 Cache result: ${essentialSuccess}/${ESSENTIAL_FILES.length} essential, ${optionalSuccess}/${OPTIONAL_FILES.length} optional berhasil`
        );

        console.log("🎉 Proses caching selesai");
      } catch (error) {
        console.error("❌ Error utama saat caching:", error);
      }
    })()
  );
});

// === ACTIVATE ===
self.addEventListener("activate", (event) => {
  console.log("🔄 Service Worker: Mengaktifkan...");

  event.waitUntil(
    (async () => {
      // Claim clients immediately
      await self.clients.claim();

      // Clean old caches
      try {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(async (cacheName) => {
            if (cacheName !== APP_SHELL_CACHE && cacheName !== CACHE_NAME) {
              console.log(`🗑️ Menghapus cache lama: ${cacheName}`);
              await caches.delete(cacheName);
            }
          })
        );
      } catch (error) {
        console.warn("⚠️ Error cleaning old caches:", error);
      }

      console.log("✅ Service Worker aktif dan siap!");
    })()
  );
});

// === FETCH ===
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Skip API calls - langsung fetch dari network
  if (url.href.includes("story-api.dicoding.dev")) {
    return;
  }

  // Skip external resources
  if (!url.href.startsWith(self.location.origin)) {
    return;
  }

  // ✅ FIX: Handle chunk files specifically
  if (
    url.pathname.includes(".bundle.js") ||
    url.pathname.includes(".chunk.js")
  ) {
    event.respondWith(handleChunkRequest(request));
    return;
  }

  // Handle normal requests
  event.respondWith(handleNormalRequest(request));
});

// Handle chunk files dengan strategy cache-first
async function handleChunkRequest(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    console.log(
      `📂 Serving chunk from cache: ${new URL(request.url).pathname}`
    );
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.status === 200) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error(`❌ Chunk load failed: ${new URL(request.url).pathname}`);
    // Return error response untuk chunks
    return new Response("Chunk load failed", {
      status: 404,
      statusText: "Chunk Not Found",
    });
  }
}

// Handle normal requests dengan strategy network-first
async function handleNormalRequest(request) {
  try {
    // Coba network dulu
    const networkResponse = await fetch(request);

    // Cache response yang valid
    if (networkResponse.status === 200) {
      const cache = await caches.open(APP_SHELL_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log(`❌ Network error: ${new URL(request.url).pathname}`);

    // Fallback ke cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    // Fallback untuk HTML requests
    if (
      request.destination === "document" ||
      request.headers.get("accept")?.includes("text/html")
    ) {
      const fallback = await caches.match(`${BASE_PATH}/index.html`);
      if (fallback) {
        return fallback;
      }
    }

    // Return offline page
    return createOfflineResponse();
  }
}

// Helper function untuk create offline response
function createOfflineResponse() {
  return new Response(
    `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Anda Sedang Offline - Cerita di Sekitarmu</title>
        <style>
          body { 
            font-family: Arial, sans-serif; 
            text-align: center; 
            padding: 50px; 
            background: #f5f5f5;
            margin: 0;
          }
          .container { 
            background: white; 
            padding: 40px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            max-width: 500px;
            margin: 100px auto;
          }
          h1 { color: #666; margin-bottom: 20px; }
          p { color: #888; line-height: 1.6; }
          button {
            background: #007bff;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 16px;
            margin-top: 20px;
          }
          button:hover {
            background: #0056b3;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📶 Anda Sedang Offline</h1>
          <p>Aplikasi membutuhkan koneksi internet untuk mengambil data cerita terbaru.</p>
          <p>Silakan periksa koneksi internet Anda dan coba lagi.</p>
          <button onclick="window.location.reload()">Coba Lagi</button>
        </div>
      </body>
    </html>
  `,
    {
      status: 503,
      statusText: "Service Unavailable",
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    }
  );
}

// === PUSH NOTIFICATIONS ===
self.addEventListener("push", (event) => {
  console.log("📨 Menerima push notification");

  const options = {
    body: "Ada cerita baru di sekitarmu! 📖",
    icon: `${BASE_PATH}/icons/icon-192x192.png`,
    badge: `${BASE_PATH}/icons/icon-72x72.png`,
    tag: "cerita-notification",
  };

  event.waitUntil(
    self.registration.showNotification("Cerita di Sekitarmu", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  console.log("👆 Notification diklik");
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin)) {
          return client.focus();
        }
      }
      return self.clients.openWindow(`${BASE_PATH}/`);
    })
  );
});

console.log("🚀 Service Worker loaded dan siap! Versi 3.0.0");
console.log("📍 Base Path:", BASE_PATH);
