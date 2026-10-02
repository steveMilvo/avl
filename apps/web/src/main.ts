import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { explainChange, type DynamicsResult, type ChangeExplanation, cross, normalize, scale, add, v, type Vec3, transformPoint, apply } from "@loadlab/physics";
import { MachineView } from "./scene/machineView.js";
import { T } from "./scene/coords.js";
import {
  FORKLIFTS, LOADERS, defaultForklift, defaultLoader, evaluate, runDynamics, clone, forkPreset, DENSITY, REPOSE, presetLabel, turnRadius,
  type MachineUI, type Evaluation, type ForkliftUI, type LoaderUI,
} from "./app/state.js";
import { LESSONS, type Lesson } from "./app/lessons.js";
import { renderResults, OUTCOME, OP_OUTCOME, dynBlock } from "./ui/results.js";
import { h, slider, select, toggle, section, type Control, locked } from "./ui/controls.js";
import { download, scenarioJson, reportHtml } from "./app/report.js";
import type { ForkLoadKind, BulkMaterial } from "./scene/loads.js";

// ---------- renderer, camera, views ----------
const vp = document.getElementById("viewport")!;
const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setScissorTest(true);
vp.prepend(renderer.domElement);

const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; controls.maxPolarAngle = Math.PI * 0.495; controls.minDistance = 2; controls.maxDistance = 60;
const labelHost = document.getElementById("vp-labels")!;
const mkLabels = () => { const r = new CSS2DRenderer(); r.domElement.style.position = "absolute"; r.domElement.style.top = "0"; labelHost.append(r.domElement); return r; };
const labelsB = mkLabels(), labelsA = mkLabels();

const viewB = new MachineView(renderer);
let viewA: MachineView | null = null;

// ---------- app state ----------
type Mode = "explore" | "compare" | "lessons";
let mode: Mode = "explore";
let ui: MachineUI = defaultForklift();
let baseline: MachineUI | null = null;
let evalB: Evaluation | null = null, evalA: Evaluation | null = null, evalBase: Evaluation | null = null;
let dynB: DynamicsResult | null = null, dynA: DynamicsResult | null = null;
let explain: ChangeExplanation | null = null;
let errorMsg: string | null = null;
const play = { t: 0, playing: false, speed: 1, tEnd: 0, lastStrikeShake: -1 };
let camMode = "iso";
let shake = 0;
let lesson: Lesson | null = null, lessonPick: string | null = null, lessonRan = false;
let pendingTimer: number | undefined;

const shortName = (p: { meta: { manufacturer: string; model: string; releaseStatus: string } }) =>
  p.meta.manufacturer === "Generic" ? `Generic ${p.meta.model.match(/[\d.]+ ?(t|m³)/)?.[0] ?? ""} (demo data)` : `${p.meta.manufacturer} ${p.meta.model}${p.meta.releaseStatus === "draft-unverified" ? " (draft data)" : ""}`;
const MACHINES: [string, string][] = [
  ...Object.values(FORKLIFTS).map((p) => [`forklift|${p.meta.id}`, `Forklift — ${shortName(p)}`] as [string, string]),
  ...Object.values(LOADERS).map((p) => [`loader|${p.meta.id}`, `Front end loader — ${shortName(p)}`] as [string, string]),
];

const radiusHint = () => {
  if (ui.kind !== "loader") return "";
  const R = turnRadius(ui);
  return R === undefined
    ? "Set an articulation angle in Loader controls: the articulation sets the turn. Straight articulation drives straight."
    : `Articulation ${Math.abs(ui.articulationDeg).toFixed(0)}° ${ui.articulationDeg > 0 ? "left" : "right"} gives a ${Math.abs(R).toFixed(1)} m path radius at the rear axle. The loader starts straight and steers into it.`;
};

// ---------- evaluation ----------
const recompute = (recordTrail = true) => {
  try { evalB = evaluate(ui); errorMsg = null; }
  catch (err) { errorMsg = (err as Error).message; }
  if (!evalB) return;
  stopPlayback(); dynB = null; dynA = null;
  viewB.show(evalB, recordTrail);
  if (baseline) {
    try { evalBase = evaluate(baseline); } catch { evalBase = null; }
    if (evalBase && evalBase.ui.kind === evalB.ui.kind && evalBase.ui.profileId === evalB.ui.profileId) {
      const g = evalBase.state.stability;
      viewB.overlays.setGhost(g.cgUnrolled.combined.cg, g.gravityEval.groundIntersection ?? null);
      explain = explainChange(g, evalB.state.stability);
    } else { viewB.overlays.setGhost(null, null); explain = null; }
    viewB.overlays.update(evalB.state.stability, { recordTrail: false });
  } else { viewB.overlays.setGhost(null, null); explain = null; }
  if (mode === "compare" && baseline) {
    viewA ??= new MachineView(renderer);
    try { evalA = evaluate(baseline); viewA.show(evalA); } catch { /* ignore */ }
  }
  const pickSel = document.querySelector("#machine-pick select") as HTMLSelectElement | null;
  if (pickSel) pickSel.value = `${ui.kind}|${ui.profileId}`;
  const rh = document.getElementById("radius-hint"); if (rh) rh.textContent = radiusHint();
  hideBanner();
  refreshRight();
  refreshControls();
  if (mode === "compare") refreshDiffs();
};
const recomputeSoon = () => { window.clearTimeout(pendingTimer); pendingTimer = window.setTimeout(() => recompute(), 10); };

