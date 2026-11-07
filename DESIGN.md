---
name: Bergmann AI
description: KI-Chatbots, Automatisierung und Websites für kleine Betriebe, gezeichnet als Liniennetz über einem leuchtenden Planeten.
colors:
  hellblau: "#8fe3ff"
  accent-ink: "#04121a"
  line-mail: "#ffb15c"
  line-office: "#6fdc9c"
  space-ground: "#05090c"
  inverse-ground: "#071219"
  surface: "#0c161c"
  board: "#0a161d"
  board-raised: "#10232d"
  board-line: "#1f3d4c"
  ink: "#eef6fa"
  muted: "#9db4c0"
  board-muted: "#9fb9c6"
  stop-white: "#f4fafc"
  tag-ink: "#0d2230"
typography:
  display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(40px, 5.6vw, 84px)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(30px, 1.72vw + 23.3px, 48px)"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.015em"
  lead:
    fontFamily: "Work Sans, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Work Sans, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Work Sans, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1
  line-code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1
rounded:
  tag: "6px"
  sm: "8px"
  md: "12px"
  float: "16px"
  lg: "20px"
  pill: "999px"
spacing:
  s-1: "4px"
  s-2: "8px"
  s-3: "12px"
  s-4: "16px"
  s-5: "24px"
  s-6: "32px"
  s-7: "48px"
  s-8: "64px"
  s-9: "96px"
components:
  button-primary:
    backgroundColor: "{colors.hellblau}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "0 24px"
  button-secondary:
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "44px"
    padding: "0 24px"
  line-tag-chat:
    backgroundColor: "{colors.hellblau}"
    textColor: "{colors.tag-ink}"
    typography: "{typography.line-code}"
    rounded: "{rounded.tag}"
    height: "24px"
    padding: "0 7px"
  line-tag-mail:
    backgroundColor: "{colors.line-mail}"
    textColor: "{colors.tag-ink}"
    typography: "{typography.line-code}"
    rounded: "{rounded.tag}"
    height: "24px"
    padding: "0 7px"
  line-tag-office:
    backgroundColor: "{colors.line-office}"
    textColor: "{colors.tag-ink}"
    typography: "{typography.line-code}"
    rounded: "{rounded.tag}"
    height: "24px"
    padding: "0 7px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "40px"
    padding: "0 14px"
  chip-selected:
    backgroundColor: "{colors.hellblau}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    height: "40px"
  line-tab:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 18px 0 8px"
  line-tab-selected:
    backgroundColor: "{colors.hellblau}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.pill}"
    height: "44px"
  board:
    backgroundColor: "{colors.board}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "64px"
---

# Design System: Bergmann AI

## Overview

**Creative North Star: "Das Liniennetz bei Nacht"**

Every workflow is a transit line. Requests ride from station to station across a glowing planet surface, set on a near-black space ground. The page explains automation by drawing it: routes, stops, riding light points, and dark diagram boards stand in for the usual agency rows of icon cards (the rejected default).

The mood is calm, nocturnal and technical, close to the JARVIS cockpit: dark ground, one cold light-blue accent, glow instead of hard edges. Density is moderate; each section holds one heading, one muted continuation, and one board or list. Faint line art (meshes, workflow chains, gears) runs behind the page after the hero, always under the content.

**Key Characteristics:**
- Dark space ground with soft cyan glow; light comes from the accent, not from white surfaces.
- Three named lines (C1 Chatbot, M2 E-Mail, B3 Büro) carry a fixed color each, everywhere.
- Diagrams live on dark boards; motion is a light point riding a line.
- Bold, tight Bricolage headings, quiet Work Sans text, Geist Mono only for line codes and times.

## Colors

One cold accent on a blue-black ground, plus two line colors that exist only to tell the three lines apart.

### Primary
- **Hellblau** (hellblau): The single action and highlight color. Primary buttons, selected chips and tabs, the highlighted word in the hero heading, focus outlines, selection, the C1 line, the planet's atmosphere and every glow. Text on it is always Accent Ink.

