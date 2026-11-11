# Technik

## Aufbau

Statische Dateien, kein Build, kein Framework. So läuft die Seite bei jedem Hoster, lädt schnell und bleibt jahrelang wartbar.

```
index.html  impressum.html  datenschutz.html  404.html  robots.txt  sitemap.xml
assets/site.css  assets/site.js  assets/img/  assets/fonts/
```

Inhalte sind ohne JavaScript sichtbar. JS ergänzt Menü, Zwei-Klick und das Formular. Die Klasse `js` am `<html>` steuert das (siehe Vorlage). `.pruefung/` gehört in `.gitignore`.

## Leistungsbudget (Handy)

- Core Web Vitals im grünen Bereich: LCP ≤ 2,5 s, CLS ≤ 0,1, INP ≤ 200 ms
- Beim Laden übertragen: unter 1,5 MB (das Prüfskript warnt darüber)
- Heldbild ≤ 200 KB, höchstens vier Schriftdateien, ein CSS, ein JS

## Bilder

- Breiten: volle Breite 800 und 1600 px, halbe Breite 400 und 800 px. Format WebP (AVIF optional davor in `<picture>`).
- Immer `width`/`height` (verhindert Springen), `srcset` + `sizes` und ein `alt`, das beschreibt, was zu sehen ist. Dekorative Bilder bekommen `alt=""`.
- Heldbild mit `fetchpriority="high"` und ohne lazy. Alle anderen mit `loading="lazy" decoding="async"`.
- Handyfotos enthalten GPS-Daten. Das Umwandeln unten entfernt sie, weil keine EXIF-Daten mitgeschrieben werden.
  ```bash
  pip install pillow
  python3 -c '
  import sys; from PIL import Image, ImageOps
  src, name = sys.argv[1], sys.argv[2]
  im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
  for w in map(int, sys.argv[3:]):
      h = round(im.height * w / im.width)
      im.resize((w, h), Image.LANCZOS).save(f"assets/img/{name}-{w}.webp", quality=78, method=6)
      print(f"assets/img/{name}-{w}.webp", w, h)
  ' foto.jpg held 800 1600
  ```

## Schriften

Nur selbst gehostet als WOFF2, auf lateinische Zeichen und deutsche Sonderzeichen reduziert. Die Lizenzdatei (z. B. OFL.txt) kommt mit.

```bash
pip install fonttools brotli
pyftsubset Schrift-Bold.ttf --flavor=woff2 --output-file=assets/fonts/titel-700.woff2 \
  --unicodes="U+0000-00FF,U+0131,U+0152-0153,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2190-2193,U+2212"
```

Bei `@font-face` steht `font-display: swap`. Vorgeladen wird nur die Schrift der H1.

## Formular an n8n

- Ziel ist ein n8n-Webhook (POST). Die Vorlage schickt `FormData` per `fetch` und zeigt bei Fehlern Telefon und E-Mail als Ersatzweg.
- Im Workflow:
  1. Spam-Falle `website` muss leer sein, Längen prüfen.
  2. Anfrage per E-Mail an den Betrieb.
  3. Optional Bestätigung an den Absender.
  4. Antwort 200.
- In den Webhook-Optionen „Allowed Origins (CORS)“ auf die Kundendomain setzen (Standard ist `*`).
- Kein reCAPTCHA. Das wäre ein Drittanbieter mit Einwilligungspflicht, Spam-Falle und Längenprüfung reichen für kleine Betriebe meist.
- n8n gehört als Dienstleister in die Datenschutzerklärung (Auftragsverarbeitung, bei n8n Cloud mit AV-Vertrag).

## Externe Inhalte (Zwei-Klick)

- Muster in der Vorlage: Ein Container mit `data-extern-src`, Erklärtext und Knopf. `assets/site.js` setzt das iframe erst beim Klick.
- Karte: Einbettungs-URL aus Google Maps → Teilen → Karte einbetten. Daneben immer ein normaler Route-Link.
- Video: `youtube-nocookie.com` ist trotzdem ein Drittanbieter und lädt nur per Zwei-Klick. Eigene kurze MP4-Dateien sind die bessere Wahl.
- Buchungstool: am einfachsten als Link in neuem Tab statt eingebettet.
- Chatbot: Skript erst nach Zustimmung laden, wie die Tidio-Demo in `index.html` von Bergmann AI (Zustimmungsfeld `#demo`, Skript wird erst beim Klick eingefügt). Die Begrüßung nennt ihn „KI-Assistent“.

## Suche und Teilen

- `<title>`: Leistung in Ort | Name, bis 60 Zeichen. `meta description` bis 155 Zeichen, `canonical`.
- Open Graph: `og:title`, `og:description`, `og:url`, `og:image` (1200 × 630 px JPG, unter 300 KB).
- JSON-LD mit dem genauesten Typ:
  - AutoRepair, AutoDealer, HairSalon, BeautySalon, NailSalon, ExerciseGym, Hotel, BedAndBreakfast
  - RealEstateAgent, Plumber, Electrician, HVACBusiness, RoofingContractor, GeneralContractor, HousePainter, Locksmith
  - AccountingService, Attorney, TravelAgency
  - sonst LocalBusiness (z. B. Fahrschule)
- Im JSON-LD stehen nur echte Daten. `aggregateRating` lässt du weg, weil Google eigene Bewertungsangaben von Unternehmen nicht als Sterne zeigt und die Zahlen veralten.
- `robots.txt` mit Sitemap-Zeile, `sitemap.xml` mit den indexierbaren Seiten. Impressum und Datenschutz tragen `noindex`.

## Hosting

- Statische Seiten laufen überall. Für Kundenseiten eignet sich ein Hoster mit Rechenzentrum in der EU und AV-Vertrag, gern der Webspace, den der Kunde schon hat (Upload per SFTP).
- GitHub Pages passt für eigene Projekte. Laut GitHub ist Pages nicht als kostenloses Hosting gedacht, um ein Online-Geschäft oder Seiten für kommerzielle Transaktionen zu betreiben (https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits). Kundenseiten legst du deshalb beim Hoster ab. US-Hosting gehört zudem in die Datenschutzerklärung.
- HTTPS erzwingen. Beim Wechsel von einer alten Seite leiten alte Adressen per 301 weiter (bei Apache-Webspace mit `.htaccess`: `Redirect 301 /alte-seite.html /#leistungen`).
- `404.html` liegt im Wurzelordner. Die Vorlage nutzt dort absolute Pfade, damit sie in jedem Unterordner funktioniert.
