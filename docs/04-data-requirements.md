# 4. Machine data requirements

Every parameter records **value, unit, source, status** (`manufacturer`, `measured`, `estimated`, `assumed`).

## Counterbalanced forklift

| Parameter | Why it matters | Typical source |
|---|---|---|
| Unladen mass and **mass distribution** (axle loads unladen, mast vertical, forks lowered) | Locates machine CG longitudinally | Spec sheet axle loads; or weigh each axle on pads |
| CG height (unladen) | Lateral stability, slope and cornering | Tilt-table or axle-lift method (measured); rarely published |
| Counterweight mass and CG | Largest stabilising moment | Service manual / manufacturer |
| Wheelbase, front and rear track | Support geometry | Spec sheet |
| Rear axle pivot height, oscillation angle, stop angle | Three-point support and stop transition | Service manual; measure |
| Tyre size and type, stiffness | Contact geometry; dynamic stage | Spec sheet; tyre data |
| Mast type, stages, max lift, free lift, tilt pivot location, tilt angles | Mast/carriage CG transforms | Spec sheet + drawing / measurement |
| Mast, carriage, fork, side-shifter and attachment masses and CGs | Moving masses | Manufacturer / weigh |
| Fork length, section, spacing; carriage offset (fork face to front axle) | Load centre → reach | Measure |
| **Capacity plate** (capacity vs load centre vs lift height, by attachment) | Compliance check | Data plate photo + manufacturer load chart |
| Operating restrictions (slope travel, travel height, attachment derating) | Restriction check | Operator manual, site rules |

## Articulated loader

| Parameter | Why it matters | Typical source |
|---|---|---|
| Operating mass and axle loads (straight, bucket carry position) | Machine CG | Spec sheet; weigh |
| Front/rear frame masses and CGs | Articulation effect | Manufacturer; estimate from axle loads at straight and full turn |
| Articulation joint position, max angle | Support reshaping | Spec sheet / measure |
| Rear axle oscillation pivot height and angle, stops | Stop transition | Service manual |
| Wheelbase split (joint to each axle), tracks, tyres | Support geometry | Spec sheet |
| Lift-arm pivot, arm length, linkage geometry, lift range | Bucket arc | Drawing / measurement |
| Bucket mass, CG, struck/heaped volume, width, fill centroid | Payload CG | Bucket data sheet |
| Counterweight / ballast options | Configuration-dependent | Manufacturer |
| **Static tipping load straight and full turn, with exact test configuration** (ISO 14397-1) | Validation target — **not** a permitted payload | Spec sheet |
| Rated operating load and basis | Compliance | Spec sheet / manual |

## Load data

Mass (measured or density × volume, with which one controls stated), dimensions, CG offsets (not
assumed at the geometric centre for tall/irregular loads), tare, restraint, base friction, angle of
repose for bulk materials.
