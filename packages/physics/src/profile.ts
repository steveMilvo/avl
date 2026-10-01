/**
 * Machine profile data model.
 *
 * Every numeric parameter is a Datum: value + unit + source + status, so that the
 * provenance of each number survives into results and reports. Profiles are stored as
 * versioned JSON under /profiles, separate from application code.
 */
export type DatumStatus = "manufacturer" | "measured" | "estimated" | "assumed";

export interface Datum {
  value: number;
  unit: string;
  status: DatumStatus;
  source?: string;
  note?: string;
}

export type ProfileReleaseStatus =
  | "draft-unverified"
  | "generic-educational"
  | "manufacturer-data-entered"
  | "physics-validated"
  | "released-for-training";

export interface ProfileMeta {
  id: string;                 // unique, stable identifier e.g. "generic.forklift.cb-2500.v1"
  schemaVersion: 1;
  version: string;
  machineType: "counterbalanced-forklift" | "articulated-loader";
  manufacturer: string;       // "Generic" for demonstration profiles
  model: string;
  configuration: string;
  releaseStatus: ProfileReleaseStatus;
  validationScope?: string;
  notes?: string;
  references?: string[];
}

/** Capacity-plate style entry for a forklift. Missing table ⇒ "Operating limit not verified". */
export interface CapacityEntry {
  loadCentre_m: number;       // horizontal distance from fork face to payload CG
  maxForkHeight_m: number;    // the plate's lift-height band this entry applies to
  capacity_kg: number;
  status: DatumStatus;
  source?: string;
}

export interface DataConfidence {
  counts: Record<DatumStatus, number>;
  /** Fraction of parameters that are manufacturer-supplied or measured. */
  verifiedFraction: number;
  releaseStatus: ProfileReleaseStatus;
  label: string;
}

/** Walk any object graph, count Datum statuses. */
export const dataConfidence = (profile: { meta: ProfileMeta } & Record<string, unknown>): DataConfidence => {
  const counts: Record<DatumStatus, number> = { manufacturer: 0, measured: 0, estimated: 0, assumed: 0 };
  const walk = (o: unknown): void => {
    if (!o || typeof o !== "object") return;
    const rec = o as Record<string, unknown>;
    if (typeof rec["value"] === "number" && typeof rec["status"] === "string" && rec["status"] in counts) {
      counts[rec["status"] as DatumStatus]++;
      return;
    }
    for (const k of Object.keys(rec)) walk(rec[k]);
  };
  walk(profile);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const verifiedFraction = total ? (counts.manufacturer + counts.measured) / total : 0;
  const label =
    profile.meta.releaseStatus === "released-for-training" ? "Reviewed and released for training"
    : profile.meta.releaseStatus === "physics-validated" ? `Physics validated: ${profile.meta.validationScope ?? "scope not stated"}`
    : profile.meta.releaseStatus === "manufacturer-data-entered" ? "Manufacturer data entered, not validated"
    : profile.meta.releaseStatus === "draft-unverified" ? "Draft profile: unverified third-party data, assumed mass distribution — results illustrative only"
    : "Generic educational profile — results illustrative only";
  return { counts, verifiedFraction, releaseStatus: profile.meta.releaseStatus, label };
};

export const val = (d: Datum): number => d.value;

export interface OperatorSeatSpec {
  hip: { x: number; y: number; z: number };
  enclosedCab: boolean;
  seatFriction: number;
  seatbeltFitted: boolean;
}
