const CACHE_NAME = "monbudget-" + CACHE_VERSION;
const CACHE_VERSION = "v3";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/revenus",
  "/depenses",
  "/objectifs",
  "/synthese",
  "/profil",
  "/admin",
  "/login",
  "/signup",
  "/reset-password",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET") return;

  // Static assets: cache-first
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icon-") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then(
          (cached) =>
            cached ||
            fetch(request).then((response) => {
              if (response.ok) cache.put(request, response.clone());
              return response;
            })
        )
      )
    );
    return;
  }

  // Supabase API: network-first, never cache auth endpoints
  if (url.hostname.includes("supabase")) {
    const isAuthEndpoint = url.pathname.includes("/auth/");
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.status === 401) {
            caches.delete(CACHE_NAME);
            return response;
          }
          if (response.ok && !isAuthEndpoint) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => isAuthEndpoint ? new Response('{"error":"offline"}', { status: 503, headers: { "Content-Type": "application/json" } }) : caches.match(request))
    );
    return;
  }

  // Google Fonts: stale-while-revalidate
  if (
    url.hostname.includes("fonts.googleapis.com") ||
    url.hostname.includes("fonts.gstatic.com")
  ) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fetched = fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
          return cached || fetched;
        })
      )
    );
    return;
  }

  // App pages: network-first with cache fallback
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      })
      .catch(() =>
        caches
          .match(request)
          .then((cached) => cached || caches.match("/"))
      )
  );
});

// Push notifications
self.addEventListener("push", (event) => {
  let data = { title: "MonBudget", body: "Nouvelle notification", type: "info" };
  try {
    if (event.data) data = event.data.json();
  } catch {
    if (event.data) data.body = event.data.text();
  }

  const icon = "/icon-192x192.svg";
  const badge = "/icon-192x192.svg";

  event.waitUntil(
    self.registration.showNotification(data.title || "MonBudget", {
      body: data.body || "",
      icon,
      badge,
      tag: data.type || "default",
      renotify: true,
      data: { url: data.url || "/dashboard" },
      vibrate: [100, 50, 100],
    })
  );
});

// Click on notification → open app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
