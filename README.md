# Salon App — POC (The Prestige, Niš)

Proof of concept: lokalni sajt za salon koji spaja **zakazivanje** + **TV doživljaj u salonu**.

## Šta radi
- **`index.html`** — booking stranica: klijent bira uslugu → frizera → termin → ime/telefon.
  Frizer može i ručno da unese rezervaciju (Admin panel).
- **`tv.html`** — fullscreen ekran za TV u salonu: sat, red čekanja, i kad dođe nečiji termin
  iskoči **„Dobrodošao, Ime"** + fotka sa prošle sesije. Muzika preko YouTube prozora u uglu.
- **Foto iz sesija** → mogu da se izvezu za Instagram (sinergija sa marketingom).

## Tehnika (POC)
- Čist HTML/CSS/JS, bez build-a. Podaci u `localStorage`.
- Live sinhronizacija booking ↔ TV preko `BroadcastChannel` (radi na istom uređaju/browseru za demo).
- Za pravi proizvod kasnije: backend + baza (Supabase/Firebase) za sinhronizaciju više uređaja.

## Pokretanje
Preview server (port 8090): otvori `index.html` (booking) i `tv.html` (TV) u dva taba.

## Status: POC v1
Demo podaci (frizeri, usluge). Brendiranje „The Prestige" — doteruje se po njihovom IG-u.
