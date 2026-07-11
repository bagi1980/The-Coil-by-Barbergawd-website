# Registar klijenata

Kontrolna tabla — ažuriraj ODMAH pri svakoj promeni. Lozinke i ključevi NISU ovde (Bitwarden!).

| Klijent | Domen | Ističe | Vercel projekat | Supabase projekat | Poslednji backup | Kontakt vlasnika |
|---|---|---|---|---|---|---|
| The Prestige Barbershop | prestigebarbershop.rs (kupiti) | — | barber-tv-demo | cyabrqryicgzlmdkedla | — | IG: @_theprestigebarbershop_ |
| The Fade Factory (US demo, nije klijent) | fade-factory-demo.vercel.app | — | fade-factory-demo | ohnxqpffsjbnbnyjxkts | — | — (outreach test USA) |

## Podsetnici

- Auto-renew mora biti UKLJUČEN za svaki domen.
- Nedeljno: `node backup.js` → upiši datum u kolonu „Poslednji backup".
- Mesečno: kopija `backups/` na USB/cloud; proveri kolonu „Ističe"; Supabase Advisors.
- Kvartalno: probni restore (`node backup.js --restore <fajl>`).
