---
name: website-fuer-betriebe
description: Websites für kleine Betriebe und lokale Dienstleister bauen, überarbeiten oder vor der Übergabe prüfen (Handwerk, Werkstatt, Salon, Studio, Kanzlei, Hotel, Makler). Mit Startgerüst, deutschen Rechtsregeln und Prüfskript im Browser; auch für den Website-Check eines Interessenten.
---

# Website für Betriebe

Ziel: eine Seite, die einem lokalen Betrieb Anrufe und Anfragen bringt, rechtlich sauber ist und auf dem Handy klarer und schneller ist als die Seiten der Konkurrenz.

Fertiges Beispiel nach diesem Ablauf: `PRODUCT.md`, `DESIGN.md` und `index.html` im Repo bergmann-ai-website.

## Feste Regeln

Sie gelten in jedem Schritt.

- **Beleg statt Behauptung.** Jede Zahl, Bewertung, Auszeichnung und jedes Foto stammt vom Kunden und steht in PRODUCT.md unter „Evidence on Hand“. Was fehlt, wird ein sichtbarer **Platzhalter** `[FEHLT: was genau]`. Das Prüfskript meldet jeden Platzhalter als Fehler, live geht die Seite erst ohne.
- **Zwei-Klick für alles Fremde.** Beim ersten Laden spricht die Seite nur mit dem eigenen Server. Schriften liegen lokal. Karte, Video, Chat und Buchungstool laden erst nach Klick. Das ist rechtlich sauber und kommt meist ohne Cookie-Banner aus.
- **Anruf zuerst.** Auf dem Handy ist die wichtigste Aktion des Betriebs (meist Anrufen) ohne Scrollen sichtbar und mit dem Daumen erreichbar.
- **Rechtstexte liefert der Kunde.** Du baust Struktur und Platzhalter. Impressum- und Datenschutztext kommen aus einem Generator oder vom Anwalt des Kunden. Du gibst Hinweise aus `references/recht.md`, keine Rechtsberatung.

## Ablauf

1. **Auftrag klären** nach `references/intake.md`. Lege `PRODUCT.md` aus `templates/PRODUCT.md` an.
   - Fertig, wenn jedes Feld eine Kundenangabe trägt oder als Platzhalter mit konkreter Frage markiert ist.
   - Die Liste „Offene Fragen an den Kunden“ steht.

2. **Gestaltung festlegen** nach `references/design.md`. Lege `DESIGN.md` aus `templates/DESIGN.md` an.
   - Fertig, wenn DESIGN.md eine Leitidee aus dem Betrieb selbst hat, ein Signatur-Element, alle Tokens mit geprüften Kontrasten und mindestens drei benannte Regeln.
   - Gibt es Design-Skills wie `impeccable` oder `taste-skill`, nutze sie hier für Richtung und Kritik.

3. **Inhalt planen** nach `references/inhalt.md`.
   - Fertig, wenn jeder Abschnitt genau eine Kundenfrage beantwortet und die Reihenfolge steht.
   - Die Branchenpflichten aus der Tabelle sind in PRODUCT.md übernommen.
   - Die Texte sind geschrieben: aus Kundenangaben, sonst Platzhalter.

4. **Bauen.** Kopiere `templates/seite/` ins Projekt, setz die Tokens aus DESIGN.md in `assets/site.css` ein, füll die Abschnitte nach Plan und streich, was nicht passt. Technik steht in `references/technik.md`, Recht in `references/recht.md`.
   - Fertig, wenn alle Seiten gebaut sind und Leitidee und Signatur-Element auf den ersten Blick erkennbar sind.

5. **Prüfen.** Starte im Projektordner `node <Skill-Ordner>/scripts/pruefen.cjs index.html impressum.html datenschutz.html`. Danach folgt die Handprüfung aus `references/pruefung.md`.
   - Fertig für die **Vorschau** an den Kunden: 0 Fehler außer Platzhaltern. Der Kunde bekommt die Platzhalter als Liste.
   - Fertig für den **Live-Gang**: 0 Fehler, jede Warnung behoben oder in einem Satz begründet.
   - In beiden Fällen hast du die Screenshots selbst angesehen.

6. **Übergeben** nach dem Abschnitt „Übergabe“ in `references/pruefung.md`.
   - Fertig, wenn die Seite unter der Kundendomain mit HTTPS läuft und das Google-Unternehmensprofil auf sie verlinkt.
   - Der Kunde hat die Übergabe-Notiz.

## Website-Check für Interessenten

Für die Akquise prüfst du die bestehende Seite eines Betriebs: `node <Skill-Ordner>/scripts/pruefen.cjs https://seine-domain.de --out check-betriebsname`.

- Formuliere Ergebnisse als Hinweise und Chancen („lädt Schriften von Google ohne Einwilligung“), nicht als rechtliches Urteil.
- Zeig nur, was der Bericht belegt.

## Dateien im Skill

- `templates/seite/`: Startgerüst mit index, impressum, datenschutz, 404, robots.txt, sitemap.xml und `assets/`. Technisch fertig, gestalterisch neutral, alle Lücken als Platzhalter.
- `templates/PRODUCT.md`, `templates/DESIGN.md`: Vorlagen für den Auftrag und das Designsystem.
- `scripts/pruefen.cjs`: Browser-Prüfung mit Bericht und Screenshots. Braucht Node und Playwright.
- `references/`: Nachschlagen pro Schritt (intake, design, inhalt, technik, recht, pruefung).
