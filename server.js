// Salon App — backend. REST API + SSE.
// Storage prioritet: Supabase (produkcija) → data.json (lokal)
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = __dirname;
const DB = process.env.VERCEL ? "/tmp/data.json" : path.join(ROOT, "data.json");
const SEED = path.join(ROOT, "data.json");

// --- Supabase klijent ---
let supabase = null;
// --- Admin auth ---
// U produkciji (Vercel) bez env vara admin je zaključan — nema podrazumevane lozinke.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.VERCEL ? null : "1234");
if (!process.env.ADMIN_PASSWORD)
  console.warn("UPOZORENJE: ADMIN_PASSWORD nije postavljen" + (process.env.VERCEL ? " — admin funkcije su onemogućene!" : " — lokalno se koristi '1234'."));
function safeEq(a, b) {
  const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

// Lozinka koju vlasnik postavi iz admin panela čuva se kao scrypt hash ("salt:hash")
// u settings tabeli (Supabase) / data.json (lokal). Env ADMIN_PASSWORD je samo početna.
function hashPass(pass) {
  const salt = crypto.randomBytes(16).toString("hex");
  return salt + ":" + crypto.scryptSync(String(pass), salt, 32).toString("hex");
}
function checkPass(pass, stored) {
  const [salt, hash] = String(stored).split(":");
  if (!salt || !hash) return false;
  return safeEq(crypto.scryptSync(String(pass), salt, 32).toString("hex"), hash);
}
let _passCache = { v: null, t: 0 };
async function storedPassHash() {
  if (Date.now() - _passCache.t < 60000) return _passCache.v;
  let v = null;
  try {
    if (supabase) {
      const { data } = await supabase.from("settings").select("value").eq("key", "admin_pass").maybeSingle();
      v = data ? data.value : null;
    } else {
      v = (fileLoad().settings || {}).admin_pass || null;
    }
  } catch (e) { v = null; }
  _passCache = { v, t: Date.now() };
  return v;
}
async function verifyPass(pass) {
  const stored = await storedPassHash();
  if (stored) return checkPass(pass, stored);
  return !!ADMIN_PASSWORD && safeEq(pass, ADMIN_PASSWORD);
}
function isAdmin(req) { return verifyPass(req.headers["x-admin-pass"] || ""); } // → Promise<boolean>

// Javni photo ključ — hash od "ime|telefon" da se telefoni ne otkrivaju javnom API-ju
function pkey(k) { return crypto.createHash("sha256").update("pk1:" + k).digest("hex").slice(0, 20); }

// Validacija unosa pri zakazivanju (štiti od XSS payload-a i đubreta u bazi)
function cleanStr(s, max) { return String(s == null ? "" : s).replace(/[\x00-\x1f<>&"'`]/g, "").trim().slice(0, max); }
function validateAppt(a) {
  if (!a.name) return "Ime je obavezno.";
  if (!a.phone) return "Telefon je obavezan.";
  if (a.phone !== "walk-in" && !/^[\d+\-/() .]{3,30}$/.test(a.phone)) return "Neispravan broj telefona."; // "walk-in" šalje TV
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a.date || "")) return "Neispravan datum.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(a.time || "")) return "Neispravno vreme.";
  if (!/^b\d{1,3}$/.test(a.barberId || "")) return "Neispravan frizer.";
  if (a.serviceId && !/^s\d{1,3}$/.test(a.serviceId)) return "Neispravna usluga.";
  return null;
}
function toMins(t) { const [h, m] = String(t || "0:0").split(":").map(Number); return h * 60 + m; }

// Koliko dana se čuvaju prošli termini pre automatskog brisanja (GDPR — ograničeno čuvanje)
const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS, 10) || 90;

const supaKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
const supaUrl = (process.env.SUPABASE_URL || "").trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
if (supaUrl && supaKey) {
  try {
    const { createClient } = require("@supabase/supabase-js");
    supabase = createClient(supaUrl, supaKey);
  } catch(e) {
    console.error("Supabase init error:", e.message);
  }
}

const TODAY = () => {
  const t = new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
};

// Datum pre RETENTION_DAYS dana (YYYY-MM-DD) — sve starije od ovoga se briše
const CUTOFF_DATE = () => {
  const d = new Date(Date.now() - RETENTION_DAYS * 864e5);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
};

// --- Supabase helpers: konverzija snake_case ↔ camelCase ---
function apptFromRow(r) {
  return { id: r.id, date: r.date, time: r.time, barberId: r.barber_id, serviceId: r.service_id,
    name: r.name, phone: r.phone, greeted: r.greeted, createdAt: r.created_at };
}
function apptToRow(a) {
  return { id: a.id, date: a.date, time: a.time, barber_id: a.barberId, service_id: a.serviceId || null,
    name: a.name, phone: a.phone, greeted: a.greeted || false, created_at: a.createdAt };
}
function breakFromRow(r) {
  return { id: r.id, barberId: r.barber_id, date: r.date, startTime: r.start_time, endTime: r.end_time };
}
function breakToRow(b) {
  return { id: b.id, barber_id: b.barberId, date: b.date, start_time: b.startTime, end_time: b.endTime };
}

// --- Supabase: load ---
async function sbLoad() {
  const today = TODAY();
  const [{ data: appts }, { data: brs }] = await Promise.all([
    supabase.from("appointments").select("*").gte("date", today),
    supabase.from("breaks").select("*").gte("date", today),
  ]);
  const { data: phVers } = await supabase.from("photos").select("client_key, version");
  const photoVers = {};
  (phVers || []).forEach(r => { photoVers[pkey(r.client_key)] = r.version; });
  return {
    appointments: (appts || []).map(apptFromRow),
    breaks: (brs || []).map(breakFromRow),
    photoVers,
  };
}

// Javni oblik state odgovora: photoKey umesto telefona; telefon samo za admina
function publicState(d, admin) {
  return {
    appointments: (d.appointments || []).map(a => {
      const out = { id: a.id, date: a.date, time: a.time, barberId: a.barberId, serviceId: a.serviceId,
        name: a.name, greeted: a.greeted, photoKey: pkey(clientKey(a.name, a.phone)) };
      if (admin) out.phone = a.phone;
      return out;
    }),
    breaks: d.breaks || [],
    photoVers: d.photoVers || {},
  };
}

// --- Supabase: upsert appointment ---
async function sbAddAppt(a) {
  const { data, error } = await supabase.from("appointments").insert(apptToRow(a)).select().single();
  if (error) throw error;
  return apptFromRow(data);
}

async function sbRemoveAppt(id) {
  await supabase.from("appointments").delete().eq("id", id);
}

async function sbGreetAppt(id) {
  await supabase.from("appointments").update({ greeted: true }).eq("id", id);
}

// --- Supabase: breaks ---
async function sbAddBreak(b) {
  const { data, error } = await supabase.from("breaks").insert(breakToRow(b)).select().single();
  if (error) throw error;
  return breakFromRow(data);
}

async function sbRemoveBreak(id) {
  await supabase.from("breaks").delete().eq("id", id);
}

// --- Supabase: photos (javni ključ = hash, razrešava se u client_key) ---
async function sbGetPhoto(hashKey) {
  const { data: keys } = await supabase.from("photos").select("client_key");
  const row = (keys || []).find(r => pkey(r.client_key) === hashKey);
  if (!row) return null;
  const { data } = await supabase.from("photos").select("data_url").eq("client_key", row.client_key).single();
  return data ? data.data_url : null;
}

// --- Provera zauzetosti slota (server-side, sprečava duplo zakazivanje) ---
async function slotTaken(a) {
  let appts, breaks;
  if (supabase) {
    const [{ data: ex }, { data: brs }] = await Promise.all([
      supabase.from("appointments").select("id").eq("date", a.date).eq("barber_id", a.barberId).eq("time", a.time).limit(1),
      supabase.from("breaks").select("*").eq("date", a.date).eq("barber_id", a.barberId),
    ]);
    if (ex && ex.length) return true;
    breaks = (brs || []).map(breakFromRow);
  } else {
    const d = fileLoad();
    if ((d.appointments || []).some(x => x.date === a.date && x.barberId === a.barberId && x.time === a.time)) return true;
    breaks = (d.breaks || []).filter(b => b.date === a.date && b.barberId === a.barberId);
  }
  const t = toMins(a.time);
  return breaks.some(b => t >= toMins(b.startTime) && t < toMins(b.endTime));
}

async function sbSetPhoto(key, dataUrl, consent) {
  const row = { client_key: key, data_url: dataUrl, version: Date.now() };
  if (consent !== undefined) { row.consent = !!consent; row.consent_date = consent ? Date.now() : null; }
  await supabase.from("photos").upsert(row);
}

// --- Supabase: demo reset ---
async function sbLoadDemo(appointments, photos) {
  await supabase.from("appointments").delete().neq("id", "");
  await supabase.from("breaks").delete().neq("id", "");
  await supabase.from("appointments").insert(appointments.map(apptToRow));
  for (const [key, dataUrl] of Object.entries(photos)) {
    await sbSetPhoto(key, dataUrl);
  }
}

// --- File storage (lokal) ---
function fileLoad() {
  let d;
  try { d = JSON.parse(fs.readFileSync(DB, "utf8")); }
  catch { try { d = JSON.parse(fs.readFileSync(SEED, "utf8")); } catch { d = { appointments: [], photos: {} }; } }
  const today = TODAY();
  d.appointments = (d.appointments || []).filter(a => a && a.date >= today);
  d.breaks = (d.breaks || []).filter(b => b && b.date >= today);
  d.photos = d.photos || {};
  d.consents = d.consents || {};
  d.settings = d.settings || {};
  if (!d.photoVers) { d.photoVers = {}; for (const k of Object.keys(d.photos)) d.photoVers[k] = 1; }
  return d;
}
function fileSave(d) {
  fs.writeFileSync(DB, JSON.stringify({ appointments: d.appointments || [], photos: d.photos || {},
    photoVers: d.photoVers || {}, breaks: d.breaks || [], consents: d.consents || {}, settings: d.settings || {} }, null, 2));
}
function clientKey(name, phone) { return (name || "").trim().toLowerCase() + "|" + (phone || "").trim(); }

// --- SSE ---
const clients = [];
const loginFails = new Map(); // ip → { n, t } za rate limit logina/promene lozinke
function loginRec(req) {
  const ip = String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  const rec = loginFails.get(ip) || { n: 0, t: Date.now() };
  if (Date.now() - rec.t > 600000) { rec.n = 0; rec.t = Date.now(); }
  loginFails.set(ip, rec);
  return rec;
}
function broadcast() { clients.forEach(res => { try { res.write("data: update\n\n"); } catch {} }); }

function body(req) {
  return new Promise(resolve => {
    let b = ""; req.on("data", c => { b += c; if (b.length > 8e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
  });
}
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
  ".svg": "image/svg+xml", ".ico": "image/x-icon" };

async function handler(req, res) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;

  // Aplikacija je same-origin — bez CORS header-a (drugi sajtovi ne mogu da čitaju API)
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  // ── /api/state ──
  // ── /api/cleanup (Vercel Cron — briše stare termine; GDPR ograničeno čuvanje) ──
  if (p === "/api/cleanup" && (req.method === "GET" || req.method === "POST")) {
    const auth = req.headers["authorization"] || "";
    const cronOk = process.env.CRON_SECRET && auth === "Bearer " + process.env.CRON_SECRET;
    if (!cronOk && !(await isAdmin(req))) return json(res, 401, { error: "Neautorizovano" });
    const cutoff = CUTOFF_DATE();
    let removed = 0;
    if (supabase) {
      const a = await supabase.from("appointments").delete().lt("date", cutoff).select("id");
      await supabase.from("breaks").delete().lt("date", cutoff);
      removed = a.data ? a.data.length : 0;
    } else {
      const d = fileLoad();
      const before = d.appointments.length;
      d.appointments = d.appointments.filter(x => x.date >= cutoff);
      d.breaks = (d.breaks || []).filter(x => x.date >= cutoff);
      removed = before - d.appointments.length;
      fileSave(d);
    }
    broadcast();
    return json(res, 200, { ok: true, cutoff, removed, retentionDays: RETENTION_DAYS });
  }

  // ── /api/admin-login POST (rate limit protiv pogađanja lozinke) ──
  if (p === "/api/admin-login" && req.method === "POST") {
    if (!ADMIN_PASSWORD && !(await storedPassHash()))
      return json(res, 503, { ok: false, error: "Admin nije konfigurisan." });
    const rec = loginRec(req);
    if (rec.n >= 10) return json(res, 429, { ok: false, error: "Previše pokušaja. Sačekaj 10 minuta." });
    const { password } = await body(req);
    const ok = await verifyPass(password || "");
    if (!ok) rec.n++;
    return json(res, ok ? 200 : 401, { ok });
  }

  // ── /api/admin-password POST (vlasnik menja lozinku iz admin panela) ──
  if (p === "/api/admin-password" && req.method === "POST") {
    const rec = loginRec(req);
    if (rec.n >= 10) return json(res, 429, { error: "Previše pokušaja. Sačekaj 10 minuta." });
    const { oldPassword, newPassword } = await body(req);
    if (!(await verifyPass(oldPassword || ""))) {
      rec.n++;
      return json(res, 401, { error: "Pogrešna trenutna lozinka." });
    }
    const np = String(newPassword || "");
    if (np.length < 8) return json(res, 400, { error: "Nova lozinka mora imati bar 8 karaktera." });
    if (np.length > 100) return json(res, 400, { error: "Nova lozinka je predugačka (max 100)." });
    const hash = hashPass(np);
    if (supabase) {
      const { error } = await supabase.from("settings").upsert({ key: "admin_pass", value: hash });
      if (error) return json(res, 500, { error: "Baza: " + error.message + " (proveri da tabela 'settings' postoji — supabase-schema.sql)" });
    } else {
      const d = fileLoad(); d.settings = d.settings || {}; d.settings.admin_pass = hash; fileSave(d);
    }
    _passCache = { v: hash, t: Date.now() };
    return json(res, 200, { ok: true });
  }

  // ── /api/state (javno: bez telefona; admin sa x-admin-pass dobija i telefone) ──
  if (p === "/api/state" && req.method === "GET") {
    const admin = await isAdmin(req);
    if (supabase) {
      const d = await sbLoad();
      return json(res, 200, publicState(d, admin));
    }
    const d = fileLoad();
    const pv = {}; // fajl-storage drži sirove ključeve (ime|telefon) — hashuj pre slanja
    for (const k of Object.keys(d.photoVers || {})) pv[pkey(k)] = d.photoVers[k];
    return json(res, 200, publicState({ ...d, photoVers: pv }, admin));
  }

  // ── /api/appointments POST ──
  if (p === "/api/appointments" && req.method === "POST") {
    const raw = await body(req);
    // samo poznata polja — ništa drugo ne ulazi u bazu
    const a = { date: raw.date, time: raw.time, barberId: raw.barberId, serviceId: raw.serviceId || null,
      name: cleanStr(raw.name, 60), phone: cleanStr(raw.phone, 30) };
    const err = validateAppt(a);
    if (err) return json(res, 400, { error: err });
    if (new Date(a.date + "T12:00").getDay() === 0)
      return json(res, 400, { error: "Nedeljom ne radimo." });
    if (await slotTaken(a))
      return json(res, 409, { error: "Termin je upravo zauzet — izaberi drugi." });
    a.id = "a" + Date.now() + Math.floor(Math.random() * 1000);
    a.createdAt = Date.now(); a.greeted = false;
    if (supabase) {
      try {
        const saved = await sbAddAppt(a);
        broadcast();
        return json(res, 200, saved);
      } catch(e) {
        console.error("Supabase error:", e.message, e);
        return json(res, 500, { error: e.message });
      }
    }
    const d = fileLoad(); d.appointments.push(a); fileSave(d); broadcast();
    return json(res, 200, a);
  }

  // ── /api/appointments/:id DELETE ──
  if (p.startsWith("/api/appointments/") && req.method === "DELETE") {
    if (!(await isAdmin(req))) return json(res, 401, { error: "Neautorizovano" });
    const id = p.split("/").pop();
    if (supabase) { await sbRemoveAppt(id); broadcast(); return json(res, 200, { ok: true }); }
    const d = fileLoad(); d.appointments = d.appointments.filter(x => x.id !== id);
    fileSave(d); broadcast(); return json(res, 200, { ok: true });
  }

  // ── /api/client DELETE (GDPR pravo na zaborav) ──
  if (p === "/api/client" && req.method === "DELETE") {
    if (!(await isAdmin(req))) return json(res, 401, { error: "Neautorizovano" });
    const { name, phone } = await body(req);
    if (!phone || !phone.trim()) return json(res, 400, { error: "Telefon je obavezan." });
    const ph = phone.trim();
    const key = clientKey(name, phone);
    if (supabase) {
      await supabase.from("appointments").delete().eq("phone", ph);
      await supabase.from("photos").delete().like("client_key", "%|" + ph);
      broadcast(); return json(res, 200, { ok: true });
    }
    const d = fileLoad();
    d.appointments = (d.appointments || []).filter(a => (a.phone || "").trim() !== ph);
    for (const k of Object.keys(d.photos || {})) if (k.endsWith("|" + ph)) { delete d.photos[k]; if (d.photoVers) delete d.photoVers[k]; if (d.consents) delete d.consents[k]; }
    if (d.photos && d.photos[key]) { delete d.photos[key]; if (d.photoVers) delete d.photoVers[key]; if (d.consents) delete d.consents[key]; }
    fileSave(d); broadcast(); return json(res, 200, { ok: true });
  }

  // ── /api/appointments/greet POST ──
  if (p === "/api/appointments/greet" && req.method === "POST") {
    const { id } = await body(req);
    if (supabase) { await sbGreetAppt(id); broadcast(); return json(res, 200, { ok: true }); }
    const d = fileLoad();
    d.appointments = d.appointments.map(x => x.id === id ? { ...x, greeted: true } : x);
    fileSave(d); broadcast(); return json(res, 200, { ok: true });
  }

  // ── /api/breaks POST ──
  if (p === "/api/breaks" && req.method === "POST") {
    if (!(await isAdmin(req))) return json(res, 401, { error: "Neautorizovano" });
    const raw = await body(req);
    const b = { barberId: raw.barberId, date: raw.date, startTime: raw.startTime, endTime: raw.endTime };
    if (!/^b\d{1,3}$/.test(b.barberId || "") || !/^\d{4}-\d{2}-\d{2}$/.test(b.date || "")
      || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.startTime || "") || !/^([01]\d|2[0-3]):[0-5]\d$/.test(b.endTime || ""))
      return json(res, 400, { error: "Neispravna pauza." });
    b.id = "br" + Date.now();
    if (supabase) { const saved = await sbAddBreak(b); broadcast(); return json(res, 200, saved); }
    const d = fileLoad(); d.breaks = d.breaks || []; d.breaks.push(b);
    fileSave(d); broadcast(); return json(res, 200, b);
  }

  // ── /api/breaks/:id DELETE ──
  if (p.startsWith("/api/breaks/") && req.method === "DELETE") {
    if (!(await isAdmin(req))) return json(res, 401, { error: "Neautorizovano" });
    const id = p.split("/").pop();
    if (supabase) { await sbRemoveBreak(id); broadcast(); return json(res, 200, { ok: true }); }
    const d = fileLoad(); d.breaks = (d.breaks || []).filter(x => x.id !== id);
    fileSave(d); broadcast(); return json(res, 200, { ok: true });
  }

  // ── /api/photo GET (ključ = hash, ne otkriva ime|telefon) ──
  if (p === "/api/photo" && req.method === "GET") {
    const key = u.searchParams.get("key") || "";
    if (supabase) return json(res, 200, { dataUrl: await sbGetPhoto(key) });
    const d = fileLoad();
    const raw = Object.keys(d.photos || {}).find(k => pkey(k) === key);
    return json(res, 200, { dataUrl: raw ? d.photos[raw] : null });
  }

  // ── /api/photos POST ──
  if (p === "/api/photos" && req.method === "POST") {
    if (!(await isAdmin(req))) return json(res, 401, { error: "Neautorizovano" });
    const { name, phone, dataUrl, consent } = await body(req);
    if (!consent) return json(res, 400, { error: "Nedostaje saglasnost klijenta za čuvanje fotografije." });
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/") || dataUrl.length > 2e6)
      return json(res, 400, { error: "Neispravna ili prevelika slika (max ~1.5MB)." });
    const key = clientKey(name, phone);
    if (supabase) { await sbSetPhoto(key, dataUrl, consent); broadcast(); return json(res, 200, { ok: true }); }
    const d = fileLoad();
    d.photos = d.photos || {}; d.photos[key] = dataUrl;
    d.photoVers = d.photoVers || {}; d.photoVers[key] = Date.now();
    d.consents = d.consents || {}; d.consents[key] = { consent: true, date: Date.now() };
    fileSave(d); broadcast(); return json(res, 200, { ok: true });
  }

  // ── /api/stream SSE ──
  if (p === "/api/stream") {
    if (process.env.VERCEL) { res.writeHead(204); return res.end(); }
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache",
      "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write("retry: 3000\n\n");
    clients.push(res);
    req.on("close", () => { const i = clients.indexOf(res); if (i >= 0) clients.splice(i, 1); });
    return;
  }

  // ── /api/demo POST ──
  if (p === "/api/demo" && req.method === "POST") {
    if (!(await isAdmin(req))) return json(res, 401, { error: "Neautorizovano" });
    const today = TODAY();
    const at = min => {
      const d = new Date(Date.now() + min * 60000);
      d.setMinutes(Math.round(d.getMinutes() / 30) * 30, 0, 0);
      return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
    };
    const appointments = [
      { id: "d1", date: today, time: at(10), barberId: "b1", serviceId: "s4", name: "James Carter", phone: "3125550141", greeted: false, createdAt: Date.now() },
      { id: "d2", date: today, time: at(70), barberId: "b1", serviceId: "s1", name: "Andre Wilson", phone: "3125550149", greeted: false, createdAt: Date.now() },
      { id: "d3", date: today, time: at(130), barberId: "b1", serviceId: "s2", name: "Devin Brooks", phone: "3125550137", greeted: false, createdAt: Date.now() },
    ];
    const photos = {
      "james carter|3125550141": "img/demo-client.jpg",
      "andre wilson|3125550149": "img/demo-client2.jpg",
      "devin brooks|3125550137": "img/demo-client3.jpg",
    };
    if (supabase) {
      await sbLoadDemo(appointments, photos);
      broadcast(); return json(res, 200, { ok: true });
    }
    // demo resetuje termine/fotke, ali čuva settings (npr. promenjenu admin lozinku)
    const d = { appointments, photos, photoVers: {}, breaks: [], settings: fileLoad().settings };
    for (const [k] of Object.entries(photos)) d.photoVers[k] = Date.now();
    fileSave(d); broadcast(); return json(res, 200, { ok: true });
  }

  // ── statični fajlovi (whitelist ekstenzija; bez data.json, server koda, dot-fajlova) ──
  const STATIC_EXT = new Set([".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".webp", ".svg", ".ico"]);
  const STATIC_DENY = new Set(["server.js", "make-doc.js"]);
  let file = p === "/" ? "/index.html" : p;
  const fp = path.join(ROOT, path.normalize(file));
  const rel = path.relative(ROOT, fp);
  const ext = path.extname(fp).toLowerCase();
  if (!fp.startsWith(ROOT + path.sep) || !STATIC_EXT.has(ext) || STATIC_DENY.has(rel)
    || rel.split(path.sep).some(s => s.startsWith(".") || s === "node_modules")) {
    res.writeHead(404); return res.end("not found");
  }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    const cache = ext === ".html" ? "no-cache"
      : (ext === ".css" || ext === ".js") ? "public, max-age=300"
      : "public, max-age=86400";
    res.writeHead(200, { "Content-Type": TYPES[ext] || "application/octet-stream", "Cache-Control": cache });
    res.end(buf);
  });
}

module.exports = handler;

if (!process.env.VERCEL) {
  const http = require("http");
  const PORT = process.env.PORT || 8091;
  http.createServer(handler).listen(PORT, () => console.log("Salon server: http://localhost:" + PORT));
}
