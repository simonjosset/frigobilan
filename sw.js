/* Frigobilan · fonctionnement hors ligne.
   La page de l'application est chargée depuis le réseau quand il répond vite : une nouvelle
   version s'affiche dès l'ouverture. Sans réseau (ou réseau trop lent sur chantier), on prend
   la copie en cache. Les autres fichiers (icônes, polices) viennent du cache et se mettent à
   jour en arrière-plan. Changer VERSION force le renouvellement complet du cache. */
var VERSION = "frigobilan-v2";
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
  // Page de l'application : réseau d'abord (3 s au plus), cache en secours.
  if(req.mode === "navigate"){
    e.respondWith(caches.open(VERSION).then(function(c){
      function cached(){
        return c.match(req, {ignoreSearch:true}).then(function(hit){ return hit || c.match("./frigobilan.html"); });
      }
      var net = fetch(req).then(function(res){
        if(!res || !res.ok) throw new Error("http");
        c.put(url.origin + url.pathname, res.clone());
        return res;
      });
      var late = new Promise(function(ok){ setTimeout(ok, 3000); }).then(cached);
      return Promise.race([net.catch(function(){ return null; }), late]).then(function(res){
        return res || net.catch(cached);
      });
    }));
    return;
  }
  // Autres fichiers : cache d'abord, mise à jour en arrière-plan.
  e.respondWith(caches.open(VERSION).then(function(c){
    return c.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        if(res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
        return res;
      });
      if(hit){ e.waitUntil(net.catch(function(){})); return hit; }
      return net.catch(function(){ return Response.error(); });
    });
  }));
});
