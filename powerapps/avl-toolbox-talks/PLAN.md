# Plan — AVL Toolbox Talks app (Buronga)

Staff open the **Toolbox** tile on the Buronga AVL main board **on their own AVL phone**, confirm their
**AVL ID**, read the information for the current toolbox meeting, and sign the **"read and understood"
declaration** with a drawn signature. Their name and signature go **straight into that meeting's group
spreadsheet**, one row per person with the signature embedded as a picture. The spreadsheet lives **in
that toolbox talk's dated folder on the intranet**.

People who missed the meeting use exactly the same steps for **7 days** afterwards. They read the same
information and sign the same declaration, and the spreadsheet shows they signed after the meeting.

When the 7 days are up, the sheet is saved as a **PDF in the same dated folder**. Steve uploads that PDF
to **WHS Monitor as the sign-off evidence**.

**Rollout:** Cellar staff first, then Maintenance and Lab staff (add them to the people list with their
team; nothing else changes).

It uses the same build method as the AusGrape Packing Supplies app (SharePoint lists, Power Apps canvas,
Power Automate, standard licences), so it can be handed to Cowork the same way.

## 1. How it works

```
 Intranet (already in use)                Staff member (own AVL phone)               Automatic
 ─────────────────────────                ────────────────────────────               ─────────
 Toolbox meeting scheduled                                                           Flow 1 (each morning):
 + its dated folder, e.g.                                                            finds today's meeting, copies
 Managers Toolbox Meeting/<dated folder>/ ────────────────────────────────────────► the sign-off template INTO the
   ├ Hearing protection.pdf                                                          dated folder, fills in the
   └ (talk files)                                                                    meeting details, lists the
                                                                                     folder's files for the app
                                          Main board → Toolbox tile
                                          AVL ID + name shown → confirm
                                          Today's toolbox opens: details + the
                                          talk files from the dated folder
                                          Tick: "I have read and understood…"
                                          Draw signature → SIGN
                                                   │
                                                   ▼
                                          TBX Signatures (one row per person) ──────► Flow 2: adds the person's row
                                                                                      and signature picture to the
                                          Missed it? Same steps, any time in          spreadsheet in the dated folder
                                          the next 7 days → "Read after meeting"      (within about a minute)

                                                                                      Flow 3 (day 7): final check,
                                                                                      saves the PDF in the dated
                                                                                      folder, emails Steve the link
                                                                                              │
                                                                                              ▼
                                                                  Steve uploads the PDF to WHS Monitor → marks "Uploaded"
```

Each dated folder ends up holding the talk files, `Toolbox sign-off - 2026-11-03 - Hearing
protection.xlsx`, and the matching `.pdf`.

## 2. Where the data lives