### Secondary
- **Signal Orange** (line-mail): The M2 E-Mail line only: its route, its tag, its wires in the service diagrams, and the "waiting" status dot in the cockpit.

### Tertiary
- **Station Green** (line-office): The B3 Büro line only: its route and tag, plus "done/online" status text in the cockpit and inbox mocks.

### Neutral
- **Space Ground** (space-ground): Page and hero background; the hero fades into it at the bottom.
- **Inverse Ground** (inverse-ground): The JARVIS band, laid as a translucent gradient so the tech background still shows through.
- **Surface** (surface): Resting fill of chips and line tabs.
- **Board / Board Raised / Board Line** (board, board-raised, board-line): The diagram tables, their inner nodes and rows, and their hairlines.
- **Ink** (ink): Headings and body text on the dark ground.
- **Muted / Board Muted** (muted, board-muted): The muted half of every section heading, descriptions, price labels, times.
- **Stop White** (stop-white): Station rings on routes and the planet, and the pressed outline of map-key buttons.
- **Tag Ink / Accent Ink** (tag-ink, accent-ink): Dark text set on Hellblau and on the line tags.

### Named Rules
**The Three Lines Rule.** Hellblau, Orange and Grün each belong to exactly one line (C1, M2, B3). A line keeps its color in the hero, the route boards, tags, price dots and list bullets. Outside their lines they appear only as status signals (waiting, done); never as a general accent.

**The One Light Rule.** Hellblau is the only color that glows or acts. A second action color does not exist.

## Typography

**Display Font:** Bricolage Grotesque (self-hosted, 400/700; fallback system-ui)
**Body Font:** Work Sans (self-hosted, 400/700; fallback system-ui)
**Label/Mono Font:** Geist Mono (self-hosted, 400; fallback ui-monospace)

**Character:** A heavy, slightly quirky grotesque with tight tracking for headings against a plain, readable sans for everything else; the mono is reserved for the transit vocabulary.

### Hierarchy
- **Display**: Hero heading only, centered, at most 14ch wide; one word may be set in Hellblau.
- **Headline**: Section headings. The heading is a two-part sentence: a statement in Ink, then a muted continuation in the same size.
- **Title**: Station names, offer names, board headings (19 to 28px depending on board size, always Bricolage 700).
- **Lead**: The hero sub and section intros (18px phone, 20px from 1024px), max about 40em.
- **Body**: Descriptions on boards and lists (16 to 17px), board copy at about 26ch.
- **Label**: Buttons, chips, tabs (Work Sans 500, 13 to 16px).
- **Line code**: C1/M2/B3 tags, times, cockpit counters (Geist Mono 13px, 12px inside mocks).

### Named Rules
**The Mono Is Transit Rule.** Geist Mono appears only on line codes, timestamps and counters. Body copy, buttons and headings never use it.

**The Two-Tone Heading Rule.** Section headings carry their own subtitle as a muted second sentence instead of a separate label above them.

## Layout

One 1280px container with 80px gutters at desktop (48px at 640 to 1023, 24px on phones). Spacing follows a 4/8 scale (s-1 to s-10). Sections are padded 120px above and 72px below (96/48 on phones) and grow with their content below 1024px.

The hero fills the viewport: centered heading, lead and two buttons over a planet arc anchored to the bottom. Boards sit on a 12-column grid (for example chips at 5 columns beside a 7-column board). Routes run horizontally in four stops at desktop and turn into a vertical line with stops on the left below 900px; the riding train is hidden there. Price offers are rows with hairlines, reflowing at 1024 and 640px. Breakpoints in use: 480, 640, 900, 1024px.

The tech line-art background starts below the hero, masked in at the top and out at the bottom, at 50% opacity (38% on phones).

## Elevation & Depth

