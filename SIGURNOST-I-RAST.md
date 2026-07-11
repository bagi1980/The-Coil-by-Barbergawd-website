# Sigurnost i rast — plan od 1. do 100. klijenta

Kompletan operativni plan: kako da vodiš sve klijente (domeni, lozinke, backup),
budeš maksimalno siguran i da **nikad ne izgubiš podatke**. Dopuna uz
[PONOVNA-UPOTREBA.md](PONOVNA-UPOTREBA.md) (tamo je tehnički postupak rebrandinga,
ovde je sve oko toga).

> **TL;DR:** Ti si vlasnik SVIH naloga. Klijent dobija samo svoju admin lozinku.
> Svaki klijent = poseban Vercel projekat + posebna Supabase baza + svoj domen.
> Backup = `node backup.js` jednom nedeljno (svi klijenti jednom komandom).
> Sve lozinke u Bitwarden. Sve klijente u [KLIJENTI.md](KLIJENTI.md).

---

## 1. Tri principa (ne krši ih nikad)

1. **Izolacija:** svaki klijent ima SVOJU Supabase bazu i SVOJ Vercel projekat.
   Ako jedan salon nešto zezne ili ode — ostali ne osećaju ništa.
2. **Ti si vlasnik infrastrukture:** svi nalozi (Vercel, Supabase, registrar, Resend)
   glase na tebe. Klijent dobija samo admin lozinku svog panela. Time držiš kontrolu,
   naplatu i mogućnost da pomogneš kad zaglave.
3. **Ništa ne postoji dok nema backup:** podatak koji postoji samo u Supabase Free bazi
   može da nestane. Backup rutina (dole, §4) je jedina obavezna nedeljna radnja.

---

## 2. Faza 0 — nalozi (jednom zauvek, ~1 sat)

| Nalog | Čemu služi | Trošak |
|---|---|---|
| **Bitwarden** (bitwarden.com) | sve lozinke i ključevi | besplatno |
| **Vercel** | hosting svih sajtova (1 nalog = svi projekti) | Hobby besplatno → Pro $20/mes kad kreneš da naplaćuješ |
| **Supabase** | baze (1 nalog = do 2 free projekta; više — vidi §6) | besplatno za start |
| **Registrar** (Loopia/Ninet/mCloud) | SVI domeni na jednom mestu | ~2.000–2.500 din/god po domenu |
| **Resend** | slanje reset mejlova | besplatno (100 mejlova/dan — više nego dovoljno) |

U Bitwarden odmah napravi folder po klijentu. Za svakog klijenta jedan zapis:

```
Klijent: The Prestige Barbershop
- Admin lozinka panela: ...
- Supabase URL: https://xxx.supabase.co
- Supabase SERVICE key: ...
- Supabase ANON key: ...
- CRON_SECRET: ...
- Domen: prestigebarbershop.rs (Loopia, ističe: ...)
- Recovery email vlasnika: ...
```

**Pravila za lozinke:** svaka admin lozinka jedinstvena i generisana (Bitwarden generator,
16+ znakova). Nikad ista lozinka za dva salona. Nikad lozinka u poruci/mejlu klijentu —
šalji preko Bitwarden Send (link koji se sam obriše) ili je ukucaj kod njih uživo.

---

## 3. Checklist za svakog novog klijenta

Tehnički deo (fork, rebrand, deploy) je u PONOVNA-UPOTREBA.md §3. Ovo je
**bezbednosno-administrativni** deo — uradi SVE stavke, redom:

