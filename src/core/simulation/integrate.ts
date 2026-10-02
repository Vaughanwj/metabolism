/** Right-hand side of an ODE system: returns dx/dt at time t. */
export type Derivative = (t: number, x: readonly number[]) => number[];

/** One classical fourth-order Runge-Kutta step of size h. */
export function rk4Step(f: Derivative, t: number, x: readonly number[], h: number): number[] {
  const k1 = f(t, x);
  const k2 = f(t + h / 2, x.map((xi, i) => xi + (h / 2) * k1[i]!));
  const k3 = f(t + h / 2, x.map((xi, i) => xi + (h / 2) * k2[i]!));
  const k4 = f(t + h, x.map((xi, i) => xi + h * k3[i]!));
  return x.map((xi, i) => xi + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
}
