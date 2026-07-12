// Barbershop App — konfiguracija (klijent + prikaz)
// VAŽNO: ovaj fajl (i api.js, tv.html) mora ostati ES5 — TV browseri (Tizen/webOS/Vidaa)
// imaju stari Chromium bez ?. ?? let/const/async; jedna moderna sintaksa ubija ceo skript.

// Polyfills za stare TV browsere
(function () {
  if (!String.prototype.padStart) {
    String.prototype.padStart = function (targetLength, padString) {
      targetLength = targetLength >> 0;
      padString = String(typeof padString !== 'undefined' ? padString : ' ');
      var s = String(this);
      if (s.length >= targetLength || padString.length === 0) return s;
      var pad = '';
      while (pad.length < targetLength - s.length) pad += padString;
      return pad.slice(0, targetLength - s.length) + s;
    };
  }
  if (!String.prototype.includes) {
    String.prototype.includes = function (search) { return this.indexOf(search) !== -1; };
  }
  if (!Array.prototype.find) {
    Array.prototype.find = function (fn) {
      for (var i = 0; i < this.length; i++) { if (fn(this[i], i, this)) return this[i]; }
      return undefined;
    };
  }
  if (!Array.prototype.includes) {
    Array.prototype.includes = function (x) { return this.indexOf(x) !== -1; };
  }
  if (!Object.assign) {
    Object.assign = function (target) {
      for (var i = 1; i < arguments.length; i++) {
        var src = arguments[i];
        if (src) { for (var k in src) { if (Object.prototype.hasOwnProperty.call(src, k)) target[k] = src[k]; } }
      }
      return target;
    };
  }
  if (typeof NodeList !== 'undefined' && !NodeList.prototype.forEach) {
    NodeList.prototype.forEach = Array.prototype.forEach;
  }
})();

var SALON = {
  name: "BARBERSHOP",
  tagline: "Classic Cuts · Hot Towel · Beard",
  established: "EST. 2024",
  hours: { open: 9, close: 21 },
  slotMin: 30,
  // Muzika salona — zameni svojom YouTube plejlistom/kanalom. (na klik se pušta sa zvukom)
  youtube: "https://www.youtube.com/embed/lCKLzHyhStQ?loop=1&playlist=lCKLzHyhStQ"
};

var SERVICES = [
  { id: "s1", name: "Šišanje", price: 800, min: 30 },
  { id: "s2", name: "Šišanje + brada", price: 1100, min: 45 },
  { id: "s3", name: "Brada", price: 500, min: 30 },
  { id: "s4", name: "Fade / fazoniranje", price: 1000, min: 45 },
  { id: "s5", name: "Klinac (do 12 god.)", price: 600, min: 30 }
];

var BARBERS = [
  { id: "b1", name: "Marko" },
  { id: "b2", name: "Stefan" },
  { id: "b3", name: "Nikola" }
];

function todayStr(d) {
  d = d || new Date();
  // lokalni datum (ne UTC) da se ne pomeri dan
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function serviceById(id) { return SERVICES.find(function (s) { return s.id === id; }); }
function barberById(id) { return BARBERS.find(function (b) { return b.id === id; }); }
function clientKey(name, phone) { return (name || "").trim().toLowerCase() + "|" + (phone || "").trim(); }
// HTML escape — obavezno za svaki korisnički unos koji ide u innerHTML (anti-XSS)
function esc(s) {
  var map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return map[c]; });
}
