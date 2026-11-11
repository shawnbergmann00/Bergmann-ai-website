#!/usr/bin/env node
/*
 * Prüft eine statische Website im echten Browser, bevor sie zum Kunden geht.
 *
 *   node pruefen.cjs <index.html> [weitere.html ...] [--out <ordner>] [--erlaube <host,host>]
 *   node pruefen.cjs https://beispiel.de [--out <ordner>]
 *
 * Lokale Dateien werden über einen kleinen eigenen Server ausgeliefert (wie später beim Hoster).
 * Ergebnis: bericht.md und Screenshots (handy/desktop) im Ausgabeordner, Exit-Code 1 bei FEHLER.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  console.error('Playwright nicht gefunden. Installieren: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

/* ---------- Argumente ---------- */
const args = process.argv.slice(2);
const ziele = [];
let outDir = null;
let erlaubt = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--out') outDir = args[++i];
  else if (args[i] === '--erlaube') erlaubt = String(args[++i] || '').split(',').map((h) => h.trim()).filter(Boolean);
  else if (args[i] === '-h' || args[i] === '--help') { console.log(fs.readFileSync(__filename, 'utf8').split('*/')[0]); process.exit(0); }
  else ziele.push(args[i]);
}
if (!ziele.length) { console.error('Aufruf: node pruefen.cjs <index.html|URL> [weitere.html ...] [--out ordner] [--erlaube host]'); process.exit(2); }

const istUrl = (s) => /^https?:\/\//i.test(s);
const remote = istUrl(ziele[0]);
const wurzel = remote ? null : path.dirname(path.resolve(ziele[0]));
if (!remote) for (const z of ziele) {
  if (istUrl(z)) { console.error('Bitte nicht lokale Dateien und URLs mischen.'); process.exit(2); }
  if (!fs.existsSync(z)) { console.error('Datei nicht gefunden: ' + z); process.exit(2); }
  if (path.dirname(path.resolve(z)) !== wurzel && !path.resolve(z).startsWith(wurzel + path.sep)) {
    console.error('Alle Seiten müssen im Ordner der ersten Seite liegen: ' + z); process.exit(2);
  }
}
outDir = path.resolve(outDir || (remote ? '.pruefung' : path.join(wurzel, '.pruefung')));
fs.mkdirSync(outDir, { recursive: true });

