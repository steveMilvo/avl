# LoadLab — Forklift and Front End Loader Stability Simulator

**by SiteReadyAI** · [sitereadyai.com.au](https://sitereadyai.com.au)

Interactive 3D training simulator for counterbalanced forklift and articulated front end loader
operators: winery warehouses, loading yards and bulk-material handling.

The trainer changes load, lift height, tilt, articulation, slope and movement. The app shows where the
centres of gravity go, which tipping axis applies, how wheel loads change, and — when the model says the
machine or load is unstable — a physics-driven tip-over with operator and load outcomes and a
slow-motion replay. No outcome is scripted; everything comes from the tested physics core.

> **Status: working prototype (stages 1–6 of 8).** All machine data is **generic or unverified draft
> data**. Results are illustrative only and are **not operating limits** for any real machine. An
> independent engineering review is required before any machine-specific quantitative training claim.

## Run it

```bash
pnpm install
pnpm dev            # opens the app at http://localhost:5173
pnpm test           # 75 physics benchmark and regression tests
pnpm build:single   # apps/web/dist-single/index.html — one file, double-click to open offline
```

Every CI run also publishes the single-file offline build as the `LoadLab-offline` artifact.
Recommended: Chrome or Edge on a laptop with a dedicated graphics card.

## What's in it

| Area | Highlights |
|---|---|
| Machines | Generic 2.5 t counterbalanced forklift · generic 1.5 m³ front end loader · **Caterpillar 950F draft** (unverified listing data, assumed mass split) |
| Modes | Explore · Guided lessons (18 scenarios: predict → run → inspect → explain) · Trainer comparison (A/B side by side, lockable variables) |
| Teaching overlays | Blue machine CG · orange payload CG · magenta combined CG · world-vertical gravity line · cyan inertial resultant · support outline · tipping axis with margin · tyre reactions · CG trail · baseline ghost |
| Results | Four separate verdicts: calculated stability · manufacturer capacity · operating restrictions · data confidence. No "SAFE" badge. "Operating limit not verified" when data is missing |
| Dynamics | Machines drive at the set speed, brake, pull away or turn on the set radius, with stability evaluated live; multi-stage rigid-body tip-over, load sliding/toppling off forks, bucket spill, operator seatbelt / no belt / jump, crush and entrapment zone, dust on impact. No blood or injury depiction |
| Playback | Run · pause · step · scrub · 1× to 0.05× · slow-motion replay of the tipping moment · cameras: orbit, side, front, rear, overhead, operator, tip view |
| Outputs | Engineering view · screenshot · HTML report · scenario export/import · saved presets |

## Repository layout

| Path | Purpose |
|---|---|
| `docs/` | Brief analysis, deployment decision, architecture, data requirements, model scope, validation, client decisions, trainer guide |
| `packages/physics/` | Physics core in TypeScript, separate from rendering. SI units, documented frames |
| `packages/physics/test/` | Analytical benchmarks and regression tests |
| `profiles/` | Versioned machine profiles. Every number carries unit, source and status |
| `scenarios/` | Reproducible scenario files |
| `apps/web/` | Three.js training application |
