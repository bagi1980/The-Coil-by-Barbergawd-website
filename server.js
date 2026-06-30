// Salon App — backend. REST API + SSE. Podaci u Upstash Redis (Vercel) ili data.json (lokal).
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
// /tmp je jedino writable mesto na Vercel; bundlovani data.json je readonly seed
const DB = process.env.VERCEL ? "/tmp/data.json" : path.join(ROOT, "data.json");
const SEED = path.join(ROOT, "data.json");

// --- Storage: Redis kad je dostupan, inače fajl ---
// Vercel Upstash integracija pravi KV_REST_API_*; standalone Upstash pravi UPSTASH_REDIS_REST_*
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
let redis = null;
if (REDIS_URL && REDIS_TOKEN) {
  const { Redis } = require("@upstash/redis");
  redis = new Redis({ url: REDIS_URL, token: REDIS_TOKEN });
}

const TODAY = () => {
  const t = new Date();
  return t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
};
function prune(list) { const today = TODAY(); return (list || []).filter(a => a && a.date >= today); }
function pruneBreaks(list) { const today = TODAY(); return (list || []).filter(b => b && b.date >= today); }

// Model: salon:data = { appointments, photoVers{key:ts} } — sitno, podesno za čest polling.
// Svaka slika je u salon:photo:<key>. Lokalno: data.json drži sve.
async function load() {
  if (redis) {
    let d = await redis.get("salon:data") || { appointments: [], photoVers: {} };
    let dirty = false;
    if (d.photos) { // migracija: premesti inline slike u zasebne ključeve
      d.photoVers = d.photoVers || {};
      for (const [k, v] of Object.entries(d.photos)) {
        await redis.set("salon:photo:" + k, v);
        d.photoVers[k] = d.photoVers[k] || 1;
      }
      delete d.photos; dirty = true;
    }
    const before = (d.appointments || []).length;
    d.appointments = prune(d.appointments);
    if (d.appointments.length !== before) dirty = true;
    if (!d.photoVers) { d.photoVers = {}; dirty = true; }
    d.breaks = pruneBreaks(d.breaks);
    if (dirty) await redis.set("salon:data", { appointments: d.appointments, photoVers: d.photoVers, breaks: d.breaks });
    return d;
  }
  let d;
  try { d = JSON.parse(fs.readFileSync(DB, "utf8")); }
  catch { try { d = JSON.parse(fs.readFileSync(SEED, "utf8")); } catch { d = { appointments: [], photos: {} }; } }
  d.appointments = prune(d.appointments);
  d.photos = d.photos || {};
  if (!d.photoVers) { d.photoVers = {}; for (const k of Object.keys(d.photos)) d.photoVers[k] = 1; }
  d.breaks = pruneBreaks(d.breaks);
  return d;
}

async function save(d) {
  if (redis) { await redis.set("salon:data", { appointments: d.appointments || [], photoVers: d.photoVers || {}, breaks: d.breaks || [] }); return; }
  fs.writeFileSync(DB, JSON.stringify({ appointments: d.appointments || [], photos: d.photos || {}, photoVers: d.photoVers || {}, breaks: d.breaks || [] }, null, 2));
}

async function getPhoto(key) {
  if (redis) return (await redis.get("salon:photo:" + key)) || null;
  const d = await load(); return (d.photos || {})[key] || null;
}
function setPhoto(d, key, dataUrl) {
  d.photoVers = d.photoVers || {};
  d.photoVers[key] = Date.now();
  if (redis) return redis.set("salon:photo:" + key, dataUrl);
  d.photos = d.photos || {}; d.photos[key] = dataUrl;
}

const clients = [];
function broadcast() { clients.forEach(res => { try { res.write("data: update\n\n"); } catch {} }); }
function clientKey(name, phone) { return (name || "").trim().toLowerCase() + "|" + (phone || "").trim(); }

