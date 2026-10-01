import { type Vec3, dot, scale, sub, normalize, apply, transpose, type Frame } from "./math.js";
import { type PayloadSpec, type ForkliftState } from "./forklift.js";
import { type LoaderState } from "./loader.js";
import { G } from "./units.js";
import { gravityDirInGroundFrame } from "./terrain.js";

/**
 * Load retention, modelled SEPARATELY from whole-machine stability.
 * A machine can remain upright while an unsecured pallet slides, or material spills.
 *
 * Model scope (simplified, labelled):
 *  - Forklift: rigid load box resting on a flat rigid fork surface. Retained by friction and,
 *    against rearward motion, by the fork face / backrest. Checks (a) sliding: required friction
 *    on the fork plane vs available; (b) toppling: the load's own specific-force line vs the
 *    edges of its base footprint on the forks.
 *  - Loader bucket: material treated as a granular body with an angle of repose. Spill is
 *    predicted when the bucket floor slopes "downhill" out of the bucket more steeply than the
 *    angle of repose, measured against the resultant specific force. No slosh or flow model.
 */
export type RetentionStatus = "retained" | "sliding-predicted" | "toppling-predicted" | "spill-predicted" | "secured" | "no-load";

export interface ForkliftRetentionResult {
  status: RetentionStatus;
  requiredFriction: number;
  availableFriction: number;
  /** Slide direction on the fork plane, ground frame (unit), when relevant. */
  slideDirection: Vec3 | undefined;
  /** Whether the backrest can react the sliding tendency (slide is toward the mast). */
  restrainedByBackrest: boolean;
  /** Signed margins (m) of the load's force line to each base edge; negative = toppling over that edge. */
  footprintMargins: { front: number; rear: number; left: number; right: number };
  notes: string[];
}

/** Specific force acting on the load, expressed in the carriage frame (x along the forks, y left, z normal to the fork surface). */
export interface ForkLoadCheck {
  status: RetentionStatus;
  requiredFriction: number;
  restrainedByBackrest: boolean;
  footprintMargins: { front: number; rear: number; left: number; right: number };
  notes: string[];
}

/**
 * Retention of an unsecured load on the forks.
 * Support region on the fork surface: longitudinally from the fork face (backrest) or the load's rear face
 * to the nearer of the load's front face and the fork tips; laterally the narrower of the load width and the
 * outside edges of the tines. Sliding along the forks is resisted by friction (toward the backrest by the
 * backrest when the load touches it). Sideways sliding is prevented when the tines are engaged in pallet
 * pockets; otherwise friction applies. Toppling: the load's own force line leaves the support region.
 */
export const checkForkLoad = (fl: Vec3, L: PayloadSpec, loadCentre: number, forkLength: number, forkSpacing: number): ForkLoadCheck => {
  const notes: string[] = [];
  const normal = -fl.z;
  if (normal <= 0) return { status: "toppling-predicted", requiredFriction: Infinity, restrainedByBackrest: false, footprintMargins: { front: -1, rear: -1, left: -1, right: -1 }, notes: ["The specific force lifts the load off the forks."] };
  const latRestrained = L.laterallyRestrained ?? true;
  const backrest = L.gapFromForkFace <= 1e-6;
  const h = L.height / 2 + L.cgOffset.z;
  const px = loadCentre + (fl.x / normal) * h, py = L.cgOffset.y + (fl.y / normal) * h;
  const half = Math.min(L.width / 2, forkSpacing / 2 + 0.06);
  const xFront = Math.min(L.gapFromForkFace + L.length, forkLength);
  const footprintMargins = { front: xFront - px, rear: backrest ? Infinity : px - L.gapFromForkFace, left: half - py, right: py + half };
  // friction demand along the directions that friction must resist
  const tx = fl.x > 0 || !backrest ? fl.x : 0;
  const ty = latRestrained ? 0 : fl.y;
  const requiredFriction = Math.hypot(tx, ty) / normal;
  let status: RetentionStatus = "retained";
  if (Math.min(footprintMargins.front, footprintMargins.rear, footprintMargins.left, footprintMargins.right) < 0) {
    status = "toppling-predicted"; notes.push("The load's own force line falls outside its support on the forks.");
  } else if (requiredFriction > L.loadFriction) {
    status = "sliding-predicted"; notes.push(`Friction needed ${requiredFriction.toFixed(2)} exceeds the ${L.loadFriction.toFixed(2)} available on the forks.`);
  }
  if (fl.x < 0 && backrest) notes.push("Rearward tendency is taken by the load backrest.");
  if (latRestrained && Math.abs(fl.y) > 1e-6) notes.push("Sideways tendency is taken by the tines in the pallet pockets.");
  return { status, requiredFriction, restrainedByBackrest: backrest && fl.x < 0, footprintMargins, notes };
};

