# Divyam Navin — Portfolio

A single-page portfolio told as an interactive journey. One Three.js particle system (up to 20k points) travels through space from chapter to chapter, with the camera flying alongside it. At each stop the particles form a new shape:

| Chapter | Shape | Interaction |
| --- | --- | --- |
| Prologue | Neural sphere | Big-bang intro: particles collapse out of chaos |
| Ch.01 Origin | "DN" monogram | |
| Ch.02 Craft | Double helix | |
| Ch.03 Experiments | Candlesticks → leaf → book | Scene progresses as you read: candles draw in, the leaf grows, the pages turn |
| Ch.04 Toolkit | Skill lattice | Hover or tap a skill to light it up and link it to related skills; drag to spin |
| Epilogue | Globe (real continents) | Pin on Thane, arcs to tech hubs, your approximate location from your time zone; drag to spin |

**Everywhere:** the cursor pushes particles aside, a click or tap sends a shockwave, and phones respond to tilt (gyroscope).

**Extras**
- **Quick view:** a 30-second recruiter summary in a dialog.
- **⌘K / Ctrl K** (or `/`): command palette to jump to sections, copy your email, open the résumé, or toggle sound.
- **Generative sound**, off by default: a drone that responds to scroll, wind during flights, and plucks on clicks.
- **Atmosphere:** nebula fog clouds along the route, tinted per chapter (you fly through them), and warm light leaks at the screen edges that move and flare on every chapter change, on top of the film grain.
- **Visual effects:** bloom (desktop), chromatic-aberration glitch during flights, warp streaks, custom cursor, magnetic buttons, scrambling text.

**Accessibility and performance**
- All content is semantic HTML; the canvas is decorative only.
- Respects `prefers-reduced-motion`: no flights, intro, smooth scroll or animations.
- Adaptive quality tiers (particle count, pixel ratio, bloom and post-processing). The site steps down automatically if frames drop. Force a tier with `?quality=0|1|2`.
- On phones, each chapter shows its 3D shape on an empty "stage" above solid, readable text panels, with backdrop blur and grain turned off.
- Falls back to a static page when WebGL isn't available.

## Develop

```bash
npm install
npm run dev      # local dev server
npm run build    # production build → dist/
npm run preview  # serve the build
```

Deploy `dist/` to any static host (Vercel or Netlify: build command `npm run build`, output directory `dist`).

## Where things live

- Content: `index.html`. Each chapter's `data-shape`, `data-x`, `data-y`, `data-dim` and `data-chapter` attributes drive the 3D.
- `src/scene.js`: renderer, shaders, camera flight, post-processing, globe and lattice rigs.
- `src/shapes.js`: point-cloud generators. `src/landmask.js` is a compact world land mask (Natural Earth, public domain).
- `src/ui.js`: cursor, magnetic buttons, scramble text, toasts, palette and quick view.
- `src/audio.js`: WebAudio sound design.
- `src/main.js`: wires everything together.
