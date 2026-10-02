import dagre from '@dagrejs/dagre';
import type { ReferenceModel } from '../core';

// Lays out the machine diagram from the reference model. Nothing is placed by hand: adding a
// component or flow to the data adds it to the picture.

export interface Point {
  x: number;
  y: number;
}

export interface NodeBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Layout {
  width: number;
  height: number;
  nodes: Map<string, NodeBox>;
  /** Polyline for each flow, from source to target. */
  flows: Map<string, Point[]>;
}

const NODE_HEIGHT = 40;
const READOUT_HEIGHT = 18;
const MARGIN = 16;
const PARALLEL_GAP = 7;
const ENDPOINT_TAPER = 0.4;

function nodeWidth(label: string): number {
  return Math.max(88, Math.round(label.length * 7.2 + 28));
}

/** Pushes parallel flows between the same two components apart so each stays visible. */
function separateParallel(model: ReferenceModel, flows: Map<string, Point[]>): void {
  const groups = new Map<string, string[]>();
  for (const f of model.flows) {
    const key = [f.from, f.to].sort().join('|');
    groups.set(key, [...(groups.get(key) ?? []), f.id]);
  }
  for (const ids of groups.values()) {
    if (ids.length < 2) continue;
    ids.forEach((id, i) => {
      const pts = flows.get(id);
      if (!pts || pts.length < 2) return;
      const a = pts[0]!;
      const b = pts[pts.length - 1]!;
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      // Normal of the canonical (sorted) direction, so opposite-direction flows also separate.
      const flow = model.flows.find((f) => f.id === id)!;
      const sign = flow.from < flow.to ? 1 : -1;
      const nx = (-(b.y - a.y) / len) * sign;
      const ny = ((b.x - a.x) / len) * sign;
      const offset = (i - (ids.length - 1) / 2) * PARALLEL_GAP;
      // Full separation in the middle, tapering at the ends so every flow still touches its components.
      const last = pts.length - 1;
      flows.set(id, pts.map((p, k) => {
        const o = k === 0 || k === last ? offset * ENDPOINT_TAPER : offset;
        return { x: p.x + nx * o, y: p.y + ny * o };
      }));
    });
  }
}

export function layoutMachine(model: ReferenceModel, readoutsPerComponent: Map<string, number>): Layout {
  // dagre 3.1 fails ("Not possible to find intersection inside of the rectangle") on multigraphs
  // that mix parallel and opposite-direction edges, e.g. blood <-> adipose. So lay out one edge
  // per pair of components, weighted by how many flows share it, and route each flow along it.
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 28, ranksep: 56, edgesep: 14, marginx: MARGIN, marginy: MARGIN });
  g.setDefaultEdgeLabel(() => ({}));

  for (const c of model.components) {
    const readouts = readoutsPerComponent.get(c.id) ?? 0;
    g.setNode(c.id, { width: nodeWidth(c.name), height: NODE_HEIGHT + readouts * READOUT_HEIGHT });
  }
  const pairEdge = new Map<string, { v: string; w: string; count: number }>();
  for (const f of model.flows) {
    const key = [f.from, f.to].sort().join('|');
    const edge = pairEdge.get(key) ?? { v: f.from, w: f.to, count: 0 };
    edge.count += 1;
    pairEdge.set(key, edge);
  }
  for (const e of pairEdge.values()) g.setEdge(e.v, e.w, { weight: e.count });

  // Layout-only edges pull each control's producer towards where it acts, so placeholder glands
  // sit near their targets rather than floating at the top. They are not drawn as flows.
  const flowsById = new Map(model.flows.map((f) => [f.id, f]));
  for (const c of model.controls) {
    const targets = new Set(c.actsOn.map((id) => flowsById.get(id)?.to).filter((t): t is string => !!t && t !== c.producedBy));
    for (const t of targets) {
      if (!g.hasEdge(c.producedBy, t) && !g.hasEdge(t, c.producedBy)) g.setEdge(c.producedBy, t, { weight: 0, minlen: 1 });
    }
  }

  dagre.layout(g);

  const nodes = new Map<string, NodeBox>();
  for (const id of g.nodes()) {
    const n = g.node(id);
    nodes.set(id, { x: n.x, y: n.y, width: n.width, height: n.height });
  }
  const flows = new Map<string, Point[]>();
  for (const f of model.flows) {
    const pair = pairEdge.get([f.from, f.to].sort().join('|'))!;
    const points: Point[] = (g.edge(pair.v, pair.w).points ?? []).map((p: Point) => ({ x: p.x, y: p.y }));
    flows.set(f.id, pair.v === f.from ? points : points.reverse());
  }
  separateParallel(model, flows);

  const graph = g.graph();
  return { width: graph.width ?? 0, height: graph.height ?? 0, nodes, flows };
}

/** The point halfway along a polyline, by length. */
export function midpoint(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  const segments = points.slice(1).map((p, i) => Math.hypot(p.x - points[i]!.x, p.y - points[i]!.y));
  let remaining = segments.reduce((a, b) => a + b, 0) / 2;
  for (let i = 0; i < segments.length; i++) {
    const len = segments[i]!;
    if (remaining <= len && len > 0) {
      const a = points[i]!;
      const b = points[i + 1]!;
      const w = remaining / len;
      return { x: a.x + (b.x - a.x) * w, y: a.y + (b.y - a.y) * w };
    }
    remaining -= len;
  }
  return points[points.length - 1]!;
}
