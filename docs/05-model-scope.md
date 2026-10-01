# 5. Model scope (physics model 0.1.0)

## Static and quasi-static (drives the overlays and the four verdicts)

- Combined CG from component masses with live frame transforms: mast tilt, lift, side shift, loader arm
  arc, bucket curl, articulation.
- World-vertical gravity on any slope and heading; longitudinal/cross grade conversion.
- Oscillating-axle support with stop engagement: the chassis rolls rigidly until the stop engages, a
  rigid-axle wheel lifts, and the support polygon changes. The four-tyre rectangle is never assumed.
- Margins and stabilising/overturning moments about every candidate axis, per component.
- Ground-normal tyre reactions from force and moment balance plus the axle-pivot condition.
- Sliding check: friction needed vs available.
- Quasi-static inertial loading for braking, acceleration and cornering. Kept separate from the mass
  centre (cyan resultant line vs magenta gravity line).
- Load retention on forks: sliding along the forks, backrest restraint, tines in pallet pockets prevent
  sideways sliding, toppling over the tine span, the fork tips or the load's rear edge.
- Bucket spill: angle of repose against the resultant (simplified granular model, no flow).
- Capacity plate lookup and rated-operating-load check; "Operating limit not verified" when absent.

## Dynamic (Run simulation)

- Rigid-body rotation about the critical support edge, RK4, 1 ms fixed step.
- Plastic return to the original support (machine drops back onto its wheels).
- **Multi-stage contact:** when a structural point strikes the ground, the impact is plastic and the
  machine continues about the edge of the new contact triangle that the resultant lies outside, with
  angular velocity from conservation of angular momentum. If the resultant lies inside, it comes to rest.
- Unsecured load release from the same fork check, including the body's rotational acceleration;
  separated masses fly ballistically.
- Operator: belted (stays in the seat), unbelted (slides out of an open-sided forklift when seat friction
  is exceeded; stays inside a closed loader cab), or jumps after a 0.4 s reaction time at 2.5 m/s
  (assumed values). Entrapment zone = ground footprint of structure lying within 0.8 m of the ground at
  the final pose.
- Outcomes are reported as mechanical facts: tilt, impact speeds, fall height, position relative to the
  structure. No injury prediction or depiction.

## Not modelled (labelled in the app)

- Tyre compliance, per-wheel obstacles (lesson 14 uses an equivalent cross slope), contact sliding,
  bouncing, structural deformation, ROPS/FOPS integrity.
- Liquid slosh in IBCs (mass and CG height follow the fill level; no slosh dynamics).
- Bulk material flow (spill is a ballistic particle effect from the released mass).
- Human body dynamics (the operator is a point mass with an animated figure).
- Travel itself: movement enters through its acceleration. The machine does not drive across the ground.
