# Gestaltung festlegen

Ziel ist eine `DESIGN.md`, nach der jemand anderes die Seite gleich bauen würde. Das Format entspricht der DESIGN.md von Bergmann AI: Tokens im Kopf, danach Leitidee, Farben, Schrift, Layout, Tiefe, Formen, Komponenten sowie Do's und Don'ts. Design-Skills wie `impeccable` können dieses Format lesen.

## Leitidee

Eine Seite wird unverwechselbar, wenn ihre Gestaltung aus dem Betrieb selbst kommt: aus seinem Material, seinen Werkzeugen, seinem Ort, seiner typischen Bewegung. Formuliere die Leitidee als Bild in zwei bis fünf Wörtern und leite daraus ein **Signatur-Element** ab, das die Seite trägt.

| Betrieb | Leitidee (Beispiel) | Signatur-Element (Beispiel) |
|---|---|---|
| Bergmann AI | Das Liniennetz bei Nacht | Abläufe als Linien mit Stationen, ein Lichtpunkt fährt mit |
| Kfz-Werkstatt | Prüfprotokoll mit Ölspur | Leistungen als abhakbares Prüfprotokoll |
| Friseursalon | Spiegel und warmes Licht | Vorher-nachher als Spiegelpaar |
| SHK-Betrieb | Der Leitungsplan | Ablauf als Rohrleitung mit Abzweigen |
| Steuerkanzlei | Ordnung im Belegordner | Register-Reiter als Navigation |
| Pension | Schlüsselbrett am Empfang | Zimmer als Schlüsselanhänger mit Nummer |

Notiere in DESIGN.md auch, welchen Standard die Seite bewusst ersetzt, zum Beispiel „Diagramme auf dunklen Tafeln statt Reihen gleicher Icon-Karten“. Das hält spätere Änderungen auf Kurs.

## Farben

- Tokens: Grund, Fläche, Text, Leise, Linie und **genau eine Aktionsfarbe** mit ihrer Textfarbe. Weitere Farben bekommen eine feste, benannte Aufgabe (bei Bergmann AI: eine Farbe pro Linie).
- Kontraste nach WCAG 2.2 AA: Fließtext mindestens 4,5:1. Große Schrift (ab 24 px, oder ab 18,66 px fett) und Ränder von Bedienelementen und Fokus mindestens 3:1.
- Ist die Hausfarbe zu hell für Text oder Knöpfe, nimm für die Aktion eine dunklere Stufe derselben Farbe und die Hausfarbe für Flächen und Akzente.
- Kontrast schnell rechnen:
  ```bash
  node -e 'const L=h=>{const c=h.match(/\w\w/g).map(x=>{x=parseInt(x,16)/255;return x<=.03928?x/12.92:((x+.055)/1.055)**2.4});return .2126*c[0]+.7152*c[1]+.0722*c[2]};const[a,b]=process.argv.slice(1).map(L);console.log(((Math.max(a,b)+.05)/(Math.min(a,b)+.05)).toFixed(2)+":1")' 1b1d1f ffffff
  ```

## Schrift

- Höchstens zwei Familien: eine für Überschriften mit Charakter, eine ruhige für Text. Eine dritte (Mono o. ä.) nur, wenn die Leitidee sie braucht, mit klar begrenzter Aufgabe.
- Nur Schriften mit freier Lizenz (z. B. OFL), selbst gehostet als WOFF2. Umwandeln steht in `technik.md`, die Lizenzdatei kommt mit ins Projekt.
- Überschriften mit `clamp()`. Lange deutsche Wörter brechen mit `overflow-wrap: break-word; hyphens: auto` (ist in der Vorlage gesetzt). Prüf die H1 mit dem längsten echten Wort des Betriebs auf 390 px Breite.

## Bilder

- Echte Fotos des Betriebs schlagen jede Illustration. Schick dem Kunden die Fotoliste aus `intake.md`. Handyfotos bei Tageslicht und im Querformat reichen oft.
- Stockfotos nur für Stimmung, nie als „unser Team“ oder „unsere Arbeit“. Dasselbe gilt für KI-Bilder (siehe `recht.md`).
- Bis echte Fotos da sind, bleibt der Bildplatz ein Platzhalter.

## Bewegung

- Eine Signatur-Bewegung, die zur Leitidee passt. Alles andere bleibt ruhig.
- Dauer 150 bis 400 ms, Kurve `cubic-bezier(0.23, 1, 0.32, 1)`.
- Unter `prefers-reduced-motion: reduce` zeigt die Seite den Endzustand. Inhalte sind auch ohne JavaScript sichtbar.

## Layout

- Vom Handy aus denken, 390 px Breite zuerst. Ein Abschnitt hat eine Aufgabe: eine Überschrift, ein Text, ein Element.
- Abstände aus einer 4/8-Skala, wenige Breakpoints, eine Containerbreite.
- Die Anrufleiste der Vorlage bleibt auf dem Handy, solange der Betrieb telefonisch erreichbar ist.

## DESIGN.md fertig

Fertig ist DESIGN.md, wenn sie Folgendes enthält:
- Leitidee und Signatur-Element,
- abgelehnten Standard,
- alle Tokens mit Kontrastwerten,
- Schriften mit Lizenz,
- Komponenten (Knopf, Navigation, Abschnittskopf, Signatur-Element),
- mindestens drei benannte Regeln („Die Eine-Aktion-Regel …“).
