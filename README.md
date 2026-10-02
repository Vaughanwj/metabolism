# Metabolism

A systems view of metabolism: an educational what-if simulator of fuel metabolism, and the first of the "body machine" apps.

A learner sets up a body and a scenario, changes one thing, and watches how the machine responds. It teaches cause and effect. It does not track, predict for, or advise any real person.

- Build spec: [docs/spec-v2.md](docs/spec-v2.md)
- Engine assessment: [docs/engine-assessment.md](docs/engine-assessment.md)

## Status

- **Milestone 1, done.** Core domain types, a reference-model loader with a citation check, and unit tests.
- **Milestone 2, engine done; citation sign-off pending.** The Dalla Man 2007 meal engine reproduces the curated BioModels SBML. Its parameters await human verification ([checklist](docs/citation-review-dalla-man-2007.md)). Until then the parameter loader refuses them.

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
| `data/reference-model/` | The five-layer reference model as data. The diagram is generated from this |
| `data/parameters/` | Cited parameter sets for each engine |
| `data/sources/` | Machine-readable source models, e.g. the curated BioModels SBML |
| `scripts/` | Generate test fixtures from the source models using independent solvers |
| `tests/` | Unit tests |

## Sourcing rule

Every parameter, reference range and quantitative fact carries a citation that a named person has checked (`verifiedBy`, `verifiedOn`). The loader drops anything without one and reports it. The `needs`, `controlNeeds` and `referenceRanges` sections are empty until sourced entries are added.
