import { PHYSICS_MODEL_VERSION, type DynamicsResult, type ChangeExplanation, deg, gradePercentFromAngle } from "@loadlab/physics";
import { type Evaluation, type MachineUI, RAW_PROFILES } from "./state.js";
import { STATUS_TEXT, OUTCOME, OP_OUTCOME } from "../ui/results.js";

export const APP_VERSION = "0.2.0";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export const download = (name: string, data: string | Blob, type = "text/plain") => {
  const blob = typeof data === "string" ? new Blob([data], { type }) : data;
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

/** Scenario file: machine profile (id, version, status, full data), assumptions and inputs. Reproducible. */
export const scenarioJson = (ui: MachineUI, baseline: MachineUI | null) => JSON.stringify({
  schema: "loadlab.scenario.v1", app: APP_VERSION, model: PHYSICS_MODEL_VERSION, created: new Date().toISOString(),
  profile: RAW_PROFILES[ui.profileId], inputs: ui, baseline,
}, null, 2);

export const reportHtml = (e: Evaluation, dyn: DynamicsResult | null, explain: ChangeExplanation | null, screenshot: string | null) => {
  const st = e.state.stability, p = e.state.profile, t = e.state.inputs.terrain;
  const rows = (o: [string, string][]) => o.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("");
  const crit = st.resultantEval.critical;
  return `<!doctype html><html><head><meta charset="utf-8"><title>LoadLab report</title>
<style>body{font:14px/1.5 system-ui,sans-serif;max-width:900px;margin:24px auto;padding:0 16px;color:#111}h1{margin:0}table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #ddd;padding:4px 8px}td:first-child{color:#555;width:45%}.warn{background:#fff4d6;padding:8px;border-left:4px solid #e0a000}img{max-width:100%;border:1px solid #ccc}</style></head><body>
<h1>LoadLab stability report</h1><p>SiteReadyAI · sitereadyai.com.au · generated ${new Date().toLocaleString("en-AU")}</p>
<p class="warn">Simulation results are illustrative unless the profile is released for training after independent engineering review. A machine remaining upright in the simulation does not establish permission to perform the operation. Simulation completion is not a competency assessment or site authorisation.</p>
${screenshot ? `<img src="${screenshot}" alt="Simulator view">` : ""}
<h2>Machine</h2><table>${rows([["Profile", `${p.meta.manufacturer} ${p.meta.model} (${p.meta.id}, v${p.meta.version})`], ["Configuration", p.meta.configuration], ["Release status", e.confidence.label], ["Parameter sources", `${e.confidence.counts.manufacturer} manufacturer, ${e.confidence.counts.measured} measured, ${e.confidence.counts.estimated} estimated, ${e.confidence.counts.assumed} assumed`], ["Physics model", PHYSICS_MODEL_VERSION], ["App", APP_VERSION]])}</table>
<h2>Results</h2><table>${rows([
    ["1. Calculated stability", STATUS_TEXT[st.status][0]], ["Critical axis / margin", `${crit.id} / ${(crit.margin * 1000).toFixed(0)} mm`], ["Support state", st.resultantEval.polygon.description],
    ["Load retention", e.retention.status], ["2. Manufacturer capacity", e.compliance.status === "operating-limit-not-verified" ? "Operating limit not verified" : e.compliance.status], ["Applicable entry", e.compliance.applicableEntry ?? "–"],
    ["3. Operating restrictions", e.compliance.restriction], ["4. Data confidence", e.confidence.label],
    ["Payload mass", `${st.cg.payload.mass.toFixed(0)} kg`], ["Combined mass", `${st.cg.combined.mass.toFixed(0)} kg`],
    ["Combined CG (x, y, z)", `${st.cgUnrolled.combined.cg.x.toFixed(3)}, ${st.cgUnrolled.combined.cg.y.toFixed(3)}, ${st.cgUnrolled.combined.cg.z.toFixed(3)} m`],
    ["Slope", `${deg(t.slopeAngle).toFixed(1)}° (${gradePercentFromAngle(t.slopeAngle).toFixed(1)} %), heading ${deg(t.heading).toFixed(0)}°`],
    ...(st.reactions ?? []).map((r) => [`Reaction ${r.label}`, r.lifted ? "0 (lifted)" : `${(r.normal / 1000).toFixed(2)} kN`] as [string, string]),
  ])}</table>
${explain ? `<h2>Change from baseline</h2><ul>${explain.sentences.map((s) => `<li>${esc(s)}</li>`).join("")}</ul>` : ""}
${dyn ? `<h2>Dynamic simulation</h2><p><b>${OUTCOME[dyn.machineOutcome][0]}</b>. ${esc(OP_OUTCOME[dyn.operatorOutcome])}</p><ul>${dyn.summary.map((s) => `<li>${esc(s)}</li>`).join("")}</ul><h3>Events</h3><ul>${dyn.events.map((x) => `<li>${x.t.toFixed(2)} s — ${esc(x.text)}</li>`).join("")}</ul><p>Single-axis rigid-body tip model, timestep ${dyn.dt * 1000} ms. Post-impact motion estimated.</p>` : ""}
<h2>Inputs</h2><pre>${esc(JSON.stringify(e.ui, null, 2))}</pre>
<h2>Profile notes and assumptions</h2><p>${esc(p.meta.notes ?? "")}</p>
<h2>Engineering review</h2><p>Reviewer: ______________________ Date: __________ Scope: ______________________</p>
</body></html>`;
};
