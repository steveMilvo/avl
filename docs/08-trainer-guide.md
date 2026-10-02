# 8. Trainer guide

## Before the session

- Open the app in Chrome or Edge (or double-click the offline `index.html`). Press F11 for full screen on a projector.
- Pick the machine in the top bar. The badge under the machine name states its data status.

## Explore

1. Set the load, the mast or bucket position, the terrain and any movement in the left panel.
2. Press **Set baseline** (Trainer section) before a change. The magenta wireframe ghost marks where the
   combined CG was, and the right panel lists what changed in **Explain this change**.
3. In **Movement**, choose *Drive, then brake*, *Pull away* or *Drive, then turn*, and set the speed,
   braking rate or turn radius (the loader's turn radius comes from its articulation angle).
4. Press **▶ Run simulation**. The machine drives across the yard at that speed, the camera follows it,
   and the readout shows speed, g-forces, turn radius and the critical tipping axis live. The dashed
   yellow line is the path it took.
5. Press **🎬 Replay tipping moment** for a slow-motion replay from the tip view camera.
6. Use **Step** and the scrubber to stop on a frame and explain it.

## Reading the right panel

| Card | Meaning |
|---|---|
| 1 · Calculated stability | What the physics model predicts for these exact conditions |
| 2 · Manufacturer capacity | Whether the load is within the entered capacity data. "Operating limit not verified" means the data needed is missing |
| 3 · Operating restrictions | Whether entered restrictions (slope, travel height) or profile limits are breached |
| 4 · Data confidence | How many numbers come from the manufacturer, measurement, estimate or assumption |

Staying upright in the simulator is **never** permission to do the task.

The educational band "approaching a modelled stability boundary" means the critical margin is less than
20 % of the distance from the support's centre to that edge. It is not a probability.

## Guided lessons

Pick a lesson, let learners choose a prediction, then press the run button. The verdict is read from the
model. If the model disagrees with the expected teaching point for a particular machine, the model is
shown, not the expectation.

## Comparison

**Trainer comparison** shows A (baseline) and B (current) side by side. Lock the variables you are not
testing (🔒 next to each control). The panel warns when more than one variable differs.

## Trainer demonstrations

Tick **Trainer demonstration outside profile limits** to go beyond the machine's slider limits. A red
banner shows on screen, and card 3 reports the breach.

## Outputs

**Screenshot**, **Report** (HTML with results, model version and data sources), **Export scenario**
(JSON with the machine profile, assumptions and inputs, re-loadable with **Import scenario**).
