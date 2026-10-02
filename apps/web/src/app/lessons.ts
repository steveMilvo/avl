import { type DynamicsResult, terrainFromGrades, deg } from "@loadlab/physics";
import { defaultForklift, defaultLoader, forkPreset, type ForkliftUI, type LoaderUI, type MachineUI, type Evaluation, LOADERS } from "./state.js";

/**
 * Guided lessons (brief §8). Each lesson builds two configurations that differ in one variable,
 * asks the learner to predict, runs the model, and marks the prediction against the MODEL result.
 * No lesson hard-codes the expected answer: `answer` reads it from the evaluations.
 */
export interface Lesson {
  id: number; title: string; question: string; variable: string;
  a: MachineUI; b: MachineUI;
  aLabel: string; bLabel: string;
  runDynamics: boolean;
  options: { key: string; label: string }[];
  answer(A: Evaluation, B: Evaluation, dA: DynamicsResult | null, dB: DynamicsResult | null): string;
  inspect: string;
  note?: string;
}

const fk = (patch: (u: ForkliftUI) => void): ForkliftUI => { const u = defaultForklift(); patch(u); return u; };
const ld = (patch: (u: LoaderUI) => void): LoaderUI => { const u = defaultLoader(); patch(u); return u; };
const cmpOpts = [{ key: "A", label: "A is closer to tipping" }, { key: "B", label: "B is closer to tipping" }, { key: "same", label: "About the same" }];
const margin = (e: Evaluation) => e.state.stability.resultantEval.critical.margin;
const compare = (A: Evaluation, B: Evaluation, f = margin) => { const a = f(A), b = f(B); return Math.abs(a - b) < 0.005 ? "same" : a < b ? "A" : "B"; };
/** Smallest margin among edges that limit sideways tipping (edges that are not the front or rear axle). */
const lateral = (e: Evaluation) => {
  const s = e.state.support;
  const axles = new Set([`${s.rigidRight.id}-${s.rigidLeft.id}`, `${s.rigidLeft.id}-${s.rigidRight.id}`, `${s.oscLeft.id}-${s.oscRight.id}`, `${s.oscRight.id}-${s.oscLeft.id}`]);
  return Math.min(...e.state.stability.resultantEval.edges.filter((x) => !axles.has(x.id)).map((x) => x.margin));
};
const dynOpts = [{ key: "stable", label: "Stays on its wheels" }, { key: "rocked-back", label: "Lifts, then drops back" }, { key: "tips", label: "Tips over or onto its attachment" }];
const dynKey = (d: DynamicsResult | null) => !d ? "stable" : d.machineOutcome === "stable" ? "stable" : d.machineOutcome === "rocked-back" ? "rocked-back" : "tips";
const pallet = (u: ForkliftUI, mass: number) => { Object.assign(u.load, forkPreset("cartons"), { mass }); };

