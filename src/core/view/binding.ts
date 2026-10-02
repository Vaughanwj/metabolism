import type { ReferenceModel } from '../model/types';

// A binding says which engine output animates which part of the reference model.
// Only bound flows and controls move; everything else is drawn but marked "not modeled".

export interface FlowBinding {
  flowId: string;
  series: string;
  /** Shown beside the flow; says what the number is and what the model lumps together. */
  note: string;
}

export interface ControlBinding {
  controlId: string;
  series: string;
}

export interface ObservableBinding {
  observableId: string;
  series: string;
}

export interface EngineBinding {
  engineId: string;
  flows: FlowBinding[];
  controls: ControlBinding[];
  observables: ObservableBinding[];
}

export type BindingResult = { ok: true; binding: EngineBinding } | { ok: false; errors: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function entries(raw: Record<string, unknown>, key: string, errors: string[]): Record<string, unknown>[] {
  const value = raw[key];
  if (!Array.isArray(value)) {
    errors.push(`${key} must be an array`);
    return [];
  }
  return value.filter((e, i) => {
    if (isRecord(e)) return true;
    errors.push(`${key}[${i}] must be an object`);
    return false;
  });
}

function text(e: Record<string, unknown>, key: string, path: string, errors: string[]): string {
  const value = e[key];
  if (typeof value !== 'string' || value === '') {
    errors.push(`${path}.${key} must be a non-empty string`);
    return '';
  }
  return value;
}

/** Validates a binding against the reference model: every id it names must exist. */
export function loadBinding(raw: unknown, model: ReferenceModel): BindingResult {
  if (!isRecord(raw)) return { ok: false, errors: ['binding must be an object'] };
  const errors: string[] = [];
  const engineId = text(raw, 'engineId', 'binding', errors);
  const flowIds = new Set(model.flows.map((f) => f.id));
  const controlIds = new Set(model.controls.map((c) => c.id));
  const observableIds = new Set(model.observables.map((o) => o.id));

  const flows = entries(raw, 'flows', errors).map((e, i): FlowBinding => {
    const path = `flows[${i}]`;
    const flowId = text(e, 'flowId', path, errors);
    if (flowId && !flowIds.has(flowId)) errors.push(`${path}: unknown flow "${flowId}"`);
    return { flowId, series: text(e, 'series', path, errors), note: text(e, 'note', path, errors) };
  });
  const controls = entries(raw, 'controls', errors).map((e, i): ControlBinding => {
    const path = `controls[${i}]`;
    const controlId = text(e, 'controlId', path, errors);
    if (controlId && !controlIds.has(controlId)) errors.push(`${path}: unknown control "${controlId}"`);
    return { controlId, series: text(e, 'series', path, errors) };
  });
  const observables = entries(raw, 'observables', errors).map((e, i): ObservableBinding => {
    const path = `observables[${i}]`;
    const observableId = text(e, 'observableId', path, errors);
    if (observableId && !observableIds.has(observableId)) errors.push(`${path}: unknown observable "${observableId}"`);
    return { observableId, series: text(e, 'series', path, errors) };
  });

  for (const [name, ids] of [
    ['flows', flows.map((f) => f.flowId)],
    ['controls', controls.map((c) => c.controlId)],
    ['observables', observables.map((o) => o.observableId)],
  ] as const) {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${name}: "${id}" is bound twice`);
      seen.add(id);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, binding: { engineId, flows, controls, observables } };
}
