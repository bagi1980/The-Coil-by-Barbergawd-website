// Salon App — API klijent (live preko SSE). Drži keš stanja; stranice se re-renderuju na promenu.
const _state = { appointments: [], photos: {}, breaks: [] };
const _subs = [];
const _vers = {};
let _lastHash = '';
let _loaded = false;   // true nakon prvog uspešnog /api/state — sprečava blic praznog stanja

function toMins(t) { const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + m; }
function loadAppts() { return _state.appointments; }
function loadBreaks() { return _state.breaks; }
// fotke su keširane po photoKey (hash sa servera — telefon se ne otkriva javno)
function getPhoto(a) { return (a && _state.photos[a.photoKey]) || null; }
function onData(cb) { _subs.push(cb); }
function isLoaded() { return _loaded; }
// forsiraj pun refresh (posle admin logina — da stignu telefoni u keš)
function forceRefresh() { _lastHash = ''; return _refresh(); }
function _emit() { _subs.forEach(cb => { try { cb(); } catch (e) {} }); }

async function _refresh() {
  try {
    // admin šalje lozinku da bi dobio i telefone; javne stranice dobijaju podatke bez telefona
    const r = await fetch("/api/state", { headers: adminHeaders() });
    const s = await r.json();
    _loaded = true;
    const pv = s.photoVers || {};
    const hash = JSON.stringify((s.appointments || []).map(a => ({ id: a.id, greeted: a.greeted })))
      + '|' + Object.keys(pv).sort().map(k => k + ':' + pv[k]).join(',');
    if (hash === _lastHash) return;
    _lastHash = hash;
    _state.appointments = s.appointments || [];
    _state.breaks = s.breaks || [];
    // dovuci samo slike koje su nove ili izmenjene — ne ceo blob na svaki poll
    const missing = Object.keys(pv).filter(k => _vers[k] !== pv[k]);
    if (missing.length) await Promise.all(missing.map(async k => {
      try {
        const pr = await fetch("/api/photo?key=" + encodeURIComponent(k));
        const pj = await pr.json();
        if (pj.dataUrl) { _state.photos[k] = pj.dataUrl; _vers[k] = pv[k]; }
      } catch (e) {}
    }));
    _emit();
  } catch (e) { /* offline */ }
}

async function addAppt(a) {
  const r = await fetch("/api/appointments", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(a)
  });
  return r.json();   // SSE će osvežiti ostale ekrane
}
// admin akcije šalju lozinku iz localStorage kao zaglavlje
function adminHeaders(extra) {
  const pass = (typeof localStorage !== 'undefined' && localStorage.getItem('adminPass')) || '';
  return Object.assign({ 'x-admin-pass': pass }, extra || {});
}
async function removeAppt(id) {
  await fetch("/api/appointments/" + id, { method: "DELETE", headers: adminHeaders() });
}
async function savePhoto(name, phone, dataUrl, consent) {
  return fetch("/api/photos", {
    method: "POST", headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ name, phone, dataUrl, consent })
  });
}

// slobodni termini (iz keša) — isključuje zauzete i pauze frizera
function freeSlots(dateStr, barberId) {
  const taken = loadAppts().filter(a => a.date === dateStr && a.barberId === barberId).map(a => a.time);
  const breaks = loadBreaks().filter(b => b.date === dateStr && b.barberId === barberId);
  const out = [];
  for (let h = SALON.hours.open; h < SALON.hours.close; h++)
    for (let m = 0; m < 60; m += SALON.slotMin) {
      const t = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      if (taken.includes(t)) continue;
      const tMins = h * 60 + m;
      if (breaks.some(b => tMins >= toMins(b.startTime) && tMins < toMins(b.endTime))) continue;
      out.push(t);
    }
  return out;
}

// procena čekanja: minuta od sada do odabranog termina (samo za danas)
function waitMins(dateStr, slotTime) {
  if (!slotTime || dateStr !== todayStr()) return null;
  const now = new Date();
  const diff = toMins(slotTime) - (now.getHours() * 60 + now.getMinutes());
  return diff > 0 ? diff : null;
}

async function addBreak(barberId, date, startTime, endTime) {
  const r = await fetch("/api/breaks", {
    method: "POST", headers: adminHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ barberId, date, startTime, endTime })
  });
  return r.json();
}
async function removeBreak(id) {
  await fetch("/api/breaks/" + id, { method: "DELETE", headers: adminHeaders() });
}

// live: polling kad je tab vidljiv (štedi Upstash zahteve), SSE bonus kad radi lokalno.
// TV može postaviti window.POLL_MS pre učitavanja api.js za brži interval.
(function initLive() {
  const POLL = (typeof window !== 'undefined' && window.POLL_MS) || 5000;
  _refresh();
  setInterval(() => { if (!document.hidden) _refresh(); }, POLL);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) _refresh(); });
  try {
    const es = new EventSource("/api/stream");
    es.onmessage = () => _refresh();
    es.onerror = () => es.close();
  } catch (e) {}
})();
