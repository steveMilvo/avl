import { type Vec3, v, frame, compose, rotY, identity, transformPoint, type Frame } from "./math.js";
import { type MassComponent } from "./mass.js";
import { type OscillatingAxleSupport, evaluateStability, type StabilityResult } from "./stability.js";
import { type Terrain } from "./terrain.js";
import { type ProfileMeta, type CapacityEntry } from "./profile.js";

/**
 * Counterbalanced forklift model.
 *
 * Ground frame origin: centre of the front (drive) axle at ground level. x forward, y left, z up.
 *
 * Height definitions (these are different quantities and are reported separately):
 *   liftHeight          — carriage travel along the mast from its lowest position (m).
 *   forkHeight          — height of the fork top surface at the heel above the ground, including tilt (m).
 *   payloadCgHeight     — height of the payload's centre of gravity above the ground (m).
 *   loadCentre          — horizontal distance from the fork face (vertical face of the forks /
 *                         load backrest) to the payload CG, measured in the mast frame (m).
 */
export interface ForkliftProfile {
  meta: ProfileMeta;
  geometry: {
    wheelbase: number;                 // m, front axle to rear axle
    trackFront: number;                // m, centre-to-centre of front tyre contacts
    trackRear: number;                 // m
    rearAxlePivotHeight: number;       // m above ground
    rearAxleOscillationLimit: number;  // rad, ± chassis-to-axle roll before the stop engages
    mastPivot: { x: number; z: number };     // tilt pivot in the ground frame
    forkFaceX: number;                 // m forward of the mast pivot, in the mast frame
    forkTopZ: number;                  // m, fork top surface above the mast pivot at zero lift (mast frame)
    forkLength: number;                // m
    maxLift: number;                   // m
    tiltBackMax: number;               // rad
    tiltForwardMax: number;            // rad
    sideShiftMax: number;              // m, ± (0 if not fitted)
  };
  masses: {
    chassis: { mass: number; cg: Vec3 };        // chassis incl. engine, drive, operator compartment; EXCLUDING counterweight and mast
    counterweight: { mass: number; cg: Vec3 };  // ground frame
    operator: { mass: number; cg: Vec3 };       // ground frame; set mass 0 if the quoted machine mass includes the operator
    mast: { mass: number; cg: Vec3 };           // mast frame (relative to the tilt pivot), fixed part of the mast
    carriage: { mass: number; cg: Vec3 };       // relative to the carriage reference (fork heel at fork top surface), moves with lift
  };
  capacity: CapacityEntry[];   // empty ⇒ operating limit not verified
  restrictions?: {
    maxTravelSlopeLoaded?: number;    // rad
    maxTravelLiftHeight?: number;     // m, loaded travel
    note?: string;
  };
}

export interface PayloadSpec {
  /** Total payload mass including pallet/container tare (kg). */
  mass: number;
  length: number;   // m, along the forks
  width: number;    // m
  height: number;   // m
  /** CG offset from the geometric centre of the load box (m). x forward, y left, z up. */
  cgOffset: Vec3;
  /** Gap between the fork face and the load's near face (m). 0 = load pushed against the backrest. */
  gapFromForkFace: number;
  /** If set, overrides the geometric load centre: horizontal distance from fork face to payload CG (m). */
  loadCentre?: number;
  secured: boolean;
  /** Friction coefficient between load base and fork surface. */
  loadFriction: number;
  label?: string;
}

export interface ForkliftInputs {
  liftHeight: number;    // m, along the mast
  tiltBack: number;      // rad, positive = mast top moves rearward
  sideShift: number;     // m, positive = left
  payload: PayloadSpec | null;
  terrain: Terrain;
  acceleration?: Vec3;   // ground frame, m/s²
  /** Trainer demonstration: allow inputs outside the profile limits (reported, never silently clamped). */
  allowOutsideLimits?: boolean;
}

export interface ForkliftGeometryState {
  mastFrame: Frame;         // mast → ground
  carriageFrame: Frame;     // carriage (fork heel/top) → ground
  forkHeight: number;       // m
  forkTipHeight: number;    // m
  payloadCg: Vec3 | undefined;
  payloadCgHeight: number | undefined;
  loadCentre: number | undefined;      // m from fork face, mast frame
  horizontalReach: number | undefined; // m, payload CG forward of the front axle, ground frame
  forkPlaneNormal: Vec3;    // unit normal of the fork top surface, ground frame
  limitViolations: string[];
}

export interface ForkliftState {
  profile: ForkliftProfile;
  inputs: ForkliftInputs;
  geometry: ForkliftGeometryState;
  components: MassComponent[];
  support: OscillatingAxleSupport;
  stability: StabilityResult;
}