const refreshRight = () => {
  const right = document.getElementById("right")!;
  if (!evalB) return;
  if (mode === "lessons" && lesson) { renderLessonRight(right); return; }
  renderResults(right, evalB, { explain, dyn: dynB, error: errorMsg });
};

// ---------- controls ----------
let controlsList: Control[] = [];
const refreshControls = () => controlsList.forEach((c) => c.refresh());

const buildControls = () => {
  const left = document.getElementById("left")!;
  left.innerHTML = ""; controlsList = [];
  if (mode === "lessons") { buildLessonsPanel(left); return; }
  const add = (parent: HTMLElement, c: Control) => { controlsList.push(c); parent.append(c.el); return c; };
  const on = () => recomputeSoon();
  const demo = ui.trainerDemo;

  if (mode === "compare") {
    const s = section("Comparison");
    s.body.append(h("div", { class: "diffs", id: "diffs" }));
    s.body.append(h("div", { class: "hint" }, "A is the baseline. Change one variable for B. Lock the others with 🔒."));
    const row = h("div", { class: "row" });
    const b1 = h("button", { class: "btn" }, "Set baseline = B"); b1.onclick = () => { baseline = clone(ui); recompute(); };
    const b2 = h("button", { class: "btn" }, "B = baseline"); b2.onclick = () => { if (baseline) { ui = clone(baseline); buildControls(); recompute(); } };
    row.append(b1, b2); s.body.append(row); left.append(s.el);
  }

  if (ui.kind === "forklift") {
    const u = ui, p = FORKLIFTS[u.profileId]!, g = p.geometry;
    const L = section("Load");
    add(L.body, select<ForkLoadKind | "none">({ key: "preset", label: "Load type", options: (["none", "cartons", "tall-stack", "long-load", "machinery", "ibc", "grape-bin"] as const).map((k) => [k, presetLabel(k)]),
      get: () => u.load.preset, set: (k) => Object.assign(u.load, forkPreset(k, k === "ibc" || k === "grape-bin" ? u.load.fill : 1)), onChange: on }));
    if (u.load.preset === "ibc" || u.load.preset === "grape-bin")
      add(L.body, slider({ key: "fill", label: u.load.preset === "ibc" ? "IBC fill (empty → full)" : "Bin fill", unit: "%", min: 0, max: 100, step: 5, get: () => u.load.fill * 100, set: (x) => Object.assign(u.load, forkPreset(u.load.preset as ForkLoadKind, x / 100)), onChange: on, hint: "Sets mass and CG height together (liquid/fruit settles low)." }));
    add(L.body, slider({ key: "mass", label: "Payload mass (incl. pallet/container tare)", unit: "kg", min: 0, max: demo ? 4000 : 3000, step: 10, get: () => u.load.mass, set: (x) => (u.load.mass = x), onChange: on }));
    add(L.body, slider({ key: "len", label: "Length (along forks)", unit: "m", min: 0.3, max: 2.5, step: 0.05, get: () => u.load.length, set: (x) => (u.load.length = x), onChange: on }));
    add(L.body, slider({ key: "wid", label: "Width", unit: "m", min: 0.3, max: 6, step: 0.05, get: () => u.load.width, set: (x) => (u.load.width = x), onChange: on }));
    add(L.body, slider({ key: "hgt", label: "Height", unit: "m", min: 0.2, max: 3.5, step: 0.05, get: () => u.load.height, set: (x) => (u.load.height = x), onChange: on }));
    add(L.body, slider({ key: "cgx", label: "CG offset forward (from load centre)", unit: "m", min: -0.6, max: 0.6, step: 0.01, get: () => u.load.cgX, set: (x) => (u.load.cgX = x), onChange: on }));
    add(L.body, slider({ key: "cgy", label: "CG offset left (+) / right (−)", unit: "m", min: -1, max: 1, step: 0.01, get: () => u.load.cgY, set: (x) => (u.load.cgY = x), onChange: on }));
    add(L.body, slider({ key: "cgz", label: "CG offset up (from mid-height)", unit: "m", min: -1, max: 1, step: 0.01, get: () => u.load.cgZ, set: (x) => (u.load.cgZ = x), onChange: on, hint: "Tall or irregular loads rarely have their CG at the geometric centre." }));
    add(L.body, slider({ key: "gap", label: "Gap from fork face (insertion)", unit: "m", min: 0, max: 0.8, step: 0.01, get: () => u.load.gap, set: (x) => (u.load.gap = x), onChange: on, hint: "Load centre = gap + length/2 + CG offset." }));
    add(L.body, slider({ key: "lfric", label: "Load-to-fork friction", unit: "μ", min: 0.05, max: 0.8, step: 0.01, get: () => u.load.friction, set: (x) => (u.load.friction = x), onChange: on }));
    add(L.body, toggle({ key: "sec", label: "Load secured to carriage", get: () => u.load.secured, set: (x) => (u.load.secured = x), onChange: on }));
    left.append(L.el);
    const Mc = section("Mast and forks");
    add(Mc.body, slider({ key: "lift", label: "Lift height (carriage travel)", unit: "m", min: 0, max: demo ? g.maxLift * 1.3 : g.maxLift, step: 0.01, get: () => u.liftHeight, set: (x) => (u.liftHeight = x), onChange: on, warnOutside: [0, g.maxLift], hint: "Fork height, fork-heel height and payload CG height are reported separately." }));
    add(Mc.body, slider({ key: "tilt", label: "Mast tilt (+ back / − forward)", unit: "°", min: demo ? -20 : -g.tiltForwardMax * 57.2958, max: demo ? 20 : g.tiltBackMax * 57.2958, step: 0.5, get: () => u.tiltDeg, set: (x) => (u.tiltDeg = x), onChange: on, warnOutside: [-g.tiltForwardMax * 57.2958, g.tiltBackMax * 57.2958] }));
    if (g.sideShiftMax > 0) add(Mc.body, slider({ key: "ss", label: "Side shift (+ left)", unit: "m", min: demo ? -0.4 : -g.sideShiftMax, max: demo ? 0.4 : g.sideShiftMax, step: 0.005, get: () => u.sideShift, set: (x) => (u.sideShift = x), onChange: on, warnOutside: [-g.sideShiftMax, g.sideShiftMax] }));
    left.append(Mc.el);
  } else {
    const u = ui, p = LOADERS[u.profileId]!, g = p.geometry;
    const L = section("Bucket load");
    add(L.body, select<BulkMaterial | "none">({ key: "mat", label: "Material", options: [["none", "Empty bucket"], ["gravel", "Gravel"], ["soil", "Soil"], ["sand", "Sand"], ["grapes", "Grapes"], ["pomace", "Pomace (marc)"]],
      get: () => u.load.material, set: (k) => { u.load.material = k; if (k !== "none") { u.load.density = DENSITY[k]; u.load.reposeDeg = REPOSE[k]; } }, onChange: () => { buildControls(); on(); } }));
    add(L.body, select<"density" | "explicit">({ key: "mmode", label: "Payload mass from", options: [["density", "Density × fill volume"], ["explicit", "Measured mass (weighbridge)"]], get: () => u.load.massMode, set: (k) => (u.load.massMode = k), onChange: () => { buildControls(); on(); } }));
    if (u.load.massMode === "density") {
      add(L.body, slider({ key: "dens", label: "Density", unit: "kg/m³", min: 300, max: 2500, step: 10, get: () => u.load.density, set: (x) => (u.load.density = x), onChange: on }));
      add(L.body, slider({ key: "vol", label: "Fill volume", unit: "m³", min: 0, max: demo ? g.bucketHeapedVolume * 1.4 : g.bucketHeapedVolume, step: 0.05, get: () => u.load.volume, set: (x) => (u.load.volume = x), onChange: on, warnOutside: [0, g.bucketHeapedVolume], hint: `Struck ${g.bucketStruckVolume} m³, heaped ${g.bucketHeapedVolume} m³. Density × volume controls the result.` }));
    } else add(L.body, slider({ key: "lmass", label: "Measured payload mass", unit: "kg", min: 0, max: 15000, step: 50, get: () => u.load.mass, set: (x) => (u.load.mass = x), onChange: on, hint: "Measured mass controls the result." }));
    add(L.body, slider({ key: "lat", label: "Uneven fill: CG offset left (+) / right (−)", unit: "m", min: -0.8, max: 0.8, step: 0.01, get: () => u.load.lateral, set: (x) => (u.load.lateral = x), onChange: on }));
    add(L.body, slider({ key: "repose", label: "Angle of repose (spill check)", unit: "°", min: 15, max: 50, step: 1, get: () => u.load.reposeDeg, set: (x) => (u.load.reposeDeg = x), onChange: on }));
    left.append(L.el);
    const Mc = section("Loader controls");
    const d = 57.2958;
    add(Mc.body, slider({ key: "arm", label: "Lift arm angle (low → high)", unit: "°", min: demo ? g.armAngleMin * d - 5 : g.armAngleMin * d, max: demo ? g.armAngleMax * d + 5 : g.armAngleMax * d, step: 0.5, get: () => u.armDeg, set: (x) => (u.armDeg = x), onChange: on, warnOutside: [g.armAngleMin * d, g.armAngleMax * d], hint: "Hinge-pin height and payload CG height are reported separately. Raising follows an arc." }));
    add(Mc.body, slider({ key: "bkt", label: "Bucket angle (+ rolled back / − dump)", unit: "°", min: g.bucketAngleMin * d, max: g.bucketAngleMax * d, step: 0.5, get: () => u.bucketDeg, set: (x) => (u.bucketDeg = x), onChange: on }));
    add(Mc.body, slider({ key: "art", label: "Articulation (+ left / − right)", unit: "°", min: demo ? -50 : -g.articulationLimit * d, max: demo ? 50 : g.articulationLimit * d, step: 0.5, get: () => u.articulationDeg, set: (x) => (u.articulationDeg = x), onChange: on, warnOutside: [-g.articulationLimit * d, g.articulationLimit * d] }));
    left.append(Mc.el);
  }

  const Tr = section("Terrain");
  add(Tr.body, slider({ key: "slope", label: "Slope", unit: "°", min: 0, max: demo ? 40 : 25, step: 0.5, get: () => ui.terrain.slopeDeg, set: (x) => (ui.terrain.slopeDeg = x), onChange: on, hint: "Grade % = 100 × tan(angle), shown in the results." }));
  add(Tr.body, slider({ key: "head", label: "Heading from uphill (0 up · 180 down · 90 uphill on right)", unit: "°", min: -180, max: 180, step: 5, get: () => ui.terrain.headingDeg, set: (x) => (ui.terrain.headingDeg = x), onChange: on }));
  add(Tr.body, slider({ key: "fric", label: "Tyre–ground friction", unit: "μ", min: 0.05, max: 1, step: 0.01, get: () => ui.terrain.friction, set: (x) => (ui.terrain.friction = x), onChange: on, hint: "Dry concrete ≈ 0.7 · wet ≈ 0.5 · oily/icy ≈ 0.1 (indicative)." }));
  left.append(Tr.el);

  const Mv = section("Movement");
  const m = ui.manoeuvre;
  add(Mv.body, select<typeof m.type>({ key: "mtype", label: "Manoeuvre", options: [["none", "Parked"], ["brake", "Drive, then brake"], ["accelerate", "Pull away"], ["turn", "Drive, then turn"]], get: () => m.type, set: (k) => (m.type = k), onChange: () => { buildControls(); on(); } }));
  if (m.type !== "none") {
    add(Mv.body, select<typeof m.travel>({ key: "travel", label: "Travel direction (independent of heading)", options: [["forward", "Forward"], ["reverse", "Reverse"]], get: () => m.travel, set: (k) => (m.travel = k), onChange: on }));
    add(Mv.body, slider({ key: "spd", label: m.type === "accelerate" ? "Speed reached" : "Travel speed", unit: "km/h", min: 1, max: 30, step: 0.5, get: () => m.speedKmh, set: (x) => (m.speedKmh = x), onChange: on }));
    if (m.type === "brake" || m.type === "accelerate")
      add(Mv.body, slider({ key: "acc", label: m.type === "brake" ? "Braking deceleration" : "Acceleration", unit: "m/s²", min: 0.2, max: 7, step: 0.1, get: () => m.accel, set: (x) => (m.accel = x), onChange: on, hint: m.type === "brake" ? "Gentle stop ≈ 1 · firm ≈ 2.5 · emergency stop on dry concrete ≈ 4–5 (indicative)." : undefined }));
    if (m.type === "turn") {
      if (ui.kind === "forklift") {
        add(Mv.body, slider({ key: "rad", label: "Turn radius (front-axle centre)", unit: "m", min: 1.5, max: 30, step: 0.5, get: () => m.radius, set: (x) => (m.radius = x), onChange: on }));
        add(Mv.body, select<typeof m.turn>({ key: "tdir", label: "Turn direction", options: [["left", "Left"], ["right", "Right"]], get: () => m.turn, set: (k) => (m.turn = k), onChange: on }));
      } else {
        Mv.body.append(h("div", { class: "hint", id: "radius-hint" }, radiusHint()));
      }
      add(Mv.body, slider({ key: "dur", label: "Time in the turn", unit: "s", min: 0.5, max: 8, step: 0.25, get: () => m.duration, set: (x) => (m.duration = x), onChange: on }));
    }
    if (ui.kind === "loader" && m.type !== "turn" && Math.abs(ui.articulationDeg) > 0.5)
      Mv.body.append(h("div", { class: "hint" }, "The loader is articulated, so it travels on a curve."));
    Mv.body.append(h("div", { class: "hint" }, "Run the simulation to watch the machine drive. The static view shows the peak quasi-static resultant (cyan)."));
  }
  left.append(Mv.el);

  const Op = section("Operator");
  add(Op.body, select<typeof ui.operator.behaviour>({ key: "opb", label: "Operator", options: [["belted", "Seatbelt worn"], ["unbelted", "No seatbelt"], ["jump", "Tries to jump clear"]], get: () => ui.operator.behaviour, set: (k) => (ui.operator.behaviour = k), onChange: () => { buildControls(); on(); } }));
  if (ui.operator.behaviour === "jump") add(Op.body, select<"fall" | "high">({ key: "jside", label: "Jumps toward", options: [["fall", "The side the machine falls to"], ["high", "The high side"]], get: () => ui.operator.jumpSide, set: (k) => (ui.operator.jumpSide = k), onChange: on }));
  left.append(Op.el);

  const Tn = section("Trainer", false);
  add(Tn.body, toggle({ key: "demo", label: "Trainer demonstration outside profile limits", get: () => ui.trainerDemo, set: (x) => (ui.trainerDemo = x), onChange: () => { buildControls(); on(); } }));
  const r1 = h("div", { class: "row" });
  const bBase = h("button", { class: "btn" }, "Set baseline (ghost)"); bBase.onclick = () => { baseline = clone(ui); viewB.overlays.clearTrail(); recompute(); };
  const bReset = h("button", { class: "btn" }, "Reset to baseline"); bReset.onclick = () => { if (baseline) { ui = clone(baseline); buildControls(); recompute(); } };
  const bClr = h("button", { class: "btn" }, "Clear baseline"); bClr.onclick = () => { baseline = null; recompute(); };
  const bDef = h("button", { class: "btn" }, "Defaults"); bDef.onclick = () => { ui = ui.kind === "forklift" ? defaultForklift() : defaultLoader(ui.profileId); buildControls(); recompute(); };
  r1.append(bBase, bReset, bClr, bDef); Tn.body.append(r1);
  const r2 = h("div", { class: "row" });
  const bSave = h("button", { class: "btn" }, "Save preset"); bSave.onclick = savePreset;
  const presets = h("select", {}); presets.append(h("option", { value: "" }, "Load preset…"));
  for (const k of Object.keys(readPresets())) presets.append(h("option", { value: k }, k));
  presets.onchange = () => { const p = readPresets()[presets.value]; if (p) { ui = clone(p); buildControls(); recompute(); } };
  r2.append(bSave, presets); Tn.body.append(r2);
  const r3 = h("div", { class: "row" });
  const bExp = h("button", { class: "btn" }, "Export scenario"); bExp.onclick = () => download(`loadlab-scenario-${Date.now()}.json`, scenarioJson(ui, baseline), "application/json");
  const imp = h("input", { type: "file", accept: ".json" }) as HTMLInputElement; imp.style.display = "none";
  imp.onchange = async () => { const f = imp.files?.[0]; if (!f) return; try { const j = JSON.parse(await f.text()); if (j.inputs?.kind) { ui = j.inputs; baseline = j.baseline ?? null; buildControls(); recompute(); } } catch (e) { alert(`Could not read scenario: ${(e as Error).message}`); } };
  const bImp = h("button", { class: "btn" }, "Import scenario"); bImp.onclick = () => imp.click();
  const bShot = h("button", { class: "btn" }, "Screenshot"); bShot.onclick = () => { renderFrame(); download(`loadlab-${Date.now()}.png`, dataUrlToBlob(renderer.domElement.toDataURL("image/png"))); };
  const bRep = h("button", { class: "btn" }, "Report"); bRep.onclick = () => { if (!evalB) return; renderFrame(); download(`loadlab-report-${Date.now()}.html`, reportHtml(evalB, dynB, explain, renderer.domElement.toDataURL("image/jpeg", 0.85)), "text/html"); };
  r3.append(bExp, bImp, imp, bShot, bRep); Tn.body.append(r3);
  left.append(Tn.el);
  refreshControls();
};

