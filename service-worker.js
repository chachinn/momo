// ========================================
// MOMO SERVICE WORKER
// Momo 1.11.0 — daily cloud auto backup + stable PWA updates
// ========================================

const APP_VERSION =
  "1.11.0";


const CACHE_NAME =
  `momo-runtime-shell-v${APP_VERSION}`;


const CORE_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./firebase-momo.js",
  "./smart-money.js"
];


const OPTIONAL_SHELL = [
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];


self.addEventListener(
  "install",
  (event) => {

    event.waitUntil(
      caches
        .open(
          CACHE_NAME
        )
        .then(
          async (
            cache
          ) => {

            // Core app files are required. A broken/incomplete release
            // must not install and replace the currently working Momo shell.
            await cache.addAll(
              CORE_SHELL.map(
                (
                  url
                ) =>
                  new Request(
                    url,
                    {
                      cache:
                        "reload"
                    }
                  )
              )
            );


            // Branding/manifest assets are useful but should not block an
            // otherwise healthy app update if one optional file is unavailable.
            await Promise.allSettled(
              OPTIONAL_SHELL.map(
                (
                  url
                ) =>
                  cache.add(
                    new Request(
                      url,
                      {
                        cache:
                          "reload"
                      }
                    )
                  )
              )
            );

          }
        )
    );

  }
);


self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }

  if (event.data?.type === "GET_MOMO_VERSION") {
    const replyPort = event.ports?.[0];
    replyPort?.postMessage({
      version: APP_VERSION
    });
  }
});


self.addEventListener(
  "activate",
  (event) => {

    event.waitUntil(
      caches
        .keys()
        .then(
          (
            keys
          ) =>
            Promise.all(
              keys
                .filter(
                  (
                    key
                  ) =>
                    key !==
                      CACHE_NAME &&
                    key.startsWith(
                      "momo-"
                    )
                )
                .map(
                  (
                    key
                  ) =>
                    caches.delete(
                      key
                    )
                )
            )
        )
        .then(
          () =>
            self.clients.claim()
        )
    );

  }
);


function isSameOrigin(
  request
) {

  return (
    new URL(
      request.url
    ).origin ===
    self.location.origin
  );

}


function isAppShellRequest(
  request
) {

  const url =
    new URL(
      request.url
    );


  return (
    request.mode ===
      "navigate" ||
    url.pathname.endsWith(
      "/index.html"
    ) ||
    url.pathname.endsWith(
      "/styles.css"
    ) ||
    url.pathname.endsWith(
      "/app.js"
    ) ||
    url.pathname.endsWith(
      "/firebase-momo.js"
    ) ||
    url.pathname.endsWith(
      "/smart-money.js"
    ) ||
    url.pathname.endsWith(
      "/manifest.json"
    )
  );

}


async function cacheSuccessfulResponse(
  request,
  response
) {

  if (
    !response ||
    !response.ok
  ) {

    return response;

  }


  const cache =
    await caches.open(
      CACHE_NAME
    );


  await cache.put(
    request,
    response.clone()
  );


  return response;

}


self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data?.json?.() || {}; } catch { data = { body: event.data?.text?.() || "Momo has a reminder for you." }; }

  const title = data.title || "Momo reminder";
  const options = {
    body: data.body || "You have something coming up.",
    icon: "./icons/icon-192.png",
    badge: "./icons/icon-192.png",
    tag: data.tag || `momo-${Date.now()}`,
    renotify: false,
    data: { url: data.url || "./index.html" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const scopeUrl =
    self.registration.scope ||
    new URL("./", self.location.href).href;

  let targetUrl;

  try {
    const candidate = new URL(
      event.notification.data?.url ||
        "index.html",
      scopeUrl
    );

    targetUrl =
      candidate.origin ===
      self.location.origin
        ? candidate.href
        : new URL(
            "index.html",
            scopeUrl
          ).href;
  } catch {
    targetUrl = new URL(
      "index.html",
      scopeUrl
    ).href;
  }

  event.waitUntil(
    (async () => {
      const windows =
        await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true
        });

      for (const client of windows) {
        if (
          client.url.startsWith(
            scopeUrl
          ) &&
          "focus" in client
        ) {
          try {
            if (
              client.url !==
              targetUrl &&
              "navigate" in client
            ) {
              await client.navigate(
                targetUrl
              );
            }
          } catch {}

          return client.focus();
        }
      }

      return self.clients.openWindow
        ? self.clients.openWindow(
            targetUrl
          )
        : undefined;
    })()
  );
});

self.addEventListener(
  "fetch",
  (event) => {

    const request =
      event.request;


    if (
      request.method !==
        "GET" ||
      !isSameOrigin(
        request
      )
    ) {

      return;

    }


    const url =
      new URL(
        request.url
      );


    // Update/version probes always go to the network and never enter Momo's
    // offline cache. This prevents an old cached index from hiding a release.
    if (
      url.searchParams.has(
        "momo_update_check"
      )
    ) {

      event.respondWith(
        fetch(
          request,
          {
            cache:
              "no-store"
          }
        ).catch(
          () =>
            Response.error()
        )
      );


      return;

    }


    if (
      isAppShellRequest(
        request
      )
    ) {

      // Keep the currently active Momo shell stable until the user accepts
      // the waiting service worker from the in-app Refresh banner. Version
      // probes above still bypass the cache, so Momo can discover releases
      // without silently swapping app files underneath an open session.
      event.respondWith(
        (async () => {

          const cache =
            await caches.open(
              CACHE_NAME
            );


          const cached =
            await cache.match(
              request
            );


          if (
            cached
          ) {

            return cached;

          }


          // Navigations can arrive with a slightly different URL shape
          // (for example the repository root instead of /index.html).
          if (
            request.mode ===
              "navigate"
          ) {

            const fallback =
              await cache.match(
                "./index.html"
              ) ||
              await cache.match(
                "./"
              );


            if (
              fallback
            ) {

              return fallback;

            }

          }


          try {

            const response =
              await fetch(
                new Request(
                  request,
                  {
                    cache:
                      "no-store"
                  }
                )
              );


            return cacheSuccessfulResponse(
              request,
              response
            );

          } catch {

            throw new Error(
              "Momo is offline and this file is not cached yet."
            );

          }

        })()
      );


      return;

    }


    event.respondWith(
      caches
        .match(
          request
        )
        .then(
          async (
            cached
          ) => {

            if (
              cached
            ) {

              return cached;

            }


            const response =
              await fetch(
                request
              );


            return cacheSuccessfulResponse(
              request,
              response
            );

          }
        )
    );

  }
);