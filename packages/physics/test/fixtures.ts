import forkliftJson from "../../../profiles/forklift/generic-cb-2500.json";
import loaderJson from "../../../profiles/loader/generic-articulated-1500.json";
import { resolveDatums, type Datumised, type ForkliftProfile, type LoaderProfile, type PayloadSpec, type ForkliftInputs, type LoaderInputs, LEVEL, v, type Terrain, type BucketPayloadSpec } from "../src/index.js";

export const forklift = (): ForkliftProfile => resolveDatums<ForkliftProfile>(forkliftJson as unknown as Datumised<ForkliftProfile>);
export const loader = (): LoaderProfile => resolveDatums<LoaderProfile>(loaderJson as unknown as Datumised<LoaderProfile>);

export const pallet = (mass: number, over: Partial<PayloadSpec> = {}): PayloadSpec => ({
  mass, length: 1.0, width: 1.2, height: 1.0, cgOffset: v(0, 0, 0), gapFromForkFace: 0, secured: false, loadFriction: 0.4, label: "Palletised cartons", ...over,
});

export const fkInputs = (over: Partial<ForkliftInputs> = {}): ForkliftInputs => ({
  liftHeight: 0, tiltBack: 0, sideShift: 0, payload: pallet(2500), terrain: LEVEL, ...over,
});

export const bucketLoad = (over: Omit<Partial<BucketPayloadSpec>, "mass"> & { mass?: number | undefined } = {}): BucketPayloadSpec => {
  const base: BucketPayloadSpec = { mass: 2000, cgOffset: v(0, 0, 0), angleOfRepose: 35 * Math.PI / 180, label: "Gravel" };
  const merged = { ...base, ...over };
  if (merged.mass === undefined) delete (merged as { mass?: number }).mass;
  return merged as BucketPayloadSpec;
};

export const ldInputs = (over: Partial<LoaderInputs> = {}): LoaderInputs => ({
  armAngle: -35 * Math.PI / 180, bucketAngle: 35 * Math.PI / 180, articulation: 0, payload: bucketLoad(), terrain: LEVEL, ...over,
});

export const slope = (deg: number, headingDeg: number, friction = 0.7): Terrain => ({ slopeAngle: deg * Math.PI / 180, heading: headingDeg * Math.PI / 180, friction });

import catJson from "../../../profiles/loader/caterpillar-950f.draft.json";
export const cat950f = (): LoaderProfile => resolveDatums<LoaderProfile>(catJson as unknown as Datumised<LoaderProfile>);
