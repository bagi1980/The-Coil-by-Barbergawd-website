// The Coil — configuration (client + display).  *** PLACEHOLDER brand — confirm real assets ***
const SALON = {
  name: "THE COIL",
  city: "Chicago",
  address: "South Loop",
  hours: { open: 10, close: 20 },
  slotMin: 30,
  // Salon music — replace with The Coil's own YouTube playlist/channel
  youtube: "https://www.youtube.com/embed/videoseries?list=PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo"
};

// Services — placeholder pricing (confirm exact from booking page)
const SERVICES = [
  { id: "s1", name: "Haircut", price: 45, min: 45 },
  { id: "s2", name: "Haircut + Beard", price: 65, min: 60 },
  { id: "s3", name: "Beard Trim", price: 30, min: 30 },
  { id: "s4", name: "Skin Fade", price: 55, min: 45 },
  { id: "s5", name: "Hair Unit Service", price: 250, min: 120 }
];

// Solo master barber (private suite, South Loop)
const BARBERS = [
  { id: "b1", name: "Tony" }
];

function todayStr(d = new Date()) {
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
function serviceById(id) { return SERVICES.find(s => s.id === id); }
function barberById(id) { return BARBERS.find(b => b.id === id); }
function clientKey(name, phone) { return (name || "").trim().toLowerCase() + "|" + (phone || "").trim(); }
