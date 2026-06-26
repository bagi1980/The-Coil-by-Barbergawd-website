// Salon App — backend (čist Node, bez npm zavisnosti)
// REST API + SSE (live push na sve ekrane) + servira statične fajlove. Podaci u data.json.
const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8091;
const ROOT = __dirname;
const DB = path.join(ROOT, "data.json");

function load() { try { return JSON.parse(fs.readFileSync(DB, "utf8")); } catch { return { appointments: [], photos: {} }; } }
function save(d) { fs.writeFileSync(DB, JSON.stringify(d, null, 2)); }
let data = load();

const clients = [];                    // SSE konekcije (TV/booking ekrani)
function broadcast() { clients.forEach(res => { try { res.write("data: update\n\n"); } catch (e) {} }); }
function clientKey(name, phone) { return (name || "").trim().toLowerCase() + "|" + (phone || "").trim(); }

function body(req) {
  return new Promise((resolve) => {
    let b = ""; req.on("data", c => { b += c; if (b.length > 8e6) req.destroy(); });
    req.on("end", () => { try { resolve(JSON.parse(b || "{}")); } catch { resolve({}); } });
  });
}
function json(res, code, obj) { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); }

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".json": "application/json" };

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const p = u.pathname;

  // --- API ---
  if (p === "/api/state" && req.method === "GET") return json(res, 200, data);

  if (p === "/api/stream") {
    res.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive" });
    res.write("retry: 3000\n\n");
    clients.push(res);
    req.on("close", () => { const i = clients.indexOf(res); if (i >= 0) clients.splice(i, 1); });
    return;
  }

  if (p === "/api/appointments" && req.method === "POST") {
    const a = await body(req);
    a.id = "a" + Date.now() + Math.floor(Math.random() * 1000);
    a.createdAt = Date.now(); a.greeted = false;
    data.appointments.push(a); save(data); broadcast();
    return json(res, 200, a);
  }
  if (p.startsWith("/api/appointments/") && req.method === "DELETE") {
    const id = p.split("/").pop();
    data.appointments = data.appointments.filter(x => x.id !== id); save(data); broadcast();
    return json(res, 200, { ok: true });
  }
  if (p === "/api/appointments/greet" && req.method === "POST") {
    const { id } = await body(req);
    data.appointments = data.appointments.map(x => x.id === id ? { ...x, greeted: true } : x);
    save(data); return json(res, 200, { ok: true });
  }
  if (p === "/api/photos" && req.method === "POST") {
    const { name, phone, dataUrl } = await body(req);
    data.photos[clientKey(name, phone)] = dataUrl; save(data); broadcast();
    return json(res, 200, { ok: true });
  }

  if (p === "/api/demo" && req.method === "POST") {
    const t = new Date();
    const today = t.getFullYear() + "-" + String(t.getMonth() + 1).padStart(2, "0") + "-" + String(t.getDate()).padStart(2, "0");
    const at = (min) => { const d = new Date(Date.now() + min * 60000); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
    data = {
      appointments: [
        { id: "d1", date: today, time: at(10), barberId: "b1", serviceId: "s4", name: "James Carter", phone: "3125550141", greeted: false, createdAt: Date.now() },
        { id: "d2", date: today, time: at(70), barberId: "b1", serviceId: "s1", name: "Andre Wilson", phone: "3125550149", greeted: false, createdAt: Date.now() },
        { id: "d3", date: today, time: at(130), barberId: "b1", serviceId: "s2", name: "Devin Brooks", phone: "3125550137", greeted: false, createdAt: Date.now() }
      ],
      photos: {
        "james carter|3125550141": "img/demo-client.png",
        "andre wilson|3125550149": "img/demo-client2.png",
        "devin brooks|3125550137": "img/demo-client3.png"
      }
    };
    save(data); broadcast();
    return json(res, 200, { ok: true });
  }

  // --- statični fajlovi ---
  let file = p === "/" ? "/index.html" : p;
  const fp = path.join(ROOT, path.normalize(file));
  if (!fp.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(fp, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fp)] || "application/octet-stream" });
    res.end(buf);
  });
});

server.listen(PORT, () => console.log("Salon server: http://localhost:" + PORT));
