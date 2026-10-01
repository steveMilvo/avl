import {
  resolveDatums, type Datumised, type ForkliftProfile, type LoaderProfile, type ForkliftInputs, type LoaderInputs,
  type ForkliftState, type LoaderState, evaluateForklift, evaluateLoader, forkliftLoadRetention, bucketRetention,
  forkliftCompliance, loaderCompliance, forkliftDynamics, loaderDynamics, dataConfidence, rad, v, type Vec3,
  type DynamicsResult, type OperatorBehaviour, type ComplianceResult, type DataConfidence, type ManoeuvreSpec,
  type ForkliftRetentionResult, type BucketRetentionResult, G,
} from "@loadlab/physics";
import fk2500 from "../../../../profiles/forklift/generic-cb-2500.json";
import ld1500 from "../../../../profiles/loader/generic-articulated-1500.json";
import cat950f from "../../../../profiles/loader/caterpillar-950f.draft.json";
import type { ForkLoadKind, BulkMaterial } from "../scene/loads.js";

export const FORKLIFTS: Record<string, ForkliftProfile> = {
  [fk2500.meta.id]: resolveDatums<ForkliftProfile>(fk2500 as unknown as Datumised<ForkliftProfile>),
};
export const LOADERS: Record<string, LoaderProfile> = {
  [ld1500.meta.id]: resolveDatums<LoaderProfile>(ld1500 as unknown as Datumised<LoaderProfile>),
  [cat950f.meta.id]: resolveDatums<LoaderProfile>(cat950f as unknown as Datumised<LoaderProfile>),
};
export const RAW_PROFILES: Record<string, unknown> = { [fk2500.meta.id]: fk2500, [ld1500.meta.id]: ld1500, [cat950f.meta.id]: cat950f };

export interface TerrainUI { slopeDeg: number; headingDeg: number; friction: number }
export interface ManoeuvreUI { type: "none" | "brake" | "accelerate" | "turn"; travel: "forward" | "reverse"; accel: number; duration: number; speedKmh: number; radius: number; turn: "left" | "right" }
export interface OperatorUI { behaviour: OperatorBehaviour; jumpSide: "fall" | "high" }

export interface ForkLoadUI {
  preset: ForkLoadKind | "none"; mass: number; length: number; width: number; height: number;
  cgX: number; cgY: number; cgZ: number; gap: number; secured: boolean; friction: number; fill: number;
}
export interface ForkliftUI {
  kind: "forklift"; profileId: string; liftHeight: number; tiltDeg: number; sideShift: number;
  load: ForkLoadUI; terrain: TerrainUI; manoeuvre: ManoeuvreUI; operator: OperatorUI; trainerDemo: boolean;
}
export interface BucketLoadUI { material: BulkMaterial | "none"; massMode: "density" | "explicit"; density: number; volume: number; mass: number; lateral: number; reposeDeg: number }
export interface LoaderUI {
  kind: "loader"; profileId: string; armDeg: number; bucketDeg: number; articulationDeg: number;
  load: BucketLoadUI; terrain: TerrainUI; manoeuvre: ManoeuvreUI; operator: OperatorUI; trainerDemo: boolean;
}
export type MachineUI = ForkliftUI | LoaderUI;

export const DENSITY: Record<BulkMaterial, number> = { gravel: 1700, soil: 1500, sand: 1600, grapes: 650, pomace: 900 };
export const REPOSE: Record<BulkMaterial, number> = { gravel: 38, soil: 35, sand: 34, grapes: 25, pomace: 40 };

/** Load presets with documented CG assumptions (all "assumed" for teaching). */
export const forkPreset = (k: ForkLoadKind | "none", fill = 1): Partial<ForkLoadUI> => {
  switch (k) {
    case "cartons": return { preset: k, mass: 900, length: 1.0, width: 1.2, height: 1.2, cgX: 0, cgY: 0, cgZ: 0, friction: 0.4, fill: 1 };
    case "tall-stack": return { preset: k, mass: 1100, length: 1.0, width: 1.2, height: 2.6, cgX: 0, cgY: 0, cgZ: 0.15, friction: 0.4, fill: 1 };
    case "long-load": return { preset: k, mass: 1200, length: 1.0, width: 4.0, height: 0.5, cgX: 0, cgY: 0.4, cgZ: 0, friction: 0.25, fill: 1 };
    case "machinery": return { preset: k, mass: 1600, length: 1.2, width: 1.0, height: 1.3, cgX: 0.25, cgY: -0.2, cgZ: 0.1, friction: 0.35, fill: 1 };
    case "ibc": {
      const tare = 65, liq = 1000 * fill, H = 1.16, liqH = (H - 0.22) * fill;
      const zLiq = 0.17 + liqH / 2, zTare = 0.45, z = (tare * zTare + liq * zLiq) / (tare + liq);
      return { preset: k, mass: Math.round(tare + liq), length: 1.0, width: 1.2, height: H, cgX: 0, cgY: 0, cgZ: z - H / 2, friction: 0.35, fill };
    }
    case "grape-bin": {
      const tare = 90, grapes = 650 * 1.1 * 1.1 * 0.7 * fill, H = 0.75;
      const z = (tare * 0.3 + grapes * (0.04 + 0.7 * fill / 2)) / (tare + grapes);
      return { preset: k, mass: Math.round(tare + grapes), length: 1.16, width: 1.16, height: H, cgX: 0, cgY: 0, cgZ: z - H / 2, friction: 0.45, fill };
    }
    default: return { preset: "none" };
  }
};