export const forkliftGeometry = (p: ForkliftProfile, inp: ForkliftInputs): ForkliftGeometryState => {
  const g = p.geometry;
  const violations: string[] = [];
  if (inp.liftHeight < 0 || inp.liftHeight > g.maxLift) violations.push(`lift height ${inp.liftHeight.toFixed(2)} m outside 0–${g.maxLift} m`);
  if (inp.tiltBack > g.tiltBackMax + 1e-9 || -inp.tiltBack > g.tiltForwardMax + 1e-9) violations.push(`tilt outside profile limits`);
  if (Math.abs(inp.sideShift) > g.sideShiftMax + 1e-9) violations.push(`side shift outside ±${g.sideShiftMax} m`);
  if (violations.length && !inp.allowOutsideLimits) throw new Error(`Inputs outside profile limits: ${violations.join("; ")}`);

  // Mast frame: rotate about the tilt pivot. rotY(+) tips the top forward, so back tilt is rotY(-tiltBack).
  const mastFrame = frame(rotY(-inp.tiltBack), v(g.mastPivot.x, 0, g.mastPivot.z));
  // Carriage reference = fork heel on the fork top surface, slides along the mast z axis.
  const carriageFrame = compose(mastFrame, frame(identity(), v(g.forkFaceX, inp.sideShift, g.forkTopZ + inp.liftHeight)));
  const heel = transformPoint(carriageFrame, v(0, 0, 0));
  const tip = transformPoint(carriageFrame, v(g.forkLength, 0, 0));
  const forkPlaneNormal = transformPoint(frame(mastFrame.R, v(0, 0, 0)), v(0, 0, 1));

  let payloadCg: Vec3 | undefined, loadCentre: number | undefined;
  if (inp.payload) {
    const L = inp.payload;
    loadCentre = L.loadCentre ?? L.gapFromForkFace + L.length / 2 + L.cgOffset.x;
    payloadCg = transformPoint(carriageFrame, v(loadCentre, L.cgOffset.y, L.height / 2 + L.cgOffset.z));
  }
  return {
    mastFrame, carriageFrame,
    forkHeight: heel.z, forkTipHeight: tip.z,
    payloadCg, payloadCgHeight: payloadCg?.z,
    loadCentre, horizontalReach: payloadCg?.x,
    forkPlaneNormal, limitViolations: violations,
  };
};

export const forkliftComponents = (p: ForkliftProfile, inp: ForkliftInputs, geo: ForkliftGeometryState): MassComponent[] => {
  const m = p.masses;
  const parts: MassComponent[] = [
    { id: "chassis", label: "Chassis", group: "machine", mass: m.chassis.mass, cg: m.chassis.cg },
    { id: "counterweight", label: "Counterweight", group: "machine", mass: m.counterweight.mass, cg: m.counterweight.cg },
    { id: "mast", label: "Mast", group: "machine", mass: m.mast.mass, cg: transformPoint(geo.mastFrame, m.mast.cg) },
    { id: "carriage", label: "Carriage, forks and attachment", group: "machine", mass: m.carriage.mass, cg: transformPoint(geo.carriageFrame, m.carriage.cg) },
  ];
  if (m.operator.mass > 0) parts.push({ id: "operator", label: "Operator", group: "machine", mass: m.operator.mass, cg: m.operator.cg });
  if (inp.payload && geo.payloadCg)
    parts.push({ id: "payload", label: inp.payload.label ?? "Payload", group: "payload", mass: inp.payload.mass, cg: geo.payloadCg });
  return parts;
};

export const forkliftSupport = (p: ForkliftProfile): OscillatingAxleSupport => {
  const g = p.geometry;
  return {
    rigidLeft: { id: "FL", label: "Front-left tyre", p: v(0, g.trackFront / 2, 0) },
    rigidRight: { id: "FR", label: "Front-right tyre", p: v(0, -g.trackFront / 2, 0) },
    pivot: { id: "P", label: "Rear-axle pivot", p: v(-g.wheelbase, 0, g.rearAxlePivotHeight) },
    oscLeft: { id: "RL", label: "Rear-left tyre", p: v(-g.wheelbase, g.trackRear / 2, 0) },
    oscRight: { id: "RR", label: "Rear-right tyre", p: v(-g.wheelbase, -g.trackRear / 2, 0) },
    stopAngle: g.rearAxleOscillationLimit,
    pivotAxisDir: v(1, 0, 0),
  };
};

export const evaluateForklift = (profile: ForkliftProfile, inputs: ForkliftInputs): ForkliftState => {
  const geometry = forkliftGeometry(profile, inputs);
  const components = forkliftComponents(profile, inputs, geometry);
  const support = forkliftSupport(profile);
  const stability = evaluateStability({
    components, support, terrain: inputs.terrain,
    ...(inputs.acceleration ? { acceleration: inputs.acceleration } : {}),
  });
  return { profile, inputs, geometry, components, support, stability };
};