/* ---------- Mini-Server für lokale Dateien ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.pdf': 'application/pdf',
};
function starteServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const datei = path.join(wurzel, p);
      if (!datei.startsWith(wurzel)) { res.writeHead(403); return res.end(); }
      fs.readFile(datei, (err, buf) => {
        if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); return res.end('404'); }
        res.writeHead(200, { 'content-type': MIME[path.extname(datei).toLowerCase()] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

/* ---------- Prüfungen im Browser ---------- */
function seitenPruefung(opts) {
  const { istHandy } = opts;
  const beschreibe = (el) => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    else if (el.classList && el.classList.length) s += '.' + [...el.classList].slice(0, 2).join('.');
    const t = (el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    return t ? s + ' „' + t + '“' : s;
  };
  const versteckt = (el) => !!el.closest('[aria-hidden="true"]');
  const r = { fehler: [], warn: [], info: [] };
  const F = (m) => r.fehler.push(m), W = (m) => r.warn.push(m), I = (m) => r.info.push(m);
  const doc = document;

  /* Kopf und Metadaten */
  const lang = doc.documentElement.getAttribute('lang');
  if (!lang) F('<html> hat kein lang-Attribut (für Deutsch: lang="de").');
  const titel = (doc.title || '').trim();
  if (!titel) F('Seitentitel (<title>) fehlt.');
  else if (titel.length > 65) W('Titel ist ' + titel.length + ' Zeichen lang, Google kürzt ab etwa 60: „' + titel + '“');
  const meta = (n) => doc.querySelector('meta[name="' + n + '"]');
  const og = (p) => doc.querySelector('meta[property="' + p + '"]');
  if (!meta('viewport')) F('meta viewport fehlt, die Seite wird auf dem Handy verkleinert dargestellt.');
  // Seiten mit noindex (Impressum, Datenschutz) brauchen keine Such- und Teilen-Angaben
  const noindex = /noindex/i.test((meta('robots') || {}).content || '');
  const desc = meta('description') && meta('description').content.trim();
  if (!desc && !noindex) W('meta description fehlt (Text unter dem Titel in Google).');
  else if (desc && desc.length > 160) W('meta description ist ' + desc.length + ' Zeichen lang, empfohlen bis etwa 155.');
  if (!noindex && !doc.querySelector('link[rel="canonical"]')) W('link rel="canonical" fehlt.');
  const ogFehlt = ['og:title', 'og:description', 'og:image'].filter((p) => !og(p));
  if (ogFehlt.length && !noindex) W('Vorschau beim Teilen (WhatsApp, Facebook) unvollständig, es fehlt: ' + ogFehlt.join(', ') + '.');
  if (!doc.querySelector('link[rel~="icon"]')) W('Favicon (link rel="icon") fehlt.');

  /* Strukturierte Daten */
  const ld = [...doc.querySelectorAll('script[type="application/ld+json"]')];
  const typen = [];
  ld.forEach((s, i) => {
    try {
      const j = JSON.parse(s.textContent);
      (Array.isArray(j) ? j : (j['@graph'] || [j])).forEach((o) => [].concat(o['@type'] || []).forEach((t) => typen.push(t)));
    } catch (e) { F('JSON-LD-Block ' + (i + 1) + ' ist kein gültiges JSON: ' + e.message); }
  });
  if (!ld.length && !noindex) W('Keine strukturierten Daten (JSON-LD, z. B. LocalBusiness) für Google.');
  else I('JSON-LD-Typen: ' + (typen.join(', ') || 'keine'));

  /* Platzhalter und Blindtext */
  const sichtbarerText = (doc.body.innerText || '') + ' ' + titel + ' ' + (desc || '');
  const muster = /\[FEHLT[^\]]*\]|lorem ipsum|\bTODO\b|\bXXX\b|Musterstra(ß|ss)e|Max Mustermann/gi;
  const treffer = [...new Set((sichtbarerText.match(muster) || []).map((x) => x.slice(0, 80)))];
  const ldText = ld.map((s) => s.textContent).join(' ');
  const ldTreffer = [...new Set((ldText.match(muster) || []).map((x) => x.slice(0, 80)))];
  if (treffer.length) F('Platzhalter oder Blindtext auf der Seite: ' + treffer.slice(0, 8).join(' · '));
  if (ldTreffer.length) F('Platzhalter in den strukturierten Daten: ' + ldTreffer.slice(0, 5).join(' · '));
  const quellTreffer = [...new Set((doc.documentElement.outerHTML.match(/\[FEHLT[^\]]*\]/g) || []))]
    .filter((x) => !treffer.includes(x.slice(0, 80)) && !ldTreffer.includes(x.slice(0, 80)));
  if (quellTreffer.length) F('Platzhalter im Quelltext (Meta-Tags, Attribute, Skripte): ' + quellTreffer.slice(0, 6).join(' · '));

  /* Überschriften */
  const hs = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter((h) => !versteckt(h));
  const h1 = hs.filter((h) => h.tagName === 'H1');
  if (h1.length === 0) F('Keine H1-Überschrift.');
  if (h1.length > 1) W(h1.length + ' H1-Überschriften, üblich ist genau eine pro Seite.');
  let vor = 0; const spruenge = [];
  hs.forEach((h) => { const n = +h.tagName[1]; if (vor && n > vor + 1) spruenge.push('H' + vor + '→H' + n + ' bei ' + beschreibe(h)); vor = n; });
  if (spruenge.length) W('Überschriften-Ebenen übersprungen: ' + spruenge.slice(0, 4).join('; '));

  /* Bilder */
  const imgs = [...doc.images];
  const ohneAlt = imgs.filter((i) => !i.hasAttribute('alt') && !versteckt(i));
  if (ohneAlt.length) F(ohneAlt.length + ' Bild(er) ohne alt-Attribut (dekorativ: alt=""): ' + ohneAlt.slice(0, 4).map((i) => i.currentSrc || i.src).join(', '));
  const ohneMasse = imgs.filter((i) => !(i.getAttribute('width') && i.getAttribute('height')) && i.getBoundingClientRect().width > 0);
  if (ohneMasse.length) W(ohneMasse.length + ' Bild(er) ohne width/height, das lässt das Layout beim Laden springen: ' + ohneMasse.slice(0, 4).map((i) => (i.currentSrc || i.src).split('/').pop()).join(', '));
  // Echte Handys haben 3-fache, Laptops 2-fache Pixeldichte; kleine Dateien (unter 40 KB) sind egal
  const dichte = istHandy ? 3 : 2;
  const kb = (i) => { const e = performance.getEntriesByName(i.currentSrc || i.src)[0]; return e ? (e.encodedBodySize || e.transferSize || 0) / 1024 : 0; };
  const zuGross = imgs.filter((i) => { const w = i.getBoundingClientRect().width; return w > 40 && i.naturalWidth > w * dichte * 1.3 && kb(i) > 40; });
  if (zuGross.length) W(zuGross.length + ' Bild(er) viel größer geliefert als angezeigt (srcset/sizes nutzen): ' + zuGross.slice(0, 4).map((i) => (i.currentSrc || i.src).split('/').pop() + ' ' + i.naturalWidth + 'px für ' + Math.round(i.getBoundingClientRect().width) + 'px').join(', '));
  const kaputt = imgs.filter((i) => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src));
  if (kaputt.length) F(kaputt.length + ' Bild(er) laden nicht: ' + kaputt.slice(0, 4).map((i) => i.currentSrc || i.src).join(', '));

  /* Links und Bedienelemente */
  const links = [...doc.querySelectorAll('a[href]')];
  const ids = new Set([...doc.querySelectorAll('[id]')].map((e) => e.id));
  const fehlZiel = links.filter((a) => { const h = a.getAttribute('href'); return h.startsWith('#') && h.length > 1 && !ids.has(decodeURIComponent(h.slice(1))); });
  if (fehlZiel.length) F('Sprungmarken ohne Ziel: ' + [...new Set(fehlZiel.map((a) => a.getAttribute('href')))].slice(0, 6).join(', '));
  const leer = links.filter((a) => a.getAttribute('href') === '#' && !a.hasAttribute('data-demo') && !a.getAttribute('role'));
  if (leer.length) W(leer.length + ' Link(s) mit href="#" (führen nirgendwohin).');
  const rechts = (re) => links.find((a) => re.test((a.innerText || '') + ' ' + (a.getAttribute('aria-label') || '') + ' ' + a.getAttribute('href')));
  const imp = rechts(/impressum/i), dse = rechts(/datenschutz/i);
  if (!imp) F('Kein Link zum Impressum gefunden (§ 5 DDG: leicht erkennbar, unmittelbar erreichbar).');
  if (!dse) F('Kein Link zur Datenschutzerklärung gefunden.');
  const fremdeRechtstexte = [...new Set([imp, dse].filter((a) => a && a.hostname && a.hostname !== location.hostname).map((a) => a.hostname))];
  if (fremdeRechtstexte.length) W('Rechtstexte liegen auf fremder Domain (' + fremdeRechtstexte.join(', ') + '). Besser als eigene Seiten (impressum.html, datenschutz.html) ausliefern.');
  if (!noindex && !links.some((a) => a.protocol === 'tel:')) W('Kein Anruf-Link (tel:). Für lokale Betriebe ist der Anruf meist die wichtigste Aktion.');
  const ohneNoopener = links.filter((a) => a.target === '_blank' && !/noopener|noreferrer/.test(a.rel));
  if (ohneNoopener.length) W(ohneNoopener.length + ' Link(s) mit target="_blank" ohne rel="noopener".');

  const nameVon = (el) => {
    const lb = el.getAttribute('aria-labelledby');
    if (lb) return lb.split(/\s+/).map((id) => (doc.getElementById(id) || {}).textContent || '').join(' ').trim();
    return (el.getAttribute('aria-label') || el.innerText || el.getAttribute('title') || el.value ||
      [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ') ||
      [...el.querySelectorAll('svg title')].map((t) => t.textContent).join(' ') || '').trim();
  };
  const bedien = [...doc.querySelectorAll('a[href], button, [role="button"], input[type="submit"], input[type="button"]')].filter((e) => !versteckt(e));
  const namenlos = bedien.filter((e) => !nameVon(e));
  if (namenlos.length) F(namenlos.length + ' Link(s)/Button(s) ohne erkennbaren Namen für Screenreader: ' + namenlos.slice(0, 4).map(beschreibe).join(', '));

  const felder = [...doc.querySelectorAll('input, select, textarea')].filter((e) => !versteckt(e) && !['hidden', 'submit', 'button', 'reset', 'image'].includes(e.type));
  const ohneLabel = felder.filter((e) => !(e.labels && e.labels.length) && !e.getAttribute('aria-label') && !e.getAttribute('aria-labelledby'));
  if (ohneLabel.length) F(ohneLabel.length + ' Formularfeld(er) ohne Beschriftung (label): ' + ohneLabel.slice(0, 4).map((e) => e.name || e.id || e.type).join(', '));

  if (istHandy) {
    const klein = bedien.filter((e) => {
      if (e.closest('p, td') && e.tagName === 'A') return false; // Links im Fließtext sind ausgenommen
      const b = e.getBoundingClientRect();
      if (b.width <= 2 || b.height <= 2) return false; // nur für Screenreader sichtbar (z. B. Sprunglink)
      return b.width < 24 || b.height < 24;
    });
    if (klein.length) W(klein.length + ' Bedienelement(e) kleiner als 24×24 px (WCAG 2.5.8; erlaubt, wenn genug Abstand ringsum): ' + klein.slice(0, 4).map(beschreibe).join(', '));

    const vw = doc.documentElement.clientWidth, sw = doc.documentElement.scrollWidth;
    if (sw > vw + 1) {
      const raus = [...doc.querySelectorAll('body *')].filter((el) => {
        const b = el.getBoundingClientRect();
        if (!b.width || getComputedStyle(el).position === 'fixed') return false;
        // Box ragt raus, oder Text läuft über die Box hinaus (lange Wörter, nowrap)
        return b.right > vw + 1 || (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX === 'visible' && el.clientWidth > 0);
      }).slice(0, 5).map(beschreibe);
      F('Seite ist auf dem Handy ' + (sw - vw) + ' px zu breit (seitliches Wischen). Zu breit: ' + raus.join(', '));
    }
  }

  /* Kontrast (Näherung: einfarbige Hintergründe; Bilder/Verläufe werden übersprungen) */
  const farbe = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(parseFloat); return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }; };
  const ueber = (o, u) => ({ r: o.r * o.a + u.r * (1 - o.a), g: o.g * o.a + u.g * (1 - o.a), b: o.b * o.a + u.b * (1 - o.a), a: 1 });
  const lum = (c) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b); };
  const kontrast = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const schwach = new Map();
  const tw = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  let knoten; let geprueft = 0;
  while ((knoten = tw.nextNode()) && geprueft < 4000) {
    if (!knoten.textContent.trim()) continue;
    const el = knoten.parentElement; if (!el || versteckt(el)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity === 0 || !el.getClientRects().length) continue;
    geprueft++;
    let schichten = [], e = el, unklar = false;
    while (e) {
      const s = getComputedStyle(e);
      if (s.backgroundImage && s.backgroundImage !== 'none') { unklar = true; break; }
      const bg = farbe(s.backgroundColor);
      if (bg && bg.a > 0) { schichten.push(bg); if (bg.a >= 1) break; }
      e = e.parentElement;
    }
    if (unklar) continue;
    let grund = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = schichten.length - 1; i >= 0; i--) grund = ueber(schichten[i], grund);
    let tf = farbe(cs.color); if (!tf) continue; tf = ueber(tf, grund);
    const k = kontrast(tf, grund);
    const px = parseFloat(cs.fontSize), fett = parseInt(cs.fontWeight, 10) >= 700;
    const soll = (px >= 24 || (px >= 18.66 && fett)) ? 3 : 4.5;
    if (k < soll) { const key = beschreibe(el); if (!schwach.has(key)) schwach.set(key, k.toFixed(2) + ':1 (Soll ' + soll + ':1)'); }
  }
  if (schwach.size) W(schwach.size + ' Textstelle(n) mit zu wenig Kontrast (Näherung, bitte ansehen): ' + [...schwach].slice(0, 6).map(([k, v]) => k + ' ' + v).join('; '));

  return r;
}