const readPresets = (): Record<string, MachineUI> => { try { return JSON.parse(localStorage.getItem("loadlab.presets") ?? "{}"); } catch { return {}; } };
const savePreset = () => {
  const name = prompt("Preset name?"); if (!name) return;
  try { const p = readPresets(); p[name] = clone(ui); localStorage.setItem("loadlab.presets", JSON.stringify(p)); buildControls(); } catch { alert("Presets could not be saved in this browser. Use Export scenario instead."); }
};
const dataUrlToBlob = (d: string) => { const [h0, b] = d.split(","); const bin = atob(b!); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: h0!.split(":")[1]!.split(";")[0] }); };

// ---------- comparison diffs ----------
const flatten = (o: unknown, pre = ""): Record<string, unknown> => {
  if (o && typeof o === "object") return Object.entries(o as Record<string, unknown>).reduce((a, [k, v2]) => ({ ...a, ...flatten(v2, pre ? `${pre}.${k}` : k) }), {});
  return { [pre]: o };
};
const refreshDiffs = () => {
  const el = document.getElementById("diffs"); if (!el) return;
  if (!baseline) { el.textContent = "No baseline set. Press “Set baseline = B”."; return; }
  const a = flatten(baseline), b = flatten(ui);
  const diffs = Object.keys(b).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k]));
  el.textContent = diffs.length ? `Differs from A in: ${diffs.join(", ")}` : "B matches A.";
  el.classList.toggle("many", diffs.length > 1);
  if (diffs.length > 1) el.textContent += " — more than one variable differs.";
};