| Item | One row per | Main columns |
|---|---|---|
| **Intranet toolbox schedule + dated folders** *(existing, read-only for the app)* | meeting | date, topic, presenter, the talk files in the folder |
| **TBX Meetings** (new list, filled by Flow 1) | toolbox meeting | Meeting ID (Title, unique, e.g. `TBX-2026-12-10`), Topic, MeetingDate, Team (`All`; staff teams are Cellar now, Maintenance and Lab later), Presenter, Location, FolderUrl, Files (name + link of each talk file), OpenUntil (= MeetingDate + 7 days), Status (Open · Closed · Uploaded to WHSM), SheetUrl, PdfUrl, WHSMRef |
| **TBX Signatures** (new list) | person × meeting | Record key (Title, unique = `MeetingID\|AVLID`), MeetingID, Name, AVLID, Team, Declaration (the exact wording signed), Signature (Note, base64 PNG), SignedAt, SignedWhen (At meeting · Read after meeting, set by date), QuestionsRaised (Note), SignedInEmail (the phone's AVL login), InSheet (Yes/No, set by Flow 2) |
| **TBX People** (new list) | staff member | Name (Title), AVLID (unique), Email, Team (Cellar · Maintenance · Lab), Role (Staff · Admin), Active. *(Can be shared with the AusGrape app.)* |
| **TBX Questions** (new list) | question | Question ID, MeetingID, Topic, PersonName, AVLID, Email, Question, AskedAt, AskedFrom, QStatus, ForwardedTo, Answer |
| **TBX Settings** (new list) | setting | SheetMap (template layout), TemplateMatch, FolderPath, OpenDays (7), Declaration, AdminEmail |
| `TBX-SignOff-Template.xlsx` | — | fallback AV-logo template (`template/`), kept in `Managers Toolbox Meeting/_Templates`, used only if a dated folder has no template |

The unique `MeetingID|AVLID` key means each person signs each meeting once. Version history is on for
every list.

## 3. App screens

| Screen | Who | What it does |
|---|---|---|
| **Sign in** | all | The phone's AVL login finds the person in TBX People and pre-fills their AVL ID and name; they confirm it. If they type an AVL ID instead, it must belong to that login, so no one can sign as someone else. Unknown people see "see your supervisor". |
| **Current toolbox** | all | Opens straight onto today's (or the latest open) meeting for their team: topic, date, presenter, and a button for **each file in the dated folder** (PDF, slides, video link). If they've already signed: "Signed 03/11 07:42 ✓". Below it: **other toolboxes from the last 7 days you haven't signed**, so people who missed one can catch up. |
| **Declaration & sign** | all | The declaration in full, with a required tick: *"I have read and understood the information in this toolbox talk, I have had the opportunity to ask questions, and I will follow the controls described."* Signature pad, optional questions or concerns (dictation mic), then **SIGN**. The button stays off until the tick is on and something is drawn. |
| **Sign-off status** | admin (Steve) | Each meeting: who has signed and who in the team hasn't, days left, links to the sheet, PDF and dated folder · **Close now** / **Extend** · **Mark uploaded to WHSM** (with WHSM reference) |

Signature capture follows the method proven in the BHW Tank QR app: `PenInput` →
`JSON(pen.Image, JSONFormat.IncludeBinaryData)` → stored as text in the Signature column. Keep the pad
about 560 × 180 so each signature stays small, and check the stored length in testing.

**Sign-in:** everyone signs on their own AVL phone, already logged in to their AVL Microsoft account.
The record stores both the AVL ID and the phone's login email, so the record shows the signature came
from that person's own device.

## 4. The sign-off spreadsheet and PDF

Power Automate's normal Excel actions only write text, so the pictures are placed by **Office Scripts**,
run from the flows with *Excel Online (Business) → Run script*:

- `office-scripts/SignOffSheet.ts` writes into **the template that is already in each dated folder** (a
  copy named `Toolbox sign-off <date>.xlsx` is made, so the original stays clean). The template's layout
  (which row people start on, and which column is Name, AVL ID, Signature and so on) is described once in
  the `SheetMap` setting, so the script fits the existing template without changing it. Actions:
  `heading` (fill the meeting details), `append` (one signer, as they sign) and `rebuild` (the whole
  table at close, if any row failed). If a dated folder has no template, the AV-logo template
  (`template/TBX-SignOff-Template.xlsx`) is used instead.

**Layout** (laid out to print or save as an A4 landscape PDF):
- **Heading block:** AV logo, *Toolbox Talk Sign-off*, topic, date, presenter, location, team.
- **Declaration:** the full wording, printed once above the table.
- **Table:** No. · Name · AVL ID · Team · Signed when (At meeting / Read after meeting) · Date & time ·
  Signature.
- **Footer:** *"Signed electronically in the AVL Toolbox app. Record: <Meeting ID>. Generated <date>."*

The template marks where the table starts with a defined name `TableStart`, and has named cells
(Topic, MeetingDate, Presenter, Location, Team, Declaration, MeetingID) for the heading block, which the
scripts fill in. The pictures move and size with their cell, so printing keeps each signature beside its name. The PDF
is made by copying the sheet to the flow owner's OneDrive, using OneDrive *Convert file* → PDF (the
signatures show), and saving the PDF into the dated folder.

## 5. Flows (standard connectors only)

