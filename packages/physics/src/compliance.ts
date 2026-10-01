import { type ForkliftState } from "./forklift.js";
import { type LoaderState } from "./loader.js";
import { type DatumStatus } from "./profile.js";

/**
 * Manufacturer-limit and operating-restriction checks, kept separate from the physics result.
 * A machine staying upright in the simulation never implies permission to perform the task.
 */
export type ComplianceStatus = "within-manufacturer-limit" | "manufacturer-limit-exceeded" | "operating-limit-not-verified";
export type RestrictionStatus = "within-restrictions" | "operating-restriction-breached" | "not-assessed";

export interface ComplianceResult {
  status: ComplianceStatus;
  applicableCapacity_kg: number | undefined;
  applicableEntry: string | undefined;
  dataStatus: DatumStatus | undefined;
  restriction: RestrictionStatus;
  notes: string[];
}

export const forkliftCompliance = (s: ForkliftState): ComplianceResult => {
  const notes: string[] = [];
  const L = s.inputs.payload;
  const table = s.profile.capacity;
  let restriction: RestrictionStatus = "not-assessed";
  const r = s.profile.restrictions;
  if (r) {
    restriction = "within-restrictions";
    if (r.maxTravelSlopeLoaded !== undefined && L && s.inputs.terrain.slopeAngle > r.maxTravelSlopeLoaded + 1e-9) {
      restriction = "operating-restriction-breached"; notes.push(`Slope exceeds the profile's loaded-travel limit of ${(r.maxTravelSlopeLoaded * 180 / Math.PI).toFixed(1)}°.`);
    }
    if (r.maxTravelLiftHeight !== undefined && L && s.inputs.acceleration && s.geometry.forkHeight > r.maxTravelLiftHeight + 1e-9) {
      restriction = "operating-restriction-breached"; notes.push(`Travelling with forks above ${r.maxTravelLiftHeight} m breaches the profile's travel restriction.`);
    }
  }
  if (s.geometry.limitViolations.length) { restriction = "operating-restriction-breached"; notes.push(...s.geometry.limitViolations.map((x) => `Trainer demonstration outside profile limits: ${x}`)); }

  if (!L) return { status: "within-manufacturer-limit", applicableCapacity_kg: undefined, applicableEntry: undefined, dataStatus: undefined, restriction, notes };
  if (!table.length) return { status: "operating-limit-not-verified", applicableCapacity_kg: undefined, applicableEntry: undefined, dataStatus: undefined, restriction, notes: [...notes, "No capacity plate data in this profile."] };

  const lc = s.geometry.loadCentre ?? 0;
  const h = s.geometry.forkHeight;
  // Applicable entry: smallest load centre ≥ actual and height band ≥ actual (most restrictive conservative lookup).
  const candidates = table.filter((e) => e.loadCentre_m + 1e-9 >= lc && e.maxForkHeight_m + 1e-9 >= h);
  if (!candidates.length)
    return { status: "operating-limit-not-verified", applicableCapacity_kg: undefined, applicableEntry: undefined, dataStatus: undefined, restriction, notes: [...notes, `No capacity entry covers load centre ${(lc * 1000).toFixed(0)} mm at fork height ${h.toFixed(2)} m.`] };
  // Tightest applicable band: smallest load centre that still covers the actual, then the lowest height band.
  const e = candidates.reduce((a, b) =>
    b.loadCentre_m < a.loadCentre_m - 1e-9 || (Math.abs(b.loadCentre_m - a.loadCentre_m) < 1e-9 && b.maxForkHeight_m < a.maxForkHeight_m) ? b : a);
  const entry = `${e.capacity_kg} kg @ ${(e.loadCentre_m * 1000).toFixed(0)} mm load centre, to ${e.maxForkHeight_m} m`;
  if (L.mass > e.capacity_kg + 1e-9) notes.push(`Payload ${L.mass.toFixed(0)} kg exceeds the applicable capacity of ${e.capacity_kg} kg.`);
  return {
    status: L.mass > e.capacity_kg + 1e-9 ? "manufacturer-limit-exceeded" : "within-manufacturer-limit",
    applicableCapacity_kg: e.capacity_kg, applicableEntry: entry, dataStatus: e.status, restriction, notes,
  };
};

export const loaderCompliance = (s: LoaderState): ComplianceResult => {
  const notes: string[] = [];
  const c = s.profile.capacity;
  const m = s.geometry.payloadMass;
  let restriction: RestrictionStatus = "not-assessed";
  const r = s.profile.restrictions;
  if (r) {
    restriction = "within-restrictions";
    if (r.maxTravelSlopeLoaded !== undefined && m && s.inputs.terrain.slopeAngle > r.maxTravelSlopeLoaded + 1e-9) {
      restriction = "operating-restriction-breached"; notes.push(`Slope exceeds the profile's loaded-travel limit of ${(r.maxTravelSlopeLoaded * 180 / Math.PI).toFixed(1)}°.`);
    }
  }
  if (s.geometry.limitViolations.length) { restriction = "operating-restriction-breached"; notes.push(...s.geometry.limitViolations.map((x) => `Trainer demonstration outside profile limits: ${x}`)); }
  if (m === undefined) return { status: "within-manufacturer-limit", applicableCapacity_kg: undefined, applicableEntry: undefined, dataStatus: undefined, restriction, notes };
  if (c.ratedOperatingLoad_kg === undefined)
    return { status: "operating-limit-not-verified", applicableCapacity_kg: undefined, applicableEntry: undefined, dataStatus: c.status, restriction, notes: [...notes, "No rated operating load in this profile. A tipping load is not a permitted payload."] };
  const entry = `Rated operating load ${c.ratedOperatingLoad_kg} kg (${c.basis ?? "basis not stated"}; ${c.testConfiguration ?? "test configuration not stated"})`;
  if (m > c.ratedOperatingLoad_kg + 1e-9) notes.push(`Bucket load ${m.toFixed(0)} kg exceeds the rated operating load of ${c.ratedOperatingLoad_kg} kg.`);
  return {
    status: m > c.ratedOperatingLoad_kg + 1e-9 ? "manufacturer-limit-exceeded" : "within-manufacturer-limit",
    applicableCapacity_kg: c.ratedOperatingLoad_kg, applicableEntry: entry, dataStatus: c.status, restriction, notes,
  };
};