// ---------- lessons ----------
const buildLessonsPanel = (left: HTMLElement) => {
  const list = h("div", { class: "lesson-list" });
  for (const l of LESSONS()) {
    const b = h("button", { class: lesson?.id === l.id ? "on" : "" }, `${l.id}. ${l.title}`);
    b.onclick = () => startLesson(l); list.append(b);
  }
  const s = section("Guided lessons"); s.body.append(h("div", { class: "hint" }, "Predict → run → inspect → explain. The answer is read from the model, not scripted."), list);
  left.append(s.el);
};
const startLesson = (l: Lesson) => {
  lesson = l; lessonPick = null; lessonRan = false;
  ui = clone(l.b); baseline = clone(l.a);
  viewA ??= new MachineView(renderer);
  try { evalA = evaluate(baseline); viewA.show(evalA); } catch (e) { errorMsg = (e as Error).message; }
  buildControls(); recompute(); setCamera(camMode);
};
const renderLessonRight = (right: HTMLElement) => {
  const l = lesson!; right.innerHTML = "";
  const card = h("div", { class: "lesson-card" }, h("h2", {}, `${l.id}. ${l.title}`),
    h("div", { class: "ab" }, h("b", {}, "A: "), l.aLabel), h("div", { class: "ab" }, h("b", {}, "B: "), l.bLabel),
    h("div", { class: "ab" }, `Variable changed: ${l.variable}`), h("p", {}, h("b", {}, l.question)));
  if (l.note) card.append(h("div", { class: "hint" }, l.note));
  const opts = h("div", { class: "opts" });
  for (const o of l.options) { const b = h("button", { class: `btn ${lessonPick === o.key ? "picked" : ""}` }, o.label); b.onclick = () => { lessonPick = o.key; renderLessonRight(right); }; opts.append(b); }
  card.append(h("div", { class: "hint" }, "1. Predict:"), opts);
  const run = h("button", { class: "primary" }, l.runDynamics ? "2. Run the simulation" : "2. Show the model result");
  run.disabled = !lessonPick; run.onclick = () => { lessonRan = true; if (l.runDynamics) runSim(); else renderLessonRight(right); };
  card.append(run);
  if (lessonRan && evalA && evalB) {
    const ans = l.answer(evalA, evalB, dynA, dynB);
    const label = l.options.find((o) => o.key === ans)?.label ?? ans;
    card.append(h("div", { class: `verdict ${ans === lessonPick ? "match" : "nomatch"}` }, `Model result: ${label}. ${ans === lessonPick ? "Your prediction matches the model." : "Your prediction differs from the model — inspect the evidence."}`));
    const ex = explainChange(evalA.state.stability, evalB.state.stability);
    const ul = h("ul", { class: "explain" }); for (const s of ex.sentences) ul.append(h("li", {}, s));
    card.append(h("h3", {}, "3. Inspect: what changed from A to B"), ul, h("div", { class: "hint" }, l.inspect));
    const mA = evalA.state.stability.resultantEval.critical, mB = evalB.state.stability.resultantEval.critical;
    card.append(h("table", { class: "meas" },
      h("tr", {}, h("td", {}, "A critical axis / margin"), h("td", {}, `${mA.id} · ${(mA.margin * 1000).toFixed(0)} mm`)),
      h("tr", {}, h("td", {}, "B critical axis / margin"), h("td", {}, `${mB.id} · ${(mB.margin * 1000).toFixed(0)} mm`))));
    card.append(h("h3", {}, "4. Explain"), h("div", { class: "hint" }, "In your own words: which masses moved, which lever arm changed, which wheel unloaded?"));
  }
  right.append(card);
  if (evalB) { const r = h("div", {}); renderResults(r, evalB, { explain: null, dyn: lessonRan ? dynB : null, error: errorMsg }); right.append(h("h3", {}, "B in detail"), r); }
};

