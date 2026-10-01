import { type Vec3, add, scale, type Frame, transformPoint } from "./math.js";

export type MassGroup = "machine" | "payload";

/** A lumped mass with its centre of gravity expressed in some frame. */
export interface MassComponent {
  id: string;
  label: string;
  group: MassGroup;
  mass: number; // kg
  cg: Vec3;     // m, in the frame stated by the owner (ground frame once placed)
}

export interface CgSummary {
  machine: { mass: number; cg: Vec3 };
  payload: { mass: number; cg: Vec3 };
  combined: { mass: number; cg: Vec3 };
}

/** r = Σ(mᵢ rᵢ) / Σ mᵢ. Throws on zero total mass. */
export const combinedCg = (parts: readonly { mass: number; cg: Vec3 }[]): { mass: number; cg: Vec3 } => {
  let m = 0;
  let acc: Vec3 = { x: 0, y: 0, z: 0 };
  for (const p of parts) {
    if (p.mass < 0) throw new Error("negative mass");
    m += p.mass;
    acc = add(acc, scale(p.cg, p.mass));
  }
  if (m === 0) return { mass: 0, cg: { x: 0, y: 0, z: 0 } };
  return { mass: m, cg: scale(acc, 1 / m) };
};

export const summariseCg = (components: readonly MassComponent[]): CgSummary => ({
  machine: combinedCg(components.filter((c) => c.group === "machine")),
  payload: combinedCg(components.filter((c) => c.group === "payload")),
  combined: combinedCg(components),
});

/** Place a component defined in a local frame into the parent frame. */
export const placeComponent = (c: MassComponent, f: Frame): MassComponent => ({ ...c, cg: transformPoint(f, c.cg) });
