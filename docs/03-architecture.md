# 3. Architecture

```
profiles/*.json  ──►  resolveDatums()  ──►  ForkliftProfile / LoaderProfile (SI)
                                                  │
inputs (lift, tilt, articulation, payload, ──►  evaluateForklift / evaluateLoader
        terrain, acceleration)                    │   geometry: frames, CG transforms
                                                  │   components: MassComponent[]
                                                  ▼
                                         evaluateStability()   (shared, staged support model)
                                                  │
              ┌───────────────────────┬──────────┼─────────────┬──────────────────┐
              ▼                       ▼          ▼             ▼                  ▼
     retention (load)        compliance    explainChange   tyre reactions   [stage 5] dynamics
     slide / topple / spill  plate, ROL,   facts → text                      fixed-step multibody
                             restrictions
                                                  │
                                                  ▼
                                   renderer + overlays (stage 5, draws only)
```

The renderer never computes physics. Overlays read model outputs only.

## Coordinate conventions

- SI units internally: m, kg, s, rad, N, N·m.
- **Ground frame** (per machine): origin at the front axle centre (forklift) or articulation joint
  (loader) at ground level; **x forward, y left, z normal to the local ground plane**. Right-handed.
- **World frame**: Z vertical up, X = horizontal uphill direction of the slope.
- `heading` = angle of machine forward axis from uphill, anticlockwise from above: 0 uphill, π downhill,
  +π/2 across with uphill on the machine's right.
- Gravity is expressed in the ground frame via `gravityDirInGroundFrame(terrain)`; it is always
  world-vertical. The gravity line on a slope is therefore *not* perpendicular to the ground.
- Rotations: `rotY(+a)` tips +z toward +x (mast forward); back tilt is `rotY(−tiltBack)`.
  `rotZ(+a)` turns the nose left (loader articulation positive = left).
- grade (%) = 100 × tan(slope angle).

## Support model (shared by forklift and loader)

One rigid axle + one oscillating axle with a longitudinal pivot and symmetric mechanical stops:

- **Axle free:** support triangle = rigid-axle tyre contacts + oscillation pivot (a 3D point above the
  ground). Tipping axes are 3D lines; margins are measured in the plane of the triangle.
- **Stop engaged:** when the resultant crosses a pivot edge, the chassis is rotated rigidly about that
  edge until its roll relative to the axle equals the stop angle. The far rigid-axle tyre is lifted
  (reaction exactly 0). Support becomes the near rigid tyre + both oscillating-axle tyres. The
  evaluation is repeated on the rolled geometry. The rectangle of four contacts is **never** assumed.
- Forklift: rigid = front drive axle, oscillating = rear steer axle.
- Loader: rigid = front axle on the front frame (rotated by articulation), oscillating = rear axle on
  the rear frame. Articulation therefore reshapes the support triangle, which is how full-lock
  instability emerges — it is not hard-coded.

## Results kept separate

1. `stability.status`: within / approaching / incipient tipping / lift-off / sliding predicted.
2. `compliance.status`: within manufacturer limit / exceeded / **operating limit not verified**.
3. `compliance.restriction`: within / breached / not assessed.
4. `dataConfidence`: counts of manufacturer / measured / estimated / assumed datums and release status.

"Approaching" uses a documented educational band: critical margin < 20 % of the centroid-to-edge
distance of the active support polygon. It is not a probability of an accident.

## Mass centre vs. force line

- `cg` / `cgUnrolled` — the actual mass centre. Braking never moves it.
- `gravityEval` — gravity-only line of action (drives the magenta gravity line).
- `resultantEval` — gravity + quasi-static inertial force (drives status during manoeuvres; drawn as
  a separate resultant line).