// ---------- simulation / playback ----------
const runSim = () => {
  if (!evalB) return;
  dynB = runDynamics(evalB); viewB.setDynamics(dynB);
  dynA = null;
  if ((mode === "compare" || mode === "lessons") && viewA && evalA) { dynA = runDynamics(evalA); viewA.setDynamics(dynA); }
  play.tEnd = Math.max(dynB.frames.at(-1)!.t, dynA?.frames.at(-1)?.t ?? 0);
  play.t = 0; play.speed = Number(speedSel.value); play.playing = true; play.lastStrikeShake = -1;
  scrub.max = String(play.tEnd);
  hideBanner(); bannerShown = false;
  applyTime(); follow = groundToWorld(viewB.sitePosition());
  refreshRight();
};
let bannerShown = false;
/** Camera follows the machine while it drives. */
let follow: THREE.Vector3 | null = null;
const stopPlayback = () => { play.playing = false; play.t = 0; play.tEnd = 0; scrub.value = "0"; follow = null; hud.hidden = true; viewB.clearDynamics(); viewA?.clearDynamics(); };
const replaySlow = () => {
  if (!dynB) runSim(); if (!dynB) return;
  const key = dynB.events.find((e) => e.type === "tip-start" || e.type === "skid" || e.type === "payload-released");
  const start = key?.t ?? 0;
  play.t = Math.max(0, start - 1.0); play.speed = 0.15; speedSel.value = "0.15"; play.playing = true; play.lastStrikeShake = -1;
  applyTime();
  setCamera("cinematic");
};

