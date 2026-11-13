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
- Scrollsteuerung mit GSAP ScrollTrigger (lokal in `assets/vendor`), Glättung mit `gsap.quickTo`. Ohne GSAP: Scroll-Wert im passiven `scroll`-Listener lesen und im Render-Loop weich folgen (`k = 1 - pow(0.0015, dt)`).
- Jeder Seitenabschnitt bekommt einen eigenen Blick: Anfang nah und dramatisch, Mitte ruhig, Ende die Totale.

## 3. Qualität der Szene

- Eigene Shader statt Standard-Material: Tag/Nacht-Grenze, Rand-Leuchten (Fresnel), Atmosphäre als zweite Kugel mit `BackSide` und additivem Blending.
- Echte Daten statt Zufall, wo es geht (Küstenlinien, Städte). Zufällige Punkte sehen sofort künstlich aus.
- Texturen als WebP in zwei Größen (4k Desktop, 2k Handy). Mehrere Masken in einen Farbkanal je Maske packen.
- Eine Lichtquelle, eine Akzentfarbe. Leuchten kommt aus additivem Blending; für den fotorealistischen Glow einen leichten Bloom-Pass (`assets/3d/bloom.js`: Float-Ziel, Helligkeitsfilter, 3 bis 4 Unschärfe-Stufen, weiche Lichterschulter). Am Handy weniger und kleinere Stufen, kein MSAA.

## 4. Lesbarkeit

- Hinter Überschriften einen weichen dunklen Verlauf legen, keinen Kasten.
- In Abschnitten mit viel Text die Szene abdunkeln (Uniform, das dem Scroll-Wert folgt).
- Boxen: halbtransparenter Verlauf mit feinem hellem Rand. **Kein `backdrop-filter`** auf vielen Elementen, das ruckelt beim Scrollen.

## 5. Leistung (Pflicht)

- `devicePixelRatio` begrenzen: Leinwand höchstens 2, die 3D-Szene dahinter intern 1.75 (Desktop) bzw. 1.5 (Handy) über ihren eigenen Render-Puffer. Die Leinwand ändert ihre Größe nie während des Scrollens (keine DPR-Umschaltung zwischen Abschnitten). MSAA nur bei Szenen-DPR unter 1.5.
- Geometrie am Handy halbieren, kleinere Textur laden.
- Rendern pausieren, wenn der Tab verborgen ist (`visibilitychange`). Sonst **jeden Frame** zeichnen (kein Halbtakt), im GSAP-Ticker nach den Tweens; nur ein unverändert stehendes Bild darf die Leinwand einfach behalten.
- Kein Ruckler beim ersten Auftritt eines Objekts: Programme vorab kompilieren (`compileAhead`, parallel wo möglich) und ihren ersten Gebrauch vorziehen, Render-Targets mit `initRenderTarget` anlegen, einmal in ein 4×4-Ziel proben (Geometrie hochladen). Große Bilder mit `createImageBitmap` dekodieren und in Streifen hochladen (`assets/3d/gpu-upload.js`). `renderer.debug.checkShaderErrors` nur mit `?debug`.
- Leinwand per CSS `100lvh` und Größe aus `canvas.clientWidth/Height`: Die Adressleiste am Handy löst dann keine Neuanlage aus. Scroll-Strecken mit einer stabilen Höhe rechnen (`100svh`-Element), nicht mit `innerHeight`.
- Frame-Zeit-Regler: Kommen Frames zu spät, sinkt die interne Auflösung der 3D-Szene stufenweise. Prüfen auf dem Gerät mit `?fps`, Messen mit fester Auflösung mit `?gov=0`.
- Nur `transform` und `opacity` animieren. CSS-Animationen außerhalb des Sichtbereichs pausieren, Timer (Slideshows, Wiederholungen) nur bei Sichtbarkeit laufen lassen.
- Animationen **innerhalb** eines SVG (CSS-Rotation einer Gruppe, SMIL-Punkte) erzwingen jeden Frame Layout: Ein rotierendes Teil als eigenes SVG-Element drehen (Compositor), bewegte Punkte in eine versiegelte Box (`contain: strict`, feste Größe, `will-change: transform`) über das Bild legen.
- `prefers-reduced-motion`: Zeit einfrieren, Kamera ohne Nachlauf setzen.
- Ohne WebGL oder bei Kontextverlust: Klasse `no-3d` setzen und ein Standbild zeigen. Die Seite muss ohne 3D vollständig nutzbar sein.

