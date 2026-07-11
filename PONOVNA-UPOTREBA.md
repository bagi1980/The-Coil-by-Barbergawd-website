# Ponovna upotreba salon-app-a — playbook za novi salon

Kako da postojeću aplikaciju iskoristimo za novog klijenta: dupliranje → rebrand → baza →
domen → deploy. Uz vremenski okvir, procenu tokena i troškova.

> TL;DR: za jedan novi salon računaj **pola radnog dana** posla i da bude **online istog dana**.
> Fiksni trošak ~**€10–15/god** (domen). Hosting i baza mogu na besplatnom tieru za mali salon.

---

## 1. Šta je aplikacija (da znamo šta diramo)

- Statički frontend (`index.html` zakazivanje, `tv.html` TV ekran, `privatnost.html`) + jedan
  Node server (`server.js`) koji služi fajlove i drži API (`/api/state`, `/api/appointments`…).
- **Podaci:** Supabase (produkcija) sa fallbackom na lokalni `data.json`. Šema je u
  [`supabase-schema.sql`](supabase-schema.sql).
- **Brend se drži na 3 mesta:**
  1. [`config.js`](config.js) — ime salona, slogan, radno vreme, **usluge + cene**, **frizeri**, YouTube muzika.
  2. Hardkodovan tekst/logo u `index.html` i `tv.html` (wordmark „BARBERSHOP", marketing copy, boje).
  3. Slike u `img/` i tekst politike privatnosti u `privatnost.html`.
- **Deploy:** Vercel (projekat je već linkovan preko `.vercel/`; svaki novi salon = novi Vercel projekat).

---

## 2. Preduslovi (jednom napraviti naloge)

| Nalog | Čemu služi | Trošak |
|---|---|---|
| Vercel | hosting + deploy | Hobby besplatno (nekomercijalno); Pro $20/mo za firme |
| Supabase | baza (termini, slike, pauze) | Free tier ok za mali salon; Pro $25/mo za ozbiljnu produkciju |
| Registrar domena (Namecheap/GoDaddy/Vercel Domains) | `.rs` ili `.com` domen | ~€10–15/god |

---

## 3. Postupak korak-po-korak

### A. Dupliraj folder
```bash
cp -r salon-app novi-salon
cd novi-salon
rm -rf .vercel node_modules        # skini staru Vercel vezu i module
git init && git add -A && git commit -m "Init: fork od salon-app"
npm install
```

### B. Rebrand (srce posla)
1. **[`config.js`](config.js)** — promeni `SALON.name`, `tagline`, `established`, `hours`,
   `slotMin`, `youtube`; ceo niz `SERVICES` (naziv/cena/trajanje) i `BARBERS` (imena).
2. **Wordmark / logo tekst** — zameni „BARBERSHOP" u:
   - `index.html` (3 mesta: header, hero, footer)
   - `tv.html` (2 mesta: topbar + „zatvoreno" ekran)
3. **Boje brenda** — `:root` promenljive `--red`, `--blue`, `--cream` u `index.html`, `tv.html`
   i `styles.css` (drži isti naziv promenljive, samo promeni HEX).
4. **Marketing copy na `index.html`** — statistika („12k+ šišanja", „4.9 ocena", „3 majstora"),
   sekcija „ZAŠTO BAŠ OVDE", testimonijali, `<title>` i meta opis.
5. **Slike** — zameni fajlove u `img/` (hero, primeri radova, ikonice).
6. **Privatnost** — u `privatnost.html` promeni ime salona, kontakt i adresu (GDPR).

> Savet: rebrand može da odradi Claude Code u jednom prolazu ako mu daš brend-brief
> (ime, boje, cene, frizeri, slogan). Vidi procenu tokena u §6.

### C. Baza (Supabase)
1. Napravi **novi Supabase projekat**.
2. U SQL editoru pokreni ceo [`supabase-schema.sql`](supabase-schema.sql).
3. Zapiši `SUPABASE_URL` i `SUPABASE_SERVICE_KEY` (Settings → API).

### D. Domen
1. Kupi domen kod registrara.
2. Dodaj ga u Vercel projekat (Settings → Domains) i podesi DNS zapise koje Vercel pokaže
   (A/CNAME). Propagacija obično par minuta–par sati (max 24–48h).

### E. Deploy na Vercel
```bash
npm i -g vercel          # ako već nije instaliran
vercel link              # kreiraj NOV projekat za ovaj salon
```
Postavi env varijable (Vercel dashboard → Settings → Environment Variables, ili CLI):

| Varijabla | Vrednost |
|---|---|
| `SUPABASE_URL` | iz koraka C |
| `SUPABASE_SERVICE_KEY` | iz koraka C |
| `ADMIN_PASSWORD` | lozinka za admin panel |
| `CRON_SECRET` | tajni string za dnevni GDPR cleanup |
| `RETENTION_DAYS` | npr. `90` (koliko dana se čuvaju stari termini) |

Zatim:
```bash
vercel --prod --yes
```

### F. Provera (obavezno)
- Otvori `/` → zakaži test termin.
- Otvori `/tv.html` → proveri da se pojavi (loading berber-poll pa lista), pusti muziku.
- Otvori `/index.html#admin` → uloguj se admin lozinkom, obriši test termin.
- Proveri da domen radi preko HTTPS-a.

---

## 4. Vremenski okvir

| Korak | Realno vreme |
|---|---|
| A. Dupliranje foldera | 5 min |
| B. Rebrand (ako su slike/cene spremne) | 1–2 h |
| C. Supabase setup | 15 min |
| D. Kupovina domena + DNS | 15 min rada (+ propagacija do par h) |
| E. Deploy + env varijable | 15 min |
| F. Provera | 15 min |
| **Ukupno aktivnog rada** | **~2.5–3.5 h (pola radnog dana)** |
| **Online (uz DNS)** | **isti dan** |

Usko grlo je uvek **priprema materijala klijenta** (logo, boje, cene, slike, imena frizera) —
to nije tehnički posao i ne ulazi u gornju procenu.

---

## 5. Troškovi po salonu

| Stavka | Besplatno / Jeftino | Ako treba više |
|---|---|---|
| Domen | — | €10–15/god (obavezno) |
| Hosting (Vercel) | Hobby $0 (nekomercijalno) | Pro $20/mo (firme/više prometa) |
| Baza (Supabase) | Free tier $0* | Pro $25/mo (bez pauziranja, više prostora) |

\* Supabase Free tier **pauzira projekat posle ~7 dana neaktivnosti** — za salon koji se koristi
svakodnevno to nije problem, ali za sigurnu produkciju je Pro preporuka.

**Minimalno realno:** ~€15/god (samo domen) ako sve stane na free tier.

---

## 6. Procena tokena (ako rebrand radi Claude Code)

Za **jedan** rebrand u jednoj sesiji (čitanje fajlova + izmene config-a i HTML tačaka + deploy):

| Faza | Okvirno tokena |
|---|---|
| Čitanje/analiza projekta | 30k – 60k |
| Rebrand izmene (config + HTML + boje + privatnost) | 60k – 150k |
| Deploy + provera (preview, screenshotovi) | 40k – 100k |
| **Ukupno po salonu** | **~150k – 350k tokena** |

Napomene:
- Više „tam-vamo" (menjaš mišljenje oko boja/copy-ja, više provera) → bliže gornjoj granici.
- Ako pripremiš **jasan brend-brief unapred** (ime, HEX boje, tabela usluga+cena, imena frizera,
  YouTube link), sesija je kraća i jeftinija — bliže **150k**.
- Screenshotovi/preview troše najviše; ako preskočiš vizuelnu proveru, znatno manje.

---

## 7. Brzi checklist (kopiraj po salonu)

- [ ] `cp -r` folder, obrisan `.vercel`, nov `git init`
- [ ] `config.js`: ime, slogan, radno vreme, usluge+cene, frizeri, YouTube
- [ ] Wordmark „BARBERSHOP" zamenjen (index.html ×3, tv.html ×2)
- [ ] Boje `--red/--blue/--cream` u index.html, tv.html, styles.css
- [ ] Marketing copy + `<title>`/meta na index.html
- [ ] Slike u `img/`
- [ ] `privatnost.html`: ime, kontakt, adresa
- [ ] Supabase projekat + `supabase-schema.sql` pokrenut
- [ ] Env varijable postavljene (SUPABASE_URL, SUPABASE_SERVICE_KEY, ADMIN_PASSWORD, CRON_SECRET, RETENTION_DAYS)
- [ ] `vercel link` (nov projekat) + `vercel --prod`
- [ ] Domen dodat + DNS + HTTPS radi
- [ ] Test: zakazivanje, TV ekran, admin login, brisanje termina