const hideBanner = () => { document.getElementById("banner")!.hidden = true; };
const showBanner = (d: DynamicsResult) => {
  const b = document.getElementById("banner")!;
  const [title, cls] = OUTCOME[d.machineOutcome];
  b.className = cls; b.hidden = false; b.innerHTML = "";
  b.append(h("div", { class: "b-title" }, title.toUpperCase()));
  const op = OP_OUTCOME[d.operatorOutcome]; if (op) b.append(h("div", { class: "b-sub" }, op));
  if (d.payloadOutcome.released) b.append(h("div", { class: "b-sub" }, `Load lost from ${d.payloadOutcome.dropHeight?.toFixed(1)} m`));
  b.append(h("div", { class: "b-note" }, `Physics-driven model result · ${evalB?.confidence.label ?? ""}`));
};

// ---------- cameras ----------
const machineCentre = (): Vec3 => (ui.kind === "forklift" ? v(-0.6, 0, 1.0) : v(0, 0, 1.4));
const machineSize = () => (ui.kind === "forklift" ? 7.5 : (LOADERS[ui.profileId]!.geometry.tyre.radius / 0.675) * 11);
const groundToWorld = (p: Vec3) => { viewB.stage.scene.updateMatrixWorld(true); return T(p).applyMatrix4(viewB.stage.groundFrame.matrixWorld); };
const dirToWorld = (d: Vec3) => { viewB.stage.scene.updateMatrixWorld(true); return T(d).transformDirection(viewB.stage.groundFrame.matrixWorld); };
const setCamera = (k: string) => {
  camMode = k;
  document.querySelectorAll("#cams button").forEach((b) => b.classList.toggle("on", (b as HTMLElement).dataset["k"] === k));
  controls.enabled = k !== "operator";
  if (k === "operator") return;
  const fr = viewB.current;
  const toSite = (p: Vec3) => (fr ? transformPoint(fr.travel, p) : p);
  const dirSite = (d: Vec3) => (fr ? apply(fr.travel.R, d) : d);
  const c = groundToWorld(toSite(machineCentre())), s = machineSize();
  const dirs: Record<string, Vec3> = { iso: v(0.75, 0.85, 0.45), side: v(0, 1, 0.12), front: v(1, 0, 0.15), rear: v(-1, 0, 0.18), overhead: v(0.001, 0, 1) };
  let d = dirs[k];
  if (k === "cinematic") {
    if (dynB) { const ax = dynB.hinge.axis, out = cross(ax, v(0, 0, 1)); d = normalize(add(scale(ax, 0.9), add(scale(out, -0.35), v(0, 0, 0.25)))); }
    else d = dirs["side"];
  }
  const w = dirToWorld(dirSite(normalize(d!))).multiplyScalar(k === "overhead" ? s * 1.3 : s);
  camera.position.copy(c).add(w); controls.target.copy(c); camera.up.set(0, 1, 0); controls.update();
  if (dynB) follow = groundToWorld(viewB.sitePosition());
};
const updateOperatorCam = () => {
  const m = viewB.model; if (!m) return;
  const hip = m.profile.operatorSeat.hip;
  m.roll.updateMatrixWorld(true);
  const eye = T(v(hip.x + 0.1, hip.y, hip.z + 0.72)).applyMatrix4(m.roll.matrixWorld);
  const ahead = T(v(hip.x + 5, hip.y, hip.z + 0.2)).applyMatrix4(m.roll.matrixWorld);
  camera.position.copy(eye); camera.lookAt(ahead);
};