/* ---------- Ablauf ---------- */
(async () => {
  const srv = remote ? null : await starteServer();
  const basis = remote ? null : 'http://127.0.0.1:' + srv.address().port + '/';
  const browser = await chromium.launch();
  const ansichten = [
    { name: 'handy', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 },
    { name: 'desktop', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
  ];
  const ergebnisse = [];

  for (const ziel of ziele) {
    const url = remote ? ziel : basis + path.relative(wurzel, path.resolve(ziel)).split(path.sep).join('/');
    const eigenerHost = new URL(url).host;
    const kuerzel = remote ? new URL(url).hostname : path.basename(ziel, '.html');
    const seite = { ziel, fehler: [], warn: [], info: [], bilder: [] };

    for (const a of ansichten) {
      const ctx = await browser.newContext({ viewport: a.viewport, isMobile: a.isMobile, hasTouch: a.hasTouch, deviceScaleFactor: a.deviceScaleFactor, locale: 'de-DE' });
      const page = await ctx.newPage();
      const fremd = new Set(), kaputt = new Set(), konsole = new Set(), schrift = new Set();
      let bytes = 0, groesste = { url: '', b: 0 }; const offen = [];
      page.on('request', (req) => {
        const u = new URL(req.url());
        if (!/^https?:$/.test(u.protocol)) return;
        if (u.host !== eigenerHost && !erlaubt.includes(u.hostname)) fremd.add(u.hostname);
        if (req.resourceType() === 'font' && !/\.woff2(\?|$)/i.test(u.pathname)) schrift.add(u.pathname.split('/').pop());
      });
      page.on('requestfinished', (req) => offen.push(req.sizes().then((s) => {
        const b = (s.responseBodySize || 0) + (s.responseHeadersSize || 0); bytes += b;
        if (b > groesste.b) groesste = { url: req.url(), b };
      }).catch(() => {})));
      page.on('requestfailed', (req) => { if (new URL(req.url()).host === eigenerHost) kaputt.add(req.url() + ' (' + (req.failure() || {}).errorText + ')'); });
      page.on('response', (res) => { if (res.status() >= 400 && new URL(res.url()).host === eigenerHost) kaputt.add(res.url() + ' (' + res.status() + ')'); });
      page.on('console', (m) => { if (m.type() === 'error') konsole.add(m.text().slice(0, 200)); });
      page.on('pageerror', (e) => konsole.add('JS-Fehler: ' + String(e.message).slice(0, 200)));

      try { await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }); }
      catch (e) { seite.fehler.push('[' + a.name + '] Seite lädt nicht: ' + e.message.split('\n')[0]); await ctx.close(); continue; }

      // Einmal langsam nach unten scrollen, damit Lazy-Loading und Einblendungen auslösen
      await page.evaluate(async () => {
        document.documentElement.style.scrollBehavior = 'auto'; // sanftes Scrollen würde die Aufnahme verschieben
        const schritt = Math.max(300, Math.floor(innerHeight * 0.8));
        for (let y = 0; y < document.documentElement.scrollHeight; y += schritt) { scrollTo({ top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 120)); }
        scrollTo({ top: 0, behavior: 'instant' });
      });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(700);
      await Promise.all(offen);

      const r = await page.evaluate(seitenPruefung, { istHandy: a.name === 'handy' });
      const tag = (m) => '[' + a.name + '] ' + m;
      if (a.name === 'handy') { seite.fehler.push(...r.fehler); seite.warn.push(...r.warn); seite.info.push(...r.info); }
      else {
        // Desktop: nur Meldungen, die auf dem Handy nicht schon kamen
        r.fehler.filter((m) => !seite.fehler.includes(m)).forEach((m) => seite.fehler.push(tag(m)));
        r.warn.filter((m) => !seite.warn.includes(m) && /Kontrast|Bild/.test(m)).forEach((m) => seite.warn.push(tag(m)));
      }
      if (fremd.size) seite.fehler.push(tag('Verbindungen zu Drittanbietern ohne Einwilligung: ' + [...fremd].join(', ') + '. Lokal einbinden oder erst nach Klick laden (§ 25 TDDDG).'));
      if (kaputt.size) seite.fehler.push(tag('Eigene Dateien fehlen oder liefern Fehler: ' + [...kaputt].slice(0, 6).join(', ')));
      if (konsole.size) seite.fehler.push(tag('Fehler in der Browser-Konsole: ' + [...konsole].slice(0, 4).join(' | ')));
      if (schrift.size && a.name === 'handy') seite.warn.push('Schriften nicht als WOFF2 (größer als nötig): ' + [...schrift].join(', '));
      if (a.name === 'handy') {
        const mb = (bytes / 1048576).toFixed(2);
        seite.info.push('Übertragen beim Laden (Handy): ' + mb + ' MB, größte Datei: ' + groesste.url.split('/').pop() + ' (' + Math.round(groesste.b / 1024) + ' KB)');
        if (bytes > 1.5 * 1048576) seite.warn.push('Seite überträgt ' + mb + ' MB, Ziel für Handy-Netz: unter 1,5 MB.');
      }
      // Erster Bildschirm (was der Kunde beim Öffnen sieht) und ganze Seite.
      // In der Ganzseiten-Aufnahme erscheinen fixierte Leisten an zufälliger Stelle: Aufnahme-Effekt, kein Fehler.
      const oben = path.join(outDir, kuerzel + '-' + a.name + '-oben.png');
      const ganz = path.join(outDir, kuerzel + '-' + a.name + '-ganz.png');
      await page.screenshot({ path: oben }).catch(() => {});
      await page.screenshot({ path: ganz, fullPage: true }).catch(() => {});
      seite.bilder.push(oben, ganz);
      await ctx.close();
    }
    ergebnisse.push(seite);
  }
  await browser.close();
  if (srv) srv.close();

  /* ---------- Bericht ---------- */
  const zeilen = ['# Prüfbericht', '', 'Erstellt: ' + new Date().toLocaleString('de-DE'), ''];
  let gesamtFehler = 0;
  for (const s of ergebnisse) {
    s.fehler = [...new Set(s.fehler)]; s.warn = [...new Set(s.warn)];
    gesamtFehler += s.fehler.length;
    zeilen.push('## ' + s.ziel, '', s.fehler.length ? '**' + s.fehler.length + ' Fehler, ' + s.warn.length + ' Warnungen**' : '**Keine Fehler**, ' + s.warn.length + ' Warnungen', '');
    if (s.fehler.length) zeilen.push('### Fehler (vor der Übergabe beheben)', ...s.fehler.map((m) => '- ' + m), '');
    if (s.warn.length) zeilen.push('### Warnungen (ansehen und entscheiden)', ...s.warn.map((m) => '- ' + m), '');
    if (s.info.length) zeilen.push('### Info', ...s.info.map((m) => '- ' + m), '');
    zeilen.push('### Screenshots', ...s.bilder.map((b) => '- ' + b), '');
  }
  const berichtPfad = path.join(outDir, 'bericht.md');
  fs.writeFileSync(berichtPfad, zeilen.join('\n'));
  console.log(zeilen.join('\n'));
  console.log('\nBericht: ' + berichtPfad);
  process.exit(gesamtFehler ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
