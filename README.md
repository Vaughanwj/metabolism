# Metabolism

A systems view of metabolism: an educational what-if simulator of fuel metabolism, and the first of the "body machine" apps.

A learner sets up a body and a scenario, changes one thing, and watches how the machine responds. It teaches cause and effect. It does not track, predict for, or advise any real person.

- Build spec: [docs/spec-v2.md](docs/spec-v2.md)
- Engine assessment: [docs/engine-assessment.md](docs/engine-assessment.md)

## Status

- **Milestone 1, done.** Core domain types, a reference-model loader with a citation check, and unit tests.
- **Milestone 2, done.** The Dalla Man 2007 meal engine reproduces the curated BioModels SBML. Its parameters were verified on 2026-10-02 ([checklist](docs/citation-review-dalla-man-2007.md)).
- **Milestone 3, done.**
  - The machine view is generated from the reference model, with flows animated by an engine run and playback controls.
  - Clicking a component shows its five-layer bill of materials.
  - `data/bindings/` says which engine output drives which flow, and where the model lumps flows together.
- **Milestone 4, in progress.** Built so far:
  - the comparison page: baseline and variant diagrams on a shared scale, charts, glucose metrics and a generated "what changed and why" note
  - scenario controls that allow only one changed variable
  - the "Same calories, different fuel" and "The resistant machine" presets

  Still waiting on:
  - citation sign-off ([checklist](docs/citation-review-milestone-4.md)); until then the simulator refuses to run
  - "Walk it off", which needs an exercise model decision (see the engine assessment)

  In development, `?preview-unverified` shows the page before sign-off, with a warning banner.

## Develop

```bash
npm install
npm test
npm run dev
```

`npm run build` writes a static site to `dist/`. It uses relative paths so it can be served under any sub-path, such as `/metabolism/` on the landing page.

## Layout

| Path | What it holds |
| --- | --- |
| `src/core/` | Pure domain: the reference model types and loader, simulation types and ports. Imports nothing outside itself; `tests/boundaries.test.ts` enforces this |
| `src/adapters/` | Implementations of the core's ports |
| `src/ui/` | The browser UI (a driving adapter): layout with dagre, SVG machine view, playback, side panel |
| `data/bindings/` | Which engine output animates which flow, control and readout |
| `data/rules/` | Each engine's allowed input ranges, with citations |
| `data/presets/` | Preset comparisons: a base scenario plus exactly one change |
| `data/reference/` | Cited reference values used for display, such as energy per gram |
| `data/reference-model/` | The five-layer reference model as data. The diagram is generated from this |
| `data/parameters/` | Cited parameter sets for each engine |
| `data/sources/` | Machine-readable source models, e.g. the curated BioModels SBML |
| `scripts/` | Generate test fixtures from the source models using independent solvers |
| `tests/` | Unit tests |

## Sourcing rule

Every parameter, reference range and quantitative fact carries a citation that a named person has checked (`verifiedBy`, `verifiedOn`). The loader drops anything without one and reports it. The `needs`, `controlNeeds` and `referenceRanges` sections are empty until sourced entries are added.
