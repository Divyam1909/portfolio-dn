# Divyam Navin — Portfolio

A single-page portfolio told as an interactive journey. One Three.js particle system (up to 20k points) travels through space from chapter to chapter, with the camera flying alongside it. At each stop the particles form a new shape:

| Section | Shape | Interaction |
| --- | --- | --- |
| Intro | Neural sphere | Big-bang intro: particles collapse out of chaos |
| About | "DN" monogram | |
| Internships | Double helix | Data packets stream along the strands |
| ↳ ZetaQ | LLM pipeline | PDF pages stream through an LLM ring and come out as tidy study cards |
| ↳ Thinking Engines | Full-stack layers | Requests rise from the database, through the API layer, to the UI |
| ↳ Arms Robotics | Chip → dashboard | Pulses run along PCB traces into a live waveform |
| Projects | Candlesticks → leaf → book → solar system | Candles draw in, the leaf grows, pages turn as you read; planets orbit for Portfolio v1 |
| Skills | Lattice with project stars | Click a skill: links fly to the projects that used it, bright and solid for strong skills, faint and dashed for familiar ones. A panel lists the level and the projects (click one to jump to it). Drag to rotate |
| Contact | Globe (real continents, ocean sphere, atmosphere) sitting below the text | Pin on Thane, arcs to tech hubs, your approximate location from your time zone; drag to spin |

**Everywhere:** the cursor pushes particles aside, a click or tap sends a shockwave, and phones respond to tilt (gyroscope).

**Extras**
- **Previous portfolio:** v1 “Universe” is project P/04, a milestone card linking to the old site.
- **Section sidebar** (desktop): Intro, About, Internships, Projects, Skills, Contact; highlights the current section and jumps on click.
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

- Content: `index.html`. Each section's `data-shape`, `data-x`, `data-y`, `data-dim` and `data-chapter` attributes drive the 3D.
- `src/scene.js`: renderer, shaders, camera flight, post-processing, globe and lattice rigs. Only the two shapes on screen are bound to the GPU at a time, so adding shapes is cheap.
- `src/skills.js`: skill levels (strong / solid / familiar) and which projects used each skill. Edit this to change the Skills section.
- `src/shapes.js`: point-cloud generators. `src/landmask.js` is a compact world land mask (Natural Earth, public domain).
- `src/ui.js`: cursor, magnetic buttons, scramble text, toasts, palette and quick view.
- `src/audio.js`: WebAudio sound design.
- `src/main.js`: wires everything together.
