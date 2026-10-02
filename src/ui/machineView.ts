import type { Frame, ReferenceModel } from '../core';
import { layoutMachine, midpoint, type Point } from './layout';

// Draws the machine as SVG and animates it frame by frame. Owns no simulation state.

const NS = 'http://www.w3.org/2000/svg';

export type SubstanceKind = 'glucose' | 'protein' | 'fat' | 'food' | 'exhaust' | 'other';

export function substanceKind(substance: string): SubstanceKind {
  const s = substance.toLowerCase();
  if (s.includes('glucose') && !s.includes('fat')) return 'glucose';
  if (s.includes('amino')) return 'protein';
  if (s.includes('fat')) return 'fat';
  if (s.includes('food')) return 'food';
  if (s.includes('carbon') || s.includes('heat')) return 'exhaust';
  return 'other';
}

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

function smoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  const [first, ...rest] = points;
  let d = `M${first!.x.toFixed(1)},${first!.y.toFixed(1)}`;
  for (let i = 0; i < rest.length - 1; i++) {
    const p = rest[i]!;
    const q = rest[i + 1]!;
    d += ` Q${p.x.toFixed(1)},${p.y.toFixed(1)} ${((p.x + q.x) / 2).toFixed(1)},${((p.y + q.y) / 2).toFixed(1)}`;
  }
  const last = rest[rest.length - 1];
  if (last) d += ` L${last.x.toFixed(1)},${last.y.toFixed(1)}`;
  return d;
}

export interface Readout {
  componentId: string;
  observableId: string;
  label: string;
}

export interface MachineView {
  element: SVGSVGElement;
  /** Draws a frame. dtSeconds is wall-clock time since the last draw, for the moving dots. */
  update(frame: Frame, dtSeconds: number): void;
  select(componentId: string | null): void;
  setControlsVisible(visible: boolean): void;
}

