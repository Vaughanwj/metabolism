// Reference model: how the machine works, in five layers.
// The machine (Component, Flow); what it needs (Need); where it can be observed
// (Observable, ReferenceRange); the controls (Control); what the controls need (ControlNeed).

/** A source for a fact, checked by a named human before it may be loaded. */
export interface Citation {
  /** Full reference, e.g. "Hall KD et al. Lancet 2011;378:826-37". */
  source: string;
  /** Where in the source: page, table, figure or equation number. */
  locator?: string;
  url?: string;
  /** The person who checked the fact against the source. */
  verifiedBy: string;
  /** ISO date (YYYY-MM-DD) the check was made. */
  verifiedOn: string;
}

export type ComponentKind = 'organ' | 'tissue' | 'compartment' | 'placeholder';

export interface Component {
  id: string;
  name: string;
  kind: ComponentKind;
  description: string;
}

export interface Flow {
  id: string;
  from: string;
  to: string;
  substance: string;
  /** Path the substance takes, e.g. "portal vein", "lymph", "GLUT4". */
  route?: string;
  /** Ids of the controls that act on this flow. */
  controlledBy: string[];
  notes?: string;
}

/** What a component or control needs in order to work. */
export type NeedTarget = { componentId: string } | { controlId: string };

export interface Need {
  id: string;
  target: NeedTarget;
  substance: string;
  role: string;
  citation: Citation;
}

export type ObservedThing = { componentId: string } | { flowId: string };

/** A simulated output paired with how a real person could measure it. */
export interface Observable {
  id: string;
  observes: ObservedThing;
  metric: string;
  unit: string;
  measurementMethod: string;
}

export interface Control {
  id: string;
  name: string;
  /** Component that produces the signal. */
  producedBy: string;
  /** Flows this control acts on. */
  actsOn: string[];
  effect: string;
}

export interface ControlNeed {
  id: string;
  controlId: string;
  requirement: string;
  citation: Citation;
}

export interface ReferenceRange {
  id: string;
  metric: string;
  unit: string;
  low: number;
  high: number;
  population: string;
  /** e.g. "fasting", "post-meal". */
  context: string;
  citation: Citation;
}

export interface ReferenceModel {
  components: Component[];
  flows: Flow[];
  needs: Need[];
  observables: Observable[];
  controls: Control[];
  controlNeeds: ControlNeed[];
  referenceRanges: ReferenceRange[];
}
