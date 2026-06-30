// Salon App — backend. REST API + SSE.
// Storage prioritet: Supabase (produkcija) → data.json (lokal)
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const DB = process.env.VERCEL ? "/tmp/data.json" : path.join(ROOT, "data.json");
const SEED = path.join(ROOT, "data.json");

// --- Supabase klijent ---
let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  const { createClient } = require("@supabase/supabase-js");
  supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
}

const TODAY = () => {
  const t = new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
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
  (phVers || []).forEach(r => { photoVers[r.client_key] = r.version; });
  return {
    appointments: (appts || []).map(apptFromRow),
    breaks: (brs || []).map(breakFromRow),
    photoVers,
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

// --- Supabase: photos ---
async function sbGetPhoto(key) {
  const { data } = await supabase.from("photos").select("data_url").eq("client_key", key).single();
  return data ? data.data_url : null;
}

async function sbSetPhoto(key, dataUrl) {
  await supabase.from("photos").upsert({ client_key: key, data_url: dataUrl, version: Date.now() });
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
  if (!d.photoVers) { d.photoVers = {}; for (const k of Object.keys(d.photos)) d.photoVers[k] = 1; }
  return d;
}
function fileSave(d) {
  fs.writeFileSync(DB, JSON.stringify({ appointments: d.appointments || [], photos: d.photos || {},
    photoVers: d.photoVers || {}, breaks: d.breaks || [] }, null, 2));
}
function clientKey(name, phone) { return (name || "").trim().toLowerCase() + "|" + (phone || "").trim(); }

// --- SSE ---
const clients = [];
function broadcast() { clients.forEach(res => { try { res.write("data: update\n\n"); } catch {} }); }

function body(req) {
  return new Promise(resolve => {
    let b = ""; req.on("data", c => { b += c; if (b.length > 8e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
  });
}
function json(res, code, obj) {
  res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(obj));
}

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml",
  ".ico": "image/x-icon", ".json": "application/json" };

async function handler(req, res) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;

  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,DELETE", "Access-Control-Allow-Headers": "Content-Type" });
    return res.end();
  }

  // ── /api/state ──
  if (p === "/api/state" && req.method === "GET") {
    if (supabase) {
      const d = await sbLoad();
      return json(res, 200, d);
    }
    const d = fileLoad();
    return json(res, 200, { appointments: d.appointments, photoVers: d.photoVers, breaks: d.breaks });
  }

  // ── /api/appointments POST ──
  if (p === "/api/appointments" && req.method === "POST") {
    const a = await body(req);
    if (a.date && new Date(a.date + "T12:00").getDay() === 0)
      return json(res, 400, { error: "Nedeljom ne radimo." });
    a.id = "a" + Date.now() + Math.floor(Math.random() * 1000);
    a.createdAt = Date.now(); a.greeted = false;
    console.log("supabase active:", !!supabase, "SUPABASE_URL:", !!process.env.SUPABASE_URL);
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
    const id = p.split("/").pop();
    if (supabase) { await sbRemoveAppt(id); broadcast(); return json(res, 200, { ok: true }); }
    const d = fileLoad(); d.appointments = d.appointments.filter(x => x.id !== id);
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
    const b = await body(req);
    b.id = "br" + Date.now();
    if (supabase) { const saved = await sbAddBreak(b); broadcast(); return json(res, 200, saved); }
    const d = fileLoad(); d.breaks = d.breaks || []; d.breaks.push(b);
    fileSave(d); broadcast(); return json(res, 200, b);
  }

  // ── /api/breaks/:id DELETE ──
  if (p.startsWith("/api/breaks/") && req.method === "DELETE") {
    const id = p.split("/").pop();
    if (supabase) { await sbRemoveBreak(id); broadcast(); return json(res, 200, { ok: true }); }
    const d = fileLoad(); d.breaks = (d.breaks || []).filter(x => x.id !== id);
    fileSave(d); broadcast(); return json(res, 200, { ok: true });
  }

  // ── /api/photo GET ──
  if (p === "/api/photo" && req.method === "GET") {
    const key = u.searchParams.get("key") || "";
    if (supabase) return json(res, 200, { dataUrl: await sbGetPhoto(key) });
    const d = fileLoad(); return json(res, 200, { dataUrl: (d.photos || {})[key] || null });
  }

  // ── /api/photos POST ──
  if (p === "/api/photos" && req.method === "POST") {
    const { name, phone, dataUrl } = await body(req);
    const key = clientKey(name, phone);
    if (supabase) { await sbSetPhoto(key, dataUrl); broadcast(); return json(res, 200, { ok: true }); }
    const d = fileLoad();
    d.photos = d.photos || {}; d.photos[key] = dataUrl;
    d.photoVers = d.photoVers || {}; d.photoVers[key] = Date.now();
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
      "james carter|3125550141": "img/demo-client.png",
      "andre wilson|3125550149": "img/demo-client2.png",
      "devin brooks|3125550137": "img/demo-client3.png",
    };
    if (supabase) {
      await sbLoadDemo(appointments, photos);
      broadcast(); return json(res, 200, { ok: true });
    }
    const d = { appointments, photos, photoVers: {}, breaks: [] };
    for (const [k] of Object.entries(photos)) d.photoVers[k] = Date.now();
    fileSave(d); broadcast(); return json(res, 200, { ok: true });
  }

  // ── statični fajlovi ──
  let file = p === "/" ? "/index.html" : p;
  const fp = path.join(ROOT, path.normalize(file));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
    res.end(buf);
  });
}

module.exports = handler;

if (!process.env.VERCEL) {
  const http = require("http");
  const PORT = process.env.PORT || 8091;
  http.createServer(handler).listen(PORT, () => console.log("Salon server: http://localhost:" + PORT));
}
