import { type Vec3, dot, scale, sub, norm, normalize, apply, transpose, type Frame } from "./math.js";
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

export const forkliftLoadRetention = (s: ForkliftState): ForkliftRetentionResult => {
  const L: PayloadSpec | null = s.inputs.payload;
  const none = { requiredFriction: 0, availableFriction: 0, slideDirection: undefined, restrainedByBackrest: false, footprintMargins: { front: 0, rear: 0, left: 0, right: 0 }, notes: [] };
  if (!L) return { status: "no-load", ...none };
  if (L.secured) return { status: "secured", ...none, notes: ["Load is secured: retention assumed by the restraint (not modelled)."] };

  // Specific force on the load (per unit mass), ground frame. If the machine has rolled onto a stop
  // the fork plane has rolled with it; use the as-evaluated orientation.
  const gDir = gravityDirInGroundFrame(s.inputs.terrain);
  const a = s.inputs.acceleration ?? { x: 0, y: 0, z: 0 };
  const f = sub(scale(gDir, G), a);
  // Express in the carriage (fork) frame: x along forks, y lateral, z normal to the fork surface.
  const cf: Frame = s.geometry.carriageFrame;
  const fl = apply(transpose(cf.R), f);
  const normal = -fl.z;                   // positive = pressing onto the forks
  const tangential = { x: fl.x, y: fl.y };
  const tmag = Math.hypot(tangential.x, tangential.y);
  const notes: string[] = [];
  if (normal <= 0) {
    return { status: "toppling-predicted", requiredFriction: Infinity, availableFriction: L.loadFriction, slideDirection: undefined, restrainedByBackrest: false, footprintMargins: { front: -1, rear: -1, left: -1, right: -1 }, notes: ["Specific force lifts the load off the forks."] };
  }
  const requiredFriction = tmag / normal;
  const restrainedByBackrest = tangential.x < 0 && Math.abs(tangential.y) < 1e-9 && L.gapFromForkFace === 0;

  // Toppling: project the load CG along the specific force to the fork plane; compare with the base footprint.
  const lc = s.geometry.loadCentre ?? 0;
  const cgLocal = { x: lc, y: L.cgOffset.y, z: L.height / 2 + L.cgOffset.z }; // carriage frame
  const t = cgLocal.z / normal;
  const px = cgLocal.x + fl.x * t, py = cgLocal.y + fl.y * t;
  const xRear = L.gapFromForkFace, xFront = L.gapFromForkFace + L.length;
  const footprintMargins = {
    front: xFront - px, rear: px - xRear,
    left: L.cgOffset.y + L.width / 2 - py, right: py - (L.cgOffset.y - L.width / 2),
  };
  const toppling = Math.min(footprintMargins.front, footprintMargins.rear, footprintMargins.left, footprintMargins.right) < 0;
  let status: RetentionStatus = "retained";
  if (toppling) { status = "toppling-predicted"; notes.push("The load's own force line falls outside its base on the forks."); }
  else if (requiredFriction > L.loadFriction && !restrainedByBackrest) {
    status = "sliding-predicted";
    notes.push(`Required friction ${requiredFriction.toFixed(2)} exceeds available ${L.loadFriction.toFixed(2)} on the fork surface.`);
  } else if (requiredFriction > L.loadFriction && restrainedByBackrest) notes.push("Sliding tendency is toward the backrest, which reacts it.");

  const slideDirection = tmag > 0 ? normalize(apply(cf.R, { x: tangential.x, y: tangential.y, z: 0 })) : undefined;
  return { status, requiredFriction, availableFriction: L.loadFriction, slideDirection, restrainedByBackrest, footprintMargins, notes };
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

export const specificForceMagnitude = (f: Vec3): number => norm(f);