export const forkliftLoadRetention = (s: ForkliftState): ForkliftRetentionResult => {
  const L: PayloadSpec | null = s.inputs.payload;
  const none = { requiredFriction: 0, availableFriction: 0, slideDirection: undefined, restrainedByBackrest: false, footprintMargins: { front: 0, rear: 0, left: 0, right: 0 }, notes: [] };
  if (!L) return { status: "no-load", ...none };
  if (L.secured) return { status: "secured", ...none, notes: ["Load is secured: retention assumed by the restraint (not modelled)."] };
  const gDir = gravityDirInGroundFrame(s.inputs.terrain);
  const a = s.inputs.acceleration ?? { x: 0, y: 0, z: 0 };
  const f = sub(scale(gDir, G), a);
  const cf: Frame = s.geometry.carriageFrame;
  const fl = apply(transpose(cf.R), f);
  const r = checkForkLoad(fl, L, s.geometry.loadCentre ?? 0, s.profile.geometry.forkLength, s.profile.geometry.forkSpacing);
  const t = { x: fl.x, y: fl.y, z: 0 };
  const slideDirection = Math.hypot(t.x, t.y) > 0 ? normalize(apply(cf.R, t)) : undefined;
  return { ...r, availableFriction: L.loadFriction, slideDirection };
};

export interface BucketRetentionResult {
  status: RetentionStatus;
  /** Angle between the bucket floor's outward (dump) direction and the plane normal to the specific force (rad). Positive = floor slopes out of the bucket. */
  effectiveFloorSlope: number;
  angleOfRepose: number;
  notes: string[];
}

export const bucketRetention = (s: LoaderState): BucketRetentionResult => {
  const P = s.inputs.payload;
  if (!P) return { status: "no-load", effectiveFloorSlope: 0, angleOfRepose: 0, notes: [] };
  const gDir = gravityDirInGroundFrame(s.inputs.terrain);
  const a = s.inputs.acceleration ?? { x: 0, y: 0, z: 0 };
  const f = normalize(sub(scale(gDir, G), a));
  // Bucket floor outward (dump) direction in the ground frame: +x of the bucket frame rotated by the floor angle.
  const floorOut = apply(s.geometry.bucketFrame.R, { x: Math.cos(s.profile.geometry.bucketFloorAngle), y: 0, z: Math.sin(s.profile.geometry.bucketFloorAngle) });
  // Floor slopes "downhill outward" when the outward direction has a component along the specific force.
  const effectiveFloorSlope = Math.asin(Math.max(-1, Math.min(1, dot(floorOut, f))));
  const notes: string[] = [];
  let status: RetentionStatus = "retained";
  if (effectiveFloorSlope > P.angleOfRepose) {
    status = "spill-predicted";
    notes.push(`Bucket floor slopes ${(effectiveFloorSlope * 180 / Math.PI).toFixed(1)}° outward against the resultant, beyond the material's ${(P.angleOfRepose * 180 / Math.PI).toFixed(0)}° angle of repose (simplified granular model).`);
  }
  return { status, effectiveFloorSlope, angleOfRepose: P.angleOfRepose, notes };
};


