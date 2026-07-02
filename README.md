# Musée — An Interactive Atlas of Art History

**Live: https://art-history-museum-nine.vercel.app**

A browser-based, interactive 3D art museum. The entry point is a **zoomable
night-sky timeline** of art history: fifteen periods glow as nebulae along a
real-date axis; zooming in resolves each period's artists as stars placed by
the years they actually worked. Clicking a star opens a museum-placard artist
card, and from there you step into that artist's own **first-person 3D
gallery** (WASD + mouse) hung with their real works. Clicking a painting opens
a high-resolution inspect view with its story and curiosities.

## Data — all from Wikipedia & Wikimedia Commons

Every biography, image, date, story and fun fact is pulled verbatim from
English Wikipedia, Wikidata and Wikimedia Commons at seed time — nothing is
AI-generated. Only Commons-hosted, free-licensed images (public domain, CC0,
CC BY/BY-SA) pass validation; each artwork stores its license, author
attribution and a link back to its Commons file page, shown in the inspect
view. Because free licensing is a hard gate, some famous 20th-century names
(Picasso, Pollock, Rothko, Warhol, Magritte…) cannot have rooms — their works
are still under copyright — so the modern periods feature artists whose works
are genuinely free: newly public-domain painters (Léger, Gris, Tanguy, Gorky…)
and photographed public works under freedom of panorama (Calder, Moore,
Gormley, Saint Phalle…).

## Stack

- **Next.js 15** (App Router) · React 19 · TypeScript · Tailwind v4
- **Timeline**: SVG + `d3-zoom` semantic zoom, GSAP camera flights
  (`d3.interpolateZoom` through a GSAP tween), imperative screen-space layer
- **3D gallery**: React Three Fiber + drei — PBR materials (Polyhaven CC0),
  per-painting shadow-casting spotlights baked once, `MeshReflectorMaterial`
  parquet, N8AO + Bloom + ACES tone mapping, pointer-lock WASD with AABB clamp
- **Database**: Neon Postgres + Drizzle ORM (read-only at runtime, statically
  generated pages)
- **QA**: Playwright against the deployed site

## Develop

```bash
pnpm install
# .env.local: DATABASE_URL=postgres://…   (never commit)
pnpm db:push          # create tables
pnpm seed             # dry-run validation (no DB writes)
pnpm seed --write     # fetch + validate + upsert into Neon
pnpm dev
```

The seed pipeline caches every API response under `.cache/wiki/`, throttles to
a small polite pool with a descriptive User-Agent, and refuses to write unless
≥12 periods pass with ≥3 artists each and ≥8 works per artist
(`--refresh` ignores the cache).

## QA

```bash
$env:BASE_URL = "https://<deployment-url>"
pnpm qa
```

## Credits

Artwork images and texts: [Wikipedia](https://en.wikipedia.org) /
[Wikimedia Commons](https://commons.wikimedia.org) contributors (licenses per
artwork, shown in-app). Wall/floor textures and HDRI:
[Poly Haven](https://polyhaven.com) (CC0).
