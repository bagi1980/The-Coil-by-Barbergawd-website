const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  VerticalAlign, LevelFormat, PageNumber, Header, Footer
} = require('docx');
const fs = require('fs');

const GOLD = "C8A84B";
const DARK = "1A1A1A";
const GRAY = "555555";
const LIGHT = "F5F5F5";
const WHITE = "FFFFFF";

const border = { style: BorderStyle.SINGLE, size: 1, color: "DDDDDD" };
const borders = { top: border, bottom: border, left: border, right: border };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder };

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    children: [new TextRun({ text, bold: true, size: 36, font: "Arial", color: DARK })]
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 4 } },
    children: [new TextRun({ text, bold: true, size: 28, font: "Arial", color: DARK })]
  });
}

function h3(text) {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, size: 24, font: "Arial", color: GRAY })]
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, size: 22, font: "Arial", color: DARK, ...opts })]
  });
}

function bullet(text, bold = false) {
  return new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, size: 22, font: "Arial", color: DARK, bold })]
  });
}

function spacer() {
  return new Paragraph({ spacing: { before: 80, after: 80 }, children: [new TextRun("")] });
}

function tableRow(cells, header = false) {
  return new TableRow({
    tableHeader: header,
    children: cells.map(({ text, width, shade, bold, align }) =>
      new TableCell({
        borders,
        width: { size: width, type: WidthType.DXA },
        shading: shade ? { fill: shade, type: ShadingType.CLEAR } : undefined,
        verticalAlign: VerticalAlign.CENTER,
        margins: { top: 100, bottom: 100, left: 140, right: 140 },
        children: [new Paragraph({
          alignment: align || AlignmentType.LEFT,
          children: [new TextRun({ text: String(text), size: 20, font: "Arial", bold: bold || header, color: header ? WHITE : DARK })]
        })]
      })
    )
  });
}

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 600, hanging: 300 } } }
        }]
      },
      {
        reference: "steps",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 600, hanging: 300 } } }
        }]
      }
    ]
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 400, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial" },
        paragraph: { spacing: { before: 320, after: 120 }, outlineLevel: 1 } },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          alignment: AlignmentType.RIGHT,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 4 } },
          children: [new TextRun({ text: "BarberApp SaaS — Poverljivo", size: 18, font: "Arial", color: GRAY, italics: true })]
        })]
      })
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: "Strana ", size: 18, font: "Arial", color: GRAY }),
            new TextRun({ children: [PageNumber.CURRENT], size: 18, font: "Arial", color: GRAY }),
            new TextRun({ text: " od ", size: 18, font: "Arial", color: GRAY }),
            new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: "Arial", color: GRAY }),
          ]
        })]
      })
    },
    children: [

      // ─── NASLOVNICA ───
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 1200, after: 200 },
        children: [new TextRun({ text: "BARBERAPP", bold: true, size: 72, font: "Arial", color: DARK })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 160 },
        children: [new TextRun({ text: "SaaS platforma za brijačnice", size: 32, font: "Arial", color: GRAY })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: GOLD, space: 8 } },
        spacing: { before: 0, after: 600 },
        children: [new TextRun({ text: " ", size: 22 })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 400, after: 80 },
        children: [new TextRun({ text: "Plan za lansiranje, infrastruktura i cenovnik", size: 24, font: "Arial", color: GRAY, italics: true })]
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 80, after: 0 },
        children: [new TextRun({ text: "Jun 2026.", size: 22, font: "Arial", color: GRAY })]
      }),

      spacer(), spacer(), spacer(),

      // ─── 1. PREGLED ───
      h1("1. Pregled sistema"),
      p("BarberApp je SaaS platforma koja omogućava brijačnicama online zakazivanje termina, upravljanje frizerim, pauzama i klijentima. Jedan codebase — neograničen broj klijenata."),
      spacer(),

      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [3000, 6026],
        rows: [
          tableRow([
            { text: "Funkcija", width: 3000, shade: DARK, bold: true },
            { text: "Opis", width: 6026, shade: DARK, bold: true }
          ], true),
          tableRow([{ text: "Online zakazivanje", width: 3000 }, { text: "Klijent bira uslugu, frizera, dan i termin za 30 sekundi", width: 6026 }]),
          tableRow([{ text: "Admin panel", width: 3000, shade: LIGHT }, { text: "Frizer dodaje termine, pauze, uploaduje fotke", width: 6026, shade: LIGHT }]),
          tableRow([{ text: "TV ekran", width: 3000 }, { text: "Prikaz rasporeda i gostiju u čekaonici na TV-u", width: 6026 }]),
          tableRow([{ text: "Walk-in podrška", width: 3000, shade: LIGHT }, { text: "Procena čekanja za klijente bez termina", width: 6026, shade: LIGHT }]),
          tableRow([{ text: "Brendiranje", width: 3000 }, { text: "Svaki klijent ima svoje boje, logo, naziv i usluge", width: 6026 }]),
        ]
      }),

      spacer(),

      // ─── 2. INFRASTRUKTURA ───
      h1("2. Infrastruktura i servisi"),
      p("Ovo su svi servisi koji su potrebni za produkcijsko okruženje:"),
      spacer(),

      h2("2.1 Hosting — Vercel"),
      bullet("Automatski HTTPS na svim domenima"),
      bullet("Svaki klijent dobija sopstveni URL (npr. nikola-barber.vercel.app)"),
      bullet("Custom domeni po klijentu (npr. nikolabarber.rs)"),
      bullet("Deploy za manje od 30 sekundi"),
      bullet("Skalira automatski — nema podešavanja servera"),
      p("Vercel Pro plan: $20/mesec za celu platformu.", { color: GRAY, italics: true }),
      spacer(),

      h2("2.2 Baza podataka — Supabase"),
      bullet("PostgreSQL baza — pouzdana, skalabilna, besplatna do određene veličine"),
      bullet("Svi klijenti u jednoj bazi (multi-tenant arhitektura)"),
      bullet("Automatski backup svaki dan"),
      bullet("Ugrađena autentifikacija (admin lozinke po klijentu)"),
      bullet("Besplatan tier drži 10-20 klijenata bez troška"),
      p("Supabase Pro: $25/mesec za stotine klijenata.", { color: GRAY, italics: true }),
      spacer(),

      h2("2.3 Domen"),
      bullet("Klijent kupuje domen (~10€/godišnje na Namecheap ili GoDaddy)"),
      bullet("Ili ti kupuješ i naplaćuješ klijentu u paketu"),
      bullet("DNS podešavanje: 5 minuta rada"),
      bullet("SSL sertifikat: Vercel radi automatski"),
      spacer(),

      h2("2.4 Email notifikacije (opciono)"),
      bullet("Resend.com ili SendGrid — potvrda termina na email"),
      bullet("Besplatno do 3,000 emailova/mesec (Resend free tier)"),
      spacer(),

      h2("2.5 SMS notifikacije (opciono)"),
      bullet("Twilio — SMS podsetnik dan pre termina"),
      bullet("Cena: ~0.05 USD po SMS poruci"),
      bullet("Za 100 klijenata po 20 poruka mesecno: ~$100/mes dodatnog troška"),
      spacer(),

      // ─── 3. BEZBEDNOST ───
      h1("3. Bezbednost"),
      p("Pre prvog plaćenog klijenta obavezno je implementirati sledeće:"),
      spacer(),

      h2("3.1 Obavezno (pre prvog klijenta)"),

      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Admin lozinka — trenutno admin panel nema zaštitu, svako može da uđe", size: 22, font: "Arial", bold: true })]
      }),
      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "HTTPS — Vercel to uključuje automatski (već rešeno)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Rate limiting — sprečava zloupotrebu API-ja (robot zakazivanje)", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Validacija podataka — provera inputa pre upisa u bazu", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 60, after: 60 },
        children: [new TextRun({ text: "Automatski backup baze — Supabase to radi svaki dan automatski", size: 22, font: "Arial" })]
      }),

      spacer(),

      h2("3.2 Obaveze kao provajdera"),
      bullet("Čuvanje podataka klijenata u skladu sa GDPR-om"),
      bullet("Ugovor o pružanju usluge sa svakim klijentom"),
      bullet("Dostupnost sistema 99%+ (Vercel garantuje 99.99% uptime)"),
      bullet("Reagovanje na probleme u razumnom roku (npr. 24h)"),
      spacer(),

      // ─── 4. KORACI DO LANSIRANJA ───
      h1("4. Koraci do prvog klijenta"),
      spacer(),

      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [800, 4226, 2000, 2000],
        rows: [
          tableRow([
            { text: "#", width: 800, shade: DARK },
            { text: "Zadatak", width: 4226, shade: DARK },
            { text: "Težina", width: 2000, shade: DARK },
            { text: "Vreme", width: 2000, shade: DARK }
          ], true),
          tableRow([
            { text: "1", width: 800, shade: LIGHT },
            { text: "Migracija na Supabase bazu (umesto in-memory)", width: 4226, shade: LIGHT },
            { text: "Srednje", width: 2000, shade: LIGHT },
            { text: "1–2 dana", width: 2000, shade: LIGHT }
          ]),
          tableRow([
            { text: "2", width: 800 },
            { text: "Admin lozinka po klijentu", width: 4226 },
            { text: "Lako", width: 2000 },
            { text: "2–4 sata", width: 2000 }
          ]),
          tableRow([
            { text: "3", width: 800, shade: LIGHT },
            { text: "Multi-tenant arhitektura (jedan codebase, N klijenata)", width: 4226, shade: LIGHT },
            { text: "Srednje", width: 2000, shade: LIGHT },
            { text: "3–5 dana", width: 2000, shade: LIGHT }
          ]),
          tableRow([
            { text: "4", width: 800 },
            { text: "Brendiranje po klijentu (boje, logo, naziv, usluge)", width: 4226 },
            { text: "Lako", width: 2000 },
            { text: "1 dan", width: 2000 }
          ]),
          tableRow([
            { text: "5", width: 800, shade: LIGHT },
            { text: "Custom domen i SSL po klijentu", width: 4226, shade: LIGHT },
            { text: "Lako", width: 2000, shade: LIGHT },
            { text: "30 min/klijentu", width: 2000, shade: LIGHT }
          ]),
          tableRow([
            { text: "6", width: 800 },
            { text: "Email potvrda termina (Resend)", width: 4226 },
            { text: "Lako", width: 2000 },
            { text: "4–8 sati", width: 2000 }
          ]),
          tableRow([
            { text: "7", width: 800, shade: LIGHT },
            { text: "Rate limiting i sigurnost API-ja", width: 4226, shade: LIGHT },
            { text: "Srednje", width: 2000, shade: LIGHT },
            { text: "1 dan", width: 2000, shade: LIGHT }
          ]),
          tableRow([
            { text: "8", width: 800 },
            { text: "Ugovor i fakturisanje klijentima (Stripe)", width: 4226 },
            { text: "Srednje", width: 2000 },
            { text: "2–3 dana", width: 2000 }
          ]),
        ]
      }),

      spacer(),
      p("Ukupno do prvog plaćenog klijenta: 2–3 sedmice rada.", { bold: true }),
      spacer(),

      // ─── 5. CENOVNIK ───
      h1("5. Troškovi infrastrukture"),
      spacer(),

      h2("5.1 Mesečni troškovi (tvoji)"),

      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [3500, 2263, 3263],
        rows: [
          tableRow([
            { text: "Servis", width: 3500, shade: DARK },
            { text: "Cena", width: 2263, shade: DARK },
            { text: "Napomena", width: 3263, shade: DARK }
          ], true),
          tableRow([{ text: "Vercel Pro", width: 3500 }, { text: "$20/mes", width: 2263 }, { text: "Neograničen broj klijenata", width: 3263 }]),
          tableRow([{ text: "Supabase Pro", width: 3500, shade: LIGHT }, { text: "$25/mes", width: 2263, shade: LIGHT }, { text: "Baza za sve klijente", width: 3263, shade: LIGHT }]),
          tableRow([{ text: "Resend (email)", width: 3500 }, { text: "$0–$20/mes", width: 2263 }, { text: "Besplatno do 3k email-ova/mes", width: 3263 }]),
          tableRow([{ text: "Domen (tvoj)", width: 3500, shade: LIGHT }, { text: "~$1/mes", width: 2263, shade: LIGHT }, { text: "Za tvoj vlastiti domen", width: 3263, shade: LIGHT }]),
          tableRow([{ text: "UKUPNO", width: 3500, shade: "EEEEEE" }, { text: "~$45–65/mes", width: 2263, shade: "EEEEEE" }, { text: "Fiksno, bez obzira na broj klijenata", width: 3263, shade: "EEEEEE" }]),
        ]
      }),

      spacer(),

      h2("5.2 Cenovnik za klijente (preporuka)"),

      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [2500, 1800, 4726],
        rows: [
          tableRow([
            { text: "Paket", width: 2500, shade: DARK },
            { text: "Cena/mes", width: 1800, shade: DARK },
            { text: "Šta uključuje", width: 4726, shade: DARK }
          ], true),
          tableRow([{ text: "Starter", width: 2500 }, { text: "50 EUR", width: 1800 }, { text: "1 frizer, zakazivanje, admin panel", width: 4726 }]),
          tableRow([{ text: "Pro", width: 2500, shade: LIGHT }, { text: "80 EUR", width: 1800, shade: LIGHT }, { text: "Do 3 frizera, TV ekran, email potvrde", width: 4726, shade: LIGHT }]),
          tableRow([{ text: "Premium", width: 2500 }, { text: "120 EUR", width: 1800 }, { text: "Neograničeno frizera, SMS podsetnici, prioritetna podrška", width: 4726 }]),
          tableRow([{ text: "Onboarding (jednokratno)", width: 2500, shade: LIGHT }, { text: "150 EUR", width: 1800, shade: LIGHT }, { text: "Podešavanje, brendiranje, domen, obuka", width: 4726, shade: LIGHT }]),
        ]
      }),

      spacer(),

      h2("5.3 Projekcija profita"),

      new Table({
        width: { size: 9026, type: WidthType.DXA },
        columnWidths: [2000, 2000, 2000, 3026],
        rows: [
          tableRow([
            { text: "Klijenti", width: 2000, shade: DARK },
            { text: "Prihod (50 EUR/mes)", width: 2000, shade: DARK },
            { text: "Trošak infrastr.", width: 2000, shade: DARK },
            { text: "Profit", width: 3026, shade: DARK }
          ], true),
          tableRow([{ text: "1", width: 2000 }, { text: "50 EUR", width: 2000 }, { text: "~45 EUR", width: 2000 }, { text: "5 EUR", width: 3026 }]),
          tableRow([{ text: "5", width: 2000, shade: LIGHT }, { text: "250 EUR", width: 2000, shade: LIGHT }, { text: "~50 EUR", width: 2000, shade: LIGHT }, { text: "200 EUR", width: 3026, shade: LIGHT }]),
          tableRow([{ text: "20", width: 2000 }, { text: "1,000 EUR", width: 2000 }, { text: "~55 EUR", width: 2000 }, { text: "945 EUR", width: 3026 }]),
          tableRow([{ text: "100", width: 2000, shade: LIGHT }, { text: "5,000 EUR", width: 2000, shade: LIGHT }, { text: "~100 EUR", width: 2000, shade: LIGHT }, { text: "4,900 EUR", width: 3026, shade: LIGHT }]),
        ]
      }),

      spacer(),
      p("Ključna prednost: trošak infrastrukture raste minimalno dok prihod raste linearno.", { bold: true, color: GRAY }),
      spacer(),

      // ─── 6. BRENDIRANJE ───
      h1("6. Brendiranje po klijentu"),
      p("Svaki klijent dobija potpuno personalizovan izgled:"),
      spacer(),
      bullet("Naziv salona i slogan"),
      bullet("Boje (primarna, akcentna, pozadinska)"),
      bullet("Logo i favicon"),
      bullet("Lista usluga sa cenama i trajanjem"),
      bullet("Lista frizera sa imenima"),
      bullet("Radno vreme"),
      bullet("Custom domen (npr. frizerskistudio-marko.rs)"),
      spacer(),
      p("Tehnički: sve je u config.js fajlu per klijent — promena traje 30 minuta po klijentu."),
      spacer(),

      // ─── 7. SLEDEĆI KORACI ───
      h1("7. Preporučeni sledeći koraci"),
      spacer(),

      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 100, after: 100 },
        children: [new TextRun({ text: "Migrirati bazu na Supabase — ovo je najkritičniji korak, in-memory podaci se gube pri restartu", size: 22, font: "Arial", bold: true })]
      }),
      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 100, after: 100 },
        children: [new TextRun({ text: "Dodati admin lozinku — bez ovoga svako može da pristupi admin panelu", size: 22, font: "Arial", bold: true })]
      }),
      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 100, after: 100 },
        children: [new TextRun({ text: "Podesiti prvi klijent — brendiranje, domen, usluge, frizeri", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 100, after: 100 },
        children: [new TextRun({ text: "Naplatiti onboarding 150 EUR + prvu mesečninu 50–80 EUR", size: 22, font: "Arial" })]
      }),
      new Paragraph({
        numbering: { reference: "steps", level: 0 },
        spacing: { before: 100, after: 100 },
        children: [new TextRun({ text: "Implementirati naplatu putem Stripe-a za automatsko mesečno fakturisanje", size: 22, font: "Arial" })]
      }),

      spacer(),
      spacer(),

      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 8 },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: GOLD, space: 8 }
        },
        spacing: { before: 200, after: 200 },
        children: [new TextRun({ text: "Dokument pripremio Claude · Jun 2026.", size: 20, font: "Arial", color: GRAY, italics: true })]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/Users/blagojedjordjevic/Desktop/BarberApp-SaaS-Plan.docx", buffer);
  console.log("OK");
}).catch(e => { console.error(e); process.exit(1); });