function body(req) {
  return new Promise((resolve) => {
    let b = ""; req.on("data", c => { b += c; if (b.length > 8e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
  });
}
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }); res.end(JSON.stringify(obj)); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json" };

async function handler(req, res) {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;

  if (req.method === "OPTIONS") { res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST,DELETE", "Access-Control-Allow-Headers": "Content-Type" }); return res.end(); }

  if (p === "/api/state" && req.method === "GET") { const d = await load(); return json(res, 200, { appointments: d.appointments || [], photoVers: d.photoVers || {}, breaks: d.breaks || [] }); }

  if (p === "/api/breaks" && req.method === "POST") {
    const data = await load();
    const b = await body(req);
    b.id = "br" + Date.now();
    data.breaks = data.breaks || [];
    data.breaks.push(b);
    await save(data); broadcast();
    return json(res, 200, b);
  }

  if (p.startsWith("/api/breaks/") && req.method === "DELETE") {
    const data = await load();
    const id = p.split("/").pop();
    data.breaks = (data.breaks || []).filter(x => x.id !== id);
    await save(data); broadcast();
    return json(res, 200, { ok: true });
  }

  if (p === "/api/photo" && req.method === "GET") return json(res, 200, { dataUrl: await getPhoto(u.searchParams.get("key") || "") });

  if (p === "/api/stream") {
    // SSE ne radi na Vercel serverless — klijent koristi polling
    if (process.env.VERCEL) { res.writeHead(204); return res.end(); }
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "Access-Control-Allow-Origin": "*" });
    res.write("retry: 3000\n\n");
    clients.push(res);
    req.on("close", () => { const i = clients.indexOf(res); if (i >= 0) clients.splice(i, 1); });
    return;
  }

  if (p === "/api/appointments" && req.method === "POST") {
    const data = await load();
    const a = await body(req);
    if (a.date && new Date(a.date + 'T12:00').getDay() === 0)
      return json(res, 400, { error: 'Nedeljom ne radimo.' });
    a.id = "a" + Date.now() + Math.floor(Math.random() * 1000);
    a.createdAt = Date.now(); a.greeted = false;
    data.appointments.push(a); await save(data); broadcast();
    return json(res, 200, a);
  }

  if (p.startsWith("/api/appointments/") && req.method === "DELETE") {
    const data = await load();
    const id = p.split("/").pop();
    data.appointments = data.appointments.filter(x => x.id !== id); await save(data); broadcast();
    return json(res, 200, { ok: true });
  }

  if (p === "/api/appointments/greet" && req.method === "POST") {
    const data = await load();
    const { id } = await body(req);
    data.appointments = data.appointments.map(x => x.id === id ? { ...x, greeted: true } : x);
    await save(data); broadcast();
    return json(res, 200, { ok: true });
  }

  if (p === "/api/photos" && req.method === "POST") {
    const data = await load();
    const { name, phone, dataUrl } = await body(req);
    await setPhoto(data, clientKey(name, phone), dataUrl); await save(data); broadcast();
    return json(res, 200, { ok: true });
  }

  if (p === "/api/demo" && req.method === "POST") {
    const t = new Date();
    const today = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
    const at = (min) => { const d = new Date(Date.now() + min * 60000); d.setMinutes(Math.round(d.getMinutes() / 30) * 30, 0, 0); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
    const data = {
      appointments: [
        { id: "d1", date: today, time: at(10), barberId: "b1", serviceId: "s4", name: "James Carter", phone: "3125550141", greeted: false, createdAt: Date.now() },
        { id: "d2", date: today, time: at(70), barberId: "b1", serviceId: "s1", name: "Andre Wilson", phone: "3125550149", greeted: false, createdAt: Date.now() },
        { id: "d3", date: today, time: at(130), barberId: "b1", serviceId: "s2", name: "Devin Brooks", phone: "3125550137", greeted: false, createdAt: Date.now() }
      ],
      photoVers: {}, photos: {}
    };
    const demoPhotos = {
      "james carter|3125550141": "img/demo-client.png",
      "andre wilson|3125550149": "img/demo-client2.png",
      "devin brooks|3125550137": "img/demo-client3.png"
    };
    for (const [k, v] of Object.entries(demoPhotos)) await setPhoto(data, k, v);
    await save(data); broadcast();
    return json(res, 200, { ok: true });
  }

  // statični fajlovi
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

// lokalni server
if (!process.env.VERCEL) {
  const http = require("http");
  const PORT = process.env.PORT || 8091;
  http.createServer(handler).listen(PORT, () => console.log("Salon server: http://localhost:" + PORT));
}