export function createMachineView(
  model: ReferenceModel,
  boundControls: Set<string>,
  readouts: Readout[],
  onSelect: (componentId: string) => void,
  /** Keeps marker ids unique when several diagrams share a page. */
  idPrefix = 'machine',
): MachineView {
  const readoutCount = new Map<string, number>();
  for (const r of readouts) readoutCount.set(r.componentId, (readoutCount.get(r.componentId) ?? 0) + 1);
  const layout = layoutMachine(model, readoutCount);

  const svg = el('svg', {
    viewBox: `0 0 ${layout.width} ${layout.height}`,
    class: 'machine',
    role: 'group',
    'aria-label': 'Fuel metabolism system diagram',
  });

  const defs = el('defs', {}, svg);
  for (const kind of ['glucose', 'protein', 'fat', 'food', 'exhaust', 'other', 'idle']) {
    // Fixed size in user space, so arrowheads do not balloon on thick flows.
    const marker = el('marker', {
      id: `${idPrefix}-arrow-${kind}`, viewBox: '0 0 10 10', refX: 9, refY: 5,
      markerWidth: 9, markerHeight: 9, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse',
    }, defs);
    el('path', { d: 'M0,0 L10,5 L0,10 z', class: `arrowhead ${kind}` }, marker);
  }

  const controlLayer = el('g', { class: 'controls' }, svg);
  const flowLayer = el('g', { class: 'flows' }, svg);
  const nodeLayer = el('g', { class: 'nodes' }, svg);

  // Flows: a base path (always drawn) and, for each, a dotted path whose dots move with the flow.
  const flowPaths = new Map<string, { base: SVGPathElement; dots: SVGPathElement; title: SVGTitleElement; offset: number; label: string }>();
  for (const f of model.flows) {
    const points = layout.flows.get(f.id) ?? [];
    const kind = substanceKind(f.substance);
    const d = smoothPath(points);
    const group = el('g', { class: `flow ${kind} idle`, 'data-flow': f.id }, flowLayer);
    const title = el('title', {}, group);
    const label = `${f.substance}: ${model.components.find((c) => c.id === f.from)?.name} → ${model.components.find((c) => c.id === f.to)?.name}`;
    title.textContent = `${label} (not modeled in this run)`;
    const base = el('path', { d, class: 'flow-base', 'marker-end': `url(#${idPrefix}-arrow-idle)` }, group);
    const dots = el('path', { d, class: 'flow-dots' }, group);
    flowPaths.set(f.id, { base, dots, title, offset: 0, label });
    base.dataset['kind'] = kind;
  }

  // Control signals: dashed lines from the producing component to the middle of each flow it acts on.
  const controlLines = new Map<string, SVGLineElement[]>();
  for (const c of model.controls) {
    const from = layout.nodes.get(c.producedBy);
    if (!from) continue;
    const lines = c.actsOn.flatMap((flowId) => {
      const pts = layout.flows.get(flowId);
      if (!pts) return [];
      const to = midpoint(pts);
      const line = el('line', {
        x1: from.x, y1: from.y, x2: to.x, y2: to.y,
        class: `control ${boundControls.has(c.id) ? 'modeled' : 'unmodeled'}`,
        'data-control': c.id,
      }, controlLayer);
      el('title', {}, line).textContent = boundControls.has(c.id)
        ? `${c.name} → ${flowId}: ${c.effect}`
        : `${c.name} → ${flowId} (not modeled in this run)`;
      return [line];
    });
    controlLines.set(c.id, lines);
  }

  // Components.
  const nodeGroups = new Map<string, SVGGElement>();
  const readoutText = new Map<string, SVGTextElement>();
  for (const c of model.components) {
    const box = layout.nodes.get(c.id)!;
    const g = el('g', {
      class: `node ${c.kind}`,
      transform: `translate(${box.x - box.width / 2},${box.y - box.height / 2})`,
      tabindex: 0,
      role: 'button',
      'aria-label': `${c.name}. Show details.`,
      'data-component': c.id,
    }, nodeLayer);
    el('rect', { width: box.width, height: box.height, rx: 10 }, g);
    const name = el('text', { x: box.width / 2, y: 24, class: 'node-name' }, g);
    name.textContent = c.name;
    readouts
      .filter((r) => r.componentId === c.id)
      .forEach((r, i) => {
        const t = el('text', { x: box.width / 2, y: 42 + i * 18, class: 'node-readout' }, g);
        t.textContent = r.label;
        readoutText.set(r.observableId, t);
      });
    g.addEventListener('click', () => onSelect(c.id));
    g.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onSelect(c.id);
      }
    });
    nodeGroups.set(c.id, g);
  }

  const readoutLabels = new Map(readouts.map((r) => [r.observableId, r.label]));

  return {
    element: svg,

    update(frame, dtSeconds) {
      for (const [id, path] of flowPaths) {
        const state = frame.flows.get(id);
        const group = path.base.parentNode as SVGGElement;
        if (!state) continue;
        const kind = path.base.dataset['kind']!;
        group.classList.remove('idle');
        group.classList.add('live');
        path.base.setAttribute('marker-end', `url(#${idPrefix}-arrow-${kind})`);
        const width = 1.5 + 9 * state.relative;
        path.base.style.strokeWidth = `${width}`;
        path.dots.style.strokeWidth = `${Math.max(2, width * 0.55)}`;
        path.dots.style.opacity = state.relative > 0.01 ? '1' : '0';
        path.offset -= dtSeconds * 40 * state.relative;
        path.dots.style.strokeDashoffset = `${path.offset}`;
        path.title.textContent = `${path.label}: ${state.value.toFixed(2)} ${state.unit}. ${state.note}`;
      }
      for (const [id, lines] of controlLines) {
        const activity = frame.controls.get(id);
        if (activity === undefined) continue;
        for (const line of lines) line.style.opacity = `${0.15 + 0.85 * activity}`;
      }
      for (const [id, text] of readoutText) {
        const r = frame.observables.get(id);
        if (r) text.textContent = `${readoutLabels.get(id)} ${r.value.toFixed(0)} ${r.unit}`;
      }
    },

    select(componentId) {
      for (const [id, g] of nodeGroups) g.classList.toggle('selected', id === componentId);
    },

    setControlsVisible(visible) {
      controlLayer.style.display = visible ? '' : 'none';
    },
  };
}
