import { frameBuilder, runDuration, type EngineBinding, type ReferenceModel, type RunResult } from '../core';
import { createMachineView, type Readout } from './machineView';
import { renderPanel } from './panel';

// The machine view page: diagram, playback and side panel for one run.

export interface AppInput {
  model: ReferenceModel;
  binding: EngineBinding;
  run: RunResult;
  /** Plain-language description of the scenario, e.g. "78 g carbohydrate breakfast at 0 min". */
  scenarioLabel: string;
  modelLabel: string;
}

const SPEEDS = [10, 30, 60];

const READOUT_LABELS: Record<string, string> = {
  'blood-glucose': 'Glucose',
  'plasma-insulin': 'Insulin',
};

function button(text: string, label: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = text;
  b.setAttribute('aria-label', label);
  return b;
}

export function mountApp(root: HTMLElement, input: AppInput): void {
  const { model, binding, run } = input;
  const buildFrame = frameBuilder(run, binding);
  const duration = runDuration(run);

  const readouts: Readout[] = binding.observables.flatMap((b) => {
    const o = model.observables.find((x) => x.id === b.observableId);
    return o && 'componentId' in o.observes
      ? [{ componentId: o.observes.componentId, observableId: o.id, label: READOUT_LABELS[o.id] ?? o.metric }]
      : [];
  });

  let selected: string | null = null;
  let time = 0;
  let playing = false;
  let speed = SPEEDS[1]!;
  let lastTick = 0;

  // Layout of the page.
  const main = document.createElement('main');
  main.className = 'machine-page';
  const stage = document.createElement('div');
  stage.className = 'stage';
  const panel = document.createElement('aside');
  panel.className = 'panel';
  panel.setAttribute('aria-live', 'polite');
  main.append(stage, panel);

  const view = createMachineView(model, new Set(binding.controls.map((c) => c.controlId)), readouts, (id) => {
    selected = id;
    view.select(id);
    renderPanel(panel, model, selected, buildFrame(time));
  });

  // Playback bar.
  const bar = document.createElement('div');
  bar.className = 'playback';
  const play = button('▶', 'Play');
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(duration);
  slider.step = '1';
  slider.value = '0';
  slider.setAttribute('aria-label', 'Time since the start of the run, in minutes');
  const clock = document.createElement('output');
  clock.className = 'clock';
  const speedSelect = document.createElement('select');
  speedSelect.setAttribute('aria-label', 'Playback speed');
  for (const s of SPEEDS) {
    const opt = document.createElement('option');
    opt.value = String(s);
    opt.textContent = `${s} min/s`;
    speedSelect.append(opt);
  }
  speedSelect.value = String(speed);
  speedSelect.autocomplete = 'off';
  const controlsToggle = document.createElement('label');
  controlsToggle.className = 'toggle';
  const controlsBox = document.createElement('input');
  controlsBox.type = 'checkbox';
  controlsBox.checked = true;
  controlsToggle.append(controlsBox, ' Control signals');
  bar.append(play, slider, clock, speedSelect, controlsToggle);

  const caption = document.createElement('div');
  caption.className = 'model-label';
  const what = document.createElement('p');
  what.innerHTML = '<strong>Model output.</strong> ';
  what.append(`${input.scenarioLabel}. ${input.modelLabel}. Engine ${run.engineId} ${run.engineVersion}, parameter set ${run.parameterSetId}.`);
  const limits = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'What this model leaves out';
  const ul = document.createElement('ul');
  for (const l of run.limitations) {
    const li = document.createElement('li');
    li.textContent = l;
    ul.append(li);
  }
  limits.append(summary, ul);
  const legend = document.createElement('p');
  legend.className = 'legend';
  legend.innerHTML =
    '<span class="key glucose">glucose</span><span class="key protein">amino acids</span><span class="key fat">fat</span>' +
    '<span class="key exhaust">burned fuel</span><span class="key control">control signal</span><span class="key idle">not modeled in this run</span>';
  caption.append(what, legend, limits);

  const scroller = document.createElement('div');
  scroller.className = 'diagram-scroll';
  scroller.tabIndex = 0;
  scroller.setAttribute('aria-label', 'Diagram. On small screens, scroll sideways to see all of it.');
  scroller.append(view.element);
  const scrollHint = document.createElement('p');
  scrollHint.className = 'scroll-hint';
  scrollHint.textContent = 'Scroll sideways to see the whole machine.';

  stage.append(bar, scrollHint, scroller, caption);
  root.replaceChildren(main);

  function draw(dtSeconds: number) {
    const frame = buildFrame(time);
    view.update(frame, dtSeconds);
    slider.value = String(Math.round(time));
    clock.textContent = `${Math.round(time)} min`;
    if (selected) renderPanel(panel, model, selected, frame);
  }

  function setPlaying(on: boolean) {
    playing = on;
    play.textContent = on ? '❚❚' : '▶';
    play.setAttribute('aria-label', on ? 'Pause' : 'Play');
    if (on) {
      if (time >= duration) time = 0;
      lastTick = performance.now();
      requestAnimationFrame(tick);
    }
  }

  function tick(now: number) {
    if (!playing) return;
    const dt = Math.min(0.1, (now - lastTick) / 1000);
    lastTick = now;
    time = Math.min(duration, time + dt * speed);
    draw(dt);
    if (time >= duration) setPlaying(false);
    else requestAnimationFrame(tick);
  }

  play.addEventListener('click', () => setPlaying(!playing));
  slider.addEventListener('input', () => {
    time = Number(slider.value);
    draw(0);
  });
  speedSelect.addEventListener('change', () => {
    speed = Number(speedSelect.value);
  });
  controlsBox.addEventListener('change', () => view.setControlsVisible(controlsBox.checked));

  renderPanel(panel, model, null, null);
  draw(0);
}
