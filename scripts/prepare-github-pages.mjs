import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(root, "dist");
const iconSource = join(root, "assets", "icon.png");
const iconsDir = join(dist, "icons");
const indexPath = join(dist, "index.html");

mkdirSync(iconsDir, { recursive: true });

for (const filename of ["icon-192.png", "icon-512.png", "apple-touch-icon.png"]) {
  copyFileSync(iconSource, join(iconsDir, filename));
}

const manifest = {
  name: "MagicMirror",
  short_name: "MagicMirror",
  description: "A guided self-reflection interview app with local mode and optional AI model support.",
  start_url: ".",
  scope: ".",
  display: "standalone",
  orientation: "portrait",
  background_color: "#f7f4ee",
  theme_color: "#2d5a49",
  icons: [
    { src: "./icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any maskable" },
    { src: "./icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
  ]
};

writeFileSync(join(dist, "manifest.webmanifest"), `${JSON.stringify(manifest, null, 2)}\n`);

const serviceWorker = `const CACHE_NAME = "magicmirror-pwa-v1";
const APP_SHELL = ["./", "./index.html", "./manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match("./index.html"));
    })
  );
});
`;

writeFileSync(join(dist, "service-worker.js"), serviceWorker);

const pwaHead = `    <meta name="theme-color" content="#2d5a49" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-title" content="MagicMirror" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <link rel="manifest" href="./manifest.webmanifest" />
    <link rel="apple-touch-icon" href="./icons/apple-touch-icon.png" />`;

const serviceWorkerRegistration = `  <script>
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./service-worker.js").catch(function () {});
      });
    }
  </script>`;

let html = readFileSync(indexPath, "utf8");
html = html
  .replaceAll('src="/_expo/', 'src="./_expo/')
  .replaceAll('href="/_expo/', 'href="./_expo/')
  .replace("</head>", `${pwaHead}\n  </head>`)
  .replace("</body>", `${serviceWorkerRegistration}\n</body>`);

writeFileSync(indexPath, html);