| Flow | Trigger | Does |
|---|---|---|
| 1 · TBX - Open today's meeting | daily, 5:00 am | Reads today's meeting from the intranet schedule and its dated folder · creates the TBX Meetings row (OpenUntil = +7 days, the folder's file links) · copies the template into the dated folder as `Toolbox sign-off - <date> - <topic>.xlsx` and fills in the heading. It can also run on demand from the admin screen for a meeting added late. |
| 2 · TBX - Add signature to sheet | TBX Signatures item created | Runs SignOffSheet `append` on that meeting's sheet, then sets InSheet = Yes. **Concurrency control on, degree 1**, so when the whole crew signs at once the rows go in one at a time and never clash. |
| 3 · TBX - Close meeting | daily, 6:00 pm (closes meetings past OpenUntil) or **Close now** in the app | Rebuilds the sheet if any row has InSheet = No · saves the PDF in the dated folder · Status = Closed · emails Steve: *"Toolbox <topic> <date> closed: 14 of 16 Cellar staff signed (2 read after). PDF: <link>. Not signed: …"* |
| 4 · TBX - Reminders | daily, 6:30 am | Teams message to Cellar staff with today's toolbox and the app link · on days 3 and 6, a Teams nudge to anyone in the team who hasn't signed |

## 6. Admin settings needed (IT, one-off)

- **Office Scripts** must be allowed for the tenant (Microsoft 365 admin centre → Settings → Office
  Scripts) so flows can run the scripts.
- The flow owner (Steve or an L&D service account) needs edit rights on the *Managers Toolbox Meeting*
  folder, to create the sign-off sheet and PDF in each dated folder. Everyone on the intranet can already
  read the folder, so staff can open the talk files from the app.

## 7. Build phases (each one is a Cowork hand-off, like the AusGrape plan)

1. Find the intranet schedule and the dated folders · create the 3 lists · build the sign-off template
   and put it in `Managers Toolbox Meeting/_Templates` · Steve adds the Cellar staff to TBX People by hand.
2. App: Sign in, Current toolbox, Declaration & sign. Test on two Cellar staff members' own AVL phones.
3. Flows 1–3 plus the Office Scripts. Test with a test meeting folder: 3 people sign at once and 1 signs
   the next day. Open the xlsx and check every signature is in the right row. Close it and check the PDF
   in the dated folder. Upload the PDF to WHS Monitor once as a trial.
4. Sign-off status screen and reminders flow. Publish, add the **Toolbox** tile to the Buronga AVL
   main board.
5. Later: add the Maintenance and Lab staff to TBX People. Their meetings flow through automatically
   once their schedules and folders follow the same pattern.

## 8. Decisions (confirmed 28/10/2026)

| Item | Decision |
|---|---|
| WHS Monitor | No import template. The meeting's sign-off sheet is saved as a **PDF** and uploaded as the sign-off evidence. |
| Declaration | *"I have read and understood the information in this toolbox talk, I have had the opportunity to ask questions, and I will follow the controls described."* |
| Late sign-off | 7 days after the meeting, then auto-close |
| Meetings | Already scheduled on the intranet. Each talk has a **dated folder**; the sign-off sheet and PDF are saved in it. |
| Staff | Cellar first, then Maintenance and Lab |
| Device | Each person's own AVL phone |
| Speech to text | Questions can be spoken, the same way as the cleaning app (Cowork checks how it does this and copies it). |
| Questions | **Ask a question** button on each toolbox, plus the question box when signing. Each question is emailed to Steve with the asker as reply-to; Steve answers or forwards it to the meeting leader. Logged in TBX Questions. |
| Folder names | `yyyy-MM-dd` (e.g. `2026-12-10`), roughly monthly. The meeting date is read from the folder name. |
| Template | Already in each dated folder. The app writes into a copy of it. |
| Folder access | Everyone on the intranet can open it; staff read the files through the app. |
| Intranet folder | Buronga Hill Winery site → Documents → **Managers Toolbox Meeting** (one dated folder per meeting): https://australianvintagecomau.sharepoint.com/sites/australiawinemakingburongahillwineryUserCreated/Shared%20Documents/Managers%20Toolbox%20Meeting |
| App lists | On the same Buronga Hill Winery site, so one set of permissions covers the folders and the lists |
| Logo | AV monogram (`assets/av-logo.png`), in the template heading |
| Staff list | Steve adds people to TBX People by hand (name, AVL ID, email, team) |

## Still needed (Cowork checks these in build phase 1)

1. The template's layout in a dated folder: its file name (which sets `TemplateMatch`), the sheet name,
   the first sign-on row, and which column holds Name, AVL ID, Team, Date and Signature.
2. Where the topic comes from (template heading, file name, or the presenter guide).
3. Steve's AVL work email, for the close-of-meeting email and questions (`AdminEmail`).
4. The existing *BHW Toolbox Talk Sign-on QR.pdf* in the folder gets replaced with a QR code for the new app.

---

## 9. Other compliance apps worth building on the same platform

Ranked by risk reduction and audit value at a winery site. Each reuses the people list, AVL ID +
signature sign-off, and the WHS Monitor export pattern.

| # | App | Why it matters at Buronga | Core features |
|---|---|---|---|
| 1 | **Plant pre-start checks** (forklift, front end loader, EWP, telehandler) | Daily pre-starts are a legal duty and are often paper. It ties in with the LoadLab stability training. | QR code on each machine → checklist → any "fail" locks the machine as **Out of service** and alerts maintenance by Teams. Checks the operator holds a current licence (see #2). Monthly compliance % per machine. |
| 2 | **Licence and competency register** | HRW licences (LF forklift), VOCs, first aid, confined space, and inductions expire without anyone noticing. | Each person's tickets with expiry dates and a photo of the card. Email at 60 / 30 days, Teams at expiry. Pre-start and permit apps refuse an expired operator. |
| 3 | **Hazard and near-miss reporting** | Fewer reports go unmade when it takes 30 seconds on a phone. | Photo, location (QR by area), what happened, immediate action. Routed to a supervisor, with corrective actions tracked to close. Export to WHS Monitor. |
| 4 | **Tank entry / confined space and hot work permits** | Tank entry during vintage is the site's highest-consequence task (CO₂, SO₂). Ties in with the Tank QR app. | Permit with gas test readings, isolations, standby person, rescue plan and time limits. Signatures from issuer, entrant and standby. Auto-close and an overdue alert if not signed off. |
| 5 | **Contractor and visitor sign-in** | Who is on site, inducted and insured, and knowing who is on site in an emergency. | Sign-in by QR at the gate. Checks the WHS Monitor induction is current and insurance hasn't expired. Live **on-site list for evacuation** roll call. |
| 6 | **Workplace inspections and emergency equipment checks** | Monthly fire extinguisher, first aid, eyewash and spill kit checks are usually missed or kept on paper. | QR on each item → quick check → photo if faulty → corrective action. Overdue list per area. |
| 7 | **Chemical register / SDS lookup** | Fast SDS access for SO₂, caustic, acids and dry ice is a WHS requirement. | QR in each chemical store → SDS PDF, PPE and first aid steps. Register of quantities stored. |

Suggested order after Toolbox: **#2 Licences → #1 Pre-starts → #3 Hazards**. The licence register is the
data the other two check against.
