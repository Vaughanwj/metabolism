import type {
  Citation,
  Component,
  ComponentKind,
  Control,
  ControlNeed,
  Flow,
  Need,
  NeedTarget,
  Observable,
  ObservedThing,
  ReferenceModel,
  ReferenceRange,
} from './types';

// Loads a reference model from untrusted, already-parsed data (e.g. JSON).
//
// Two kinds of problem are reported differently:
// - errors: the data is malformed (missing fields, duplicate ids, dangling references).
//   Nothing is loaded.
// - rejections: an entry is well formed but its citation is missing or unverified.
//   That entry is left out and the rest of the model loads (sourcing rule).
//
// Flow.controlledBy is derived from Control.actsOn, so the link is stated once in the data.

export interface Rejection {
  section: CitedSection;
  id: string;
  reason: string;
}

export type LoadResult =
  | { ok: true; model: ReferenceModel; rejected: Rejection[] }
  | { ok: false; errors: string[] };

type CitedSection = 'needs' | 'controlNeeds' | 'referenceRanges';

const COMPONENT_KINDS: readonly ComponentKind[] = ['organ', 'tissue', 'compartment', 'placeholder'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

class Problems {
  errors: string[] = [];
  rejected: Rejection[] = [];
  error(path: string, message: string): void {
    this.errors.push(`${path}: ${message}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(obj: Record<string, unknown>, key: string, path: string, p: Problems): string {
  const value = obj[key];
  if (typeof value !== 'string' || value.trim() === '') {
    p.error(`${path}.${key}`, 'must be a non-empty string');
    return '';
  }
  return value;
}

function optStr(obj: Record<string, unknown>, key: string, path: string, p: Problems): string | undefined {
  if (obj[key] === undefined) return undefined;
  return str(obj, key, path, p);
}

function num(obj: Record<string, unknown>, key: string, path: string, p: Problems): number {
  const value = obj[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    p.error(`${path}.${key}`, 'must be a finite number');
    return NaN;
  }
  return value;
}

function strList(obj: Record<string, unknown>, key: string, path: string, p: Problems): string[] {
  const value = obj[key];
  if (!Array.isArray(value) || !value.every((v) => typeof v === 'string' && v !== '')) {
    p.error(`${path}.${key}`, 'must be an array of non-empty strings');
    return [];
  }
  return value as string[];
}

/** Returns the reason a citation is unusable, or undefined if it is acceptable. */
export function citationProblem(raw: unknown): string | undefined {
  if (raw === undefined) return 'no citation';
  if (!isRecord(raw)) return 'citation is not an object';
  const { source, verifiedBy, verifiedOn, locator, url } = raw;
  if (typeof source !== 'string' || source.trim() === '') return 'citation has no source';
  if (typeof verifiedBy !== 'string' || verifiedBy.trim() === '') return 'citation not verified by a named person';
  if (typeof verifiedOn !== 'string' || !ISO_DATE.test(verifiedOn) || Number.isNaN(Date.parse(verifiedOn))) {
    return 'citation has no valid verifiedOn date (YYYY-MM-DD)';
  }
  if (locator !== undefined && typeof locator !== 'string') return 'citation locator must be a string';
  if (url !== undefined && typeof url !== 'string') return 'citation url must be a string';
  return undefined;
}

function toCitation(raw: Record<string, unknown>): Citation {
  const citation: Citation = {
    source: raw['source'] as string,
    verifiedBy: raw['verifiedBy'] as string,
    verifiedOn: raw['verifiedOn'] as string,
  };
  if (typeof raw['locator'] === 'string') citation.locator = raw['locator'];
  if (typeof raw['url'] === 'string') citation.url = raw['url'];
  return citation;
}

function section(raw: Record<string, unknown>, key: string, p: Problems): Record<string, unknown>[] {
  const value = raw[key];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    p.error(key, 'must be an array');
    return [];
  }
  const entries: Record<string, unknown>[] = [];
  value.forEach((entry, i) => {
    if (isRecord(entry)) entries.push(entry);
    else p.error(`${key}[${i}]`, 'must be an object');
  });
  return entries;
}

/**
 * Parses a cited entry. Malformed fields are errors; a missing or unverified citation is a
 * rejection, and the entry is dropped.
 */
function cited<T>(
  sectionName: CitedSection,
  entries: Record<string, unknown>[],
  p: Problems,
  parse: (e: Record<string, unknown>, path: string) => Omit<T, 'citation'>,
): T[] {
  const kept: T[] = [];
  entries.forEach((e, i) => {
    const path = `${sectionName}[${i}]`;
    const body = parse(e, path);
    const reason = citationProblem(e['citation']);
    const id = typeof e['id'] === 'string' ? e['id'] : `#${i}`;
    if (reason) {
      p.rejected.push({ section: sectionName, id, reason });
      return;
    }
    kept.push({ ...body, citation: toCitation(e['citation'] as Record<string, unknown>) } as T);
  });
  return kept;
}

function parseComponent(e: Record<string, unknown>, path: string, p: Problems): Component {
  const kind = e['kind'];
  if (!COMPONENT_KINDS.includes(kind as ComponentKind)) {
    p.error(`${path}.kind`, `must be one of ${COMPONENT_KINDS.join(', ')}`);
  }
  return {
    id: str(e, 'id', path, p),
    name: str(e, 'name', path, p),
    kind: kind as ComponentKind,
    description: str(e, 'description', path, p),
  };
}

function parseFlow(e: Record<string, unknown>, path: string, p: Problems): Flow {
  const flow: Flow = {
    id: str(e, 'id', path, p),
    from: str(e, 'from', path, p),
    to: str(e, 'to', path, p),
    substance: str(e, 'substance', path, p),
    controlledBy: [],
  };
  const route = optStr(e, 'route', path, p);
  if (route !== undefined) flow.route = route;
  const notes = optStr(e, 'notes', path, p);
  if (notes !== undefined) flow.notes = notes;
  if (e['controlledBy'] !== undefined) {
    p.error(`${path}.controlledBy`, 'is derived from controls[].actsOn; state the link on the control instead');
  }
  return flow;
}

function parseControl(e: Record<string, unknown>, path: string, p: Problems): Control {
  return {
    id: str(e, 'id', path, p),
    name: str(e, 'name', path, p),
    producedBy: str(e, 'producedBy', path, p),
    actsOn: strList(e, 'actsOn', path, p),
    effect: str(e, 'effect', path, p),
  };
}

function parseNeedTarget(e: Record<string, unknown>, path: string, p: Problems): NeedTarget {
  const t = e['target'];
  if (isRecord(t) && typeof t['componentId'] === 'string') return { componentId: t['componentId'] };
  if (isRecord(t) && typeof t['controlId'] === 'string') return { controlId: t['controlId'] };
  p.error(`${path}.target`, 'must be { componentId } or { controlId }');
  return { componentId: '' };
}

function parseObserved(e: Record<string, unknown>, path: string, p: Problems): ObservedThing {
  const o = e['observes'];
  if (isRecord(o) && typeof o['componentId'] === 'string') return { componentId: o['componentId'] };
  if (isRecord(o) && typeof o['flowId'] === 'string') return { flowId: o['flowId'] };
  p.error(`${path}.observes`, 'must be { componentId } or { flowId }');
  return { componentId: '' };
}

function parseObservable(e: Record<string, unknown>, path: string, p: Problems): Observable {
  return {
    id: str(e, 'id', path, p),
    observes: parseObserved(e, path, p),
    metric: str(e, 'metric', path, p),
    unit: str(e, 'unit', path, p),
    measurementMethod: str(e, 'measurementMethod', path, p),
  };
}

function checkUniqueIds(name: string, items: { id: string }[], p: Problems): void {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (id === '') continue;
    if (seen.has(id)) p.error(name, `duplicate id "${id}"`);
    seen.add(id);
  }
}

