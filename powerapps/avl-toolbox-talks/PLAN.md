# Plan — AVL Toolbox Talks app (Buronga)

A phone and tablet app where staff open the scheduled toolbox talk, read or attend it, and sign off with
their AVL ID and a drawn signature. Each session produces **one Excel sheet of every attendee with their
signature embedded**, ready for bulk upload to **WHS Monitor**. It uses the same build method as the
AusGrape Packing Supplies app (SharePoint lists + Power Apps canvas + Power Automate, standard licences),
so it can be handed to Cowork the same way.

## 1. How it works

```
 Supervisor / L&D                   Staff (own phone or shared tablet)          Automatic
 ─────────────────                  ─────────────────────────────────          ─────────
 Schedule talk ──► TBX Sessions ──► "Today's toolbox" on the Home screen
 (topic, date, team,               Open talk → read content / slides / video
  content PDF or video)            Choose: Attended  or  Read (absent on the day)
                                   Tick "I have read and understood"
                                   AVL ID + draw signature → Sign
                                          │
                                          ▼
                                   TBX Attendance (one row per person per talk)
                                          │
 Close session ──────────────────────────►┤  Flow: copy the Excel template,
                                          │  write every attendee row and embed
                                          │  each signature picture in its cell,
                                          │  save a PDF copy, then email the
                                          │  supervisor both links
                                          ▼
                                   TBX Exports library: TBX-2026-11-03-Hearing-protection.xlsx / .pdf
                                          │
                                          ▼
                                   Uploaded to WHS Monitor (bulk upload) → mark "Uploaded" in the app
```

## 2. SharePoint lists (on the AustralianVintage site)

| List / library | One row per | Main columns |
|---|---|---|
| **TBX Sessions** | scheduled talk | Session ID (Title, unique, e.g. `TBX-2026-11-03-01`), Topic, TalkDate, StartTime, Location, Team (Cellar / Packaging / AusGrape / Maintenance / All), Presenter, PresenterEmail, Summary (Note), ContentUrl (PDF or video link), KeyPoints (Note), ReadWindowDays (default 7), Status (Scheduled · Open · Closed · Exported · Uploaded to WHSM), ExportXlsxUrl, ExportPdfUrl, WHSMRef, ClosedBy, ClosedAt |
| **TBX Attendance** | person × talk | Record key (Title, unique = `SessionID\|AVLID`), SessionID, AttendeeName, AVLID, Email, Team, Company (for contractors), AttendanceType (Attended · Read), Understood (Yes/No), Signature (Note, base64 PNG), SignedAt, RecordedByEmail (device login), QuestionsRaised (Note) |
| **TBX People** | staff member | Name (Title), AVLID (unique), Email, Team, Role (Staff · Presenter · Admin), Active. *(Can share one people list with the AusGrape app instead of keeping two.)* |
| **TBX Content** (document library) | talk material | PDF slides and handouts, linked from TBX Sessions |
| **TBX Exports** (document library) | exported sheet | the template `TBX-Attendance-Template.xlsx`, plus every generated `.xlsx` and `.pdf` |

All lists have version history on. Every filtered column is indexed. The unique `SessionID|AVLID` key
means a person can only sign each talk once (re-signing updates their row and keeps the old version).

## 3. App screens

| Screen | Who | What it does |
|---|---|---|
| **Home** | all | Today's toolbox for my team · upcoming talks · talks I still need to read · my history |
| **Talk** | all | Topic, presenter, summary, key points, **Open slides / video** button |
| **Sign off** | all | Attended / Read · "I have read and understood this toolbox talk" tick (required) · AVL ID (pre-filled; works on a shared tablet) · name shown for checking · **signature pad** · questions or concerns raised (iOS dictation mic) · **Sign** |
| **Kiosk sign-on** | presenter | For a crew signing on one tablet: after each signature the form clears for the next person, and a live count is shown |
| **Roll** | presenter, admin | Who has signed, plus who in the team hasn't · remind button |
| **Schedule** | presenter, admin | Create or edit a talk, attach content, open it for signing |
| **Close & export** | presenter, admin | Closes the talk and runs the export flow · shows the Excel and PDF links · **Mark uploaded to WHSM** (with WHSM reference) |

