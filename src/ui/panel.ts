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

export function renderPanel(container: HTMLElement, model: ReferenceModel, componentId: string | null, frame: Frame | null): void {
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
    const state = frame?.flows.get(f.id);
    if (state) {
      span.append(h('span', ` ${state.value.toFixed(2)} ${state.unit}`, 'value'));
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
    const r = frame?.observables.get(o.id);
    if (r) span.append(h('span', ` Model now: ${r.value.toFixed(1)} ${r.unit}`, 'value'));
    return span;
  }), 'Nothing observable here in this version.');

  const controls = section(container, 4, 'The controls');
  const controlItem = (c: (typeof bill.controlsActing)[number], produced: boolean) => {
    const span = h('span');
    span.append(h('strong', c.name), produced ? ' (made here) ' : ' ', c.effect);
    const activity = frame?.controls.get(c.id);
    span.append(h('small', activity === undefined ? 'Not modeled in this run.' : `Signal now: ${Math.round(activity * 100)}% of this run's range.`, 'note'));
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
