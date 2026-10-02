import {
  applyProfile,
  checkScenario,
  compareRuns,
  dallaMan2007,
  explainComparison,
  frameBuilder,
  mealEnergyKcal,
  mealMetrics,
  presetRuns,
  runDuration,
  type EnergyFactors,
  type EngineBinding,
  type MealMetrics,
  type ParameterSet,
  type Preset,
  type PresetChange,
  type PresetMeal,
  type ReferenceModel,
  type RunResult,
  type Scenario,
  type ScenarioRules,
} from '../core';
import { createChart } from './chart';
import { createMachineView, type MachineView, type Readout } from './machineView';
import { renderPanel } from './panel';

// The comparison page: pick a preset or change one variable, then watch baseline and variant
// side by side on the same scale, with charts, metrics and a short explanation.

export interface AppData {
  model: ReferenceModel;
  binding: EngineBinding;
  params: ParameterSet;
  rules: ScenarioRules;
  presets: Preset[];
  /** Null until the energy factors' citation has been checked. */
  energy: EnergyFactors | null;
  modelLabel: string;
}

const SPEEDS = [10, 30, 60];
const READOUT_LABELS: Record<string, string> = { 'blood-glucose': 'Glucose', 'plasma-insulin': 'Insulin' };
const RUNS = [
  { key: 'baseline', label: 'Baseline', className: 'series-1' },
  { key: 'variant', label: 'Variant', className: 'series-2' },
] as const;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

function numberField(label: string, value: number, min: number, max: number, step: number, note?: string): { wrap: HTMLLabelElement; input: HTMLInputElement } {
  const input = h('input', { type: 'number', value: String(value), min: String(min), max: String(max), step: String(step) });
  const wrap = h('label', { className: 'field' }, h('span', { textContent: label }), input);
  if (note) wrap.append(h('small', { textContent: note }));
  return { wrap, input };
}

function sensitivityField(label: string, value: number, min: number, max: number): { wrap: HTMLLabelElement; input: HTMLInputElement } {
  const input = h('input', { type: 'range', min: String(min), max: String(max), step: '0.05', value: String(value) });
  const out = h('output', { textContent: `${Math.round(value * 100)}%` });
  input.addEventListener('input', () => (out.textContent = `${Math.round(Number(input.value) * 100)}%`));
  return { wrap: h('label', { className: 'field' }, h('span', { textContent: label }), input, out), input };
}

function carbsOf(s: Scenario): number {
  const meal = s.events.find((e) => e.kind === 'meal');
  return meal && meal.kind === 'meal' ? meal.payload.carbohydrateG : 0;
}

