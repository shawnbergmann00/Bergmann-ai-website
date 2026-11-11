# Auftrag klären

Ziel ist eine vollständige `PRODUCT.md` ohne einen erfundenen Satz. Arbeite mit den Fragen unten in einem Gespräch von 30 Minuten oder schick sie als Fragebogen. Jede Antwort landet in PRODUCT.md, jede fehlende Antwort wird ein Platzhalter mit konkreter Frage.

## Fragen an den Kunden

**1. Betrieb und Pflichtangaben** (für Impressum und strukturierte Daten)
- Offizieller Name, Rechtsform, Inhaber oder vertretungsberechtigte Personen
- Ladungsfähige Anschrift (kein Postfach), Telefon, E-Mail
- Registergericht und -nummer, USt-IdNr. oder Wirtschafts-IdNr., falls vorhanden
- Kammer und Berufsbezeichnung (Handwerkskammer, Steuerberater-, Rechtsanwaltskammer), Aufsichtsbehörde bei erlaubnispflichtigem Gewerbe (Makler nach § 34c GewO, Fahrschule), Pflicht-Berufshaftpflicht mit Versicherer
- Zahl der Beschäftigten und grobe Umsatzgröße. Das entscheidet über die Pflicht zur Barrierefreiheit (BFSG) und den Hinweis zur Verbraucherschlichtung.

**2. Ziel und Kunden**
- Wer ruft an: Privatleute, Firmen, beide? Aus welchem Einzugsgebiet?
- Was soll die Seite bringen: Anrufe, Termine, schriftliche Anfragen, Bewerbungen?
- Die fünf Fragen, die am Telefon am häufigsten kommen. Daraus werden die FAQ.
- Was unterscheidet den Betrieb? Nur Belegbares: Meisterbrief, Spezialisierung, Notdienst, Marken, Sprachen.

**3. Leistungen und Preise**
- Leistungen in den Worten des Betriebs, mit Preis oder ab-Preis (bei Privatkunden inkl. MwSt.) und Dauer, wenn der Kunde sie nennen mag
- Was der Betrieb bewusst nicht macht

**4. Belege**
- Link zum Google-Unternehmensprofil. Welche Bewertungen dürfen wörtlich zitiert werden (Vorname oder Initiale, Datum, Plattform)?
- Gründungsjahr, Meisterbrief, Zertifikate, Innung, Auszeichnungen, jeweils mit Nachweis
- Referenzprojekte mit Fotos und Erlaubnis des Endkunden

**5. Material**
- Logo als Vektor (SVG oder PDF), Hausfarben
- Eigene Fotos: Außenansicht mit Schild, Team bei der Arbeit, Ergebnisse vorher und nachher, Räume, Inhaber. Wer hat sie gemacht, sind alle abgebildeten Personen einverstanden?
- Vorhandene Texte, Flyer, Preislisten

**6. Kontaktwege und Zeiten**
- Wer nimmt Anrufe an, wann? Gibt es einen Notdienst?
- WhatsApp Business ja oder nein, E-Mail-Postfach, wohin Formular-Anfragen gehen sollen
- Öffnungszeiten, Betriebsurlaub, Feiertagsregel

**7. Technik und Bestand**
- Domain: wo registriert, wer hat den Zugang? E-Mail-Postfächer auf der Domain?
- Bestehende Seite: URL, was übernommen wird, welche alten Adressen weiterleiten müssen
- Google-Unternehmensprofil: Zugang vorhanden? Name, Adresse und Telefon müssen identisch mit der Website sein.
- Hosting-Wunsch (siehe `technik.md`, Abschnitt Hosting)

**8. Gewünschte externe Dienste**
- Karte, Buchungstool, Chatbot, Video, Social-Media-Einbindung. Jeder Dienst braucht Zwei-Klick und einen Abschnitt in der Datenschutzerklärung.

**9. Personal**
- Sucht der Betrieb Mitarbeiter oder Azubis? Dann wird ein Karriere-Abschnitt Pflicht. Im Handwerk blieben 2025 rechnerisch knapp 100.000 Stellen unbesetzt (KOFA Kompakt 07/2026), eine Bewerbung ist dort oft mehr wert als ein Auftrag.

**10. Ton**
- „Sie“ oder „du“? Welche Wörter benutzt der Betrieb selbst, welche sind ihm fremd?

## Bestehende Seite als Ausgangslage

Prüfe die alte Seite vor dem Gespräch: `node <Skill-Ordner>/scripts/pruefen.cjs https://alte-domain.de --out vorher`. Der Bericht zeigt Drittanbieter ohne Einwilligung, fehlende Pflichtlinks, Handy-Probleme und Ladegewicht. Er ist zugleich der Vorher-Stand für den späteren Vorher-nachher-Vergleich.

## Ergebnis

- `PRODUCT.md` aus `templates/PRODUCT.md`, vollständig oder mit Platzhaltern
- „Offene Fragen an den Kunden“ als nummerierte Liste am Ende von PRODUCT.md, jede Frage so konkret, dass der Kunde sie in einem Satz beantworten kann
