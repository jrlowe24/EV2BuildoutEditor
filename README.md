# EV2BuildoutEditor

## Spadeway — static shovel storefront mockup

A single-page, dependency-free mockup of a dropshipping store that sells shovels,
spades and scoops. Built as a design sample: no build step, no framework, no backend.

```
index.html      the whole page — header, hero, product grid, journal band, footer
styles.css      design tokens + layout (light theme, responsive down to 320px)
app.js          category filter, sort, cart drawer (localStorage), toasts
images/         18 product and editorial photographs
```

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000   # then visit http://localhost:8000
```

### What works

- **16 products** across three categories, filterable by chip and sortable by
  price or rating.
- **Cart drawer** — add, change quantity, remove, running subtotal, and a
  free-shipping progress meter. State persists in `localStorage` and is
  revalidated against the catalogue on load.
- **Responsive** 4 → 3 → 2 → 1 column grid; no horizontal scroll at any width.
- **Keyboard and screen-reader friendly** — focus-visible outlines, `Escape`
  closes the drawer with focus restored, live regions on the cart and result
  counts, `prefers-reduced-motion` respected.

### This is a mockup

Spadeway is not a real shop. Nothing can be bought, checkout is a dead end, and
the prices, ratings, delivery windows, reviews and company history on the page
are invented. A notice at the foot of the page says so.

### Photography

The product photography is real, not generated. Every image is a freely licensed
photograph from Wikimedia Commons, cropped or padded to a common 4:5 frame.
Photographer, source and licence for each one are credited in the page footer
under "Photo credits" — licences are a mix of CC0, CC BY 4.0, CC BY-SA 2.0/3.0/4.0
and public domain.

Product names and descriptions are inventions of the mockup and are not claims
about the tools shown.