## 6. Prüfen, bevor es fertig heißt

1. Screenshots bei Scroll 0, 0.15, 0.35, 0.55, 0.8 und 1.0, je am Desktop (1440) und Handy (390). In Playwright braucht Chromium dafür `--use-angle=swiftshader --enable-unsafe-swiftshader`.
2. Leistung messen statt schätzen: einmal durchscrollen und je Frame JS-Zeit, GPU-Zeit (`EXT_disjoint_timer_query_webgl2`), blockierende GL-Aufrufe, Neuanlagen von Render-Targets, Long Animation Frames und Layouts pro Frame je Abschnitt (CDP `Performance.getMetrics`) erfassen. Ziel: nach dem Laden kein Frame über ca. 8 ms Hauptthread, kein Layout pro Frame außerhalb versiegelter Boxen.
3. An jedem Punkt: Ist der Text lesbar? Zeigt die Kamera etwas Sinnvolles, nicht nur Schwarz?
4. Konsole ohne Fehler, `no-3d` nicht gesetzt.
5. CSS nie mit Zeilen-Regex löschen. Nur ganze Regeln entfernen und danach die Klammerbilanz des Stylesheets prüfen.

## Referenz

`assets/3d/scene.js` und `assets/3d/film.js` in diesem Repository sind die Vorlage: ein Einstieg vor der Seite (das Wort „Bergmann“, durch dessen Buchstaben man das AI-Endbild sieht; Scrollen fliegt in die Buchstaben, bis das Bild allein steht) und danach eine 3D-Erde, die sich nur noch hinter dem Inhalt dreht.

- Ein einziger Zeitwert `S` steuert alles: 0 bis 10 ist der Einstieg (Scrollen durch den leeren Abschnitt `#intro`; Flug 0,5 bis 6,8, danach steht das Bild), 10 bis 11 die Übergabe an die Seite, 11 der Hintergrund.
- Das Wort ist ein Distanzfeld (`assets/3d/film/word-sdf.webp`, R fein ±8 Texel, G grob ±64 Texel), damit der Umriss bei jedem Zoom (bis 45-fach) scharf bleibt. Erzeugt aus der Schrift mit PIL und `scipy.ndimage.distance_transform_edt` bei 4-facher Abtastung; der Zoom fliegt in den dicksten Strich nahe der Wortmitte (im „m“).
- Glas-Look der Buchstaben: Bild darin aufgehellt, Lichtkante innen, langsamer Lichtstreif, weiches Licht knapp außerhalb. Beim Flug blendet erst der dunkle Grund aus, dann normalisiert sich das Bild in den Buchstaben, sodass am Ende das Originalbild steht.
- Bild: nur `wide-6` (das AI-Erde-Bild des Kunden), am Handy ein engerer `safe`-Ausschnitt vom Sonnenaufgang bis zu den AI-Buchstaben; wo das Bild nicht reicht, läuft der Rand gespiegelt, unscharf und dunkler aus.
- Die Erde hinter der Seite ist fotorealistisch: echte Tag-, Nacht- und Wolkenkarten (`earth-day/night/clouds-4k.webp`, am Handy `-2k`; Solar System Scope, CC BY 4.0, Nennung im Footer), Licht im linearen Raum mit weichem Terminator, dunklerem Ozean mit Sonnenglanz, Wolkenschatten, Stadtlichtern nur auf der Nachtseite, dünnem Atmosphärensaum (Streuung blau, Morgenrot am Terminator). Kein Nebel und keine gezeichneten Linien: das wirkt künstlich.
- `S` folgt der Scrollposition weich (GSAP ScrollTrigger + `quickTo`); ein Sprung (Anker-Link) spielt höchstens 1,6 Szenen ab.
- Frühere Varianten: der Bilder-Film aus dem Storyboard (Gehirn bis AI-Endbild, mit 3D-Partikeln) im Commit `59b672a`, die prozedurale Variante komplett aus Code im Commit `bc98ffb`.
- Prüfen mit `window.__scene.set(S)` und Screenshots je Szene, am Desktop und am Handy, und mit Vor- und Zurückscrollen.