Signature capture follows the method proven in the BHW Tank QR app: `PenInput` →
`JSON(pen.Image, JSONFormat.IncludeBinaryData)` → stored as text in the Signature column → shown back
in an Image control. Keep the pad about 560 × 180 so each signature stays small (check the stored length
in testing).

## 4. The Excel sheet with embedded signatures

Power Automate's normal Excel actions can only write text, not pictures. The plan uses an **Office
Script** (`office-scripts/WriteAttendanceSheet.ts`, in this folder), run from the flow by *Excel Online
(Business) → Run script*. It:

1. Writes one row per attendee under the headings you choose.
2. Puts each person's **signature picture in the Signature cell**, sized to the row, and set to move and
   size with that cell, so sorting and printing keep the signature beside its name.
3. Adds a *Session* sheet: topic, date, presenter, location, team, number signed.

Flow **TBX - Close and export** (triggered from the app's Close button):
Get the session → get its attendance rows → *Copy file* (template → `TBX Exports/<SessionID>-<Topic>.xlsx`)
→ *Run script* (headings, rows and session details) → check the row count matches → make the PDF:
the file is copied to the flow owner's OneDrive, OneDrive *Convert file* to PDF (the signatures show),
then the PDF is saved back to TBX Exports → save the links on the session → email the presenter and Steve.

**Columns:** by default the Attendance sheet has *Session ID, Date, Topic, Presenter, Location, Name, AVL
ID, Team, Company, Attended/Read, Understood, Signed at, Signature*. Once we have the WHS Monitor import
template, the headings are changed to match it exactly. They are passed in by the flow, so no code
changes are needed.

> **Check before building.** Bulk importers usually read only cell values and skip pictures. If WHS
> Monitor's import ignores the signature images, the import still loads the attendance data, and the
> signed sheet (xlsx or PDF) is attached to the WHS Monitor record as the signed evidence. Please
> export a blank attendance / training import template from WHS Monitor so the columns can be matched.

## 5. Flows (standard connectors only)

| Flow | Trigger | Does |
|---|---|---|
| TBX - Close and export | Power Apps button | Builds the xlsx with embedded signatures and the PDF, as above |
| TBX - Talk reminder | daily, 6:30 am | Teams message to each team that has a talk today, with the app link |
| TBX - Read-and-sign chaser | daily, 2 pm | For open talks, lists who in the team hasn't signed and emails the presenter. When the read window ends, sets the talk to Closed and runs the export. |
| TBX - Weekly summary | Monday 7 am | Talks held, attendance % per team, outstanding sign-offs, sheets not yet uploaded to WHSM |

## 6. Admin settings needed (IT, one-off)

- **Office Scripts** must be allowed for the tenant (Microsoft 365 admin centre → Settings → Office
  Scripts) so the flow can run the script. Without it, the fallback is a PDF sign-on sheet with
  signatures plus a plain xlsx without images.
- The flow's owner account needs edit rights to the TBX Exports library.

## 7. Build phases (each one is a Cowork hand-off, like the AusGrape plan)

1. Lists, libraries and the Excel template (setup script, as for AusGrape).
2. App: Home, Talk, Sign off, Kiosk. Test signing on an iPhone and on a shared tablet.
3. Presenter screens: Schedule, Roll, Close & export.
4. Export flow plus the Office Script. Test with 3 test signers, open the xlsx and check the signatures
   sit in the right cells, then try a **trial bulk upload into WHS Monitor**.
5. Reminder, chaser and weekly flows. Publish, add the tile to the Buronga AVL main board, and give out
   the QR code.

## 8. Questions to settle first

1. **WHS Monitor import:** which register do toolbox talks go into (training, meeting, or induction
   attendance)? Please supply a blank import template. Does WHSM need one file per talk or one file for
   many talks?
2. Who can schedule talks (supervisors, Steve, team leaders)?
3. Teams or crews to use (Cellar, Packaging, AusGrape, Maintenance, Lab, Contractors?).
4. Can staff who missed the talk "read and sign" later, and for how many days?
5. Do contractors sign without an AVL ID (company name + name only)?
6. Is a short check question needed ("What hearing protection is required in the packing hall?")
   before signing?

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
