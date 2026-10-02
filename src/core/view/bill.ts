import type { Component, Control, ControlNeed, Flow, Need, Observable, ReferenceModel } from '../model/types';

/** A component's five-layer bill of materials, for the side panel. */
export interface BillOfMaterials {
  component: Component;
  /** Layer 1, the machine: what flows in and out. */
  flowsIn: Flow[];
  flowsOut: Flow[];
  /** Layer 2: what the component needs. */
  needs: Need[];
  /** Layer 3: where it can be observed. */
  observables: Observable[];
  /** Layer 4: controls it produces, and controls acting on its flows. */
  controlsProduced: Control[];
  controlsActing: Control[];
  /** Layer 5: what those controls need. */
  controlNeeds: ControlNeed[];
}

export function billOfMaterials(model: ReferenceModel, componentId: string): BillOfMaterials {
  const component = model.components.find((c) => c.id === componentId);
  if (!component) throw new Error(`Unknown component "${componentId}"`);

  const flowsIn = model.flows.filter((f) => f.to === componentId);
  const flowsOut = model.flows.filter((f) => f.from === componentId);
  const ownFlowIds = new Set([...flowsIn, ...flowsOut].map((f) => f.id));

  const controlsProduced = model.controls.filter((c) => c.producedBy === componentId);
  const controlsActing = model.controls.filter((c) => c.actsOn.some((id) => ownFlowIds.has(id)));
  const relevantControls = new Set([...controlsProduced, ...controlsActing].map((c) => c.id));

  return {
    component,
    flowsIn,
    flowsOut,
    needs: model.needs.filter((n) => 'componentId' in n.target && n.target.componentId === componentId),
    observables: model.observables.filter((o) =>
      'componentId' in o.observes ? o.observes.componentId === componentId : ownFlowIds.has(o.observes.flowId),
    ),
    controlsProduced,
    controlsActing,
    controlNeeds: model.controlNeeds.filter((n) => relevantControls.has(n.controlId)),
  };
}