Depth is light, not shadow. Dark boards rise off the ground with a 1px hairline and a wide, soft cyan glow below; primary buttons carry a Hellblau halo; the planet has an atmosphere ring and a blurred horizon glow. Neutral dark drop shadows appear only under floating objects (chat card, consent panel, device mockups).

### Shadow Vocabulary
- **Board glow** (`0 0 0 1px rgb(143 227 255 / .03), 0 40px 80px -40px rgb(40 140 190 / .35)`): every diagram board.
- **Action halo** (`0 0 0 1px rgb(143 227 255 / .4), 0 10px 30px -8px rgb(143 227 255 / .55)`): primary buttons.
- **Featured glow** (`0 30px 60px -30px rgb(40 140 190 / .45)`): the one highlighted offer row.
- **Float** (`0 24px 48px -16px rgb(4 14 20 / .55), 0 2px 6px rgb(4 14 20 / .18)`): chat card, consent panel.

### Named Rules
**The Glow Not Lift Rule.** Elevation is a cold glow below or around the object. Hard or offset shadows are not part of this world.

## Shapes

Softly rounded rectangles for boards (20px) and inner nodes (12px), pills for every choice control (chips, line tabs, map keys, status badges), small 6px plates for line tags, and circles for stations, status dots and the riding train. Lines are thick and round-capped (10px on route boards, 5px on the planet). Station rings are white with a dark core; on boards they fill with the line color when the route scrolls in.

## Components

### Buttons
Confident and luminous; exactly one pair per call to action.
- **Shape:** gently rounded (8px), 44px tall.
- **Primary:** Hellblau fill, Accent Ink text, Action halo; may carry a small inline SVG arrow.
- **Secondary:** near-transparent white fill (4%) with a 22% white border, Ink text.
- **Hover / Active:** primary darkens slightly toward Ink; press scales to 0.985 and drops 1px.

### Chips and Line Tabs
- **Style:** pill, Surface fill, 16 to 18% Ink border, Work Sans 500.
- **State:** selected turns solid Hellblau with Accent Ink text; hover strengthens the border; press scales to 0.97. Line tabs lead with their colored line tag.

### Line Tags
The signature label: a small mono plate (C1, M2, B3) in the line's own color with dark text. Used on the planet, route heads, industry rows and tabs.

### Boards
- **Corner Style:** 20px.
- **Background:** Board, with Board Raised nodes and Board Line hairlines inside.
- **Shadow Strategy:** Board glow.
- **Internal Padding:** 64px (32 to 48px on smaller screens).

### Route (signature component)
A thick line in the line's color with four stations: title, mono time, short description. A white light point rides the line every 4s. Stations dim to 35% and light up in sequence (350ms steps) as the board enters view.

### Navigation
Fixed 72px bar (56px phone), logo left, centered text links, one primary button on the right; below 480px the button hides and the menu toggle takes its place.

### Offer Rows
Hairline-separated rows: colored line dot, Bricolage name, muted description, setup and monthly price in tabular Bricolage. The single featured row sits on a raised dark panel with the featured glow and a Hellblau badge. Rows nudge 4px right on hover.

## Do's and Don'ts

### Do:
- **Do** explain a service as a line with stations on a dark board before naming its price.
- **Do** keep C1 Hellblau, M2 Orange and B3 Grün bound to their lines everywhere.
- **Do** let a light point ride a line as the page's motion, with one ease-out curve (cubic-bezier(0.23, 1, 0.32, 1)) and a reduced-motion fallback that shows the finished state.
- **Do** write section headings as statement plus muted continuation.

### Don't:
- **Don't** build rows of identical icon cards; diagrams and boards carry the explanation.
- **Don't** introduce a second action color or use Orange or Grün for buttons.
- **Don't** set body or headings in Geist Mono.
- **Don't** add hard or offset shadows; depth is glow.
- **Don't** put white or light content surfaces on the page itself; light surfaces appear only as mockups of a client's own widget or website.
