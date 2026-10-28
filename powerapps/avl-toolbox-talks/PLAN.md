# Plan — AVL Toolbox Talks app (Buronga)

Staff open the **Toolbox** tile on the Buronga AVL main board **on their own AVL phone**, confirm their
**AVL ID**, read the
information for the current toolbox meeting, and sign the **"read and understood" declaration** with a
drawn signature. Their name and signature go **straight into that meeting's group spreadsheet**, one
row per person with the signature embedded as a picture, ready for bulk upload to **WHS Monitor**.

People who missed the meeting use exactly the same steps later. They read the same information and sign
the same declaration, and the spreadsheet shows they signed after the meeting.

It uses the same build method as the AusGrape Packing Supplies app (SharePoint lists, Power Apps canvas,
Power Automate, standard licences), so it can be handed to Cowork the same way.

## 1. How it works

```
 Presenter / L&D                         Staff member                               Automatic
 ───────────────                         ────────────                               ─────────
 Create the meeting in the app ──► TBX Meetings                                     Flow 1: the meeting's group
 (topic, date, info, slides/video,         │                                        spreadsheet is created from the
  presenter) and open it                   │                                        template → TBX Sheets/<Meeting>.xlsx
                                           ▼
                                  Main board → Toolbox tile
                                  On own AVL phone: AVL ID shown → "Hi Sam Smith"
                                  Current toolbox opens: info, key points,
                                  slides / video
                                  Tick: "I have read and understood…"
                                  Draw signature → SIGN
                                           │
                                           ▼
                                  TBX Signatures (one row per person per meeting) ──► Flow 2: adds the row and the
                                                                                      signature picture to that
                                  Missed the meeting? Same steps, any time           meeting's spreadsheet, within
                                  while it is open → marked "Read after meeting"     about a minute
                                           │
 Close the meeting ────────────────────────┤──► Flow 3: final check that the sheet matches the
                                           │    signatures (rebuilds it if not), saves a PDF copy,
                                           ▼    emails the presenter the links
                                  Upload the xlsx to WHS Monitor → mark "Uploaded" + WHSM ref
```

## 2. SharePoint lists (on the AustralianVintage site)