export const defaultForklift = (): ForkliftUI => ({
  kind: "forklift", profileId: fk2500.meta.id, liftHeight: 0.15, tiltDeg: 3, sideShift: 0,
  load: { preset: "cartons", mass: 900, length: 1.0, width: 1.2, height: 1.2, cgX: 0, cgY: 0, cgZ: 0, gap: 0, secured: false, friction: 0.4, fill: 1 },
  terrain: { slopeDeg: 0, headingDeg: 0, friction: 0.7 },
  manoeuvre: { type: "none", travel: "forward", accel: 3, duration: 0.8, speedKmh: 10, radius: 4, turn: "left" },
  operator: { behaviour: "belted", jumpSide: "fall" }, trainerDemo: false,
});

export const defaultLoader = (profileId: string = ld1500.meta.id): LoaderUI => ({
  kind: "loader", profileId, armDeg: -25, bucketDeg: 35, articulationDeg: 0,
  load: { material: "gravel", massMode: "density", density: 1700, volume: profileId === cat950f.meta.id ? 2.5 : 1.2, mass: 2000, lateral: 0, reposeDeg: 38 },
  terrain: { slopeDeg: 0, headingDeg: 0, friction: 0.6 },
  manoeuvre: { type: "none", travel: "forward", accel: 2.5, duration: 0.8, speedKmh: 10, radius: 7, turn: "left" },
  operator: { behaviour: "belted", jumpSide: "fall" }, trainerDemo: false,
});

const terrain = (t: TerrainUI) => ({ slopeAngle: rad(t.slopeDeg), heading: rad(t.headingDeg), friction: t.friction });

/** Quasi-static acceleration of the machine (ground frame). */
export const manoeuvreAccel = (m: ManoeuvreUI): Vec3 | undefined => {
  const dir = m.travel === "forward" ? 1 : -1;
  if (m.type === "brake") return v(-dir * m.accel, 0, 0);
  if (m.type === "accelerate") return v(dir * m.accel, 0, 0);
  if (m.type === "turn") { const vv = m.speedKmh / 3.6, a = (vv * vv) / Math.max(0.5, m.radius); return v(0, m.turn === "left" ? a : -a, 0); }
  return undefined;
};
export const manoeuvreSpec = (m: ManoeuvreUI): ManoeuvreSpec | undefined => {
  const a = manoeuvreAccel(m); if (!a) return undefined;
  return { acceleration: a, duration: m.type === "turn" ? Math.max(m.duration, 1.5) : m.duration };
};

export const forkliftInputs = (u: ForkliftUI): ForkliftInputs => {
  const L = u.load;
  const acc = manoeuvreAccel(u.manoeuvre);
  return {
    liftHeight: u.liftHeight, tiltBack: rad(u.tiltDeg), sideShift: u.sideShift,
    payload: L.preset === "none" ? null : {
      mass: L.mass, length: L.length, width: L.width, height: L.height, cgOffset: v(L.cgX, L.cgY, L.cgZ),
      gapFromForkFace: L.gap, secured: L.secured, loadFriction: L.friction, label: presetLabel(L.preset), laterallyRestrained: L.preset !== "long-load",
    },
    terrain: terrain(u.terrain), ...(acc ? { acceleration: acc } : {}), allowOutsideLimits: u.trainerDemo,
  };
};

export const loaderInputs = (u: LoaderUI): LoaderInputs => {
  const L = u.load;
  const acc = manoeuvreAccel(u.manoeuvre);
  return {
    armAngle: rad(u.armDeg), bucketAngle: rad(u.bucketDeg), articulation: rad(u.articulationDeg),
    payload: L.material === "none" ? null : {
      ...(L.massMode === "explicit" ? { mass: L.mass } : { density: L.density, fillVolume: L.volume }),
      cgOffset: v(0, L.lateral, 0), angleOfRepose: rad(L.reposeDeg), label: `Bucket load: ${L.material}`,
    },
    terrain: terrain(u.terrain), ...(acc ? { acceleration: acc } : {}), allowOutsideLimits: u.trainerDemo,
  };
};

export const presetLabel = (p: ForkLoadKind | "none"): string => ({
  none: "No load", cartons: "Palletised cartons", "tall-stack": "Tall stacked pallet", "long-load": "Long load (pipe bundle)",
  machinery: "Machinery, offset CG", ibc: "IBC (wine)", "grape-bin": "Grape bin",
}[p]);

export interface Evaluation {
  ui: MachineUI;
  state: ForkliftState | LoaderState;
  retention: ForkliftRetentionResult | BucketRetentionResult;
  compliance: ComplianceResult;
  confidence: DataConfidence;
  error?: string;
}

export const evaluate = (u: MachineUI): Evaluation => {
  if (u.kind === "forklift") {
    const p = FORKLIFTS[u.profileId]!;
    const state = evaluateForklift(p, forkliftInputs(u));
    return { ui: u, state, retention: forkliftLoadRetention(state), compliance: forkliftCompliance(state), confidence: dataConfidence(RAW_PROFILES[u.profileId] as never) };
  }
  const p = LOADERS[u.profileId]!;
  const state = evaluateLoader(p, loaderInputs(u));
  return { ui: u, state, retention: bucketRetention(state), compliance: loaderCompliance(state), confidence: dataConfidence(RAW_PROFILES[u.profileId] as never) };
};

export const runDynamics = (e: Evaluation): DynamicsResult => {
  const u = e.ui;
  const man = manoeuvreSpec(u.manoeuvre);
  const opts = { behaviour: u.operator.behaviour, jumpSide: u.operator.jumpSide, ...(man ? { manoeuvre: man } : {}), tEnd: 6 };
  return u.kind === "forklift" ? forkliftDynamics(e.state as ForkliftState, opts) : loaderDynamics(e.state as LoaderState, opts);
};

export const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
export { G };
