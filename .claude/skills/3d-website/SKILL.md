---
name: 3d-website
description: Baut oder überarbeitet Websites mit einer echten 3D-Szene, die dem Scrollen folgt (Kamerafahrt, drehendes Objekt), auf dem Niveau hochwertiger Template-Seiten. Verwenden, wenn der Nutzer eine 3D-Website, einen Scroll-Film, eine Kamerafahrt oder "so wie webild / Awwwards" verlangt.
---

# 3D-Website

Eine 3D-Seite hat genau **ein** Hauptobjekt und **eine** Kamerafahrt. Der Inhalt liegt als normales HTML darüber. Die Szene erzählt, der Text verkauft.

## 1. Vor dem Bauen klären

Frag den Nutzer, falls es nicht feststeht:

1. **Hauptobjekt:** Was steht im Mittelpunkt (Produkt, Planet, Gerät, Logo)?
2. **Bewegung:** Kamerafahrt durch die Szene, oder Objekt dreht und zerlegt sich?
3. **Look:** dunkel mit Leuchten, hell und reduziert, oder im Wechsel?
4. **Umfang:** Dürfen Texte geändert werden, oder nur der Aufbau?

Texte, Preise und Angebote bleiben wörtlich, solange der Nutzer nichts anderes sagt.

## 2. Aufbau

- Eine `<canvas>` mit `position: fixed; inset: 0; z-index: 0; pointer-events: none`. Der Inhalt liegt mit `position: relative; z-index: 1` darüber.
- Three.js lokal ablegen (`assets/3d/three.module.min.js`), als `<script type="module">` am Seitenende laden. Kein CDN, kein Build-Schritt bei statischen Seiten.
- Die Kamerafahrt ist eine Liste von Wegpunkten `[Scroll 0..1, Position, Blickziel]`. Zwischen den Punkten mit Smoothstep interpolieren.
- Scroll-Wert nur im `scroll`-Listener lesen (passiv). Im Render-Loop der Zielposition weich folgen: `k = 1 - pow(0.0015, dt)`. So ruckelt nichts, auch wenn das Scrollen springt.
- Jeder Seitenabschnitt bekommt einen eigenen Blick: Anfang nah und dramatisch, Mitte ruhig, Ende die Totale.

## 3. Qualität der Szene

- Eigene Shader statt Standard-Material: Tag/Nacht-Grenze, Rand-Leuchten (Fresnel), Atmosphäre als zweite Kugel mit `BackSide` und additivem Blending.
- Echte Daten statt Zufall, wo es geht (Küstenlinien, Städte). Zufällige Punkte sehen sofort künstlich aus.
- Texturen als WebP in zwei Größen (4k Desktop, 2k Handy). Mehrere Masken in einen Farbkanal je Maske packen.
- Eine Lichtquelle, eine Akzentfarbe. Leuchten kommt aus additivem Blending, nicht aus Bloom-Nachbearbeitung.

## 4. Lesbarkeit

- Hinter Überschriften einen weichen dunklen Verlauf legen, keinen Kasten.
- In Abschnitten mit viel Text die Szene abdunkeln (Uniform, das dem Scroll-Wert folgt).
- Boxen: halbtransparenter Verlauf mit feinem hellem Rand. **Kein `backdrop-filter`** auf vielen Elementen, das ruckelt beim Scrollen.

## 5. Leistung (Pflicht)

- `devicePixelRatio` begrenzen: 1.75 am Desktop, 1.5 am Handy. Antialiasing am Handy aus.
- Geometrie am Handy halbieren, kleinere Textur laden.
- Rendern pausieren, wenn der Tab verborgen ist (`visibilitychange`).
- Nur `transform` und `opacity` animieren. CSS-Animationen außerhalb des Sichtbereichs pausieren.
- `prefers-reduced-motion`: Zeit einfrieren, Kamera ohne Nachlauf setzen.
- Ohne WebGL oder bei Kontextverlust: Klasse `no-3d` setzen und ein Standbild zeigen. Die Seite muss ohne 3D vollständig nutzbar sein.

## 6. Prüfen, bevor es fertig heißt

1. Screenshots bei Scroll 0, 0.15, 0.35, 0.55, 0.8 und 1.0, je am Desktop (1440) und Handy (390). In Playwright braucht Chromium dafür `--use-angle=swiftshader --enable-unsafe-swiftshader`.
2. An jedem Punkt: Ist der Text lesbar? Zeigt die Kamera etwas Sinnvolles, nicht nur Schwarz?
3. Konsole ohne Fehler, `no-3d` nicht gesetzt.
4. CSS nie mit Zeilen-Regex löschen. Nur ganze Regeln entfernen und danach die Klammerbilanz des Stylesheets prüfen.

## Referenz

`assets/3d/scene.js` in diesem Repository ist die Vorlage: ein Scroll-Film vor der Seite (Gehirn, Partikel, Erde, Horizont, AI-Bühne) und danach eine Erde, die sich nur noch hinter dem Inhalt dreht.

- Ein einziger Zeitwert `S` steuert alles: 0 bis 10 sind die Szenen (Scrollen durch den leeren Abschnitt `#intro`), 10 bis 11 die Übergabe an die Seite, 11 der Hintergrund. Kamera, Licht, Partikel und Objekte lesen nur `S`, deshalb laufen sie synchron.
- `S` folgt der Scrollposition weich; ein Sprung (Anker-Link) spielt höchstens 1,6 Szenen ab.
- Kamera-Wegpunkte als Catmull-Rom-Kurve; das Endbild ist ein Endpunkt auf beiden Seiten, sonst schießt die Kamera über.
- Objekte, die nur im Endbild stehen (die AI-Bühne), werden relativ zur End-Kamera platziert und so gestellt, dass die Kamera auf dem Weg dorthin nie durch sie hindurchfliegt.
- Prüfen mit `window.__scene.set(S)` und Screenshots je Szene, am Desktop und am Handy.
