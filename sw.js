/* Frigobilan · fonctionnement hors ligne.
   L'application s'ouvre depuis le cache (instantané, même sans réseau sur chantier)
   puis se met à jour en arrière-plan : la nouvelle version s'affiche au lancement suivant.
   Changer VERSION force le renouvellement complet du cache. */
var VERSION = "frigobilan-v1";
var SHELL = [
  "./",
  "./frigobilan.html",
  "./manifest.webmanifest",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", function(e){
  e.waitUntil(caches.open(VERSION).then(function(c){ return c.addAll(SHELL); }).then(function(){ return self.skipWaiting(); }));
});

self.addEventListener("activate", function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){ return k !== VERSION; }).map(function(k){ return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener("fetch", function(e){
  var req = e.request;
  if(req.method !== "GET") return;
  var url = new URL(req.url);
  var fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if(url.origin !== self.location.origin && !fonts) return;
  // Cache d'abord, mise à jour en arrière-plan.
  e.respondWith(caches.open(VERSION).then(function(c){
    return c.match(req, {ignoreSearch: req.mode === "navigate"}).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
        return res;
      });
      if(hit){ e.waitUntil(net.catch(function(){})); return hit; }
      return net.catch(function(){ return req.mode === "navigate" ? c.match("./frigobilan.html") : Response.error(); });
    });
  }));
});