| List / library | One row per | Main columns |
|---|---|---|
| **TBX Meetings** | toolbox meeting | Meeting ID (Title, unique, e.g. `TBX-2026-11-03-CELLAR`), Topic, MeetingDate, MeetingTime, Location, Team, Presenter, PresenterEmail, Info (Note: the toolbox content staff read), KeyPoints (Note), ContentUrl (slides PDF or video), OpenUntil (date late readers can sign until), Status (Draft · Open · Closed · Uploaded to WHSM), SheetUrl, PdfUrl, WHSMRef |
| **TBX Signatures** | person × meeting | Record key (Title, unique = `MeetingID\|AVLID`), MeetingID, Name, AVLID, Team, Declaration (the exact wording they signed), Signature (Note, base64 PNG), SignedAt, SignedWhen (At meeting · Read after meeting, set automatically by date), QuestionsRaised (Note), SignedInEmail (the phone's AVL login), InSheet (Yes/No, set by Flow 2) |
| **TBX People** | staff member | Name (Title), AVLID (unique), Email, Team, Role (Staff · Presenter · Admin), Active. *(Can be shared with the AusGrape app.)* |
| **TBX Content** (library) | material | slides, PDFs and handouts linked from meetings |
| **TBX Sheets** (library) | group spreadsheet | `TBX-Attendance-Template.xlsx`, plus one `.xlsx` (and `.pdf` once closed) per meeting |

The unique `MeetingID|AVLID` key means each person signs each meeting once. Version history is on for
every list.

## 3. App screens

| Screen | Who | What it does |
|---|---|---|
| **Sign in** | all | The phone's AVL login finds the person in TBX People and pre-fills their AVL ID and name; they confirm it. If the login isn't on the people list, they type their AVL ID, and it must belong to that login's email, so no one can sign as someone else. Unknown people see "see your supervisor". |
| **Current toolbox** | all | Opens straight onto the current meeting for the person's team (or "All"): topic, date, presenter, the info and key points, an **Open slides / video** button. If they've already signed: "Signed 03/11 07:42 ✓". Below it: **other open toolboxes you haven't signed yet**, so late readers catch up. |
| **Declaration & sign** | all | The declaration in full, with a required tick: *"I have read and understood the information in this toolbox talk, I have had the opportunity to ask questions, and I will follow the controls described."* (wording to be confirmed). Signature pad, optional questions or concerns (dictation mic), then **SIGN**. The button stays off until the tick is on and something is drawn. |
| **Meetings** | presenter, admin | Create or edit a meeting, attach slides, set Open until, Open / Close · a live list of who has signed and who in the team hasn't · Sheet and PDF links · **Mark uploaded to WHSM** |

Signature capture follows the method proven in the BHW Tank QR app: `PenInput` →
`JSON(pen.Image, JSONFormat.IncludeBinaryData)` → stored as text in the Signature column. Keep the pad
about 560 × 180 so each signature stays small, and check the stored length in testing.

**Sign-in:** everyone signs on their own AVL phone, already logged in to their AVL Microsoft account.
The record stores both the AVL ID and the phone's login email, which gives a strong audit trail: the
signature came from that person's own device.

## 4. The group spreadsheet with embedded signatures

Power Automate's normal Excel actions only write text, so the pictures are placed by **Office Scripts**,
run from the flows with *Excel Online (Business) → Run script*:

- `office-scripts/AppendSignature.ts` adds **one row** for the person who just signed and drops their
  signature picture into that row's Signature cell. Flow 2 uses it every time someone signs.
- `office-scripts/WriteAttendanceSheet.ts` **rewrites the whole sheet** from the TBX Signatures list.
  Flow 3 uses it when the meeting closes, or if a row ever failed, so the spreadsheet always matches
  the list.

The pictures are set to move and size with their cell, so sorting and printing keep each signature
beside its name. Each sheet also has a *Meeting* tab with the topic, date, presenter, location and the
declaration wording.

**Columns** (default): *Meeting ID, Date, Topic, Presenter, Name, AVL ID, Team, Signed when (At meeting /
Read after meeting), Signed at, Declaration accepted, Signature*. Once we have the WHS Monitor import
template, the headings are renamed to match it exactly. Flows pass them in, so no script changes are
needed. (The scripts look for the *Signature* and *AVL ID* headings to place the picture and to stop a
person being added twice. If WHS Monitor uses different names for these two, change them in both
scripts.)

> **Check before building.** Bulk importers usually read only cell values and skip pictures. If WHS
> Monitor's import ignores the signature images, the attendance data still imports, and the meeting's
> signed xlsx or PDF is attached to the WHS Monitor record as the signed evidence. Please export a blank
> attendance / training import template from WHS Monitor so the columns can be matched.

## 5. Flows (standard connectors only)

| Flow | Trigger | Does |
|---|---|---|
| 1 · TBX - Create meeting sheet | TBX Meetings item set to Open | Copies the template to `TBX Sheets/<MeetingID>-<Topic>.xlsx`, fills the Meeting tab, saves SheetUrl |
| 2 · TBX - Add signature to sheet | TBX Signatures item created | Runs AppendSignature on that meeting's sheet, then sets InSheet = Yes. **Concurrency control on, degree 1**, so when a whole crew signs at once the rows go in one at a time and never clash. |
| 3 · TBX - Close meeting | Status set to Closed (by the presenter, or automatically after Open until) | Rebuilds the sheet with WriteAttendanceSheet if any row has InSheet = No or the counts differ, makes the PDF (copy to OneDrive → *Convert file* → save to TBX Sheets), emails the presenter and Steve |
| 4 · TBX - Reminders | daily, 6:30 am | Teams message to each team with a meeting today. For open meetings, a list of who hasn't signed goes to the presenter. |

## 6. Admin settings needed (IT, one-off)

- **Office Scripts** must be allowed for the tenant (Microsoft 365 admin centre → Settings → Office
  Scripts) so flows can run the scripts.
- The flow owner (a service or L&D account) needs edit rights on TBX Sheets.

## 7. Build phases (each one is a Cowork hand-off, like the AusGrape plan)

1. Lists, libraries and the Excel template.
2. App: Sign in, Current toolbox, Declaration & sign. Test on two staff members' own AVL phones.
3. Meetings screen (create, open, close, live sign-off list).
4. Flows 1–3 plus the Office Scripts. Test with 3 people signing at once and 1 signing the next day;
   open the xlsx and check every signature is in the right row. Then do a **trial bulk upload into WHS
   Monitor**.
5. Reminders flow. Publish, add the **Toolbox** tile to the Buronga AVL main board, QR poster for the
   crib room.

## 8. Questions to settle first

1. **WHS Monitor import:** which register do toolbox talks go into (training, meeting, or induction
   attendance)? Please supply a blank import template.
2. **Declaration wording:** use the draft above, or your own?
3. How long can people who missed the meeting still read and sign (e.g. 14 days)? What happens after
   that: closed, or kept open until everyone in the team has signed?
4. Who can create meetings (supervisors, Steve, team leaders)?
5. Teams or crews to use (Cellar, Packaging, AusGrape, Maintenance, Lab)?

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
