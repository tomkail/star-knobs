# Star Knobs

Design star knobs (the lobed hand knobs used on jigs, clamps and fences) and print a 1:1 drilling template.

The second of a family of woodworking tools, alongside [Serpentine](https://github.com/tomkail/serpentine). Both use [`workshop-kit`](https://github.com/tomkail/workshop-kit) for theme, UI, canvas and true-scale printing.

## Two ways to think about a star knob

**Drill a blank.** This is the usual shop method. Mark a round blank and drill N holes whose centres sit on a slightly larger pitch circle. Each hole scallops the rim, and the wood left between the holes becomes the lobes. The tip radius rounds off the sharp corners.

**Shape lobes.** This is the same family of shapes seen the other way round: N round lobes on a circle, joined by concave valleys. The valleys are still drilled holes, so the template still gives you a bit size and hole centres. You saw and sand round the lobes afterwards.

Both modes reduce to one construction: blank radius, hole radius, pitch radius and tip fillet. Push the tip radius to its maximum and a drilled knob becomes a lobed one. Switching modes converts the numbers so the shape stays the same.

## Features

- Drag handles on the canvas to set the pitch circle and rotation, the bit size and the blank. Drags snap to standard Forstner sizes (metric or imperial), 0.5 mm / 1/32″ and 15°. Hold Shift for free movement.
- Checks for holes that miss or overlap, scallops that break into the bore, thin walls and fragile lobe necks.
- Centre bore options: plain hole, counterbore (T-nut) or hex recess, with common hardware sizes.
- Measurements: scallop depth, core, wall to bore, neck width, and the step-off chord for laying out with dividers.
- Works in mm or inches (fractions accepted: `3/4`, `1 1/4"`, `20mm`).
- Output at true size:
  - **Print** sets the `@page` size to the paper, lays out copies and adds metric and imperial scale-check rulers.
  - **PDF**: vector, with the MediaBox equal to the paper size and `PrintScaling /None`.
  - **SVG** uses `width="…mm"`, so it opens at 1:1 in Inkscape, Illustrator and laser software.
  - **DXF** holds the outline, holes and bore on separate layers for CAD/CNC.
- **Actual size** view, with a credit-card screen calibration.
- Undo/redo, autosave, save/open `.starknob.json` files, and a shareable URL (the design lives in the hash).

## Printing accurately

Print at **100% / Actual size** and turn off "Fit to page". Measure the rulers on the printout before you drill.

## Development

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # geometry, units and export tests
npm run build   # static site in dist/
```

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. The site is served from `/star-knobs/`; change `base` in `vite.config.ts` if the repo name differs.

## Layout

```
src/
  model/        design document, geometry, presets, template layout (pure, tested)
  components/   canvas, panel, toolbar, dialogs
  stores/       zustand stores (design + undo history, settings, viewport, theme)
  actions.ts    file, export, print and view commands
```

To work on `workshop-kit` alongside this app, see [Developing the kit alongside an app](https://github.com/tomkail/workshop-kit#developing-the-kit-alongside-an-app).
