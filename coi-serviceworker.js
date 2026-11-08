/*! coi-serviceworker v0.1.7 - Guido Zuidhof, MIT License */
let coi = {
  shouldRegister: () => !reloadedBySelf,
  shouldDeregister: () => false,
  coepCredentialless: () => true,
  coepDegrade: () => true,
  doReload: () => window.location.reload(),
  globalScope: typeof window === 'undefined' ? self : window,
};

if (typeof coi.globalScope.coi !== 'undefined') {
  coi = Object.assign({}, coi, coi.globalScope.coi);
}

const reloadedBySelf = typeof window !== 'undefined' && !!window.sessionStorage.getItem('coiReloadedBySelf');
if (typeof window !== 'undefined') {
  window.sessionStorage.removeItem('coiReloadedBySelf');
}

if (typeof window === 'undefined') {
  // Service Worker context
  self.addEventListener('install', () => self.skipWaiting());
  self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

  self.addEventListener('fetch', function (event) {
    const r = event.request;
    if (r.cache === 'only-if-cached' && r.mode !== 'same-origin') {
      return;
    }

    event.respondWith(
      fetch(r).then((response) => {
        if (response.status === 0) {
          return response;
        }

        const newHeaders = new Headers(response.headers);
        newHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

        if (coi.coepCredentialless() && r.mode === 'no-cors') {
          newHeaders.set('Cross-Origin-Embedder-Policy', 'credentialless');
        } else {
          newHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
        }

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: newHeaders,
        });
      }).catch((e) => {
        console.error(e);
        throw e;
      })
    );
  });
} else {
  // Page context
  if (!window.crossOriginIsolated && coi.shouldRegister()) {
    window.addEventListener('load', function () {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./coi-serviceworker.js').then(
          function (registration) {
            registration.addEventListener('updatefound', function () {
              window.location.reload();
            });

            if (navigator.serviceWorker.controller) {
              if (!window.sessionStorage.getItem('coiReloadedBySelf')) {
                window.sessionStorage.setItem('coiReloadedBySelf', 'true');
                window.location.reload();
              }
            }
          },
          function (err) {
            console.warn('COI Service Worker registration notice:', err);
          }
        );
      }
    });
  }
}
