# The Artem Upgrade Arc

An interactive birthday mini-site for Artem (SEO Specialist @ DMarket).
CS2/DMarket-style upgrade arc with a fake boot, fandom check, inventory
roast, boss fight ("Default Hands"), legendary case opening, and a final
shareable result card.

Final drop: **Gaming Gloves.**

## Run locally

Open `index.html` directly in your browser, or serve the folder:

```bash
# any static server works
npx serve .
# or
python -m http.server 8080
```

No backend. No build step. No API.

## Deploy to GitHub Pages

1. Push this folder to a GitHub repo (e.g. `artem-upgrade-arc`).
2. Go to **Settings → Pages**.
3. Source: deploy from branch `main`, folder `/ (root)`.
4. Open the published GitHub Pages URL.

## Tech

- HTML
- CSS (custom properties, animations, responsive grid)
- Vanilla JavaScript (no framework, no deps)
- Canvas for confetti and result-card PNG export
- Web Audio API for optional procedural SFX

## Features

- 9 interactive screens with smooth transitions
- Typewriter boot terminal
- Fandom card flip with progress tracker
- CS2 rank reality check + clickable blue badge easter egg
- Inventory grid with hover tooltips and "Empty Hand Slot" card
- Animated drip meter with breakdown and penalty
- Boss fight with HP bar, attack log, finisher unlock at 20% HP
- Case-opening loot reveal with horizontal carousel and confetti
- Mission-complete result card with copy text and PNG download
- Konami code achievement, repeated-click easter eggs, console hints
- Sound toggle (procedural beeps, OFF by default)
- Reduced-motion friendly
- Responsive down to 360px

## Easter eggs

- ↑ ↑ ↓ ↓ ← → ← → B A
- Click the blue rank badge 5 times
- Click each fandom card 5 times
- Hover the Empty Hand Slot card
- Inspect the HTML — comments inside

## Files

```
artem-upgrade-arc/
  index.html
  styles.css
  script.js
  README.md
  assets/
    images/   (optional, unused by default)
    sounds/   (optional, unused by default)
```

Happy birthday, Artem. The era of default hands is over.
