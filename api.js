// Salon App — API klijent (live preko SSE). Drži keš stanja; stranice se re-renderuju na promenu.
const _state = { appointments: [], photos: {} };
const _subs = [];
const _vers = {};       // keširane verzije slika
let _lastHash = '';

function loadAppts() { return _state.appointments; }
function getPhoto(name, phone) { return _state.photos[clientKey(name, phone)] || null; }
function onData(cb) { _subs.push(cb); }
function _emit() { _subs.forEach(cb => { try { cb(); } catch (e) {} }); }

async function _refresh() {
  try {
    const r = await fetch("/api/state");
    const s = await r.json();
    const pv = s.photoVers || {};
    const hash = JSON.stringify((s.appointments || []).map(a => ({ id: a.id, greeted: a.greeted })))
      + '|' + Object.keys(pv).sort().map(k => k + ':' + pv[k]).join(',');
    if (hash === _lastHash) return;
    _lastHash = hash;
    _state.appointments = s.appointments || [];
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
async function removeAppt(id) {
  await fetch("/api/appointments/" + id, { method: "DELETE" });
}
async function savePhoto(name, phone, dataUrl) {
  await fetch("/api/photos", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, phone, dataUrl })
  });
}

// slobodni termini (iz keša)
function freeSlots(dateStr, barberId) {
  const taken = loadAppts().filter(a => a.date === dateStr && a.barberId === barberId).map(a => a.time);
  const out = [];
  for (let h = SALON.hours.open; h < SALON.hours.close; h++)
    for (let m = 0; m < 60; m += SALON.slotMin) {
      const t = String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
      if (!taken.includes(t)) out.push(t);
    }
  return out;
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