- [ ] Nova Supabase baza: pokreni ceo `supabase-schema.sql` (uključuje RLS na kraju!)
- [ ] Proveri u Supabase → Advisors da nema crvenih upozorenja
- [ ] Vercel env: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_PASSWORD` (generisana!), `CRON_SECRET`, `RESEND_API_KEY`, `EMAIL_FROM`
- [ ] Domen kupljen kod TVOG registra, **auto-renew UKLJUČEN**, povezan na Vercel
- [ ] Resend: verifikuj klijentov domen, `EMAIL_FROM = Salon <noreply@domen.rs>`
- [ ] `privatnost.html` popunjen (naziv, adresa, kontakt, datum, period čuvanja)
- [ ] U admin panelu: unet recovery email vlasnika salona (za reset lozinke)
- [ ] Test: zakaži probni termin, obriši ga; uloguj se u admin; pošalji probni reset mejl
- [ ] Klijent upisan u [KLIJENTI.md](KLIJENTI.md) + Bitwarden zapis
- [ ] Klijent dodat u `backup-config.json` + **prvi backup odmah**: `node backup.js`
- [ ] Vlasniku salona uživo pokazan admin panel + predata lozinka (Bitwarden Send)

**Offboarding (klijent odlazi):** poslednji backup → predaj mu izvoz podataka ako traži →
obriši Supabase projekat + Vercel projekat → ugasi/prenesi domen → obriši iz
KLIJENTI.md i backup-config.json → Bitwarden zapis u arhivu. (GDPR: podaci se brišu,
ne čuvaš ih „za svaki slučaj" — zadrži samo poslednji backup 30 dana pa obriši.)

---

## 4. Backup sistem (srce plana)

**Problem:** Supabase Free NEMA automatski backup. Greškom obrisana tabela = trajno izgubljeni
termini, slike i podešavanja salona.

**Rešenje:** [backup.js](backup.js) — jedna komanda povuče sve tabele SVIH klijenata:

```bash
node backup.js
# → backups/prestige/2026-07-11.json
# → backups/drugi-salon/2026-07-11.json ...
```

Klijenti se čitaju iz `backup-config.json` (u .gitignore, sadrži ključeve — pravi se
jednom, po šablonu iz backup.js zaglavlja).

### Rutina

| Kada | Šta |
|---|---|
| **Nedeljno (ponedeljak ujutru, 2 min)** | `node backup.js` → proveri da je fajl nastao i da nije prazan |
| **Mesečno (5 min)** | Kopiraj `backups/` na drugo mesto (USB ili šifrovan cloud). Proveri istek domena u KLIJENTI.md. Pogledaj Supabase Advisors. |
| **Kvartalno (15 min)** | **PROBNI RESTORE**: uzmi backup fajl i proveri da iz njega možeš da vratiš podatke (`node backup.js --restore <fajl>` u test bazu). Backup koji nikad nisi probao da vratiš = nemaš backup. |

### Pravilo 3-2-1 (pojednostavljeno za tebe)

1. **Original** — Supabase baza (živa)
2. **Kopija 1** — `backups/` folder na tvom računaru (nedeljno)
3. **Kopija 2** — USB ili privatni cloud folder (mesečno)

**GDPR napomena:** backup sadrži imena, telefone i slike klijenata salona. Nikad ga ne
stavljaj u git, ne šalji mejlom, ne drži na deljenim mestima. `backups/` je u .gitignore.

---

## 5. Registar klijenata

[KLIJENTI.md](KLIJENTI.md) — jedna tabela, jedan red po klijentu: domen, ističe, Vercel
projekat, Supabase projekat, poslednji backup, kontakt vlasnika. Ažuriraj ga ODMAH pri
svakoj promeni — to je tvoja kontrolna tabla dok ne poraste posao.

---

## 6. Faze rasta — šta se menja i kada

### Faza 1: klijenti 1–2 (SAD)
- Sve besplatno osim domena (~2.500 din/god po klijentu).
- Supabase Free dozvoljava **2 aktivna projekta po nalogu** — dovoljno za start.
- Fokus: uhodaj rutinu (checklist §3 + backup §4) na prvom klijentu.

### Faza 2: klijenti 3–10 (naplaćuješ)
- **Vercel Pro ($20/mes ukupno, ne po klijentu)** — obavezno čim naplaćuješ (Hobby ne sme komercijalno).
- Supabase: Free staje na 2 projekta. Opcije: Pro nalog ($25/mes ukupno) pa u njemu projekti,
  ili — bolje dugoročno — počni planirati multi-tenant (dole).
- Cena klijentu treba da pokrije: domen + deo Vercel/Supabase Pro + tvoj rad.
  Orijentir: **20–40 €/mes po salonu** je i dalje jeftinije od bilo koje booking platforme.
- Uvedi prost ugovor sa klijentom (šta dobija, ko je vlasnik podataka, GDPR obrada, otkazni rok).

### Faza 3: klijenti 10–100 (multi-tenant)
- Održavanje 50 odvojenih projekata ručno ne skalira. Tada se kod prerađuje u
  **multi-tenant**: JEDNA Supabase Pro baza (kolona `salon_id` u svim tabelama + RLS po tenantu),
  JEDAN Vercel projekat, saloni se razlikuju po domenu. Novi klijent = red u bazi + domen,
  ne novi deploy.
- Backup tada rešava Supabase Pro automatski (dnevni + point-in-time), tvoja skripta ostaje kao dodatna kopija.
- To je poseban projekat (par dana posla sa Claude-om) — **ne radi ga pre 10+ klijenata koji plaćaju**.

| | Faza 1 (1–2) | Faza 2 (3–10) | Faza 3 (10–100) |
|---|---|---|---|
| Mesečni trošak | ~0 | ~$45 (Vercel+Supabase Pro) | ~$45–100 |
| Trošak po klijentu | domen | domen | domen |
| Backup | tvoja skripta | tvoja skripta | automatski + skripta |
| Novi klijent traje | pola dana | pola dana | 1 sat |

---

## 7. Kad nešto pukne (drži se plana, ne paniči)

| Scenario | Šta radiš |
|---|---|
| **Greškom obrisani podaci / baza** | `node backup.js --restore backups/<klijent>/<najnoviji>.json` u (novu) bazu → ažuriraj env u Vercelu ako je nova baza. Gubitak: max 7 dana (od poslednjeg backupa). |
| **Supabase projekat pauziran** (free tier pauzira posle nedelju dana bez saobraćaja) | Dashboard → Restore project. Zato mesečno baci pogled na sve projekte. |
| **Zaboravljena admin lozinka klijenta** | Klijent: „Zaboravljena lozinka" na login ekranu (reset mejl). Ti: novi `ADMIN_PASSWORD` u Vercel env + redeploy, ili direktno u Supabase `settings` tabeli obriši `admin_password_hash` red (vrati se na env lozinku). |
| **Domen istekao** | Zato auto-renew + kolona „ističe" u KLIJENTI.md. Registrari daju grace period ~30 dana — plati odmah. |
| **Kompromitovan service key** (npr. slučajno objavljen) | Supabase → Settings → API → Reset service key → novi ključ u Vercel env + Bitwarden. |
| **Vercel/Supabase pao** (retko, ali dešava se) | Ništa — sačekaj, nije do tebe. Proveri status.vercel.com / status.supabase.com pre nego što diraš bilo šta. |

---

## 8. GDPR — tvoje obaveze kao „obrađivača"

Vlasnik salona je **rukovalac** podataka (njegovi klijenti), ti si **obrađivač** (držiš mu
sistem). Već implementirano u aplikaciji: saglasnosti, politika privatnosti, brisanje
klijenta, automatsko čišćenje starih termina (RETENTION_DAYS). Tvoje trajne obaveze:

1. Popunjen `privatnost.html` za svaki salon (bez placeholdera!).
2. Backup fajlovi zaključani (samo tvoj računar + šifrovana kopija).
3. Pri raskidu — obriši sve (§3 offboarding).
4. U ugovoru iz Faze 2 jedan pasus o obradi podataka (Claude ti sastavi nacrt kad zatreba).

---

## 9. Tvoja rutina — sve stane u 10 min nedeljno

**Ponedeljak ujutru:** `node backup.js` → pogledaj da su fajlovi tu. To je sve.

**Prvi u mesecu:** kopija backups/ na USB/cloud → KLIJENTI.md: domeni ističu? →
Supabase: svi projekti aktivni, Advisors čisti.

**Kvartalno:** probni restore jednog backupa.

Dokle god radiš ove tri stvari, nijedan scenario iz §7 ne može da te uništi.