function checkRef(path: string, id: string, known: Set<string>, what: string, p: Problems): void {
  if (id !== '' && !known.has(id)) p.error(path, `unknown ${what} "${id}"`);
}

export function loadReferenceModel(raw: unknown): LoadResult {
  const p = new Problems();
  if (!isRecord(raw)) return { ok: false, errors: ['reference model must be an object'] };

  const components = section(raw, 'components', p).map((e, i) => parseComponent(e, `components[${i}]`, p));
  const flows = section(raw, 'flows', p).map((e, i) => parseFlow(e, `flows[${i}]`, p));
  const controls = section(raw, 'controls', p).map((e, i) => parseControl(e, `controls[${i}]`, p));
  const observables = section(raw, 'observables', p).map((e, i) => parseObservable(e, `observables[${i}]`, p));

  const needs = cited<Need>('needs', section(raw, 'needs', p), p, (e, path) => ({
    id: str(e, 'id', path, p),
    target: parseNeedTarget(e, path, p),
    substance: str(e, 'substance', path, p),
    role: str(e, 'role', path, p),
  }));
  const controlNeeds = cited<ControlNeed>('controlNeeds', section(raw, 'controlNeeds', p), p, (e, path) => ({
    id: str(e, 'id', path, p),
    controlId: str(e, 'controlId', path, p),
    requirement: str(e, 'requirement', path, p),
  }));
  const referenceRanges = cited<ReferenceRange>('referenceRanges', section(raw, 'referenceRanges', p), p, (e, path) => {
    const low = num(e, 'low', path, p);
    const high = num(e, 'high', path, p);
    if (low > high) p.error(path, 'low must not exceed high');
    return {
      id: str(e, 'id', path, p),
      metric: str(e, 'metric', path, p),
      unit: str(e, 'unit', path, p),
      low,
      high,
      population: str(e, 'population', path, p),
      context: str(e, 'context', path, p),
    };
  });

  checkUniqueIds('components', components, p);
  checkUniqueIds('flows', flows, p);
  checkUniqueIds('controls', controls, p);
  checkUniqueIds('observables', observables, p);
  checkUniqueIds('needs', needs, p);
  checkUniqueIds('controlNeeds', controlNeeds, p);
  checkUniqueIds('referenceRanges', referenceRanges, p);

  const componentIds = new Set(components.map((c) => c.id));
  const flowIds = new Set(flows.map((f) => f.id));
  const controlIds = new Set(controls.map((c) => c.id));

  flows.forEach((f, i) => {
    checkRef(`flows[${i}].from`, f.from, componentIds, 'component', p);
    checkRef(`flows[${i}].to`, f.to, componentIds, 'component', p);
  });
  const flowsById = new Map(flows.map((f) => [f.id, f]));
  controls.forEach((c, i) => {
    checkRef(`controls[${i}].producedBy`, c.producedBy, componentIds, 'component', p);
    c.actsOn.forEach((flowId, j) => {
      checkRef(`controls[${i}].actsOn[${j}]`, flowId, flowIds, 'flow', p);
      flowsById.get(flowId)?.controlledBy.push(c.id);
    });
  });
  observables.forEach((o, i) => {
    if ('componentId' in o.observes) checkRef(`observables[${i}].observes`, o.observes.componentId, componentIds, 'component', p);
    else checkRef(`observables[${i}].observes`, o.observes.flowId, flowIds, 'flow', p);
  });
  // Cited sections have had rejected entries removed, so refer to entries by id, not index.
  needs.forEach((n) => {
    if ('componentId' in n.target) checkRef(`needs "${n.id}".target`, n.target.componentId, componentIds, 'component', p);
    else checkRef(`needs "${n.id}".target`, n.target.controlId, controlIds, 'control', p);
  });
  controlNeeds.forEach((n) => checkRef(`controlNeeds "${n.id}".controlId`, n.controlId, controlIds, 'control', p));

  if (p.errors.length > 0) return { ok: false, errors: p.errors };
  return {
    ok: true,
    model: { components, flows, needs, observables, controls, controlNeeds, referenceRanges },
    rejected: p.rejected,
  };
}
