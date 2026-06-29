// Barbershop App — konfiguracija (klijent + prikaz)
const SALON = {
  name: "BARBERSHOP",
  tagline: "Classic Cuts · Hot Towel · Beard",
  established: "EST. 2024",
  hours: { open: 9, close: 21 },
  slotMin: 30,
  // Muzika salona — zameni svojom YouTube plejlistom/kanalom. (na klik se pušta sa zvukom)
  youtube: "https://www.youtube.com/embed/videoseries?list=PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo"
};

const SERVICES = [
  { id: "s1", name: "Šišanje", price: 800, min: 30 },
  { id: "s2", name: "Šišanje + brada", price: 1100, min: 45 },
  { id: "s3", name: "Brada", price: 500, min: 30 },
  { id: "s4", name: "Fade / fazoniranje", price: 1000, min: 45 },
  { id: "s5", name: "Klinac (do 12 god.)", price: 600, min: 30 }
];

const BARBERS = [
  { id: "b1", name: "Marko" },
  { id: "b2", name: "Stefan" },
  { id: "b3", name: "Nikola" }
];

function todayStr(d = new Date()) {
  // lokalni datum (ne UTC) da se ne pomeri dan
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function serviceById(id) { return SERVICES.find(s => s.id === id); }
function barberById(id) { return BARBERS.find(b => b.id === id); }
function clientKey(name, phone) { return (name || "").trim().toLowerCase() + "|" + (phone || "").trim(); }
