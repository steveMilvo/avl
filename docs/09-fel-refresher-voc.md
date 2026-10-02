# 9. Front end loader refresher VOC (WHSM)

Controlled framework **WHSM-PLT-VOC-FEL rev 1.0**, issued 2 October 2026. Review October 2027 or after
any front end loader incident.

The working assessment tool is [`voc/fel-refresher-voc.html`](voc/fel-refresher-voc.html): open it in a
browser. It holds the full item list, key points for every theory question, embedded videos, LoadLab lesson
links, automatic scoring, the next due date and a copyable assessment record. The draft is kept in that
browser only, so copy the record into the training register when the assessment is finished.

## Purpose

A refresher verification of competency (VOC) confirms that an operator who has already been trained still
operates a wheeled front end loader safely on this site. It is not initial training. An operator who cannot
produce the prerequisite evidence is referred to a full course.

## Structure

| Part | Content | Method | Critical items |
|---|---|---|---|
| A · Prerequisite evidence | Statement of Attainment, operating experience, previous VOC, induction and fitness for work, road licence if needed | Documents sighted | A1, A2, A4 (gate: Parts B–D are locked until these are C) |
| B · Theory and hazard knowledge | Stability and CG, carry position, articulation, traffic plan, blind spots and exclusion zones, ground conditions, slopes, powerline No Go Zones, other site hazards | Verbal or written questions with key points | B1, B2, B3, B5, B8 |
| C · Pre- and post-operational checks | Fluids, tyres, hoses, structure; seatbelt, brakes, alarms, ROPS/FOPS; controls and articulation lock; defect reporting and lock-out/tag-out; shutdown | Observed on the site machine | C3, C4, C6 |
| D · Observed practical performance | Three points of contact, seatbelt, speed and bucket height, material handling, separation from people, slopes, attachments, suspended loads, parking | Uninterrupted observation of real tasks | D2, D3, D5, D8 |
| E · Outcome and currency | Result, remediation plan, reassessment date, re-verification due date, early triggers, sign-off | Calculated, then confirmed by the assessor | — |

## Rules

- Each item is marked **C** (competent), **NYC** (not yet competent) or **N/A** (not part of this role).
  Every NYC needs an assessor note.
- A critical NYC in Part A means *not eligible for VOC*. Any other NYC means *not yet competent*: record
  gap training and a reassessment date, and the operator does not operate unsupervised until reassessed.
- Competent operators are re-verified every **24 months** from the assessment date. Book the refresher
  60 days before it falls due.
- Re-verify earlier after an incident or near miss, observed unsafe operation, more than 6 months without
  operating, a new loader model or size class, a new attachment or the start of suspended-load lifting,
  or a change of site or traffic plan.
- The VOC covers only the machine class and attachments recorded on it.

## Videos

The tool keeps a video library at the top of its script (`VIDEOS`). Each part shows the videos assigned to
it. A video plays inside the page when clicked, with a *Watch on YouTube* link as a fallback.

| Key | Topic | Status |
|---|---|---|
| `felSafety` | Front end loader safe operation (Parts B, C, D) | Assigned: `XfHU8jhqpVM` from 0:09, the reference video supplied with the brief |
| `preStart` | Pre-start walk-around for the site's machine | Awaiting WHSM approval |
| `traffic` | Separating people and mobile plant | Awaiting WHSM approval |
| `attachments` | Changing attachments with the fitted quick hitch | Awaiting WHSM approval |
| `suspended` | Lifting suspended loads with mobile plant | Awaiting WHSM approval |

To assign a video, set its `id` (the 11-character YouTube ID) and optional `start` in seconds. Add only
videos the WHSM owner has watched and checked against site procedures. Slots without an ID show an
*awaiting approval* placeholder with a search link.

## LoadLab

Part B lists the loader lessons in this repository's simulator that demonstrate the stability questions:
11 (bucket height), 10 (articulation), 12 (articulation and slope heading), 13 (uneven filling) and
16 (turning with a raised bucket). LoadLab results are illustrative only, as stated in `README.md`.

## Basis

- Occupational Health and Safety Act 2004 (Vic), s 21: information, instruction, training and supervision.
- Occupational Health and Safety Regulations 2017 (Vic), Part 5.1 Plant.
- WorkSafe Victoria, *Excavators used to lift and suspend loads*, applied to loaders used the same way.
- WorkSafe Victoria, framework for work near overhead and underground assets (No Go Zones).
- Resources Regulator NSW, *Operating mobile plant: verification of competency*.
- SafeWork NSW, *Farm machinery fact sheet* (ROPS and FOPS).
- Industry VOC guidance: Civil Safety, Riklan, TrainSafe, Pipeline Training.

A front end loader does not need a high risk work licence in Victoria. The VOC is an organisational
control under the WHSM, and the 24-month interval is industry practice adopted here, not a regulatory
interval. Check slope limits, rated lifting capacity and model-specific checks against the operator's
manual for the site's machine.
