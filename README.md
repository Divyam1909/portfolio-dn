# Divyam Navin — Portfolio

A single-page portfolio told as an interactive journey. One Three.js particle system (up to 20k points) travels through space from chapter to chapter, with the camera flying alongside it. At each stop the particles form a new shape:

| Section | Shape | Interaction |
| --- | --- | --- |
| Intro | Fifteen forms on a loop: butterfly → atom → jellyfish → gears → black hole → dragon → tesseract → hourglass → rocket → samurai → wormhole → turntable → neural sphere → anatomical heart → brain | The blue morpho flies in from deep space with quick wingbeats, banking through a curve with motion streaks, then hovers. Each form holds ~3.4 s then rearranges into the next (or step with the arrows / ← →; drag a form to turn it, and it stays until you step on), tinted in its own colours with a soft matching aura, and each moves: electrons race round their orbits, a Keplerian accretion disk turns under its lensed light and an Einstein ring of stars, four gears mesh at their true ratios, the hourglass runs and turns over before a clock showing the visitor's local time, the tesseract rotates through the fourth dimension, light streams through the wormhole's throat, the record spins under a fixed sheen, the jellyfish pulses, light runs down the samurai's katana as cherry petals fall, the dragon breathes fire, the heart beats and waves of activity cross the brain's folded cortex. Organic forms are sculpted from signed-distance fields and lit from the camera's view (`src/fauna.js`, `src/heart.js`, `src/brain.js`, `src/creatures.js`); the rest are built from geometry (`src/objects.js`). Their motion is GLSL in `src/heroShader.js`, and they are built in a Web Worker (`src/heroWorker.js`) so the page never stalls |
| About | "DN" monogram | Education, E-Cell leadership and awards |
| Internships | Double helix | Data packets stream along the strands |
| ↳ ZetaQ | LLM pipeline | PDF pages stream through an LLM ring and come out as tidy study cards |
| ↳ Thinking Engines | Database → API → football pitch | Players move on the pitch; one is tracked with a ring and a trail (player-performance analytics) |
| ↳ Arms Robotics | Chip → dashboard | Pulses run along PCB traces into a live waveform |
| ↳ VanillaKart | Shopping cart + growth arrow | A traffic pulse climbs the SEO growth arrow |
| ↳ Finnfluent Education | Megaphone with a graduation cap | Content waves and spinning coins stream out (digital finance education) |
| Projects | Candlesticks → photo → CNN → leaf → robot reading a book → aquarium → solar system | Candles draw in; pixels stream through CNN layers into a growing leaf; the robot's eyes scan the page as pages turn; fish swim, plants sway and bubbles rise in the Wave Habitat tank wired to its control panel; planets orbit for Portfolio v1 |
| Skills | Lattice with project stars | Click a skill: links fly to the projects that used it, bright and solid for strong skills, faint and dashed for familiar ones. A panel lists the level and the projects (click one to jump to it). Drag to rotate |
| Contact | Globe (0.5° Natural Earth land, bright coastlines, ocean sphere, atmosphere) sitting below the text | Pin on Thane, arcs to tech hubs, your approximate location from your time zone; drag to spin |

**Everywhere:** the cursor pushes particles aside, a click or tap sends a shockwave, and phones respond to tilt (gyroscope).

**Extras**
- **Previous portfolio:** v1 “Universe” is project P/05, a milestone card linking to the old site.
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
