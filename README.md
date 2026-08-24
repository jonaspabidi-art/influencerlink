# Länksida (link in bio)

Statisk sida utan build-process. Tre filer gör jobbet:

| Fil | Vad den gör |
| --- | --- |
| `products.json` | **All text och alla länkar.** Det är den här du redigerar. |
| `index.html` | Sidans skelett. Rör sällan. |
| `styles.css` | Färger, typografi och layout. |
| `app.js` | Läser `products.json` och bygger listan. |

---

## Lägga till en produkt

Öppna `products.json` och lägg till ett nytt block **överst** i listan
`"products"` (ordningen i filen spelar ingen roll – sidan sorterar ändå på
datum, nyast först):

```json
{
  "name": "Produktens namn",
  "description": "En eller två meningar om varför du gillar den.",
  "image": "https://exempel.se/bild.jpg",
  "url": "https://din-affiliatelank.se/produkt",
  "category": "kok",
  "dateAdded": "2026-08-24"
}
```

Fälten:

- **name** – rubriken på kortet.
- **description** – kort text under rubriken. Håll den på 1–2 rader.
- **image** – full URL till bilden. Visas i stående format 4:5 och beskärs
  från mitten, så ladda upp stående bilder (t.ex. 800×1000). Liggande bilder
  funkar men får toppen och botten bortklippta.
- **url** – din affiliatelänk. Öppnas i ny flik och märks automatiskt som annonslänk.
- **category** – måste matcha ett `id` från listan `categories` längre upp i filen.
- **dateAdded** – formatet `ÅÅÅÅ-MM-DD`. Styr sorteringen.

Tänk på kommatecken: varje produktblock utom det sista ska följas av `,`.
Blir det fel syns produkterna inte alls – klistra då in filen i
[jsonlint.com](https://jsonlint.com) så pekar den ut raden.

Spara, committa och pusha. Netlify publicerar om sig själv.

---

## Lägga till en kategori

Lägg till en rad i `categories` i samma fil:

```json
{ "id": "teknik", "label": "Teknik" }
```

`id` är det du skriver i produkternas `category` (små bokstäver, inga
mellanrum eller å/ä/ö). `label` är det som står på knappen.

Filterknappen dyker upp automatiskt så fort minst en produkt har den
kategorin – och försvinner igen om du tar bort alla produkter i den.

---

## Byta profiltext och bild

Överst i `products.json`:

```json
"profile": {
  "name": "@dittkonto",
  "tagline": "En rad om dig",
  "image": "https://exempel.se/profilbild.jpg",
  "footerNote": "Frågor? Skicka DM på TikTok."
}
```

---

## Klickstatistik

Ingen tracking-pixel och inga externa skript. Vill du räkna klick: öppna
`app.js`, leta upp raden märkt `TODO` högst upp och sätt din endpoint:

```js
var CLICK_ENDPOINT = 'https://din-endpoint.example/klick';
```

Sidan skickar då en liten JSON-post per klick:

```json
{ "event": "product_click", "product": "...", "category": "...", "url": "...", "ts": "..." }
```

Är värdet `null` (som nu) skickas ingenting. Klicket öppnar länken oavsett
om endpointen svarar eller inte.

---

## Annonsmärkningen

Raden *"Sidan innehåller annonslänkar – jag får provision om du handlar via
dem"* ligger direkt i `index.html`, ovanför filterknapparna, så att den syns
utan att man scrollar. Alla produktlänkar får `rel="sponsored noopener"`
automatiskt. Ta inte bort någotdera – det är ett lagkrav.

---

## Köra lokalt

`fetch` fungerar inte om du bara dubbelklickar på `index.html`. Starta en
liten server i mappen istället:

```bash
python3 -m http.server 8000
```

Öppna sedan http://localhost:8000.

---

## Deploy på Netlify

Koppla repot till Netlify. Inställningarna finns redan i `netlify.toml`:

- Build command: *(tom)*
- Publish directory: `.`

Varje push till branchen publiceras automatiskt.