// ---------- header ----------
const buildHeader = () => {
  const modes = document.getElementById("modes")!;
  for (const [k, l] of [["explore", "Explore"], ["lessons", "Guided lessons"], ["compare", "Trainer comparison"]] as const) {
    const b = h("button", { "data-k": k }, l);
    b.onclick = () => { mode = k; modes.querySelectorAll("button").forEach((x) => x.classList.toggle("on", (x as HTMLElement).dataset["k"] === k)); if (k === "compare" && !baseline) baseline = clone(ui); if (k !== "lessons") lesson = null; layout(); buildControls(); recompute(); };
    if (k === mode) b.classList.add("on"); modes.append(b);
  }
  const pick = h("select", {});
  for (const [k, l] of MACHINES) pick.append(h("option", { value: k }, l));
  pick.onchange = () => { const [kind, id] = pick.value.split("|") as [string, string]; ui = kind === "forklift" ? { ...defaultForklift(), profileId: id } : defaultLoader(id); baseline = null; lesson = null; locked.clear(); viewB.overlays.clearTrail(); buildControls(); recompute(); setCamera(camMode === "operator" ? "iso" : camMode); };
  document.getElementById("machine-pick")!.append(pick);
  const cams = document.getElementById("cams")!;
  for (const [k, l] of [["iso", "Orbit"], ["side", "Side"], ["front", "Front"], ["rear", "Rear"], ["overhead", "Overhead"], ["operator", "Operator"], ["cinematic", "Tip view"]] as const) {
    const b = h("button", { "data-k": k }, l); b.onclick = () => setCamera(k); cams.append(b);
  }
  const tg = document.getElementById("toggles")!;
  const t = viewB.overlays.toggles;
  const mk = (label: string, get: () => boolean, set: (x: boolean) => void) => {
    const c = h("input", { type: "checkbox" }) as HTMLInputElement; c.checked = get();
    c.onchange = () => { set(c.checked); if (evalB) { viewB.overlays.update(evalB.state.stability, {}); if (viewA && evalA) viewA.overlays.update(evalA.state.stability, {}); } };
    tg.append(h("label", {}, c, label));
  };
  mk("Engineering view", () => false, (x) => { viewB.setEngineering(x); viewA?.setEngineering(x); });
  const both = (f: (o: typeof t) => void) => { f(viewB.overlays.toggles); if (viewA) f(viewA.overlays.toggles); };
  mk("CG", () => t.cg, (x) => both((o) => (o.cg = x)));
  mk("Gravity", () => t.gravity, (x) => both((o) => (o.gravity = x)));
  mk("Support", () => t.support, (x) => both((o) => (o.support = x)));
  mk("Reactions", () => t.reactions, (x) => both((o) => (o.reactions = x)));
  mk("Trail", () => t.trail, (x) => both((o) => (o.trail = x)));
  mk("Labels", () => t.labels, (x) => both((o) => (o.labels = x)));
};

// ---------- timeline ----------
const tl = document.getElementById("timeline")!;
const hud = document.getElementById("hud")!;
const bRun = h("button", { class: "primary" }, "▶ Run simulation"); bRun.onclick = runSim;
const bPlay = h("button", {}, "⏯ Play / pause"); bPlay.onclick = () => { if (!dynB) return runSim(); if (play.t >= play.tEnd) play.t = 0; play.playing = !play.playing; };
const bStep = h("button", {}, "⏭ Step"); bStep.onclick = () => { if (!dynB) return; play.playing = false; play.t = Math.min(play.tEnd, play.t + 1 / 60); applyTime(); };
const bBack = h("button", {}, "⏮ Back"); bBack.onclick = () => { if (!dynB) return; play.playing = false; play.t = Math.max(0, play.t - 1 / 60); applyTime(); };
const speedSel = h("select", {}) as HTMLSelectElement;
for (const [vv, l] of [["1", "1× real time"], ["0.5", "0.5×"], ["0.25", "0.25×"], ["0.15", "0.15× slow motion"], ["0.05", "0.05×"]]) speedSel.append(h("option", { value: vv! }, l!));
speedSel.onchange = () => (play.speed = Number(speedSel.value));
const bSlow = h("button", {}, "🎬 Replay tipping moment (slow motion)"); bSlow.onclick = replaySlow;
const bReset = h("button", {}, "⟲ Reset"); bReset.onclick = () => { stopPlayback(); hideBanner(); if (evalB) viewB.show(evalB, false); if (viewA && evalA) viewA.show(evalA, false); setCamera(camMode === "cinematic" ? "iso" : camMode); };
const scrub = h("input", { type: "range", min: "0", max: "1", step: "0.001", value: "0" }) as HTMLInputElement;
scrub.oninput = () => { if (!dynB) return; play.playing = false; play.t = Number(scrub.value); applyTime(); };
const tlabel = h("span", { class: "tlabel" }, "static");
tl.append(bRun, bPlay, bBack, bStep, speedSel, bSlow, bReset, scrub, tlabel);