export const LESSONS = (): Lesson[] => {
  const list: Lesson[] = [
  { id: 1, title: "Short versus long load centre", variable: "Load position on the forks",
    a: fk((u) => pallet(u, 1600)), b: fk((u) => { pallet(u, 1600); u.load.gap = 0.4; }),
    aLabel: "Load against the backrest", bLabel: "Same load 400 mm out on the forks",
    question: "Same forklift, same 1600 kg pallet. Which is closer to tipping forward?", runDynamics: false, options: cmpOpts,
    answer: (A, B) => compare(A, B), inspect: "Watch the orange payload marker and the magenta combined marker move forward, and the front-axle margin shrink. Check the capacity card: the plate entry changes with load centre." },
  { id: 2, title: "Low versus high load centre of gravity", variable: "Payload CG height",
    a: fk((u) => { pallet(u, 1200); u.manoeuvre = { ...u.manoeuvre, type: "brake", accel: 2.5, duration: 0.6 }; }),
    b: fk((u) => { Object.assign(u.load, forkPreset("tall-stack"), { mass: 1200 }); u.manoeuvre = { ...u.manoeuvre, type: "brake", accel: 2.5, duration: 0.6 }; }),
    aLabel: "1.2 m high pallet, braking 2.5 m/s²", bLabel: "2.6 m tall stack, same mass, same braking",
    question: "Both loads weigh the same and sit at the same load centre. Under the same braking, which is closer to tipping forward?", runDynamics: true, options: cmpOpts,
    answer: (A, B) => compare(A, B), inspect: "Set both to no braking and compare again: on level ground at rest the margins are nearly equal. Height matters when an inertial force acts. The cyan resultant line moves; the magenta mass centre does not." },
  { id: 3, title: "Mast tilt at height", variable: "Mast tilt",
    a: fk((u) => { pallet(u, 1500); u.liftHeight = 3.5; u.tiltDeg = 6; }), b: fk((u) => { pallet(u, 1500); u.liftHeight = 3.5; u.tiltDeg = -5; }),
    aLabel: "3.5 m, tilted back 6°", bLabel: "3.5 m, tilted forward 5°",
    question: "Load raised to 3.5 m. Which is closer to tipping forward?", runDynamics: true, options: cmpOpts,
    answer: (A, B) => compare(A, B), inspect: "Forward tilt at height carries the load CG forward by height × sin(tilt). Compare the payload CG x position and the front-axle margin." },
  { id: 4, title: "Offset payload and side shift", variable: "Side shift",
    a: fk((u) => { Object.assign(u.load, forkPreset("machinery")); u.liftHeight = 2; u.terrain.slopeDeg = 6; u.terrain.headingDeg = -90; }),
    b: fk((u) => { Object.assign(u.load, forkPreset("machinery")); u.liftHeight = 2; u.sideShift = 0.1; u.terrain.slopeDeg = 6; u.terrain.headingDeg = -90; }),
    aLabel: "Machinery with CG offset right, no side shift", bLabel: "Same load, side-shifted 100 mm left",
    question: "The machine's CG is offset to the right and the ground falls away to the right. Which has less sideways margin?", runDynamics: false, options: cmpOpts,
    answer: (A, B) => compare(A, B, lateral), inspect: "Look at the lateral position of the combined CG and the margin to the side tipping axis." },
  { id: 5, title: "Loaded forklift facing uphill versus downhill", variable: "Heading on the slope",
    a: fk((u) => { pallet(u, 1800); u.terrain.slopeDeg = 8; u.terrain.headingDeg = 0; u.trainerDemo = true; }),
    b: fk((u) => { pallet(u, 1800); u.terrain.slopeDeg = 8; u.terrain.headingDeg = 180; u.trainerDemo = true; }),
    aLabel: "Facing uphill on 8°", bLabel: "Facing downhill on 8°",
    question: "Same load on an 8° slope. Which is closer to tipping forward?", runDynamics: false, options: cmpOpts,
    answer: (A, B) => compare(A, B), inspect: "The gravity line stays vertical. On a slope it meets the ground ahead of or behind the CG by height × tan(slope).", note: "8° exceeds the generic profile's loaded-travel restriction: card 3 reports it." },
  { id: 6, title: "Forward versus reverse travel, same heading", variable: "Travel direction",
    a: fk((u) => { pallet(u, 1500); u.liftHeight = 0.3; u.terrain.slopeDeg = 5; u.terrain.headingDeg = 180; u.manoeuvre = { ...u.manoeuvre, type: "brake", travel: "forward", accel: 2.5, duration: 0.6 }; }),
    b: fk((u) => { pallet(u, 1500); u.liftHeight = 0.3; u.terrain.slopeDeg = 5; u.terrain.headingDeg = 180; u.manoeuvre = { ...u.manoeuvre, type: "brake", travel: "reverse", accel: 2.5, duration: 0.6 }; }),
    aLabel: "Facing downhill, travelling forward, braking", bLabel: "Facing downhill, reversing uphill, braking",
    question: "Both face downhill and brake equally. Which is closer to tipping?", runDynamics: true, options: cmpOpts,
    answer: (A, B) => compare(A, B), inspect: "Orientation sets the gravity geometry. Travel direction sets which way the braking inertial force acts. Compare the cyan resultant line." },
  { id: 7, title: "Cross-slope travel and turning", variable: "Turning",
    a: fk((u) => { pallet(u, 1200); u.liftHeight = 0.3; u.terrain.slopeDeg = 5; u.terrain.headingDeg = 90; }),
    b: fk((u) => { pallet(u, 1200); u.liftHeight = 0.3; u.terrain.slopeDeg = 5; u.terrain.headingDeg = 90; u.manoeuvre = { ...u.manoeuvre, type: "turn", turn: "right", speedKmh: 12, radius: 4, duration: 3 }; }),
    aLabel: "Across a 5° slope, straight", bLabel: "Same, turning uphill at 12 km/h (4 m radius)",
    question: "Which has less sideways margin?", runDynamics: true, options: cmpOpts,
    answer: (A, B) => compare(A, B, lateral), inspect: "Turning toward the uphill side throws the load toward the downhill side. Watch whether the rear-axle stop engages." },
  { id: 8, title: "Braking with a raised load", variable: "Lift height",
    a: fk((u) => { pallet(u, 1500); u.load.secured = true; u.liftHeight = 0.15; u.manoeuvre = { ...u.manoeuvre, type: "brake", accel: 4, duration: 0.7 }; }),
    b: fk((u) => { pallet(u, 1500); u.load.secured = true; u.liftHeight = 3.5; u.manoeuvre = { ...u.manoeuvre, type: "brake", accel: 4, duration: 0.7 }; }),
    aLabel: "Load lowered, hard braking", bLabel: "Load raised to 3.5 m, same braking",
    question: "What does the model predict for B?", runDynamics: true, options: dynOpts,
    answer: (_A, _B, _dA, dB) => dynKey(dB), inspect: "Replay B in slow motion. Note the peak rear lift and whether it drops back once braking ends." },
  { id: 9, title: "Empty versus loaded forklift", variable: "Payload",
    a: fk((u) => { u.load.preset = "none"; u.liftHeight = 2; u.terrain.slopeDeg = 12; u.terrain.headingDeg = 90; u.trainerDemo = true; }),
    b: fk((u) => { pallet(u, 1500); u.liftHeight = 2; u.terrain.slopeDeg = 12; u.terrain.headingDeg = 90; u.trainerDemo = true; }),
    aLabel: "Empty, forks at 2 m, 12° cross slope", bLabel: "1500 kg at 2 m, same slope",
    question: "Which is closer to tipping sideways?", runDynamics: true, options: cmpOpts,
    answer: (A, B) => compare(A, B, lateral), inspect: "The empty machine's CG sits further back, closer to the narrow end of the stability triangle. Compare the combined CG position with the triangle." },
  { id: 10, title: "Straight versus full articulation", variable: "Articulation",
    a: ld((u) => { u.terrain.slopeDeg = 8; u.terrain.headingDeg = -90; }), b: ld((u) => { u.terrain.slopeDeg = 8; u.terrain.headingDeg = -90; u.articulationDeg = -40; }),
    aLabel: "Straight, across an 8° slope", bLabel: "Full articulation toward the downhill side",
    question: "Which has less sideways margin?", runDynamics: false, options: cmpOpts,
    answer: (A, B) => compare(A, B, lateral), inspect: "Articulation swings the front axle, bucket and load. The support triangle changes shape. Compare the green support outline." },
  { id: 11, title: "Low, intermediate and raised bucket", variable: "Bucket height",
    a: ld((u) => { u.terrain.slopeDeg = 10; u.terrain.headingDeg = -90; u.armDeg = -25; }), b: ld((u) => { u.terrain.slopeDeg = 10; u.terrain.headingDeg = -90; u.armDeg = 40; }),
    aLabel: "Bucket in carry position, 10° cross slope", bLabel: "Bucket fully raised",
    question: "Which has less sideways margin?", runDynamics: false, options: cmpOpts,
    answer: (A, B) => compare(A, B, lateral), inspect: "Raising follows an arc: height rises and reach changes. On a cross slope a higher CG moves the gravity line downhill." },
  { id: 12, title: "Full articulation on longitudinal versus cross slope", variable: "Heading",
    a: ld((u) => { u.articulationDeg = 40; u.terrain.slopeDeg = 12; u.terrain.headingDeg = 0; }), b: ld((u) => { u.articulationDeg = 40; u.terrain.slopeDeg = 12; u.terrain.headingDeg = 90; }),
    aLabel: "Full lock, facing up a 12° slope", bLabel: "Full lock, across the slope",
    question: "Which is closer to tipping?", runDynamics: false, options: cmpOpts, answer: (A, B) => compare(A, B),
    inspect: "Look at which axis becomes critical in each case." },
  { id: 13, title: "Uneven bucket filling", variable: "Lateral load offset",
    a: ld((u) => { u.armDeg = 20; u.terrain.slopeDeg = 6; u.terrain.headingDeg = -90; }), b: ld((u) => { u.armDeg = 20; u.load.lateral = -0.4; u.terrain.slopeDeg = 6; u.terrain.headingDeg = -90; }),
    aLabel: "Even fill", bLabel: "Material heaped 400 mm to the downhill side",
    question: "Which has less sideways margin?", runDynamics: false, options: cmpOpts, answer: (A, B) => compare(A, B, lateral),
    inspect: "Small lateral offsets of a heavy bucket load shift the combined CG noticeably." },
  { id: 14, title: "One wheel on an obstacle", variable: "Wheel elevation",
    a: fk((u) => { pallet(u, 1500); u.liftHeight = 3; }),
    b: fk((u) => { pallet(u, 1500); u.liftHeight = 3; const t = terrainFromGrades(0, -0.2 / 1.0); u.terrain.slopeDeg = deg(t.slopeAngle); u.terrain.headingDeg = deg(t.heading); u.trainerDemo = true; }),
    aLabel: "Level, load at 3 m", bLabel: "Left front wheel on a 200 mm obstacle",
    question: "Which is closer to tipping sideways?", runDynamics: true, options: cmpOpts, answer: (A, B) => compare(A, B, lateral),
    inspect: "The obstacle tilts the whole machine. A raised load magnifies the sideways shift of the gravity line.",
    note: "Simplified: the obstacle is represented as the equivalent cross slope (rise ÷ track). A per-wheel compliant contact model is planned." },
  { id: 15, title: "Axle oscillation reaching its stop", variable: "Cross slope",
    a: fk((u) => { u.load.preset = "none"; u.terrain.slopeDeg = 15; u.terrain.headingDeg = 90; u.trainerDemo = true; }),
    b: fk((u) => { u.load.preset = "none"; u.terrain.slopeDeg = 28; u.terrain.headingDeg = 90; u.trainerDemo = true; }),
    aLabel: "Empty, 15° cross slope", bLabel: "Empty, 28° cross slope",
    question: "In B, what happens at the rear axle?", runDynamics: false,
    options: [{ key: "free", label: "Axle stays free; three-point support" }, { key: "stop", label: "Chassis rolls onto the axle stop; a front wheel lifts" }, { key: "tip", label: "Machine tips" }],
    answer: (_A, B) => B.state.stability.status === "incipient-tipping" ? "tip" : B.state.stability.stage === "axle-free" ? "free" : "stop",
    inspect: "Look for the red 0 kN reaction on the lifted wheel and the four-point support outline." },
  { id: 16, title: "Turning with a raised bucket", variable: "Bucket height while turning",
    a: ld((u) => { u.articulationDeg = 30; u.armDeg = -25; u.manoeuvre = { ...u.manoeuvre, type: "turn", turn: "left", speedKmh: 12, radius: 6, duration: 3 }; }),
    b: ld((u) => { u.articulationDeg = 30; u.armDeg = 40; u.manoeuvre = { ...u.manoeuvre, type: "turn", turn: "left", speedKmh: 12, radius: 6, duration: 3 }; }),
    aLabel: "Turning at 12 km/h, bucket low", bLabel: "Same turn, bucket raised",
    question: "Which is closer to tipping?", runDynamics: true, options: cmpOpts, answer: (A, B) => compare(A, B),
    inspect: "The lateral inertial force acts at the CG height. Raising the bucket raises it." },
  { id: 17, title: "Sliding before tipping", variable: "Surface friction",
    a: fk((u) => { pallet(u, 1500); u.terrain.slopeDeg = 7; u.terrain.headingDeg = 180; u.trainerDemo = true; }),
    b: fk((u) => { pallet(u, 1500); u.terrain.slopeDeg = 7; u.terrain.headingDeg = 180; u.terrain.friction = 0.1; u.trainerDemo = true; }),
    aLabel: "7° downhill, dry concrete (μ 0.7)", bLabel: "Same, wet / oily surface (μ 0.1)",
    question: "What does the model predict for B?", runDynamics: false,
    options: [{ key: "within", label: "Holds position" }, { key: "slide", label: "Slides" }, { key: "tip", label: "Tips" }],
    answer: (_A, B) => B.state.stability.status === "incipient-tipping" ? "tip" : B.state.stability.slidingPredicted ? "slide" : "within",
    inspect: "Compare friction needed with friction available in the measurements table." },
  { id: 18, title: "Stable machine, unsecured load", variable: "Load restraint",
    a: fk((u) => { Object.assign(u.load, forkPreset("tall-stack")); u.load.secured = true; u.liftHeight = 0.3; u.tiltDeg = 0; u.manoeuvre = { ...u.manoeuvre, type: "brake", accel: 3.5, duration: 0.6 }; }),
    b: fk((u) => { Object.assign(u.load, forkPreset("tall-stack")); u.load.secured = false; u.liftHeight = 0.3; u.tiltDeg = 0; u.manoeuvre = { ...u.manoeuvre, type: "brake", accel: 3.5, duration: 0.6 }; }),
    aLabel: "Tall stack strapped to the carriage", bLabel: "Same stack unsecured",
    question: "In B, what happens to the load?", runDynamics: true,
    options: [{ key: "retained", label: "Stays on the forks" }, { key: "slides", label: "Slides" }, { key: "topples", label: "Topples off its base" }],
    answer: (_A, B) => B.retention.status === "toppling-predicted" ? "topples" : B.retention.status === "sliding-predicted" ? "slides" : "retained",
    inspect: "Check card 1: the machine status and the load status are reported separately." },
];
  return list;
};

export const has950f = () => Object.keys(LOADERS).some((k) => k.includes("950f"));
