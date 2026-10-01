# 6. Validation plan

## Definition of "accurate" (proposed, to be agreed)

- **Analytic tier:** static results match independent hand calculations to 1e-6 relative (achieved,
  `packages/physics/test`).
- **Machine tier:** for a manufacturer profile, predicted straight and full-turn static tipping loads
  reproduce the published ISO 14397-1 values within ±5 %, *with the stated test configuration
  reproduced*, before calibration. Discrepancies are reported, not tuned away.
- **Dynamic tier:** timestep halving changes peak tilt and tipping onset time by < 2 %; static limit of
  the dynamic model agrees with the analytic evaluator within 1 mm margin.

Matching one tipping value does not validate slope, articulation or dynamic behaviour generally.

## Current benchmark coverage (47 tests)

Mass accounting and units; rotation sign conventions; terrain decomposition; resultant line of action;
forward tipping load vs closed-form moment balance; tilt geometry; slope shift = h·tan θ; braking
shift = h·a/g with unchanged mass centre; reaction force and moment balance; stop engagement as a rigid
rotation; loader arm arc; articulation transforms; loader tipping load by bisection vs closed form;
load sliding and toppling on forks; bucket spill; capacity lookup; limit enforcement.

## Standards to verify (not yet verified — do not cite as requirements)

- ISO 14397-1 — earth-moving machinery, loaders: rated operating load and tipping load.
- ISO 22915 series — industrial trucks, verification of stability.
- AS 2359 series — powered industrial trucks (Australia).
- Safe Work Australia / state WHS regulations and codes of practice on forklifts and mobile plant.

Current editions and scope must be confirmed before any claim. No certification is implied.

## Review gate

Machine-specific quantitative claims require independent engineering review before release; the
profile's `releaseStatus` records that.
