# 5. Model scope (current version: 0.1.0-static-quasistatic)

## Implemented and tested

- Combined CG from component masses with live frame transforms (mast tilt, lift, side shift,
  arm arc, bucket curl, articulation).
- World-vertical gravity on arbitrary slope and heading; longitudinal/cross grade conversion.
- Staged oscillating-axle support with stop engagement, chassis roll, lifted-wheel reporting.
- Margins and stabilising/overturning moments about every candidate tipping axis, per component.
- Ground-normal tyre reactions (statically determinate with the axle pivot condition).
- Sliding check (required vs available friction).
- Quasi-static inertial loading (braking, acceleration, cornering as a lateral acceleration) — kept
  separate from the mass centre.
- Load retention on forks (slide, backrest restraint, topple on base) and bucket spill (angle of
  repose, simplified).
- Capacity plate lookup and rated-operating-load checks; "Operating limit not verified" when absent.
- Data confidence summary.
- "Explain this change" built from computed differences.

## Not yet implemented (planned)

- Fixed-timestep multibody dynamics for transient tipping, tyre compliance, uneven ground per wheel,
  load shifting in motion, and the visual consequence stage (stage 5–6). Its static limit must match
  the analytic evaluator.
- Inertia tensors (needed by the dynamic stage).
- IBC liquid slosh (pendulum-equivalent, labelled simplified).
- Per-wheel obstacle elevation (scenario 14) — requires the dynamic/compliant contact stage.

## Known simplifications

- Tyres are rigid point contacts in the static evaluator.
- Load on forks: rigid box, single friction coefficient.
- Bucket material: rigid body with angle-of-repose spill criterion, no flow.
