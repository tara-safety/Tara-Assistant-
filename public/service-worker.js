self.addEventListener("install", event => {
console.log("Service Worker installed");
});

self.addEventListener("fetch", event => {
event.respondWith(fetch(event.request));
});

icon-192.png
icon-512.png