export function mountApp(root: HTMLElement, data: AppData): void {
  const { model, binding, rules } = data;
  const carbRule = rules.inputs.find((r) => r.id === 'carbohydrateG')!;
  const sensRule = rules.inputs.find((r) => r.id === 'insulinSensitivity')!;

  let preset: Preset = structuredClone(data.presets[0]!);
  let selected: string | null = null;
  let time = 0;
  let playing = false;
  let speed = SPEEDS[1]!;
  let lastTick = 0;
  let current: {
    duration: number;
    views: MachineView[];
    frames: ((t: number) => ReturnType<ReturnType<typeof frameBuilder>>)[];
    charts: ReturnType<typeof createChart>[];
  } | null = null;

  // ---- Static page structure ----
  const presetBar = h('nav', { className: 'presets', ariaLabel: 'Preset scenarios' });
  const question = h('section', { className: 'question' });
  const settings = h('form', { className: 'settings', ariaLabel: 'Scenario settings' });
  settings.addEventListener('submit', (e) => e.preventDefault());
  const refusal = h('div', { className: 'refusal', role: 'alert', hidden: true });
  const changed = h('p', { className: 'changed' });

  const play = h('button', { type: 'button', textContent: '▶', ariaLabel: 'Play' });
  const slider = h('input', { type: 'range', min: '0', step: '1', value: '0', ariaLabel: 'Time since the meal, in minutes' });
  const clock = h('output', { className: 'clock' });
  const speedSelect = h('select', { ariaLabel: 'Playback speed' });
  for (const s of SPEEDS) speedSelect.append(h('option', { value: String(s), textContent: `${s} min/s` }));
  speedSelect.value = String(speed);
  const controlsBox = h('input', { type: 'checkbox', checked: true });
  const bar = h('div', { className: 'playback' }, play, slider, clock, speedSelect, h('label', { className: 'toggle' }, controlsBox, ' Control signals'));

  const machines = h('div', { className: 'machines' });
  const charts = h('div', { className: 'charts' });
  const results = h('section', { className: 'results' });
  const caption = h('div', { className: 'model-label' });
  const panel = h('aside', { className: 'panel' });
  panel.setAttribute('aria-live', 'polite');

  const stage = h('div', { className: 'stage' }, question, settings, refusal, changed, bar, machines, charts, results, caption);
  root.replaceChildren(h('main', { className: 'machine-page' }, h('div', { className: 'left' }, presetBar, stage), panel));

  // ---- Presets ----
  const presetButtons = data.presets.map((p) => {
    const b = h('button', { type: 'button', textContent: p.title });
    b.addEventListener('click', () => {
      preset = structuredClone(p);
      time = 0;
      renderSettings();
      runComparison();
    });
    presetBar.append(b);
    return { b, id: p.id };
  });

  // ---- Settings form (one changed variable) ----
  function renderSettings() {
    for (const { b, id } of presetButtons) b.setAttribute('aria-pressed', String(id === preset.id));
    question.replaceChildren(
      h('h2', { textContent: preset.title }),
      h('p', { className: 'q', textContent: preset.question }),
      h('details', {}, h('summary', { textContent: 'What to look for' }), h('p', { textContent: preset.expectedObservation })),
    );

    const mealFields = (meal: PresetMeal, legend: string, onChange: (m: PresetMeal) => void) => {
      const carbs = numberField('Carbs (g)', meal.carbohydrateG, carbRule.min, carbRule.max, 1, `${carbRule.min}–${carbRule.max} g`);
      const protein = numberField('Protein (g)', meal.proteinG, 0, 150, 1, 'not modeled');
      const fat = numberField('Fat (g)', meal.fatG, 0, 150, 0.5, 'not modeled');
      const update = () => {
        const m = { ...meal, carbohydrateG: Number(carbs.input.value), proteinG: Number(protein.input.value), fatG: Number(fat.input.value) };
        m.description = `${m.carbohydrateG} g carbohydrate, ${m.proteinG} g protein, ${m.fatG} g fat`;
        onChange(m);
        runComparison();
      };
      for (const f of [carbs, protein, fat]) f.input.addEventListener('change', update);
      return h('fieldset', {}, h('legend', { textContent: legend }), carbs.wrap, protein.wrap, fat.wrap,
        h('p', { className: 'fieldset-note', textContent: `Carbohydrate is limited to the ${carbRule.min}–${carbRule.max} g meals the model's authors simulated. Protein and fat take other routes and do not change this model's glucose curve.` }));
    };

    const base = h('div', { className: 'settings-col' }, h('h3', { textContent: 'Baseline' }));
    base.append(mealFields(preset.meal, 'Meal', (m) => (preset = { ...preset, id: 'custom', meal: m })));
    const sens = sensitivityField('Insulin sensitivity', preset.profile.insulinSensitivity, sensRule.min, sensRule.max);
    sens.input.addEventListener('change', () => {
      preset = { ...preset, id: 'custom', profile: { ...preset.profile, insulinSensitivity: Number(sens.input.value) } };
      runComparison();
    });
    base.append(sens.wrap);

    const variant = h('div', { className: 'settings-col' }, h('h3', { textContent: 'Variant: change one thing' }));
    const which = h('select', { ariaLabel: 'Variable to change' },
      h('option', { value: 'meal', textContent: 'Meal composition' }),
      h('option', { value: 'insulinSensitivity', textContent: 'Insulin sensitivity' }),
      h('option', { value: 'activity', textContent: 'Activity after the meal' }));
    which.value = preset.change.variable;
    which.addEventListener('change', () => {
      const change: PresetChange =
        which.value === 'meal' ? { variable: 'meal', meal: { ...preset.meal } }
        : which.value === 'activity' ? { variable: 'activity', activity: { startAfterMeal: 15, durationMin: 30, intensity: 'moderate' } }
        : { variable: 'insulinSensitivity', value: preset.profile.insulinSensitivity };
      preset = { ...preset, id: 'custom', change };
      renderSettings();
      runComparison();
    });
    variant.append(h('label', { className: 'field' }, h('span', { textContent: 'What changes' }), which));
    if (preset.change.variable === 'meal') {
      variant.append(mealFields(preset.change.meal, 'Meal', (m) => (preset = { ...preset, id: 'custom', change: { variable: 'meal', meal: m } })));
    } else if (preset.change.variable === 'activity') {
      const a = preset.change.activity;
      const startRule = rules.inputs.find((r) => r.id === 'activityStartMin');
      const lengthRule = rules.inputs.find((r) => r.id === 'activityDurationMin');
      const start = numberField('Starts after meal (min)', a.startAfterMeal, startRule?.min ?? 0, startRule?.max ?? 0, 5, startRule ? `${startRule.min}–${startRule.max} min` : 'no sourced range');
      const length = numberField('Lasts (min)', a.durationMin, lengthRule?.min ?? 0, lengthRule?.max ?? 0, 5, lengthRule ? `up to ${lengthRule.max} min` : 'no sourced range');
      const update = () => {
        preset = { ...preset, id: 'custom', change: { variable: 'activity', activity: { ...a, startAfterMeal: Number(start.input.value), durationMin: Number(length.input.value) } } };
        runComparison();
      };
      for (const f of [start, length]) f.input.addEventListener('change', update);
      variant.append(h('fieldset', {}, h('legend', { textContent: 'Moderate activity' }), start.wrap, length.wrap,
        h('p', { className: 'fieldset-note', textContent: "Effect sizes come from exercise at 65% of VO₂max in healthy adults (Romeres et al. 2021). The liver's extra glucose release during exercise is not modeled." })));
    } else {
      const v = sensitivityField('Insulin sensitivity', preset.change.value, sensRule.min, sensRule.max);
      v.input.addEventListener('change', () => {
        preset = { ...preset, id: 'custom', change: { variable: 'insulinSensitivity', value: Number(v.input.value) } };
        runComparison();
      });
      variant.append(v.wrap);
    }
    settings.replaceChildren(base, variant);
  }

  // ---- Run, compare and draw ----
  function runComparison() {
    const runs = presetRuns(preset);
    const reasons = [...checkScenario(runs.baseline, rules), ...checkScenario(runs.variant, rules)];
    refusal.hidden = true;
    if (reasons.length > 0) {
      showRefusal(reasons);
      return;
    }
    const exec = (s: Scenario) => dallaMan2007.run(s, applyProfile(data.params, s.profile, rules));
    let out: Record<'baseline' | 'variant', RunResult>;
    try {
      out = { baseline: exec(runs.baseline), variant: exec(runs.variant) };
    } catch (e) {
      showRefusal([e instanceof Error ? e.message : String(e)]);
      return;
    }
    const scenarios = { baseline: runs.baseline, variant: runs.variant };

    changed.replaceChildren(
      h('strong', { textContent: `Changed: ${runs.intervention.variable}. ` }),
      `${String(runs.intervention.before)} → ${String(runs.intervention.after)}`,
    );

    // Machines, on one shared scale.
    const both = [out.baseline, out.variant];
    const readouts: Readout[] = binding.observables.flatMap((b) => {
      const o = model.observables.find((x) => x.id === b.observableId);
      return o && 'componentId' in o.observes ? [{ componentId: o.observes.componentId, observableId: o.id, label: READOUT_LABELS[o.id] ?? o.metric }] : [];
    });
    const views = RUNS.map(({ key }) => {
      const view = createMachineView(model, new Set(binding.controls.map((c) => c.controlId)), readouts, select, key);
      view.setControlsVisible(controlsBox.checked);
      return view;
    });
    machines.replaceChildren(...RUNS.map(({ label, className }, i) =>
      h('figure', { className: `machine-figure ${className}` },
        h('figcaption', { textContent: label }),
        h('div', { className: 'diagram-scroll', tabIndex: 0 }, views[i]!.element)),
    ));
    const frames = RUNS.map(({ key }) => frameBuilder(out[key], binding, both));

    // Charts.
    const duration = Math.min(runDuration(out.baseline), runDuration(out.variant));
    const seriesOf = (variable: string) =>
      RUNS.map(({ key, label, className }) => {
        const s = out[key].series.find((x) => x.variable === variable)!;
        return { label, className, times: s.times, values: s.values };
      });
    const bands = runs.variant.events.flatMap((e) =>
      e.kind === 'activity' ? [{ start: e.time, end: e.time + e.payload.durationMin, label: 'Variant activity' }] : []);
    const chartList = [
      createChart({ title: 'Blood glucose', unit: 'mg/dL', series: seriesOf('G'), duration, bands }),
      createChart({ title: 'Plasma insulin', unit: 'pmol/L', series: seriesOf('I'), duration, bands }),
    ];
    charts.replaceChildren(...chartList.map((c) => c.element));

    // Metrics and explanation.
    const metrics = {
      baseline: mealMetrics(out.baseline.series.find((s) => s.variable === 'G')!, 0, carbsOf(runs.baseline)),
      variant: mealMetrics(out.variant.series.find((s) => s.variable === 'G')!, 0, carbsOf(runs.variant)),
    };
    renderResults(metrics, explainComparison(compareRuns(out.baseline, out.variant, runs.intervention), binding.totals, metrics), scenarios);
    renderCaption(out.baseline, [...new Set([...out.baseline.limitations, ...out.variant.limitations])]);

    slider.max = String(duration);
    time = Math.min(time, duration);
    current = { duration, views, frames, charts: chartList };
    for (const v of views) v.select(selected);
    draw(0);
  }

  function showRefusal(reasons: string[]) {
    setPlaying(false);
    refusal.hidden = false;
    refusal.replaceChildren(h('strong', { textContent: 'This comparison was not run. ' }), ...reasons.map((r) => h('p', { textContent: r })));
    machines.replaceChildren();
    charts.replaceChildren();
    results.replaceChildren();
    current = null;
  }

  function renderResults(metrics: { baseline: MealMetrics; variant: MealMetrics }, note: string[], scenarios: Record<'baseline' | 'variant', Scenario>) {
    const rows: [string, (m: MealMetrics) => string][] = [
      ['Glucose before the meal', (m) => `${m.preMeal.toFixed(0)} mg/dL`],
      ['Peak rise', (m) => `${m.peakRise.toFixed(0)} mg/dL`],
      ['Time to peak', (m) => `${m.timeToPeak} min`],
      ['Back within 10 mg/dL of the start', (m) => (m.timeToBaseline === null ? 'not within the run' : `${m.timeToBaseline} min`)],
      ['Area above the starting level', (m) => `${Math.round(m.iauc).toLocaleString()} mg/dL·min`],
      ['Rise per gram of carbohydrate', (m) => `${m.risePerGram.toFixed(2)} mg/dL per g`],
    ];
    const table = h('table', { className: 'metrics' });
    table.append(h('caption', { textContent: 'Glucose response to the meal (model output)' }));
    table.append(h('tr', {}, h('th', { scope: 'col', textContent: 'Measure' }), ...RUNS.map((r) => h('th', { scope: 'col', className: r.className, textContent: r.label }))));
    for (const [label, f] of rows) {
      table.append(h('tr', {}, h('th', { scope: 'row', textContent: label }), h('td', { textContent: f(metrics.baseline) }), h('td', { textContent: f(metrics.variant) })));
    }
    const energyRow = h('tr', {}, h('th', { scope: 'row', textContent: 'Meal energy' }));
    for (const r of RUNS) {
      const meal = scenarios[r.key].events.find((e) => e.kind === 'meal');
      energyRow.append(h('td', {
        textContent: data.energy && meal && meal.kind === 'meal' ? `${Math.round(mealEnergyKcal(meal.payload, data.energy))} kcal` : 'awaiting citation check',
      }));
    }
    table.append(energyRow);

    const explanation = h('div', { className: 'explanation' }, h('h3', { textContent: 'What changed and why' }));
    for (const line of note) explanation.append(h('p', { textContent: line }));
    results.replaceChildren(h('div', { className: 'table-wrap' }, table), explanation);
  }

  function renderCaption(run: RunResult, limitations: string[]) {
    const limits = h('details', {}, h('summary', { textContent: 'What this model leaves out' }), h('ul', {}, ...limitations.map((l) => h('li', { textContent: l }))));
    caption.replaceChildren(
      h('p', {}, h('strong', { textContent: 'Model output. ' }), `${data.modelLabel}. Engine ${run.engineId} ${run.engineVersion}, parameter set ${run.parameterSetId}. Each run starts from the model's steady state for its settings.`),
      h('p', {
        className: 'legend',
        innerHTML:
          '<span class="key glucose">glucose</span><span class="key protein">amino acids</span><span class="key fat">fat</span>' +
          '<span class="key exhaust">burned fuel</span><span class="key control">control signal</span><span class="key idle">not modeled in this run</span>',
      }),
      limits,
    );
  }

  function select(id: string) {
    selected = id;
    current?.views.forEach((v) => v.select(id));
    refreshPanel();
  }

  function refreshPanel() {
    if (!current) return renderPanel(panel, model, selected, []);
    renderPanel(panel, model, selected, RUNS.map((r, i) => ({ label: r.label, frame: current!.frames[i]!(time) })));
  }

  function draw(dtSeconds: number) {
    if (!current) return;
    current.views.forEach((v, i) => v.update(current!.frames[i]!(time), dtSeconds));
    current.charts.forEach((c) => c.setTime(time));
    slider.value = String(Math.round(time));
    clock.textContent = `${Math.round(time)} min`;
    if (selected) refreshPanel();
  }

  function setPlaying(on: boolean) {
    playing = on && current !== null;
    play.textContent = playing ? '❚❚' : '▶';
    play.ariaLabel = playing ? 'Pause' : 'Play';
    if (playing) {
      if (time >= current!.duration) time = 0;
      lastTick = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function tick(now: number) {
    if (!playing || !current) return;
    const dt = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;
    time = Math.min(current.duration, time + dt * speed);
    draw(dt);
    if (time >= current.duration) setPlaying(false);
    else requestAnimationFrame(tick);
  }

  play.addEventListener('click', () => setPlaying(!playing));
  slider.addEventListener('input', () => {
    time = Number(slider.value);
    draw(0);
  });
  speedSelect.addEventListener('change', () => (speed = Number(speedSelect.value)));
  controlsBox.addEventListener('change', () => current?.views.forEach((v) => v.setControlsVisible(controlsBox.checked)));

  renderSettings();
  renderPanel(panel, model, null, []);
  runComparison();
}
