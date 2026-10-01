import { type Vec3, v, frame, compose, rotY, rotZ, identity, transformPoint, type Frame } from "./math.js";
import { type MassComponent } from "./mass.js";
import { type OscillatingAxleSupport, evaluateStability, type StabilityResult } from "./stability.js";
import { type Terrain } from "./terrain.js";
import { type ProfileMeta } from "./profile.js";

/**
 * Articulated front-end loader model.
 *
 * Ground frame origin: the articulation joint axis at ground level, attached to the REAR frame.
 * x forward, y left, z up. The front frame rotates about the vertical joint axis by the
 * articulation angle (positive = front frame swung to the left, i.e. a left turn).
 * With the steering cylinders holding the articulation angle, the two frames act as one rigid
 * body for static analysis; the rear axle oscillates about a longitudinal pivot with stops.
 *
 * Height definitions:
 *   armAngle          — lift-arm angle from the front-frame horizontal (rad); the arm tip (bucket
 *                       pivot) moves on an arc, so raising changes reach as well as height.
 *   bucketPivotHeight — height of the bucket pivot above ground (m).
 *   payloadCgHeight   — height of the payload CG above ground (m).
 *   bucketAngle       — bucket floor angle from the front-frame horizontal (rad), positive = rolled back.
 */
export interface LoaderProfile {
  meta: ProfileMeta;
  geometry: {
    rearAxleX: number;                 // m, negative (behind the joint)
    frontAxleX: number;                // m, positive, in the front frame
    trackFront: number;
    trackRear: number;
    rearAxlePivotHeight: number;
    rearAxleOscillationLimit: number;  // rad ±
    articulationLimit: number;         // rad ±
    armPivot: { x: number; z: number };  // front frame
    armLength: number;                 // m, pivot to bucket pivot
    armAngleMin: number;               // rad
    armAngleMax: number;
    bucketAngleMin: number;            // rad (dump)
    bucketAngleMax: number;            // rad (full roll-back)
    bucketStruckVolume: number;        // m³
    bucketHeapedVolume: number;        // m³
    bucketWidth: number;               // m
    /** Centroid of a level struck bucket fill relative to the bucket pivot, bucket frame (m). */
    bucketFillCentroid: { x: number; z: number };
    /** Angle of the bucket floor relative to the bucket frame x axis (rad). 0 = floor along +x. */
    bucketFloorAngle: number;
  };
  masses: {
    rearFrame: { mass: number; cg: Vec3 };      // ground frame
    counterweight: { mass: number; cg: Vec3 };  // ground frame (rear)
    frontFrame: { mass: number; cg: Vec3 };     // front frame
    operator: { mass: number; cg: Vec3 };       // ground frame (rear or front per machine; stated in profile)
    arms: { mass: number; cg: Vec3 };           // arm frame (origin arm pivot, x along arm)
    bucket: { mass: number; cg: Vec3 };         // bucket frame (origin bucket pivot)
  };
  capacity: {
    staticTippingLoadStraight_kg?: number;
    staticTippingLoadFullTurn_kg?: number;
    ratedOperatingLoad_kg?: number;
    /** e.g. "ISO 14397-1, GP bucket 2.1 m³, 20.5R25 L3 tyres, standard counterweight, load centre per standard" */
    testConfiguration?: string;
    basis?: string;
    status: "manufacturer" | "measured" | "estimated" | "assumed";
  };
  restrictions?: { maxTravelSlopeLoaded?: number; note?: string };
}

export interface BucketPayloadSpec {
  /** Either an explicit mass or density × fill volume. If `mass` is set it wins and `density`/`fillVolume` are informational. */
  mass?: number;          // kg
  density?: number;       // kg/m³
  fillVolume?: number;    // m³
  /** CG offset from the level-fill centroid, bucket frame (m). y = lateral, positive left. */
  cgOffset: Vec3;
  /** Material angle of repose (rad) for the simplified spill check. */
  angleOfRepose: number;
  label?: string;
}

