# Metabolism What-If Simulator: Build Spec v1

Oct 1, 2026 · @Vaughan Wynne-Jones

## Purpose and scope

Version 1 is an educational web simulator of fuel metabolism. A learner sets up a body and a scenario, changes one thing, and watches how the machine responds. It teaches cause and effect; it does not track, predict for, or advise any real person.

The model keeps the five-layer organization: the machine; what the machine needs; where it can be observed; the controls; and what the controls need.

**In v1:** fuel metabolism at two time scales. The meal scale (minutes to hours) covers glucose, insulin and where fuel goes after a meal. The energy scale (days to months) covers weight, fat and lean mass, and metabolic adaptation. Side-by-side comparison of a baseline and a variant, preset scenarios, and guided lessons.

**Out of v1:** personal data import, blood pressure and cardiovascular modeling, kidney and respiratory detail, insulin or medication dosing, and any output framed as a recommendation for a real person.

## Architecture

Hexagonal, per standing project rule: the reference model, the simulation engines and the scenario runner sit in a pure core; controls, lessons, presets, parameter sets and storage are swappable adapters.

&#91;embedded content: hexagonal architecture · core, 4 driving and 3 driven adapters\]

A new engine, lesson or parameter set is a new adapter or data file; the core does not change. If personal data is ever added, it arrives as one more driving adapter.

## Domain model

The core holds two families of types: the reference model (how the machine works) and the simulation (what happens when you run it). Nothing in the core knows about storage, the UI or file formats.

**Reference model (the five layers)**

| Type | Layer | Key fields |
| --- | --- | --- |
| Component | Machine | id, name, kind (organ, tissue, compartment, placeholder), description |
| Flow | Machine | id, from, to, substance, route (e.g. portal vein, lymph), controlledBy\[\] |
| Need | Needs | componentId or controlId, substance, role, source citation |
| Observable | Checks | id, observes (component or flow), metric, unit, real-world measurement method |
| Control | Controls | id, name (insulin, glucagon…), producedBy, acts on flows\[\], effect |
| ControlNeed | Control needs | controlId, requirement, source citation |
| ReferenceRange | Checks | metric, low, high, population, context (fasting, post-meal), source citation |

**Simulation**

| Type | Key fields |
| --- | --- |
| BodyProfile | age, sex, height, weight, body fat, insulin sensitivity, activity level; each bounded to its source model's validated range |
| Scenario | profile, timeline of events, duration, time step, engine (meal or energy scale) |
| Event | time, kind (meal, activity, fast), payload (macros in grams, activity intensity and duration) |
| Intervention | the one variable changed between baseline and variant, with its before and after values |
| RunResult | time series per state variable, per-flow totals, the parameters used and their citations |
| Comparison | baseline and variant results, deltas, and the flows that account for them |
| Lesson | ordered steps, each a scenario, a question for the learner, and the expected observation |

Every parameter and quantitative fact carries a citation field. A value with no source is not loaded.

## Physiology content v1

This is the qualitative skeleton the diagram is drawn from. The simulation engines supply the numbers; Spock must not invent rates or quantities to fill gaps.

**Components:** intake; stomach and small intestine; lymphatic route; portal vein; liver; bloodstream; pancreas; skeletal muscle; adipose tissue; brain; exhaust (lungs, kidneys, skin). Placeholders: kidneys (detail), respiratory loop.

**Flows to model**

| Substance | Path | Notes |
| --- | --- | --- |
| Carbohydrate | gut → glucose → portal vein → liver → blood | Liver stores some as glycogen |
| Protein | gut → amino acids → portal vein → liver → blood | Used for repair; can be converted to glucose |
| Fat | gut → lymph → blood, bypassing the liver at first | Stored mainly in adipose |
| Glucose into muscle and fat | blood → cell via GLUT4 | Insulin-dependent |
| Glucose into brain, liver, red cells | blood → cell via other GLUT transporters | Largely insulin-independent |
| Fasting supply | glycogen breakdown, glucose made from amino acids, fat release | Runs between meals |
| Excess fuel | glucose → fat in liver and adipose | Linked to fatty liver |
| Burning fuel | glucose and fatty acids + oxygen → energy, CO2, water, heat | Exits via lungs, kidneys, skin |

**Controls:** insulin and glucagon (pancreas); gut hormones including GLP-1, GIP and CCK; hunger and satiety signals (ghrelin, leptin); stress hormones (cortisol, adrenaline); thyroid hormone; autonomic nervous system. In v1, only controls an engine actually models are animated; the rest are shown as labeled, inactive signals.

**Needs:** oxygen, water, B vitamins (thiamine, riboflavin, niacin, pantothenic acid), magnesium, iron, essential amino acids, essential fatty acids.

**Observables:** what the simulator shows, paired with how a real person could measure it, so lessons connect to the real world.

| Simulated output | Where it lives | Real-world measurement |
| --- | --- | --- |
| Blood glucose | Bloodstream | Fingerstick, CGM |
| Plasma insulin | Bloodstream | Lab (fasting insulin) |
| Average glucose over months | Bloodstream | Lab (A1c) |
| Liver and muscle glycogen | Storage | Not measurable at home |
| Fat mass and lean mass | Storage | Scale (total only), body composition scan |
| Energy expenditure | Working cells | Resting metabolic rate test |

## Visual layer

The main screen is the system diagram, generated from the reference model and animated by the simulation, so the learner watches fuel move rather than reading about it.

