import { type StabilityResult, type DynamicsResult, type ChangeExplanation, gradePercentFromAngle, deg, type ForkliftState, type LoaderState } from "@loadlab/physics";
import { type Evaluation } from "../app/state.js";
import { h } from "./controls.js";

/** Documented meanings of the educational status bands (docs/03-architecture.md). */
export const STATUS_TEXT: Record<StabilityResult["status"], [string, string]> = {
  "within-boundary": ["Within the modelled stability boundary", "ok"],
  "approaching-boundary": ["Approaching a modelled stability boundary", "warn"],
  "incipient-tipping": ["Incipient tipping or contact loss", "bad"],
  "lift-off": ["Contact loss: resultant lifts the machine", "bad"],
  "sliding-predicted": ["Sliding predicted", "warn"],
};
const RET: Record<string, [string, string]> = {
  retained: ["Load retained", "ok"], secured: ["Load secured (restraint not modelled)", "ok"], "no-load": ["No load", "neutral"],
  "sliding-predicted": ["Load sliding predicted", "bad"], "toppling-predicted": ["Load toppling predicted", "bad"], "spill-predicted": ["Material spill predicted", "warn"],
};
const COMP: Record<string, [string, string]> = {
  "within-manufacturer-limit": ["Within the entered capacity data", "ok"],
  "manufacturer-limit-exceeded": ["Manufacturer limit exceeded", "bad"],
  "operating-limit-not-verified": ["Operating limit not verified", "warn"],
};
const RESTR: Record<string, [string, string]> = {
  "within-restrictions": ["Within entered operating restrictions", "ok"],
  "operating-restriction-breached": ["Operating restriction breached", "bad"],
  "not-assessed": ["No operating restrictions entered", "warn"],
};

const card = (title: string, [txt, cls]: [string, string], detail: string[]) =>
  h("div", { class: `card ${cls}` }, h("div", { class: "card-title" }, title), h("div", { class: "card-status" }, txt), ...detail.map((d) => h("div", { class: "card-detail" }, d)));

const row = (k: string, v: string) => h("tr", {}, h("td", {}, k), h("td", {}, v));
const kN = (n: number) => `${(n / 1000).toFixed(1)} kN`;
const m = (x: number | undefined, d = 2) => (x === undefined ? "–" : `${x.toFixed(d)} m`);