export interface LoaderInputs {
  armAngle: number;       // rad
  bucketAngle: number;    // rad, bucket floor from front-frame horizontal, +ve rolled back
  articulation: number;   // rad, +ve left
  payload: BucketPayloadSpec | null;
  terrain: Terrain;
  acceleration?: Vec3;
  allowOutsideLimits?: boolean;
}

export interface LoaderGeometryState {
  frontFrame: Frame;
  armFrame: Frame;
  bucketFrame: Frame;
  bucketPivot: Vec3;
  bucketPivotHeight: number;
  payloadMass: number | undefined;
  payloadMassBasis: "explicit" | "density×volume" | undefined;
  payloadCg: Vec3 | undefined;
  payloadCgHeight: number | undefined;
  /** Payload CG forward of the FRONT axle, measured along the front frame's x axis (m). */
  horizontalReach: number | undefined;
  /** Angle of the bucket floor relative to the ground-frame horizontal (rad). */
  bucketFloorAngleGround: number;
  limitViolations: string[];
}

export interface LoaderState {
  profile: LoaderProfile;
  inputs: LoaderInputs;
  geometry: LoaderGeometryState;
  components: MassComponent[];
  support: OscillatingAxleSupport;
  stability: StabilityResult;
}

export const resolveBucketPayloadMass = (p: BucketPayloadSpec): { mass: number; basis: "explicit" | "density×volume" } => {
  if (p.mass !== undefined) return { mass: p.mass, basis: "explicit" };
  if (p.density !== undefined && p.fillVolume !== undefined) return { mass: p.density * p.fillVolume, basis: "density×volume" };
  throw new Error("bucket payload needs either mass or density and fillVolume");
};

export const loaderGeometry = (p: LoaderProfile, inp: LoaderInputs): LoaderGeometryState => {
  const g = p.geometry;
  const violations: string[] = [];
  if (inp.armAngle < g.armAngleMin - 1e-9 || inp.armAngle > g.armAngleMax + 1e-9) violations.push("arm angle outside profile limits");
  if (inp.bucketAngle < g.bucketAngleMin - 1e-9 || inp.bucketAngle > g.bucketAngleMax + 1e-9) violations.push("bucket angle outside profile limits");
  if (Math.abs(inp.articulation) > g.articulationLimit + 1e-9) violations.push("articulation outside profile limits");
  if (inp.payload?.fillVolume !== undefined && inp.payload.fillVolume > g.bucketHeapedVolume + 1e-9) violations.push("fill volume exceeds heaped capacity");
  if (violations.length && !inp.allowOutsideLimits) throw new Error(`Inputs outside profile limits: ${violations.join("; ")}`);

  const frontFrame = frame(rotZ(inp.articulation), v(0, 0, 0));
  // Arm frame: origin at arm pivot, x along the arm. rotY(-θ) raises +x toward +z.
  const armFrame = compose(frontFrame, frame(rotY(-inp.armAngle), v(g.armPivot.x, 0, g.armPivot.z)));
  const bucketPivot = transformPoint(armFrame, v(g.armLength, 0, 0));
  // Bucket frame: origin at the bucket pivot, rotated so the floor sits at bucketAngle from the front-frame horizontal.
  const bucketFrame = compose(frontFrame, frame(rotY(-(inp.bucketAngle - g.bucketFloorAngle)), transformPoint(frame(rotZ(-inp.articulation), v(0, 0, 0)), bucketPivot)));

  let payloadMass: number | undefined, basis: LoaderGeometryState["payloadMassBasis"], payloadCg: Vec3 | undefined, reach: number | undefined;
  if (inp.payload) {
    const r = resolveBucketPayloadMass(inp.payload);
    payloadMass = r.mass; basis = r.basis;
    const c = inp.payload.cgOffset;
    payloadCg = transformPoint(bucketFrame, v(g.bucketFillCentroid.x + c.x, c.y, g.bucketFillCentroid.z + c.z));
    // reach along the front-frame x axis, from the front axle
    const inFront = transformPoint(frame(rotZ(-inp.articulation), v(0, 0, 0)), payloadCg);
    reach = inFront.x - g.frontAxleX;
  }
  return {
    frontFrame, armFrame, bucketFrame, bucketPivot, bucketPivotHeight: bucketPivot.z,
    payloadMass, payloadMassBasis: basis, payloadCg, payloadCgHeight: payloadCg?.z, horizontalReach: reach,
    bucketFloorAngleGround: inp.bucketAngle,
    limitViolations: violations,
  };
};

