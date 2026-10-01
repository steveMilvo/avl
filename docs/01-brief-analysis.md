# 1. Brief analysis

## What the brief actually asks for

The brief is a specification for an **engineering-grade teaching tool**, not a game. Its recurring
theme is *honesty of the model*: every visible effect must come from a calculation, every number must
carry provenance, and "upright in the simulation" must never be presented as "permitted".

Core deliverables, in priority order:

1. A physics core, separate from rendering, that computes combined CG, support geometry, tipping axes,
   reactions and moments for a forklift (three-point support with oscillating rear axle) and an
   articulated loader (multibody, oscillating axle, articulation joint).
2. Live CG display (blue machine / orange payload / magenta combined), world-vertical gravity line,
   support polygon, ghost baseline and trail.
3. Three modes: Explore, Guided lessons (predict → run → inspect → explain), Trainer comparison
   (side by side, one variable changed).
4. 18 named training scenarios, with the articulated-loader slope comparison built first.
5. Separate verdicts: physics stability, manufacturer capacity, operating restrictions, data confidence.
6. Validation against analytical benchmarks; documented limitations; independent engineering review gate.

## Points of tension in the brief (and how this build resolves them)

| Tension | Resolution |
|---|---|
| "Unreal Engine style" graphics vs. classroom computers of unknown spec | See `02-deployment.md`. Recommend browser (Three.js/WebGL2, PBR) first; keep the physics core engine-agnostic so a later Unreal front end can reuse it unchanged. **Needs client confirmation.** |
| "Engaging, realistic outcomes when loads are dangerous" (client request) vs. "no scripted tipping animations" | Consequences are animated *from the model*: once the model reports incipient tipping, a rigid-body dynamic stage takes over (rotation about the reported tipping axis under gravity + inertia, contact with ground, load release when retention fails). Visual severity (dust, impact, load spill, sound) is driven by computed impact speed and energy. No pre-baked "crash" clip. A clear on-screen label distinguishes "model prediction" from "illustrative consequence beyond model scope" (e.g. cab crush, injury). |
| High-fidelity dynamics vs. transparent, testable physics | Two layers: (a) static/quasi-static analytic evaluator (done, fully tested) that drives overlays and explanations; (b) fixed-timestep multibody dynamics for transients (stage 5–6) whose static limit must agree with (a) — that agreement is itself a test. |
| Real manufacturer data vs. availability | Generic profiles first, labelled "Generic educational profile — results illustrative only". Manufacturer catalogue designed in but not populated. |
| Granular / liquid slosh | Labelled simplified: angle-of-repose spill check for buckets; IBC slosh as a documented pendulum-equivalent model (stage 6), never presented as CFD. |

## What is *not* in scope for release 1

Accounts, subscriptions, LMS integration (designed for, not built), operator competency assessment,
certification claims, manufacturer-specific quantitative claims before engineering review.
