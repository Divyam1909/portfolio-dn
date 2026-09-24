# Divyam Navin — Portfolio

Single-page portfolio built with Three.js. One particle system (20k points on desktop, 9k on mobile) morphs into a new shape for each section as you scroll: neural sphere, DN monogram, double helix, candlestick chart, leaf, open book, lattice and globe. The cursor pushes the particles around, and a click or tap sends out a shockwave.

- All content is plain semantic HTML, so it stays readable for recruiters, screen readers and search engines. The WebGL canvas is decorative only.
- Respects `prefers-reduced-motion`: smooth scrolling, animations and particle motion are turned off.
- Falls back to a static gradient when WebGL isn't available.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # serve the build
```

## Deploy

Static output in `dist/`. On Vercel or Netlify: build command `npm run build`, output directory `dist`.

## Edit content

- Text: `index.html`
- Résumé download: `public/Divyam-Navin-Resume.pdf`
- Shapes: `src/shapes.js`. Each section's `data-shape`, `data-x`, `data-y` and `data-dim` attributes set which shape it shows and where.