export const loaderComponents = (p: LoaderProfile, inp: LoaderInputs, geo: LoaderGeometryState): MassComponent[] => {
  const m = p.masses;
  const parts: MassComponent[] = [
    { id: "rearFrame", label: "Rear frame (engine, transmission)", group: "machine", mass: m.rearFrame.mass, cg: m.rearFrame.cg },
    { id: "counterweight", label: "Counterweight", group: "machine", mass: m.counterweight.mass, cg: m.counterweight.cg },
    { id: "frontFrame", label: "Front frame and axle", group: "machine", mass: m.frontFrame.mass, cg: transformPoint(geo.frontFrame, m.frontFrame.cg) },
    { id: "arms", label: "Lift arms and linkage", group: "machine", mass: m.arms.mass, cg: transformPoint(geo.armFrame, m.arms.cg) },
    { id: "bucket", label: "Bucket", group: "machine", mass: m.bucket.mass, cg: transformPoint(geo.bucketFrame, m.bucket.cg) },
  ];
  if (m.operator.mass > 0) parts.push({ id: "operator", label: "Operator", group: "machine", mass: m.operator.mass, cg: m.operator.cg });
  if (inp.payload && geo.payloadCg && geo.payloadMass !== undefined)
    parts.push({ id: "payload", label: inp.payload.label ?? "Bucket load", group: "payload", mass: geo.payloadMass, cg: geo.payloadCg });
  return parts;
};

export const loaderSupport = (p: LoaderProfile, articulation: number): OscillatingAxleSupport => {
  const g = p.geometry;
  const ff = frame(rotZ(articulation), v(0, 0, 0));
  return {
    rigidLeft: { id: "FL", label: "Front-left tyre", p: transformPoint(ff, v(g.frontAxleX, g.trackFront / 2, 0)) },
    rigidRight: { id: "FR", label: "Front-right tyre", p: transformPoint(ff, v(g.frontAxleX, -g.trackFront / 2, 0)) },
    pivot: { id: "P", label: "Rear-axle oscillation pivot", p: v(g.rearAxleX, 0, g.rearAxlePivotHeight) },
    oscLeft: { id: "RL", label: "Rear-left tyre", p: v(g.rearAxleX, g.trackRear / 2, 0) },
    oscRight: { id: "RR", label: "Rear-right tyre", p: v(g.rearAxleX, -g.trackRear / 2, 0) },
    stopAngle: g.rearAxleOscillationLimit,
    pivotAxisDir: v(1, 0, 0),
  };
};

export const evaluateLoader = (profile: LoaderProfile, inputs: LoaderInputs): LoaderState => {
  const geometry = loaderGeometry(profile, inputs);
  const components = loaderComponents(profile, inputs, geometry);
  const support = loaderSupport(profile, inputs.articulation);
  const stability = evaluateStability({
    components, support, terrain: inputs.terrain,
    ...(inputs.acceleration ? { acceleration: inputs.acceleration } : {}),
  });
  return { profile, inputs, geometry, components, support, stability };
};

/** Arm angle that places the bucket pivot at a given height above the arm pivot plane (inverse of the arc). */
export const armAngleForBucketPivotHeight = (p: LoaderProfile, height: number): number => {
  const g = p.geometry;
  const s = (height - g.armPivot.z) / g.armLength;
  if (s < -1 || s > 1) throw new Error("height not reachable");
  return Math.asin(s);
};