const applyTime = () => {
  viewB.setTime(play.t); viewA?.setTime(play.t);
  scrub.value = String(play.t);
  tlabel.textContent = `t = ${play.t.toFixed(2)} s · ${play.speed}×`;
  const f = viewB.current;
  if (f && dynB) {
    hud.hidden = false;
    const m = f.motion, gx = f.accel.x / 9.81, gy = f.accel.y / 9.81;
    const rest = dynB.events.find((e) => e.type === "came-to-rest");
    const down = !!rest && play.t >= rest.t;
    const state = down ? (m.speed > 0.05 ? "SLIDING ON ITS SIDE" : "AT REST, TIPPED OVER") : !f.onWheels ? "TIPPING" : m.mode === "skid" ? "SKIDDING" : m.mode === "sliding" ? "SLIDING" : m.speed > 0.05 ? "DRIVING" : "STOPPED";
    hud.innerHTML = `<div class="hud-speed">${(m.speed * 3.6).toFixed(1)}<span>km/h</span></div>`
      + `<div class="hud-row"><b>${state}</b></div>`
      + `<div class="hud-row">Longitudinal ${f.accel.x >= 0 ? "+" : "−"}${Math.abs(gx).toFixed(2)} g</div>`
      + `<div class="hud-row">Lateral ${Math.abs(gy).toFixed(2)} g ${gy > 0.005 ? "(load pushed right)" : gy < -0.005 ? "(load pushed left)" : ""}</div>`
      + `<div class="hud-row">Turn radius ${Number.isFinite(m.radius) ? `${m.radius.toFixed(1)} m` : "straight"}</div>`
      + `<div class="hud-row">Critical axis ${f.stability.resultantEval.critical.id} · ${f.onWheels ? `${(f.stability.resultantEval.critical.margin * 1000).toFixed(0)} mm` : "outside"}</div>`;
  }
  if (dynB && !bannerShown && play.t >= Math.min(play.tEnd - 1e-6, (dynB.events.find((e) => e.type === "tip-start")?.t ?? play.tEnd) + 0.5)) { showBanner(dynB); bannerShown = true; }
  if (dynB?.strike && play.t >= dynB.strike.t && play.lastStrikeShake < dynB.strike.t) { shake = Math.min(0.25, 0.03 * dynB.strike.speed + 0.03); play.lastStrikeShake = dynB.strike.t; }
};

// ---------- layout + render loop ----------
const layout = () => {
  const r = vp.getBoundingClientRect();
  renderer.setSize(r.width, r.height);
  const split = mode !== "explore";
  camera.aspect = split ? r.width / 2 / r.height : r.width / r.height; camera.updateProjectionMatrix();
  labelsB.setSize(split ? r.width / 2 : r.width, r.height); labelsA.setSize(r.width / 2, r.height);
  labelsB.domElement.style.left = split ? `${r.width / 2}px` : "0"; labelsA.domElement.style.display = split ? "" : "none";
  document.getElementById("compare-tags")!.hidden = !split;
};
window.addEventListener("resize", layout);

const renderFrame = () => {
  const r = vp.getBoundingClientRect(), W = r.width, H = r.height;
  const split = mode !== "explore" && viewA;
  if (split) {
    renderer.setViewport(0, 0, W / 2, H); renderer.setScissor(0, 0, W / 2, H); renderer.render(viewA!.stage.scene, camera); labelsA.render(viewA!.stage.scene, camera);
    renderer.setViewport(W / 2, 0, W / 2, H); renderer.setScissor(W / 2, 0, W / 2, H);
  } else { renderer.setViewport(0, 0, W, H); renderer.setScissor(0, 0, W, H); }
  renderer.render(viewB.stage.scene, camera); labelsB.render(viewB.stage.scene, camera);
};

let last = performance.now();
const loop = (now: number) => {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (play.playing && dynB) { play.t = Math.min(play.tEnd, play.t + dt * play.speed); applyTime(); if (play.t >= play.tEnd) play.playing = false; }
  if (follow && dynB && camMode !== "operator") {
    const p = groundToWorld(viewB.sitePosition()), dlt = p.clone().sub(follow);
    camera.position.add(dlt); controls.target.add(dlt); follow = p;
  }
  if (camMode === "operator") updateOperatorCam(); else controls.update();
  if (shake > 0.001) { const o = new THREE.Vector3((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake); camera.position.add(o); renderFrame(); camera.position.sub(o); shake *= 0.9; }
  else renderFrame();
  requestAnimationFrame(loop);
};

buildHeader(); layout(); buildControls(); recompute(); setCamera("iso");
requestAnimationFrame(loop);
(window as unknown as { loadlab: unknown }).loadlab = { get ui() { return ui; }, set ui(x: MachineUI) { ui = x; buildControls(); recompute(); }, runSim, setCamera, replaySlow, seek: (t: number) => { play.playing = false; play.t = t; applyTime(); }, get dyn() { return dynB; }, startLesson: (i: number) => startLesson(LESSONS()[i - 1]!), setMode: (m: Mode) => (document.querySelector(`#modes button[data-k=${m}]`) as HTMLElement).click() };
void dynBlock; void ({} as ForkliftUI); void ({} as LoaderUI);
