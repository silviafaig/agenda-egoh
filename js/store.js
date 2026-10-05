// Persistencia en el navegador (etapa 1). Las fotos cargadas desde el panel se guardan
// aparte del resto de los datos, así guardar una nota no reescribe megas de imágenes.
(function (root) {
  "use strict";
  var EG = (root.EG = root.EG || {});

  var KEY = "agenda-egoh:v1:datos";
  var FOTO = "agenda-egoh:v1:foto:";

  function memoryStorage() {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; },
      key: function (i) { return Object.keys(m)[i] || null; },
      get length() { return Object.keys(m).length; }
    };
  }

  EG.createStore = function (storage, persistent) {
    var cache = {};
    var api = {
      persistent: persistent !== false,
      load: function () {
        var db = null;
        try { db = JSON.parse(storage.getItem(KEY)); } catch (e) { db = null; }
        if (!db || typeof db !== "object" || !db.settings || !Array.isArray(db.products) || !Array.isArray(db.appts)) {
          return EG.seed();
        }
        var def = EG.defaultSettings();
        Object.keys(def).forEach(function (k) { if (db.settings[k] === undefined) db.settings[k] = def[k]; });
        return db;
      },
      save: function (db) {
        try { storage.setItem(KEY, JSON.stringify(db)); return true; } catch (e) { return false; }
      },
      fotoGet: function (id) {
        if (Object.prototype.hasOwnProperty.call(cache, id)) return cache[id];
        var v = null;
        try { v = storage.getItem(FOTO + id); } catch (e) { v = null; }
        cache[id] = v;
        return v;
      },
      fotoSet: function (id, dataUrl) {
        try { storage.setItem(FOTO + id, dataUrl); cache[id] = dataUrl; return true; } catch (e) { return false; }
      },
      fotoDel: function (id) {
        try { storage.removeItem(FOTO + id); } catch (e) { /* nada que borrar */ }
        delete cache[id];
      },
      clearAll: function () {
        var keys = [];
        for (var i = 0; i < storage.length; i++) {
          var k = storage.key(i);
          if (k && (k === KEY || k.indexOf(FOTO) === 0)) keys.push(k);
        }
        keys.forEach(function (k) { storage.removeItem(k); });
        cache = {};
      }
    };
    return api;
  };

  // En el navegador usamos localStorage; si el navegador lo bloquea, la app sigue andando en memoria.
  var real = null;
  try {
    if (root.localStorage) {
      root.localStorage.setItem("agenda-egoh:test", "1");
      root.localStorage.removeItem("agenda-egoh:test");
      real = root.localStorage;
    }
  } catch (e) { real = null; }
  if (typeof window !== "undefined") EG.store = EG.createStore(real || memoryStorage(), !!real);

  // Foto de una prenda: archivo del repo ("fotos/…") o foto cargada desde el panel ("local").
  EG.photoSrc = function (p) {
    if (!p) return "";
    return p.foto === "local" ? EG.store.fotoGet(p.id) || "" : p.foto || "";
  };

  // Reduce una foto elegida por la usuaria a un JPEG liviano (devuelve una promesa con el data URL).
  EG.resizeImage = function (file, maxW, quality) {
    function draw(src, w, h) {
      var scale = Math.min(1, maxW / w);
      var c = document.createElement("canvas");
      c.width = Math.round(w * scale);
      c.height = Math.round(h * scale);
      var ctx = c.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(src, 0, 0, c.width, c.height);
      return c.toDataURL("image/jpeg", quality);
    }
    if (root.createImageBitmap) {
      return root.createImageBitmap(file, { imageOrientation: "from-image" }).then(function (bmp) {
        var url = draw(bmp, bmp.width, bmp.height);
        if (bmp.close) bmp.close();
        return url;
      });
    }
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var u = URL.createObjectURL(file);
      img.onload = function () { URL.revokeObjectURL(u); resolve(draw(img, img.naturalWidth, img.naturalHeight)); };
      img.onerror = function () { URL.revokeObjectURL(u); reject(new Error("imagen inválida")); };
      img.src = u;
    });
  };
})(typeof window !== "undefined" ? window : globalThis);
