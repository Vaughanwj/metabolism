import { billOfMaterials, type Citation, type Flow, type Frame, type ReferenceModel } from '../core';

// Side panel: the selected component's five-layer bill of materials, with live values.

function h<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, className?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function section(parent: HTMLElement, layer: number, title: string): HTMLElement {
  const s = h('section', undefined, 'layer');
  const heading = h('h3');
  heading.append(h('span', String(layer), 'layer-number'), ` ${title}`);
  s.append(heading);
  parent.append(s);
  return s;
}

function list(parent: HTMLElement, items: HTMLElement[], empty: string): void {
  if (items.length === 0) {
    parent.append(h('p', empty, 'empty'));
    return;
  }
  const ul = h('ul');
  for (const item of items) {
    const li = h('li');
    li.append(item);
    ul.append(li);
  }
  parent.append(ul);
}

function citation(c: Citation): HTMLElement {
  const p = h('p', undefined, 'citation');
  p.append(`${c.source}${c.locator ? `, ${c.locator}` : ''}. Checked by ${c.verifiedBy} on ${c.verifiedOn}.`);
  return p;
}

export interface LabeledFrame {
  label: string;
  frame: Frame;
}

/** "Baseline 3.64 · Variant 2.10 mg/kg/min" (or just the value when there is one run). */
function values(frames: LabeledFrame[], pick: (f: Frame) => { value: number; unit: string } | undefined, digits: number): string | null {
  const picked = frames.map((f) => ({ label: f.label, v: pick(f.frame) })).filter((x) => x.v !== undefined);
  if (picked.length === 0) return null;
  const unit = picked[0]!.v!.unit;
  if (picked.length === 1) return `${picked[0]!.v!.value.toFixed(digits)} ${unit}`;
  return `${picked.map((x) => `${x.label} ${x.v!.value.toFixed(digits)}`).join(' · ')} ${unit}`;
}

export function renderPanel(container: HTMLElement, model: ReferenceModel, componentId: string | null, frames: LabeledFrame[]): void {
  container.replaceChildren();
  if (!componentId) {
    container.append(h('p', 'Select a part of the machine to see what it does, what it needs, where it can be checked and what controls it.', 'hint'));
    return;
  }
  const bill = billOfMaterials(model, componentId);
  const names = new Map(model.components.map((c) => [c.id, c.name]));

  const header = h('header');
  header.append(h('h2', bill.component.name), h('p', bill.component.description, 'description'));
  if (bill.component.kind === 'placeholder') header.append(h('p', 'Placeholder: not modeled in this version.', 'badge'));
  container.append(header);

  const flowItem = (f: Flow, direction: 'in' | 'out') => {
    const span = h('span');
    const other = names.get(direction === 'in' ? f.from : f.to);
    span.append(h('strong', f.substance), ` ${direction === 'in' ? 'from' : 'to'} ${other}`);
    if (f.route) span.append(` via ${f.route}`);
    const state = frames[0]?.frame.flows.get(f.id);
    if (state) {
      span.append(h('span', ` ${values(frames, (fr) => fr.flows.get(f.id), 2)}`, 'value'));
      span.append(h('small', state.note, 'note'));
    } else {
      span.append(h('small', 'Not modeled in this run.', 'note'));
    }
    return span;
  };

  const machine = section(container, 1, 'The machine');
  machine.append(h('h4', 'In'));
  list(machine, bill.flowsIn.map((f) => flowItem(f, 'in')), 'Nothing flows in.');
  machine.append(h('h4', 'Out'));
  list(machine, bill.flowsOut.map((f) => flowItem(f, 'out')), 'Nothing flows out.');

  const needs = section(container, 2, 'What it needs');
  list(needs, bill.needs.map((n) => {
    const span = h('span');
    span.append(h('strong', n.substance), ` for ${n.role}`, citation(n.citation));
    return span;
  }), 'No sourced entries yet. Needs are added only with a checked citation.');

  const checks = section(container, 3, 'Where it can be checked');
  list(checks, bill.observables.map((o) => {
    const span = h('span');
    span.append(h('strong', o.metric), ` (${o.unit}): ${o.measurementMethod}`);
    const now = values(frames, (fr) => fr.observables.get(o.id), 1);
    if (now) span.append(h('span', ` Model now: ${now}`, 'value'));
    return span;
  }), 'Nothing observable here in this version.');

  const controls = section(container, 4, 'The controls');
  const controlItem = (c: (typeof bill.controlsActing)[number], produced: boolean) => {
    const span = h('span');
    span.append(h('strong', c.name), produced ? ' (made here) ' : ' ', c.effect);
    const activity = values(frames, (fr) => {
      const a = fr.controls.get(c.id);
      return a === undefined ? undefined : { value: a * 100, unit: '%' };
    }, 0);
    span.append(h('small', activity === null ? 'Not modeled in this run.' : `Signal now, as a share of its range across the runs shown: ${activity}`, 'note'));
    return span;
  };
  list(controls, [
    ...bill.controlsProduced.map((c) => controlItem(c, true)),
    ...bill.controlsActing.filter((c) => !bill.controlsProduced.includes(c)).map((c) => controlItem(c, false)),
  ], 'No controls act here.');

  const controlNeeds = section(container, 5, 'What the controls need');
  list(controlNeeds, bill.controlNeeds.map((n) => {
    const span = h('span');
    span.append(h('strong', model.controls.find((c) => c.id === n.controlId)?.name ?? n.controlId), ` needs ${n.requirement}`, citation(n.citation));
    return span;
  }), 'No sourced entries yet. Control needs are added only with a checked citation.');
}
