// Salon App — API klijent (live preko SSE). Drži keš stanja; stranice se re-renderuju na promenu.
// VAŽNO: ES5 sintaksa (bez ?. ?? let/const/async/strelica) — mora da radi na starim TV browserima.
var _state = { appointments: [], photos: {}, breaks: [] };
var _subs = [];
var _vers = {};
var _lastHash = '';
var _loaded = false;   // true nakon prvog uspešnog /api/state — sprečava blic praznog stanja

function toMins(t) {
  var p = (t || '0:0').split(':');
  return Number(p[0]) * 60 + Number(p[1]);
}

// ── Tačno vreme salona ──
// TV-i često imaju pogrešan sat ili zonu (npr. UTC → kasni 2h). Server uz /api/state
// šalje svoje vreme (now) i ofset zone salona (tzOffsetMin); iz toga računamo "sada"
// nezavisno od sata uređaja. Pre prvog odgovora: vreme uređaja.
var _clockSkewMs = 0;      // server UTC − uređaj UTC
var _tzOffsetMin = null;   // zona salona u minutima od UTC (null = još ne znamo)
function salonNow() {
  var utc = Date.now() + _clockSkewMs;
  if (_tzOffsetMin === null) return new Date(utc);
  // pomerena Date: getHours()/getMinutes() prikazuju zidno vreme salona na bilo kom uređaju
  var approx = new Date(utc);
  return new Date(utc + (_tzOffsetMin + approx.getTimezoneOffset()) * 60000);
}
function loadAppts() { return _state.appointments; }
function loadBreaks() { return _state.breaks; }
// fotke su keširane po photoKey (hash sa servera — telefon se ne otkriva javno)
function getPhoto(a) { return (a && _state.photos[a.photoKey]) || null; }
function onData(cb) { _subs.push(cb); }
function isLoaded() { return _loaded; }
// forsiraj pun refresh (posle admin logina — da stignu telefoni u keš)
function forceRefresh() { _lastHash = ''; return _refresh(); }
function _emit() { _subs.forEach(function (cb) { try { cb(); } catch (e) {} }); }

function _refresh() {
  // admin šalje lozinku da bi dobio i telefone; javne stranice dobijaju podatke bez telefona
  return fetch("/api/state", { headers: adminHeaders() })
    .then(function (r) { return r.json(); })
    .then(function (s) {
      _loaded = true;
      if (typeof s.now === 'number') {
        _clockSkewMs = s.now - Date.now();
        _tzOffsetMin = (typeof s.tzOffsetMin === 'number') ? s.tzOffsetMin : null;
      }
      var pv = s.photoVers || {};
      var hash = JSON.stringify((s.appointments || []).map(function (a) { return { id: a.id, greeted: a.greeted }; }))
        + '|' + Object.keys(pv).sort().map(function (k) { return k + ':' + pv[k]; }).join(',');
      if (hash === _lastHash) return;
      _lastHash = hash;
      _state.appointments = s.appointments || [];
      _state.breaks = s.breaks || [];
      // Odmah iscrtaj (red, demo fotke) — fotke klijenata stižu naknadno.
      // Na TV-u je čekanje na sve fotke (megabajti base64) blokiralo ceo prikaz.
      _emit();
      // Dovuci samo fotke koje neki termin stvarno koristi, i to nove/izmenjene —
      // u bazi može biti gomila starih fotki bez termina; njih ne skidamo uopšte.
      var needed = {};
      _state.appointments.forEach(function (a) { if (a.photoKey) needed[a.photoKey] = 1; });
      var missing = Object.keys(pv).filter(function (k) { return needed[k] && _vers[k] !== pv[k]; });
      var jobs = missing.map(function (k) {
        return fetch("/api/photo?key=" + encodeURIComponent(k))
          .then(function (pr) { return pr.json(); })
          .then(function (pj) {
            if (pj.dataUrl) { _state.photos[k] = pj.dataUrl; _vers[k] = pv[k]; }
          })
          .catch(function (e) {});
      });
      if (jobs.length) return Promise.all(jobs).then(_emit);
    })
    .catch(function (e) { /* offline */ });
}

function addAppt(a) {
  return fetch("/api/appointments", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a)
  }).then(function (r) { return r.json(); });   // SSE će osvežiti ostale ekrane
}
// admin akcije šalju lozinku iz localStorage kao zaglavlje
function adminHeaders(extra) {
  var pass = (typeof localStorage !== 'undefined' && localStorage.getItem('adminPass')) || '';
  return Object.assign({ 'x-admin-pass': pass }, extra || {});
}
function removeAppt(id) {
  return fetch("/api/appointments/" + id, { method: "DELETE", headers: adminHeaders() });
}
function savePhoto(name, phone, dataUrl, consent) {
  return fetch("/api/photos", {
    method: "POST", headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name: name, phone: phone, dataUrl: dataUrl, consent: consent })
  });
}

// slobodni termini (iz keša) — isključuje zauzete i pauze frizera
function freeSlots(dateStr, barberId) {
  var taken = loadAppts().filter(function (a) { return a.date === dateStr && a.barberId === barberId; })
    .map(function (a) { return a.time; });
  var breaks = loadBreaks().filter(function (b) { return b.date === dateStr && b.barberId === barberId; });
  var out = [];
  for (var h = SALON.hours.open; h < SALON.hours.close; h++) {
    for (var m = 0; m < 60; m += SALON.slotMin) {
      var t = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      if (taken.includes(t)) continue;
      var tMins = h * 60 + m;
      var inBreak = breaks.some(function (b) { return tMins >= toMins(b.startTime) && tMins < toMins(b.endTime); });
      if (inBreak) continue;
      out.push(t);
    }
  }
  return out;
}

// procena čekanja: minuta od sada do odabranog termina (samo za danas)
function waitMins(dateStr, slotTime) {
  if (!slotTime || dateStr !== todayStr(salonNow())) return null;
  var now = salonNow();
  var diff = toMins(slotTime) - (now.getHours() * 60 + now.getMinutes());
  return diff > 0 ? diff : null;
}

function addBreak(barberId, date, startTime, endTime) {
  return fetch("/api/breaks", {
    method: "POST", headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ barberId: barberId, date: date, startTime: startTime, endTime: endTime })
  }).then(function (r) { return r.json(); });
}
function removeBreak(id) {
  return fetch("/api/breaks/" + id, { method: "DELETE", headers: adminHeaders() });
}

// live: polling kad je tab vidljiv (štedi Upstash zahteve), SSE bonus kad radi lokalno.
// TV može postaviti window.POLL_MS pre učitavanja api.js za brži interval.
(function initLive() {
  var POLL = (typeof window !== 'undefined' && window.POLL_MS) || 5000;
  _refresh();
  setInterval(function () { if (!document.hidden) _refresh(); }, POLL);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) _refresh(); });
  try {
    var es = new EventSource("/api/stream");
    es.onmessage = function () { _refresh(); };
    es.onerror = function () { es.close(); };
  } catch (e) {}
})();