- **Machine view:** components as nodes, flows as arrows whose thickness tracks throughput as the run plays; control signals as dashed lines that brighten when active.
- **Playback:** play, pause and scrub along the run's timeline; speed control for the energy scale.
- **Click a node:** a side panel shows its five-layer bill of materials, with citations.
- **Compare:** baseline and variant side by side on the same scale, with the one changed variable named at the top.
- **Charts:** state variables over time (glucose, insulin, glycogen, fat and lean mass), both runs overlaid.
- **What changed and why:** a short generated note naming the flows that account for the difference, e.g. more glucose routed to storage.
- Must work on a phone screen.

## Scenario controls

The learner changes one variable at a time against a baseline. Every control's range is clamped to what its engine was validated for; outside that range the app refuses to run and says why.

| Control | Scale | What it changes |
| --- | --- | --- |
| Meal composition (carbohydrate, protein, fat, fiber in grams) | Meal | Absorption rate and fuel routing |
| Meal timing and spacing | Meal | Overlap between meal curves |
| Insulin sensitivity (normal to resistant) | Meal | How fast glucose leaves the blood |
| Activity after a meal | Meal | Glucose uptake by muscle |
| Daily intake over weeks | Energy | Weight, fat and lean mass trajectory |
| Daily activity level | Energy | Expenditure and trajectory |
| Body profile (age, sex, height, starting weight) | Both | Baseline parameters |

Later, each needing a sourced effect size before it ships: sleep restriction, stress hormones, medication effects.

## Simulation engines

The engines implement published, peer-reviewed models rather than home-made equations. The candidates below are named from memory; Spock must fetch and read each original paper, confirm the equations and parameter values, and check licensing before implementing.

| Scale | Candidate model | Role |
| --- | --- | --- |
| Meal | Bergman minimal model (Bergman and colleagues, 1979) | Compact glucose and insulin dynamics; insulin sensitivity as an explicit parameter |
| Meal | Dalla Man, Rizza and Cobelli meal simulation model (IEEE Transactions on Biomedical Engineering, 2007) | Meal absorption and a fuller glucose and insulin system |
| Energy | Hall and colleagues, body weight dynamics (The Lancet, 2011) | Weight, fat and lean change with metabolic adaptation; basis of the NIH Body Weight Planner |

**Engine requirements**

- Deterministic: the same scenario always produces the same run.
- Fixed-step numerical integration, with the step size shown to be small enough by a convergence test.
- Each engine must reproduce a published figure or worked case from its source paper before it ships; that reproduction is a permanent regression test.
- Every run records the model, version and parameter set it used.
- Whether the energy engine models glycogen and water shifts must be confirmed from the paper; if not, the scale-jump lesson waits for an engine that does.

**Derived metrics per meal:** pre-meal value, peak rise, time to peak, time back to baseline, incremental area under the curve, and rise per gram of net carbohydrate.

**Derived metrics per energy run:** weight, fat mass and lean mass over time; energy expenditure; and the gap between expected and actual loss attributable to adaptation.

## Non-functional requirements

- **Educational, not medical.** A persistent banner says the simulator teaches how metabolism works and does not predict outcomes for any individual. No output is phrased as advice, a target or a dose.
- **Honest about extremes.** Very low intake and long fasts may be simulated for teaching, but the results must show the costs the model captures (lean mass loss, adaptation), with a note that such regimens need medical supervision.
- **Model honesty.** Every chart is labeled as model output and names the model and parameter set. Inputs outside a model's validated range are refused, not extrapolated.
- **Sourcing rule.** No invented physiology values or references. Every parameter and reference range carries a citation a human has checked; unsourced values are rejected at load time.
- **Privacy by design.** No accounts, no personal data, no third-party analytics in v1.
- **Testing.** Engines covered by convergence and source-reproduction tests; core types and scenario runner by unit tests.
- **Hexagonal boundaries enforced.** The core imports nothing from adapters, UI or storage.

## Preset scenarios and lessons

Presets ship as data files, each a baseline, one intervention and a question. These cover the questions that started this project.

| Preset | Baseline | Variant | Question it teaches |
| --- | --- | --- | --- |
| Same calories, different fuel | Carbohydrate-heavy breakfast | Protein and fat breakfast | Why do two meals of equal size move glucose so differently? |
| The resistant machine | Normal insulin sensitivity | Insulin resistance, same meal | What does insulin resistance look like on a glucose curve? |
| Walk it off | Rest after a meal | Activity after the same meal | Where does the glucose go when muscle is working? |
| Deficit size | Moderate deficit for 12 weeks | Very large deficit for 12 weeks | How much of the loss is fat, how much lean, and how does the body push back? |
| The scale jump | Steady intake | One higher-carbohydrate day | Why does weight rise overnight without fat gain? (only if the engine models glycogen and water) |

The first three lessons to build are the first three presets, since they need only the meal-scale engine.

## Milestones and open questions

1. Core domain types, reference model loader with citation check, unit tests.
2. Meal-scale engine, reproducing a published case from its source paper.
3. Machine view generated from the reference model, with animated flows and playback.
4. Scenario controls, comparison view, and the first three presets.
5. Energy-scale engine, reproducing its source paper, and the deficit preset.
6. Lesson player and the first three lessons; export.

**Open questions**

- [ ] Stack: Python or TypeScript? Single-page app or server-rendered?
- [ ] Hosting: laptop only, or public on Vaughan's own server so others can learn from it?
- [ ] Which candidate models do we adopt after reading the originals, and are their equations free to implement?
- [ ] Which physiology references are the citation sources of record?
- [ ] Should learners be able to set a profile like their own? It makes lessons relatable but drifts toward personal prediction.
