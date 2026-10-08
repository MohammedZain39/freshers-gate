const CACHE_NAME = "freshers-gate-v2";

const APP_SHELL = [
  "/login",
  "/gate",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      for (const url of APP_SHELL) {
        try {
          const response = await fetch(url, {
            cache: "no-store",
          });

          if (response.ok) {
            await cache.put(url, response);
            console.log(
              "[Freshers Gate] Cached:",
              url
            );
          }
        } catch (error) {
          console.warn(
            "[Freshers Gate] Could not cache:",
            url,
            error
          );
        }
      }

      await self.skipWaiting();
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );

      await self.clients.claim();

      console.log(
        "[Freshers Gate] Service worker activated"
      );
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (
    url.origin !== self.location.origin
  ) {
    return;
  }

  // =========================================
  // PAGE NAVIGATION
  // =========================================

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);

          if (response.ok) {
            const cache =
              await caches.open(CACHE_NAME);

            await cache.put(
              request,
              response.clone()
            );
          }

          return response;
        } catch {
          // Internet unavailable.
          // Return cached page.

          const cached =
            await caches.match(request);

          if (cached) {
            return cached;
          }

          // Fallback to Gate shell.
          const gate =
            await caches.match("/gate");

          if (gate) {
            return gate;
          }

          // Final fallback to Login.
          const login =
            await caches.match("/login");

          if (login) {
            return login;
          }

          return new Response(
            "Freshers Gate is offline. Please open the application online once before using offline mode.",
            {
              status: 503,
              headers: {
                "Content-Type":
                  "text/plain; charset=utf-8",
              },
            }
          );
        }
      })()
    );

    return;
  }

  // =========================================
  // NORMAL STATIC / API GET REQUESTS
  // =========================================

  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);

        if (
          response.ok &&
          response.status === 200
        ) {
          const cache =
            await caches.open(CACHE_NAME);

          await cache.put(
            request,
            response.clone()
          );
        }

        return response;
      } catch {
        const cached =
          await caches.match(request);

        if (cached) {
          return cached;
        }

        return new Response(
          "Offline",
          {
            status: 503,
            headers: {
              "Content-Type":
                "text/plain",
            },
          }
        );
      }
    })()
  );
});