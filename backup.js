// backup.js — nedeljni backup SVIH klijenata jednom komandom.
//
//   node backup.js                                  → backups/<klijent>/<datum>.json za svakog
//   node backup.js --restore backups/prestige/2026-07-11.json
//                                                   → vraća podatke u bazu tog klijenta (upsert)
//
// Klijenti se čitaju iz backup-config.json (NIJE u git-u — sadrži ključeve):
// [
//   { "name": "prestige", "url": "https://xxx.supabase.co", "serviceKey": "eyJ..." }
// ]
//
// PAŽNJA: backup fajlovi sadrže lične podatke (imena, telefoni, slike).
// Ostaju samo lokalno + šifrovana kopija. Nikad u git, mejl ili deljeni folder.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const TABLES = ["appointments", "breaks", "photos", "settings"];
const CONFIG_PATH = path.join(__dirname, "backup-config.json");

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("Nema backup-config.json — napravi ga po šablonu iz zaglavlja backup.js");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

// Povuci celu tabelu u komadima od 1000 (Supabase limit po upitu)
async function fetchAll(supabase, table) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...data);
    if (data.length < 1000) break;
  }
  return rows;
}

async function backupClient(client) {
  const supabase = createClient(client.url, client.serviceKey);
  const dump = { client: client.name, createdAt: new Date().toISOString(), tables: {} };
  for (const t of TABLES) dump.tables[t] = await fetchAll(supabase, t);

  const dir = path.join(__dirname, "backups", client.name);
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, new Date().toISOString().slice(0, 10) + ".json");
  fs.writeFileSync(file, JSON.stringify(dump));

  const counts = TABLES.map((t) => `${t}:${dump.tables[t].length}`).join(" ");
  console.log(`✓ ${client.name} → ${path.relative(__dirname, file)} (${counts})`);
}

async function restore(file) {
  const dump = JSON.parse(fs.readFileSync(file, "utf8"));
  const client = loadConfig().find((c) => c.name === dump.client);
  if (!client) {
    console.error(`Klijent "${dump.client}" nije u backup-config.json — dodaj ga (može i nova baza, samo pokreni supabase-schema.sql u njoj).`);
    process.exit(1);
  }
  const supabase = createClient(client.url, client.serviceKey);
  for (const t of TABLES) {
    const rows = dump.tables[t] || [];
    if (!rows.length) { console.log(`- ${t}: prazno, preskačem`); continue; }
    // upsert u komadima od 500 — ne briše postojeće redove, samo dopunjuje/prepisuje po ključu
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await supabase.from(t).upsert(rows.slice(i, i + 500));
      if (error) throw new Error(`${t}: ${error.message}`);
    }
    console.log(`✓ ${t}: vraćeno ${rows.length} redova`);
  }
  console.log(`Gotovo — ${dump.client} vraćen iz ${path.basename(file)} (backup od ${dump.createdAt}).`);
}

(async () => {
  try {
    const ri = process.argv.indexOf("--restore");
    if (ri !== -1) {
      const file = process.argv[ri + 1];
      if (!file) { console.error("Upotreba: node backup.js --restore <fajl.json>"); process.exit(1); }
      await restore(file);
    } else {
      const clients = loadConfig();
      let failed = 0;
      for (const c of clients) {
        try { await backupClient(c); }
        catch (e) { failed++; console.error(`✗ ${c.name}: ${e.message}`); }
      }
      console.log(`\n${clients.length - failed}/${clients.length} klijenata sačuvano.`);
      if (failed) process.exit(1);
    }
  } catch (e) {
    console.error("Greška:", e.message);
    process.exit(1);
  }
})();
