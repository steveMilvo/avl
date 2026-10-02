# 6. Validation

## Definition of "accurate"

- **Analytic tier:** static results match independent hand calculations to 1e-6 relative. *Achieved.*
- **Dynamic numerical tier:** energy conserved to 0.2 % between tip start and first impact; strike
  time and angle change < 1 % when the timestep is quartered; a single-mass inverted pendulum matches
  the closed-form energy result to 0.1 %. *Achieved.*
- **Machine tier:** for a manufacturer profile, predicted straight and full-turn static tipping loads
  reproduce published ISO 14397-1 values within ±5 %, with the stated test configuration reproduced
  and before calibration. *Not yet possible: no verified manufacturer data.*

Matching one tipping value does not validate slope, articulation or dynamic behaviour generally.

## Test coverage (73 tests, `pnpm test`)

Mass accounting and units · rotation sign conventions · terrain decomposition · resultant line of
action · forward tipping load vs closed-form moment balance · tilt geometry · slope shift = h·tan θ ·
braking shift = h·a/g with unchanged mass centre · reaction force and moment balance · stop engagement
as a rigid rotation · loader arm arc · articulation transforms · loader tipping load by bisection vs
closed form · load sliding, tine restraint and toppling · bucket spill · capacity lookup · limit
enforcement · dynamics energy, convergence and pendulum benchmarks · outcome logic.

## Cat 950F draft comparison

| Quantity | Model (draft profile) | Listed (unverified third-party) |
|---|---|---|
| Static tipping load, straight | 11,000 kg | 10,543 kg (straight or turned not stated) |
| Static tipping load, full turn (40°) | 9,430 kg | not found |

The 4 % agreement is **coincidental**. The component masses and CGs are assumed, split only to sum to
the listed operating weight, and were not tuned to this value. The listed figure's bucket, tyres and
test standard are unknown. This is not validation.

## Standards to verify (not cited as requirements)

ISO 14397-1 (loaders: rated operating load, tipping load) · ISO 22915 series (industrial truck stability)
· AS 2359 series (powered industrial trucks) · Safe Work Australia and state WHS regulations and codes
of practice. Current editions and scope must be confirmed before any claim. No certification is implied.

## Review gate

No engineering reviewer is currently available (client decision). Therefore no profile may be set to
`released-for-training`, and every quantitative result stays labelled illustrative.