export const renderResults = (root: HTMLElement, e: Evaluation, extra: { explain?: ChangeExplanation | null; dyn?: DynamicsResult | null; error?: string | null }) => {
  root.innerHTML = "";
  const st = e.state.stability, prof = e.state.profile;
  root.append(h("div", { class: "machine-id" },
    h("div", { class: "mi-name" }, `${prof.meta.manufacturer} ${prof.meta.model}`),
    h("div", { class: "mi-conf" }, prof.meta.configuration),
    h("div", { class: `mi-badge ${prof.meta.releaseStatus}` }, e.confidence.label)));
  if (extra.error) root.append(h("div", { class: "card bad" }, h("div", { class: "card-status" }, extra.error)));
  if (e.ui.trainerDemo) root.append(h("div", { class: "demo-banner" }, "TRAINER DEMONSTRATION — inputs may be outside profile limits. Not a permitted operating condition."));

  const crit = st.resultantEval.critical;
  root.append(h("div", { class: "cards" },
    card("1 · Calculated stability", STATUS_TEXT[st.status], [
      `Critical axis ${crit.id}: margin ${(crit.margin * 1000).toFixed(0)} mm`,
      `Support: ${st.resultantEval.polygon.description}`,
      ...(st.quasiStatic ? ["Includes the quasi-static inertial force of the manoeuvre."] : []),
      `Load: ${RET[e.retention.status]![0]}`,
    ]),
    card("2 · Manufacturer capacity", COMP[e.compliance.status]!, [e.compliance.applicableEntry ?? "No applicable capacity entry", ...e.compliance.notes.filter((n) => !n.startsWith("Trainer") && !n.includes("restriction") && !n.includes("limit of"))]),
    card("3 · Operating restrictions", RESTR[e.compliance.restriction]!, e.compliance.notes.filter((n) => n.startsWith("Trainer") || n.includes("restriction") || n.includes("limit of"))),
    card("4 · Data confidence", [e.confidence.label, e.confidence.verifiedFraction > 0.8 ? "ok" : "warn"], [
      `Parameters: ${e.confidence.counts.manufacturer} manufacturer, ${e.confidence.counts.measured} measured, ${e.confidence.counts.estimated} estimated, ${e.confidence.counts.assumed} assumed`,
    ])));
  root.append(h("div", { class: "disclaimer" }, "A machine remaining upright in the simulation does not establish permission to perform the operation. Margins are distances, not probabilities."));

  const t = h("table", { class: "meas" });
  const terr = e.state.inputs.terrain;
  t.append(row("Payload mass", `${st.cg.payload.mass.toFixed(0)} kg`));
  t.append(row("Total combined mass", `${st.cg.combined.mass.toFixed(0)} kg`));
  if (e.ui.kind === "forklift") {
    const fs = e.state as ForkliftState;
    t.append(row("Load centre (from fork face)", m(fs.geometry.loadCentre)));
    t.append(row("Horizontal reach (ahead of front axle)", m(fs.geometry.horizontalReach)));
    t.append(row("Fork height (heel, top surface)", m(fs.geometry.forkHeight)));
    t.append(row("Mast tilt", `${e.ui.tiltDeg.toFixed(1)}° ${e.ui.tiltDeg >= 0 ? "back" : "forward"}`));
  } else {
    const ls = e.state as LoaderState;
    t.append(row("Payload mass basis", ls.geometry.payloadMassBasis === "explicit" ? "Measured mass (controls result)" : ls.geometry.payloadMassBasis ? "Density × fill volume (controls result)" : "–"));
    t.append(row("Bucket hinge-pin height", m(ls.geometry.bucketPivotHeight)));
    t.append(row("Payload reach (ahead of front axle)", m(ls.geometry.horizontalReach)));
    t.append(row("Bucket angle", `${e.ui.bucketDeg.toFixed(0)}° ${e.ui.bucketDeg >= 0 ? "rolled back" : "dumped"}`));
    t.append(row("Articulation", `${Math.abs(e.ui.articulationDeg).toFixed(0)}° ${e.ui.articulationDeg > 0 ? "left" : e.ui.articulationDeg < 0 ? "right" : ""}`));
  }
  t.append(row("Payload CG height", m(st.cg.payload.mass > 0 ? st.cgUnrolled.payload.cg.z : undefined)));
  const c = st.cgUnrolled.combined.cg;
  t.append(row("Combined CG (x, y, height)", `${c.x.toFixed(2)}, ${c.y.toFixed(2)}, ${c.z.toFixed(2)} m`));
  t.append(row("Slope", `${deg(terr.slopeAngle).toFixed(1)}° (${gradePercentFromAngle(terr.slopeAngle).toFixed(1)} % grade), heading ${deg(terr.heading).toFixed(0)}° from uphill`));
  if (st.stage !== "axle-free") t.append(row("Axle stop", `Engaged: chassis rolled ${deg(st.chassisRoll).toFixed(1)}°, ${st.liftedContact?.label} lifted ${(st.liftedContactHeight * 1000).toFixed(0)} mm`));
  for (const r of st.reactions ?? []) t.append(row(`Reaction · ${r.label}`, r.lifted ? "0 kN (lifted)" : r.normal < 0 ? `lifting (static balance needs ${kN(r.normal)})` : kN(r.normal)));
  const stab = crit.contributions.filter((x) => x.moment > 0).reduce((a, x) => a + x.moment, 0);
  const over = -crit.contributions.filter((x) => x.moment < 0).reduce((a, x) => a + x.moment, 0);
  t.append(row(`Moments about ${crit.id}`, `stabilising ${(stab / 1000).toFixed(1)} kN·m · overturning ${(over / 1000).toFixed(1)} kN·m`));
  t.append(row("Friction needed / available", `${st.requiredFriction.toFixed(2)} / ${st.availableFriction.toFixed(2)}`));
  root.append(h("h3", {}, "Measurements"), t);

  if (extra.explain) {
    root.append(h("h3", {}, "Explain this change (vs baseline)"));
    const ul = h("ul", { class: "explain" }); for (const s of extra.explain.sentences) ul.append(h("li", {}, s));
    root.append(ul);
  }
  if (st.notes.length) { const ul = h("ul", { class: "explain" }); for (const s of st.notes) ul.append(h("li", {}, s)); root.append(h("h3", {}, "Support transitions"), ul); }

  if (extra.dyn) root.append(...dynBlock(extra.dyn));
};

export const OUTCOME: Record<DynamicsResult["machineOutcome"], [string, string]> = {
  stable: ["Stayed on its wheels", "ok"],
  slid: ["Tyres lost grip: machine slid", "warn"],
  "rocked-back": ["Lifted, then dropped back", "warn"],
  "rests-on-attachment": ["Tipped onto its attachment", "bad"],
  leaning: ["Tipped over", "bad"],
  overturned: ["Overturned", "bad"],
  "still-tipping": ["Still tipping at end of run", "bad"],
};
export const OP_OUTCOME: Record<DynamicsResult["operatorOutcome"], string> = {
  none: "", "retained-by-seatbelt": "Operator held by seatbelt inside the protective structure",
  "thrown-inside-cab": "No seatbelt: operator thrown out of the seat, striking the inside of the cab", "remained-in-seat": "Operator remained in the seat",
  "thrown-clear": "Operator thrown from the machine (fall)", "entrapment-zone": "Operator in the crush / entrapment zone",
};

export const dynBlock = (d: DynamicsResult): HTMLElement[] => {
  const ul = h("ul", { class: "explain" });
  for (const s of d.summary) ul.append(h("li", {}, s));
  const ev = h("ul", { class: "events" });
  for (const x of d.events) ev.append(h("li", {}, h("span", { class: "evt" }, `${x.t.toFixed(2)} s`), ` ${x.text}`));
  return [h("h3", {}, "Simulation result"), h("div", { class: `card ${OUTCOME[d.machineOutcome][1]}` }, h("div", { class: "card-status" }, OUTCOME[d.machineOutcome][0]), h("div", { class: "card-detail" }, OP_OUTCOME[d.operatorOutcome])), ul, h("h4", {}, "Event timeline"), ev,
    h("div", { class: "disclaimer" }, "Single-axis rigid-body tip model. Post-impact motion is estimated. Outcomes are mechanical facts, not injury predictions.")];
};
