# Prüfen und Übergeben

## Prüfskript

```bash
node <Skill-Ordner>/scripts/pruefen.cjs index.html impressum.html datenschutz.html   # lokal, im Projektordner
node <Skill-Ordner>/scripts/pruefen.cjs https://domain.de --out check-domain            # Live-Seite oder fremde Seite
```

- Lokale Dateien liefert ein eigener kleiner Server aus. Der Browser verhält sich dadurch wie später beim Hoster.
- Ausgabe:
  - `bericht.md` und Screenshots in `.pruefung/` bzw. im `--out`-Ordner,
  - je Seite `handy-oben`, `handy-ganz`, `desktop-oben`, `desktop-ganz`,
  - Exit-Code 1 bei Fehlern.
- `--erlaube host1,host2` nimmt Drittanbieter von der Prüfung aus, die bewusst ohne Einwilligung laden dürfen. Begründe jeden davon in DESIGN.md oder PRODUCT.md.
- In Ganzseiten-Aufnahmen stehen fixierte Leisten an zufälliger Stelle. Das ist ein Aufnahme-Effekt. Die `-oben`-Aufnahme zeigt den echten ersten Bildschirm.
- Braucht Node und Playwright (`npm i -D playwright && npx playwright install chromium`, falls nicht vorhanden).

**Was das Skript als Fehler meldet:**
- Platzhalter und Blindtext
- Drittanbieter-Verbindungen vor einem Klick
- fehlende eigene Dateien
- Konsolenfehler
- seitliches Wischen auf dem Handy
- fehlende H1, `lang` oder `viewport`
- Bilder ohne `alt`
- namenlose Links und Knöpfe, Formularfelder ohne Label
- Sprungmarken ohne Ziel
- fehlende Links zu Impressum oder Datenschutz
- kaputtes JSON-LD

**Was es als Warnung meldet:**
- Such- und Teilen-Angaben
- Bildgrößen und fehlende Bildmaße
- Kontrast (Näherung, Bilder und Verläufe werden übersprungen)
- kleine Bedienelemente
- Nicht-WOFF2-Schriften
- Ladegewicht
- fehlender Anruf-Link
- Rechtstexte auf fremder Domain

## Handprüfung

Das Skript sieht keine Bedeutung. Diese Punkte prüfst du selbst:

1. **Wahrheit:** Jede Aussage, Zahl, Bewertung und jedes Foto lässt sich auf „Evidence on Hand“ in PRODUCT.md zurückführen.
2. **Erster Eindruck:** Auf `handy-oben` sieht man in drei Sekunden, was der Betrieb macht und wo, und wie man ihn anruft. Die Leitidee aus DESIGN.md ist erkennbar.
3. **Tastatur:** Mit Tab einmal durch die ganze Seite. Der Fokus ist immer sichtbar, Menü und Fragen gehen per Tastatur, der Sprunglink erscheint als Erstes.
4. **Zwei-Klick:** Jede Karte, jedes Video und jeder Chat lädt erst beim Klick und funktioniert danach.
5. **Formular:** Eine Testanfrage kommt beim Betrieb an. Bei abgeschaltetem Webhook erscheint der Ersatzweg. Ein ausgefülltes Spam-Fallen-Feld wird verworfen.
6. **Auf einem echten Handy:** Anruf-, WhatsApp- und Mail-Links öffnen die richtige App mit der richtigen Nummer.
7. **Rechtstexte:** Impressum und Datenschutz sind vom Kunden geliefert und enthalten die Branchenpflichten aus PRODUCT.md. Die Datenschutzerklärung nennt jeden Dienst, den die Seite nutzt.
8. **Optional:** Lighthouse in Chrome DevTools im Handy-Modus. Ziel ist mindestens 95 bei Leistung, Barrierefreiheit und Best Practices.

## Übergabe

1. Seite unter der Kundendomain mit HTTPS. Alte Adressen leiten weiter, ein Prüfskript-Lauf gegen die Live-URL hat 0 Fehler.
2. Im Google-Unternehmensprofil die Website eintragen. Name, Adresse und Telefon sind identisch mit der Seite.
3. Übergabe-Notiz an den Kunden, eine Seite:
   - wo die Seite liegt und wer Zugänge hat,
   - was der Kunde selbst pflegt (Öffnungszeiten, Urlaub, neue Dienste melden, damit der Datenschutztext angepasst wird),
   - wie er Änderungen bestellt,
   - was die monatliche Betreuung abdeckt.
4. Vorher-nachher als Referenz: Vergleich des alten und neuen Prüfberichts plus Screenshots. Als Referenz auf der eigenen Seite nur mit schriftlicher Erlaubnis des Kunden.
