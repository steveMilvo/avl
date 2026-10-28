# Build plan — AVL Toolbox app (Buronga Hill Winery)

**For:** Claude Cowork, driving Steve's signed-in Chrome (Claude in Chrome).
**Method:** the `sharepoint-powerapps-builder` skill (load it first). This file is self-contained:
- Appendix A: list setup script
- Appendix B: Office Script `SignOffSheet`
- Appendix C: app formulas and screen YAML
- Appendix D: flows
- Appendix E: the fallback template generator

**Attachments to build:** the fallback sign-off template `TBX-SignOff-Template.xlsx` (Appendix E makes
it, using the AV logo Steve supplied; if you can't run Python, ask Steve for the copy he was sent) and a
new sign-on QR code PDF.

## 1. What you are building

Staff open the **Toolbox** tile on the Buronga AVL main board **on their own AVL phone**, confirm their
**AVL ID**, read the current toolbox talk's files, and sign the **read-and-understood declaration** with
a drawn signature. Each signature goes straight into **that meeting's sign-off spreadsheet in its dated
folder**, as a row with the signature picture. Anyone who missed the meeting can read and sign for
**7 days**. Then the sheet is saved as a **PDF in the same folder**, and Steve uploads it to WHS
Monitor as the sign-off evidence. Staff can **ask a question** about the topic. It is emailed to Steve,
who answers or forwards it to the meeting leader.

## 2. Confirmed decisions — do not re-ask

| Item | Decision |
|---|---|
| Site | https://australianvintagecomau.sharepoint.com/sites/australiawinemakingburongahillwineryUserCreated |
| Meeting folders | Documents → **Managers Toolbox Meeting** → one folder per meeting named **`yyyy-MM-dd`** (e.g. `2026-12-10`, `2027-01-07`). The library also holds *BHW Toolbox Talk Presenter Guide.docx* and *BHW Toolbox Talk Sign-on QR.pdf*. |
| Template | **Each dated folder already has a sign-off template.** Write into a copy of it named `Toolbox sign-off <yyyy-MM-dd>.xlsx` in the same folder. Never edit the original. Use the AV-logo fallback only if a folder has no template. |
| Access | Everyone on the intranet can open the folder. Staff read the files through the app. |
| Declaration | "I have read and understood the information in this toolbox talk, I have had the opportunity to ask questions, and I will follow the controls described." |
| Late signing | 7 days after the meeting date, then auto-close |
| Output | One xlsx per meeting with embedded signatures, plus a PDF of it, both in the dated folder. No WHS Monitor import template; the PDF is uploaded as evidence. |
| Staff | Cellar first, then Maintenance and Lab. **Steve adds people to TBX People by hand.** |
| Device | Each person's own AVL phone |
| Questions | Emailed to Steve (reply-to = the asker). Steve forwards them to the meeting leader. |

## 3. Rules while working

- Work only in Steve's signed-in Chrome. Never accept a consent prompt for him.
- **Never modify or delete anything already in Managers Toolbox Meeting** (folders, templates, guides,
  the existing QR PDF). Only create new files. For testing, make a folder `2099-01-01 TEST - delete me`
  and recycle it at the end.
- Never hard-delete. Recycle test rows and files.
- Before pasting a formula, check the property name in the formula bar.
- Ask Steve when something here doesn't match what you see.

## 4. Phases and checks

### Phase 1 — Look before building (report to Steve, then continue)
1. Open the Managers Toolbox Meeting folder. List the dated folders, then open the **next upcoming**
   one and one **past** one.
2. Identify the **sign-off template** in each: its file name and type. Note the text in the name that
   identifies it, for `TemplateMatch`.
   - **If it's .xlsx:** open it in Excel online and record the layout for `SHEET_MAP`: the sheet name;
     the first row people sign on; the column letter for Name, AVL ID, Team, Signed when, Date & time
     and Signature (leave out any the template doesn't have); how many sign rows it has; and the
     heading cells for topic, date, presenter and location, if present.
   - **If it's Word or PDF** (not Excel): tell Steve. The fallback AV-logo Excel template is used for
     every meeting (`SHEET_MAP = null`), and the folder's template stays as the printed version.
3. Work out **where the topic comes from**: the template heading, a file name, or the presenter guide.
   Adjust Flow 1's `Topic` step to match.
4. Ask Steve for his **AVL work email** (for `AdminEmail`).
5. Report the findings in one short message, then continue.

### Phase 2 — Lists and settings (Appendix A)
1. Put the Phase 1 layout into `SHEET_MAP` in the script (or leave it `null`).
2. Open `<site>/_layouts/15/viewlsts.aspx` and run the script. Read `window.__tbxReport`.
3. In **TBX Settings**: set `TemplateMatch` and `AdminEmail`.
4. Upload the fallback template to `Managers Toolbox Meeting/_Templates/TBX-SignOff-Template.xlsx`
   (create `_Templates`).
5. **Check:** there are 5 lists (TBX Meetings, Signatures, People, Questions, Settings) and the settings
   rows exist. Steve adds himself to TBX People with TbxRole **Admin**, plus one test staff member.

### Phase 3 — Office Script (Appendix B)
In Excel online, under the flow owner's account: Automate → New script → paste → save as
**SignOffSheet**. Test it on a copy of a real template in the TEST folder. Run `append` with sample data
twice; the second run must be skipped because it's the same AVL ID. Check that the signature picture
sits inside the Signature cell.

### Phase 4 — App (Appendix C)
1. Create a blank canvas app, **Phone**, named **AVL Toolbox**. Add the 5 lists as data sources and
   upload `av-logo-small.png` to Media.
2. Paste App.OnStart. Create the screens `scrHome`, `scrSign`, `scrAsk` and `scrAdmin`; paste each YAML
   and set each OnVisible. Set StartScreen.
3. App checker → 0 errors.

### Phase 5 — Flows (Appendix D)
Build flows 1, 2, 3 and 5; flow 4 last and optional. Point Flow 1 at the TEST folder first.

### Phase 6 — End-to-end test (TEST folder)
1. Run Flow 1 by hand. TBX Meetings gets a row, and `Toolbox sign-off 2099-01-01.xlsx` appears in the
   TEST folder with its heading filled in.
2. In the app, as Steve and the test person on two phones: Continue → files open → Ask a question
   (check the email arrives with reply-to set) → sign, both at about the same time. Both rows and
   signatures appear in the sheet within about a minute.
3. Sign the third person a "day later" (set OpenUntil and test the "Read after meeting" logic by
   editing MeetingDate back a day).
4. Close now → within the hour the PDF is in the TEST folder, the email reaches Steve, and the signatures
   are readable in the PDF.
5. Check the stored data over REST, then recycle the TEST folder and all test rows.
6. Point Flow 1 back at the real folder.

### Phase 7 — Publish and hand over
1. Publish. Get the play link (envId = tenantId for AVL). Share the app with the Cellar staff.
2. Add the **Toolbox** tile to the Buronga AVL main board app (Launch the play link).
3. Make a new **QR code PDF**: "AVL Toolbox — scan with your AVL iPhone". Save it next to the old one as
   *BHW Toolbox Talk Sign-on QR (app).pdf*. Ask Steve before replacing or renaming the existing QR PDF.
4. Hand back: the play link, the QR PDF, the list URLs, and what's in each dated folder after a meeting
   (the talk files, the sign-off xlsx and the sign-off PDF).

---

## Appendix A — List setup script (`sharepoint/provision-lists.js`)

```js
/*
 * AVL Toolbox Talks - SharePoint list provisioning
 *
 * HOW TO RUN
 *   1. Open the Buronga Hill Winery site in Chrome or Edge:
 *      https://australianvintagecomau.sharepoint.com/sites/australiawinemakingburongahillwineryUserCreated/_layouts/15/viewlsts.aspx
 *   2. If phase 1 of the build plan changed the sheet layout, edit SHEET_MAP below first.
 *   3. DevTools > Console, paste this whole file, press Enter. Wait for "DONE" (or read window.__tbxReport).
 *
 * Safe to run more than once: it skips lists, fields and rows that already exist. It never deletes anything.
 */
(async () => {
  // Layout of the sign-off sheet that SignOffSheet.ts writes into.
  // SHEET_MAP_FALLBACK matches template/TBX-SignOff-Template.xlsx (used when a dated folder has no template).
  // SHEET_MAP is the layout of the template already in each dated folder. Phase 1 of the build plan
  // works it out from a real folder and fills it in here BEFORE running this script.
  const SHEET_MAP = null; // e.g. { sheet: 'Sheet1', firstDataRow: 8, maxRows: 60, rowHeight: 40, columns: {...}, heading: {...} }
  const SHEET_MAP_FALLBACK = {
    sheet: 'Sign-off',
    firstDataRow: 16,
    maxRows: 200,
    rowHeight: 48,
    columns: { 'No.': 'A', 'Name': 'B', 'AVL ID': 'C', 'Team': 'D', 'Signed when': 'E', 'Date & time': 'F', 'Signature': 'G' },
    heading: { Topic: 'C4', MeetingDate: 'C5', Presenter: 'C6', Location: 'C7', Team: 'C8', MeetingID: 'C9' },
  };
  const SETTINGS = [
    ['SheetMap', JSON.stringify(SHEET_MAP || SHEET_MAP_FALLBACK), 'Layout of the sign-off template in the dated folders (see SignOffSheet.ts)'],
    ['SheetMapFallback', JSON.stringify(SHEET_MAP_FALLBACK), 'Layout of TBX-SignOff-Template.xlsx in Managers Toolbox Meeting/_Templates'],
    ['Declaration', 'I have read and understood the information in this toolbox talk, I have had the opportunity to ask questions, and I will follow the controls described.', 'Wording shown in the app and stored with every signature'],
    ['OpenDays', '7', 'Days after the meeting that people can still read and sign'],
    ['TemplateMatch', 'CHANGE-ME', 'Text in the file name of the sign-off template inside each dated folder (set in phase 1)'],
    ['FolderPath', '/Shared Documents/Managers Toolbox Meeting', 'Library folder holding the dated (yyyy-MM-dd) meeting folders'],
    ['AdminEmail', 'CHANGE-ME', 'Who gets the close-of-meeting email with the PDF link (Steve)'],
  ];

  const LISTS = [
    {
      title: 'TBX Meetings',
      desc: 'Toolbox Talks - one row per toolbox meeting, created by flow from the Managers Toolbox Meeting dated folders.',
      titleName: 'Meeting ID', titleUnique: true,
      fields: [
        ['Topic', 'Text'],
        ['MeetingDate', 'DateTime', { indexed: true, dateOnly: true }],
        ['Team', 'Text', { indexed: true }],
        ['Presenter', 'Text'],
        ['Location', 'Text'],
        ['FolderPath', 'Text', { indexed: true }],
        ['FolderUrl', 'Text'],
        ['Files', 'Note'],
        ['OpenUntil', 'DateTime', { dateOnly: true }],
        ['Status', 'Text', { indexed: true }],
        ['SheetPath', 'Text'],
        ['SheetMap', 'Note'],
        ['SheetUrl', 'Text'],
        ['PdfUrl', 'Text'],
        ['WHSMRef', 'Text'],
        ['ClosedAt', 'DateTime'],
      ],
    },
    {
      title: 'TBX Signatures',
      desc: 'Toolbox Talks - one row per person per meeting: the read-and-understood declaration with signature.',
      titleName: 'Record key', titleUnique: true,
      fields: [
        ['MeetingID', 'Text', { indexed: true }],
        ['PersonName', 'Text'],
        ['AVLID', 'Text', { indexed: true }],
        ['Team', 'Text'],
        ['Declaration', 'Note'],
        ['Signature', 'Note'],
        ['SignedAt', 'DateTime'],
        ['SignedWhen', 'Text'],
        ['QuestionsRaised', 'Note'],
        ['SignedInEmail', 'Text'],
        ['InSheet', 'Boolean', { indexed: true, def: '0' }],
      ],
    },
    {
      title: 'TBX People',
      desc: 'Toolbox Talks - staff who sign toolbox talks. Added by hand.',
      titleName: 'Name', titleUnique: false,
      fields: [
        ['AVLID', 'Text', { indexed: true, unique: true }],
        ['Email', 'Text', { indexed: true, unique: true }],
        ['Team', 'Text', { indexed: true }],
        ['TbxRole', 'Text'],
        ['Active', 'Boolean', { indexed: true, def: '1' }],
      ],
    },
    {
      title: 'TBX Questions',
      desc: 'Toolbox Talks - questions staff ask about a toolbox topic. Each one is emailed to Steve to answer or pass to the meeting leader.',
      titleName: 'Question ID', titleUnique: true,
      fields: [
        ['MeetingID', 'Text', { indexed: true }],
        ['Topic', 'Text'],
        ['PersonName', 'Text'],
        ['AVLID', 'Text', { indexed: true }],
        ['Email', 'Text'],
        ['Question', 'Note'],
        ['AskedAt', 'DateTime'],
        ['AskedFrom', 'Text'],
        ['QStatus', 'Text', { indexed: true }],
        ['ForwardedTo', 'Text'],
        ['Answer', 'Note'],
      ],
    },
    {
      title: 'TBX Settings',
      desc: 'Toolbox Talks - settings read by the app and flows.',
      titleName: 'Setting', titleUnique: true,
      fields: [
        ['SettingValue', 'Note'],
        ['Notes', 'Note'],
      ],
    },
  ];

  // ---------------------------------------------------------------- helpers
  const web = (window._spPageContextInfo && _spPageContextInfo.webAbsoluteUrl)
    || location.href.split(/\/(_layouts|SitePages|Lists|Shared%20Documents)\//i)[0];
  const log = [];
  const say = (m) => { log.push(m); console.log(m); };
  const esc = (s) => String(s).replace(/'/g, "''");
  let digest = '';
  const refreshDigest = async () => {
    const r = await fetch(`${web}/_api/contextinfo`, { method: 'POST', headers: { Accept: 'application/json;odata=nometadata' } });
    digest = (await r.json()).FormDigestValue;
  };
  const api = async (path, method = 'GET', body, extra = {}) => {
    const headers = { Accept: 'application/json;odata=nometadata', 'Content-Type': 'application/json;odata=verbose', 'X-RequestDigest': digest, ...extra };
    const r = await fetch(`${web}/_api/${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${(await r.text()).slice(0, 300)}`);
    return r.status === 204 ? null : r.json().catch(() => null);
  };
  const merge = (path, body) => api(path, 'POST', body, { 'X-HTTP-Method': 'MERGE', 'IF-MATCH': '*' });
  const L = (t) => `web/lists/getbytitle('${esc(t)}')`;

  const fieldXml = (name, type, o = {}) => {
    const t = { Text: 'Text', Number: 'Number', Boolean: 'Boolean', DateTime: 'DateTime', Note: 'Note' }[type];
    const extra = type === 'DateTime' ? ` Format="${o.dateOnly ? 'DateOnly' : 'DateTime'}"` : type === 'Note' ? ' NumLines="6" RichText="FALSE" UnlimitedLengthInDocumentLibrary="TRUE"' : '';
    const def = o.def !== undefined ? `<Default>${o.def}</Default>` : '';
    return `<Field Type="${t}" DisplayName="${name}" Name="${name}" StaticName="${name}"${extra}>${def}</Field>`;
  };

  // ------------------------------------------------------------------ build
  await refreshDigest();
  const existing = (await api(`web/lists?$select=Title&$filter=Hidden eq false`)).value.map((l) => l.Title);

  for (const def of LISTS) {
    if (!existing.includes(def.title)) {
      await api('web/lists', 'POST', { __metadata: { type: 'SP.List' }, BaseTemplate: 100, Title: def.title, Description: def.desc });
      say(`Created list ${def.title}`);
    } else say(`List exists: ${def.title}`);
    await merge(L(def.title), { __metadata: { type: 'SP.List' }, EnableVersioning: true, MajorVersionLimit: 500 });

    await merge(`${L(def.title)}/fields/getbyinternalnameortitle('Title')`, { __metadata: { type: 'SP.Field' }, Title: def.titleName });
    if (def.titleUnique) {
      await merge(`${L(def.title)}/fields/getbyinternalnameortitle('Title')`, { __metadata: { type: 'SP.Field' }, Indexed: true });
      await merge(`${L(def.title)}/fields/getbyinternalnameortitle('Title')`, { __metadata: { type: 'SP.Field' }, EnforceUniqueValues: true });
    }

    const have = (await api(`${L(def.title)}/fields?$select=InternalName`)).value.map((f) => f.InternalName);
    for (const [name, type, o = {}] of def.fields) {
      if (!have.includes(name)) {
        await api(`${L(def.title)}/fields/createfieldasxml`, 'POST', {
          parameters: { __metadata: { type: 'SP.XmlSchemaFieldCreationInformation' }, SchemaXml: fieldXml(name, type, o), Options: 24 },
        });
        say(`  + ${def.title}.${name} (${type})`);
      }
      const f = `${L(def.title)}/fields/getbyinternalnameortitle('${name}')`;
      if (o.indexed || o.unique) await merge(f, { __metadata: { type: 'SP.Field' }, Indexed: true });
      if (o.unique) await merge(f, { __metadata: { type: 'SP.Field' }, EnforceUniqueValues: true });
    }
  }

  // ------------------------------------------------------------------- seed
  const entityType = async (t) => (await api(`${L(t)}?$select=ListItemEntityTypeFullName`)).ListItemEntityTypeFullName;
  const seed = async (listTitle, keyField, rows) => {
    const type = await entityType(listTitle);
    let added = 0;
    for (const row of rows) {
      const found = await api(`${L(listTitle)}/items?$select=Id&$top=1&$filter=${keyField} eq '${encodeURIComponent(esc(row[keyField]))}'`);
      if (found.value.length) continue;
      await api(`${L(listTitle)}/items`, 'POST', { __metadata: { type }, ...row });
      added++;
    }
    say(`Seeded ${listTitle}: ${added} new, ${rows.length - added} already there`);
  };

  await refreshDigest();
  await seed('TBX Settings', 'Title', SETTINGS.map(([k, v, n]) => ({ Title: k, SettingValue: v, Notes: n })));
  say('NOTE: set AdminEmail in TBX Settings, and add Cellar staff to TBX People (Name, AVLID, Email lower case, Team = Cellar, TbxRole = Staff or Admin).');

  // ----------------------------------------------------------------- verify
  for (const def of LISTS) {
    const n = (await api(`${L(def.title)}?$select=ItemCount`)).ItemCount;
    say(`${def.title}: ${n} rows  ->  ${web}/Lists/${encodeURIComponent(def.title)}`);
  }
  say('DONE');
  window.__tbxReport = log.join('\n');
})().catch((e) => { console.error(e); window.__tbxReport = 'FAILED: ' + e.message; });
```

## Appendix B — Office Script `SignOffSheet`

```ts
/**
 * Office Script: SignOffSheet
 *
 * Writes toolbox sign-offs into a meeting's sign-off spreadsheet, the copy of the template that sits in
 * that meeting's dated folder, with each person's drawn signature embedded as a picture in their row.
 *
 * Works with ANY template layout. The layout is described by mapJson (stored once in the TBX Settings
 * list, row "SheetMap"), e.g.
 *   {
 *     "sheet": "Sheet1",              // worksheet name ("" = first sheet)
 *     "firstDataRow": 16,             // first row people sign on (1-based)
 *     "maxRows": 200,                 // stop looking for an empty row after this many
 *     "columns": {                    // field -> column letter; leave out fields the template has no column for
 *       "No.": "A", "Name": "B", "AVL ID": "C", "Team": "D",
 *       "Signed when": "E", "Date & time": "F", "Signature": "G"
 *     },
 *     "heading": {                    // field -> cell, filled only if the cell is empty
 *       "Topic": "C4", "MeetingDate": "C5", "Presenter": "C6", "Location": "C7", "Team": "C8", "MeetingID": "C9"
 *     },
 *     "rowHeight": 48                 // points
 *   }
 *
 * action:
 *   "heading" - fill the empty heading cells from dataJson (an object). Run once when the sheet is created.
 *   "append"  - add one signer (dataJson = object keyed by field). Skips a signer already on the sheet.
 *   "rebuild" - clear all signer rows and pictures, then write every signer (dataJson = array of objects).
 * The "Signature" field holds the PNG as base64, with or without the "data:image/png;base64," prefix.
 *
 * Returns the number of signer rows on the sheet after the action.
 */
function main(workbook: ExcelScript.Workbook, action: string, mapJson: string, dataJson: string): number {
  const map: SheetMap = JSON.parse(mapJson);
  const sheet = map.sheet ? workbook.getWorksheet(map.sheet) : workbook.getWorksheets()[0];
  if (!sheet) throw new Error(`Sheet "${map.sheet}" not found`);
  const first = map.firstDataRow - 1; // 0-based row index
  const maxRows = map.maxRows || 200;
  const rowHeight = map.rowHeight || 48;
  const cols = map.columns;
  const keyField = cols["AVL ID"] ? "AVL ID" : "Name";

  if (action === "heading") {
    const d: SignRow = JSON.parse(dataJson);
    Object.keys(map.heading || {}).forEach((f) => {
      const cell = sheet.getRange(map.heading[f]);
      if (d[f] !== undefined && String(cell.getValue()) === "") cell.setValue(d[f]);
    });
    return countRows();
  }

  if (action === "rebuild") {
    const all: SignRow[] = JSON.parse(dataJson);
    sheet.getShapes().forEach((sh) => { if (sh.getName().startsWith("sig_")) sh.delete(); });
    Object.keys(cols).forEach((f) => colRange(f, first, maxRows).clear(ExcelScript.ClearApplyTo.contents));
    all.forEach((r, i) => writeRow(first + i, r, i + 1));
    return all.length;
  }

  if (action === "append") {
    const r: SignRow = JSON.parse(dataJson);
    const keys = colRange(keyField, first, maxRows).getValues();
    let n = 0;
    while (n < maxRows && String(keys[n][0]) !== "") {
      if (String(keys[n][0]).trim().toLowerCase() === String(r[keyField] ?? "").trim().toLowerCase()) return countRows();
      n++;
    }
    if (n >= maxRows) throw new Error("Sign-off sheet is full - raise maxRows in SheetMap");
    writeRow(first + n, r, n + 1);
    return n + 1;
  }

  throw new Error(`Unknown action "${action}"`);

  // ---------------------------------------------------------------- helpers
  function colRange(field: string, top: number, rows: number): ExcelScript.Range {
    return sheet.getRange(`${cols[field]}${top + 1}:${cols[field]}${top + rows}`);
  }

  function countRows(): number {
    const keys = colRange(keyField, first, maxRows).getValues();
    let n = 0;
    while (n < maxRows && String(keys[n][0]) !== "") n++;
    return n;
  }

  function writeRow(rowIndex: number, r: SignRow, no: number) {
    Object.keys(cols).forEach((f) => {
      if (f === "Signature") return;
      const v = f === "No." ? String(no) : (r[f] ?? "");
      sheet.getRange(`${cols[f]}${rowIndex + 1}`).setValue(v);
    });
    sheet.getRange(`${rowIndex + 1}:${rowIndex + 1}`).getFormat().setRowHeight(rowHeight);
    if (cols["Signature"] && r["Signature"]) {
      const cell = sheet.getRange(`${cols["Signature"]}${rowIndex + 1}`);
      const pic = sheet.addImage(String(r["Signature"]).replace(/^data:image\/[a-z]+;base64,/, ""));
      pic.setLockAspectRatio(true);
      pic.setHeight(Math.min(rowHeight - 6, cell.getHeight() - 4));
      if (pic.getWidth() > cell.getWidth() - 6) pic.setWidth(cell.getWidth() - 6);
      pic.setLeft(cell.getLeft() + 3);
      pic.setTop(cell.getTop() + 2);
      pic.setPlacement(ExcelScript.Placement.twoCell); // picture moves and sizes with its cell
      pic.setName(`sig_${String(r[keyField] ?? rowIndex).replace(/[^A-Za-z0-9]/g, "")}`);
    }
  }
}

interface SheetMap {
  sheet: string;
  firstDataRow: number;
  maxRows?: number;
  rowHeight?: number;
  columns: { [field: string]: string };
  heading?: { [field: string]: string };
}
interface SignRow { [field: string]: string }
```

## Appendix C — App

### App-level settings and screen formulas — AVL Toolbox

App name: **AVL Toolbox** · Format: **Phone** · Data sources (SharePoint, Buronga Hill Winery site):
`TBX Meetings`, `TBX Signatures`, `TBX People`, `TBX Questions`, `TBX Settings`.
Media: upload `assets/av-logo-small.png` (Media → Upload) so it can be referenced as `'av-logo-small'`.

| Screen | Who | Paste file |
|---|---|---|
| `scrHome` | all | `screens/scrHome.yaml` |
| `scrSign` | all | `screens/scrSign.yaml` |
| `scrAsk` | all | `screens/scrAsk.yaml` |
| `scrAdmin` | admin (TbxRole = Admin) | `screens/scrAdmin.yaml` |

Set `App.StartScreen` to `=scrHome`.

#### App.OnStart

```
=Set(varGreen, RGBA(0, 94, 56, 1));
Set(varRed, RGBA(184, 28, 28, 1));
Set(varDeclaration, LookUp('TBX Settings', Title = "Declaration").SettingValue);
Set(varPerson, Blank());
Set(varMtg, Blank())
```

#### scrHome.OnVisible

Reloads the person's open toolboxes and signatures once they have confirmed their AVL ID.

```
=If(!IsBlank(varPerson),
    ClearCollect(colOpen,
        Filter('TBX Meetings', Status = "Open" && Team = varPerson.Team),
        Filter('TBX Meetings', Status = "Open" && Team = "All"));
    ClearCollect(colMySigs, Filter('TBX Signatures', AVLID = varPerson.AVLID));
    If(IsBlank(varMtg) || IsBlank(LookUp(colOpen, Title = varMtg.Title)),
        Set(varMtg, First(Sort(colOpen, MeetingDate, SortOrder.Descending)))))
```

#### scrSign.OnVisible

```
=Reset(chkDecl);
Reset(penSig);
Reset(txtQuestions);
Set(varBlankSig, JSON(penSig.Image, JSONFormat.IncludeBinaryData))
```

#### scrAsk.OnVisible

```
=Reset(txtAsk)
```

#### scrAdmin.OnVisible

```
=If(varPerson.TbxRole <> "Admin", Navigate(scrHome, ScreenTransition.None));
ClearCollect(colRecent, FirstN(Sort('TBX Meetings', MeetingDate, SortOrder.Descending), 30));
If(IsBlank(varAdm), Set(varAdm, First(colRecent)));
ClearCollect(colAdmSigs, Filter('TBX Signatures', MeetingID = varAdm.Title));
ClearCollect(colTeam, If(varAdm.Team = "All", Filter('TBX People', Active = true), Filter('TBX People', Team = varAdm.Team && Active = true)))
```

#### Notes

- **Who is signing.** The AVL ID box is pre-filled from the phone's login, and the person taps
  Continue. An AVL ID only works if it belongs to the AVL login on that phone, so nobody can sign for
  someone else. The record stores both the AVL ID and `SignedInEmail`.
- **The current toolbox** is the newest *Open* meeting for the person's team (or team "All").
  *Also to sign* lists any other open meetings from the last 7 days that they haven't signed.
- **Signature:** `JSON(penSig.Image, JSONFormat.IncludeBinaryData)` with the quotes removed, giving a
  base64 PNG data URI. It's refused if the pad wasn't drawn on, or if the result is over 60,000
  characters (the SharePoint text limit). Keep the pad at 560 × 180.
- **One signature per person per meeting:** the `Record key` (`MeetingID|AVLID`) is unique, and the
  app also checks before saving.
- `TBX People` keeps the name in `Title`. Refer to it as `Title` in Power Fx, not `Name`; the skill
  notes that a renamed title column is not always recognised.
- **Questions:** *Ask a question* (Home) and the question box on the sign screen both create a row in
  `TBX Questions`. Flow 5 emails it to Steve with the asker as reply-to. Someone can ask before
  signing, which supports the "opportunity to ask questions" part of the declaration.

### Screen YAML — `scrHome`

```yaml
# Paste onto the blank screen scrHome. Set scrHome.OnVisible separately (App.fx.md).
# Top half: confirm AVL ID (shown until confirmed). Bottom half: the current toolbox and its files.
- imgLogo:
    Control: Image
    Properties:
      Image: |-
        ='av-logo-small'
      X: |-
        =20
      Y: |-
        =14
      Width: |-
        =80
      Height: |-
        =76
- lblTitle:
    Control: Label
    Properties:
      Text: |-
        ="Toolbox Talk"
      X: |-
        =110
      Y: |-
        =20
      Width: |-
        =Parent.Width - 130
      Height: |-
        =64
      Size: |-
        =26
      FontWeight: |-
        =FontWeight.Bold
      Color: |-
        =varGreen
- lblAskAVL:
    Control: Label
    Properties:
      Text: |-
        ="Enter your AVL ID"
      Visible: |-
        =IsBlank(varPerson)
      X: |-
        =20
      Y: |-
        =120
      Width: |-
        =Parent.Width - 40
      Height: |-
        =40
      Size: |-
        =18
      FontWeight: |-
        =FontWeight.Semibold
- txtAVL:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =LookUp('TBX People', Email = Lower(User().Email) && Active = true).AVLID
      HintText: |-
        ="AVL ID"
      Visible: |-
        =IsBlank(varPerson)
      X: |-
        =20
      Y: |-
        =165
      Width: |-
        =Parent.Width - 40
      Height: |-
        =64
      Size: |-
        =22
- btnContinue:
    Control: Classic/Button
    Properties:
      Text: |-
        ="CONTINUE"
      Visible: |-
        =IsBlank(varPerson)
      X: |-
        =20
      Y: |-
        =245
      Width: |-
        =Parent.Width - 40
      Height: |-
        =80
      Fill: |-
        =varGreen
      Size: |-
        =20
      OnSelect: |-
        =With({p: LookUp('TBX People', AVLID = Trim(txtAVL.Text) && Active = true)},
            If(IsBlank(p), Notify("AVL ID not found. Ask Steve to add you to the toolbox list.", NotificationType.Error),
               Lower(p.Email) <> Lower(User().Email), Notify("That AVL ID belongs to a different login. Use your own AVL phone.", NotificationType.Error),
               Set(varPerson, p);
               ClearCollect(colOpen,
                   Filter('TBX Meetings', Status = "Open" && Team = p.Team),
                   Filter('TBX Meetings', Status = "Open" && Team = "All"));
               ClearCollect(colMySigs, Filter('TBX Signatures', AVLID = p.AVLID));
               Set(varMtg, First(Sort(colOpen, MeetingDate, SortOrder.Descending)))))
- lblWho:
    Control: Label
    Properties:
      Text: |-
        =varPerson.Title & "  ·  AVL ID " & varPerson.AVLID
      Visible: |-
        =!IsBlank(varPerson)
      X: |-
        =20
      Y: |-
        =100
      Width: |-
        =Parent.Width - 180
      Height: |-
        =40
      Size: |-
        =15
- btnNotMe:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Not you?"
      Visible: |-
        =!IsBlank(varPerson)
      OnSelect: |-
        =Set(varPerson, Blank()); Set(varMtg, Blank()); Clear(colOpen); Clear(colMySigs); Reset(txtAVL)
      X: |-
        =Parent.Width - 160
      Y: |-
        =100
      Width: |-
        =140
      Height: |-
        =40
      Fill: |-
        =Transparent
      Color: |-
        =varGreen
      BorderThickness: |-
        =0
      Size: |-
        =13
- lblNone:
    Control: Label
    Properties:
      Text: |-
        ="No toolbox talk is open for signing right now."
      Visible: |-
        =!IsBlank(varPerson) && IsBlank(varMtg)
      X: |-
        =20
      Y: |-
        =160
      Width: |-
        =Parent.Width - 40
      Height: |-
        =80
      Size: |-
        =16
- lblMtgTopic:
    Control: Label
    Properties:
      Text: |-
        =varMtg.Topic
      Visible: |-
        =!IsBlank(varMtg)
      X: |-
        =20
      Y: |-
        =150
      Width: |-
        =Parent.Width - 40
      Height: |-
        =80
      Size: |-
        =22
      FontWeight: |-
        =FontWeight.Bold
- lblMtgInfo:
    Control: Label
    Properties:
      Text: |-
        =Text(varMtg.MeetingDate, "dddd d mmmm yyyy") &
         If(IsBlank(varMtg.Presenter), "", "  ·  " & varMtg.Presenter) &
         Char(10) & "Open for signing until " & Text(varMtg.OpenUntil, "ddd d mmm")
      Visible: |-
        =!IsBlank(varMtg)
      X: |-
        =20
      Y: |-
        =232
      Width: |-
        =Parent.Width - 40
      Height: |-
        =60
      Size: |-
        =14
      Color: |-
        =RGBA(70, 70, 70, 1)
- lblFiles:
    Control: Label
    Properties:
      Text: |-
        ="Read the toolbox information:"
      Visible: |-
        =!IsBlank(varMtg)
      X: |-
        =20
      Y: |-
        =300
      Width: |-
        =Parent.Width - 40
      Height: |-
        =36
      Size: |-
        =15
      FontWeight: |-
        =FontWeight.Semibold
- galFiles:
    Control: Gallery
    Variant: Vertical
    Properties:
      Items: |-
        =ForAll(Table(ParseJSON(Coalesce(varMtg.Files, "[]"))) As f,
            {FileName: Text(f.Value.name), Url: Text(f.Value.url)})
      Visible: |-
        =!IsBlank(varMtg)
      TemplateSize: |-
        =74
      X: |-
        =14
      Y: |-
        =338
      Width: |-
        =Parent.Width - 28
      Height: |-
        =250
    Children:
      - btnFile:
          Control: Classic/Button
          Properties:
            Text: |-
              ="📄  " & ThisItem.FileName
            OnSelect: |-
              =Launch(ThisItem.Url)
            X: |-
              =6
            Y: |-
              =4
            Width: |-
              =Parent.TemplateWidth - 12
            Height: |-
              =64
            Fill: |-
              =RGBA(225, 240, 230, 1)
            Color: |-
              =varGreen
            Align: |-
              =Align.Left
            Size: |-
              =14
- btnAsk:
    Control: Classic/Button
    Properties:
      Text: |-
        ="❓ Ask a question about this toolbox"
      Visible: |-
        =!IsBlank(varMtg)
      OnSelect: |-
        =Navigate(scrAsk, ScreenTransition.Cover)
      X: |-
        =20
      Y: |-
        =594
      Width: |-
        =Parent.Width - 40
      Height: |-
        =50
      Fill: |-
        =Transparent
      Color: |-
        =varGreen
      BorderColor: |-
        =varGreen
      BorderThickness: |-
        =1
      Size: |-
        =14
- lblSigned:
    Control: Label
    Properties:
      Text: |-
        ="✓ Signed " & Text(LookUp(colMySigs, MeetingID = varMtg.Title).SignedAt, "ddd d mmm h:mm am/pm")
      Visible: |-
        =!IsBlank(varMtg) && !IsBlank(LookUp(colMySigs, MeetingID = varMtg.Title))
      X: |-
        =20
      Y: |-
        =650
      Width: |-
        =Parent.Width - 40
      Height: |-
        =90
      Size: |-
        =20
      FontWeight: |-
        =FontWeight.Bold
      Color: |-
        =varGreen
      Align: |-
        =Align.Center
- btnGoSign:
    Control: Classic/Button
    Properties:
      Text: |-
        ="I'VE READ IT – SIGN"
      Visible: |-
        =!IsBlank(varMtg) && IsBlank(LookUp(colMySigs, MeetingID = varMtg.Title))
      OnSelect: |-
        =Navigate(scrSign, ScreenTransition.Cover)
      X: |-
        =20
      Y: |-
        =650
      Width: |-
        =Parent.Width - 40
      Height: |-
        =96
      Fill: |-
        =varGreen
      Size: |-
        =20
- lblAlso:
    Control: Label
    Properties:
      Text: |-
        ="Also still to sign:"
      Visible: |-
        =!IsBlank(varPerson) && CountRows(galAlso.AllItems) > 0
      X: |-
        =20
      Y: |-
        =760
      Width: |-
        =Parent.Width - 40
      Height: |-
        =36
      Size: |-
        =15
      FontWeight: |-
        =FontWeight.Semibold
      Color: |-
        =varRed
- galAlso:
    Control: Gallery
    Variant: Vertical
    Properties:
      Items: |-
        =Sort(Filter(colOpen As m, m.Title <> varMtg.Title && IsBlank(LookUp(colMySigs, MeetingID = m.Title))), MeetingDate, SortOrder.Descending)
      Visible: |-
        =!IsBlank(varPerson)
      TemplateSize: |-
        =70
      X: |-
        =14
      Y: |-
        =798
      Width: |-
        =Parent.Width - 28
      Height: |-
        =Parent.Height - 920
    Children:
      - btnAlso:
          Control: Classic/Button
          Properties:
            Text: |-
              =Text(ThisItem.MeetingDate, "d mmm") & "  ·  " & ThisItem.Topic
            OnSelect: |-
              =Set(varMtg, ThisItem)
            X: |-
              =6
            Y: |-
              =4
            Width: |-
              =Parent.TemplateWidth - 12
            Height: |-
              =60
            Fill: |-
              =RGBA(250, 230, 230, 1)
            Color: |-
              =varRed
            Align: |-
              =Align.Left
            Size: |-
              =14
- btnAdmin:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Admin: sign-off status"
      Visible: |-
        =varPerson.TbxRole = "Admin"
      OnSelect: |-
        =Set(varAdm, varMtg); Navigate(scrAdmin, ScreenTransition.Cover)
      X: |-
        =20
      Y: |-
        =Parent.Height - 100
      Width: |-
        =Parent.Width - 40
      Height: |-
        =80
      Fill: |-
        =RGBA(0, 70, 140, 1)
      Size: |-
        =16
```

### Screen YAML — `scrSign`

```yaml
# Paste onto the blank screen scrSign. Set scrSign.OnVisible separately (App.fx.md).
- hdrSign:
    Control: Label
    Properties:
      Text: |-
        ="Sign off"
      X: |-
        =0
      Y: |-
        =0
      Width: |-
        =Parent.Width
      Height: |-
        =90
      Fill: |-
        =varGreen
      Color: |-
        =White
      Size: |-
        =22
      FontWeight: |-
        =FontWeight.Bold
      Align: |-
        =Align.Center
- btnSignBack:
    Control: Classic/Button
    Properties:
      Text: |-
        ="‹ Back"
      OnSelect: |-
        =Back()
      X: |-
        =10
      Y: |-
        =20
      Width: |-
        =120
      Height: |-
        =50
      Fill: |-
        =Transparent
      Color: |-
        =White
      BorderThickness: |-
        =0
      Size: |-
        =16
- lblSignMtg:
    Control: Label
    Properties:
      Text: |-
        =varMtg.Topic & Char(10) & Text(varMtg.MeetingDate, "dddd d mmmm yyyy")
      X: |-
        =20
      Y: |-
        =100
      Width: |-
        =Parent.Width - 40
      Height: |-
        =80
      Size: |-
        =17
      FontWeight: |-
        =FontWeight.Semibold
- lblSignAs:
    Control: Label
    Properties:
      Text: |-
        ="Signing as " & varPerson.Title & " (AVL ID " & varPerson.AVLID & ")"
      X: |-
        =20
      Y: |-
        =182
      Width: |-
        =Parent.Width - 40
      Height: |-
        =36
      Size: |-
        =14
      Color: |-
        =RGBA(70, 70, 70, 1)
- lblDecl:
    Control: Label
    Properties:
      Text: |-
        =varDeclaration
      X: |-
        =20
      Y: |-
        =226
      Width: |-
        =Parent.Width - 40
      Height: |-
        =130
      Size: |-
        =16
      FontItalic: |-
        =true
      Fill: |-
        =RGBA(240, 245, 242, 1)
      PaddingLeft: |-
        =12
      PaddingRight: |-
        =12
- chkDecl:
    Control: Classic/CheckBox
    Properties:
      Text: |-
        ="I agree with the declaration above"
      Default: |-
        =false
      X: |-
        =20
      Y: |-
        =366
      Width: |-
        =Parent.Width - 40
      Height: |-
        =60
      Size: |-
        =16
- lblSigHint:
    Control: Label
    Properties:
      Text: |-
        ="Sign with your finger:"
      X: |-
        =20
      Y: |-
        =436
      Width: |-
        =400
      Height: |-
        =34
      Size: |-
        =14
      FontWeight: |-
        =FontWeight.Semibold
- btnClearSig:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Clear"
      OnSelect: |-
        =Reset(penSig)
      X: |-
        =Parent.Width - 140
      Y: |-
        =432
      Width: |-
        =120
      Height: |-
        =40
      Fill: |-
        =Transparent
      Color: |-
        =varGreen
      Size: |-
        =14
- penSig:
    Control: PenInput
    Properties:
      X: |-
        =40
      Y: |-
        =476
      Width: |-
        =560
      Height: |-
        =180
      BorderThickness: |-
        =2
      BorderColor: |-
        =RGBA(160, 160, 160, 1)
      Color: |-
        =RGBA(10, 10, 60, 1)
- txtQuestions:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      HintText: |-
        ="Any questions or concerns? They go to Steve (optional - tap the keyboard mic to speak)"
      Mode: |-
        =TextMode.MultiLine
      X: |-
        =20
      Y: |-
        =672
      Width: |-
        =Parent.Width - 40
      Height: |-
        =110
      Size: |-
        =14
- btnSign:
    Control: Classic/Button
    Properties:
      Text: |-
        ="SIGN"
      DisplayMode: |-
        =If(chkDecl.Value, DisplayMode.Edit, DisplayMode.Disabled)
      X: |-
        =20
      Y: |-
        =800
      Width: |-
        =Parent.Width - 40
      Height: |-
        =110
      Fill: |-
        =varGreen
      Size: |-
        =24
      OnSelect: |-
        =With({sig: JSON(penSig.Image, JSONFormat.IncludeBinaryData),
               key: varMtg.Title & "|" & varPerson.AVLID},
          If(
            !chkDecl.Value, Notify("Tick the declaration first.", NotificationType.Error),
            sig = varBlankSig || Len(sig) < Len(varBlankSig) + 100, Notify("Please draw your signature.", NotificationType.Error),
            Len(sig) > 60000, Notify("Signature too large. Tap Clear and sign a little smaller.", NotificationType.Error),
            Today() > varMtg.OpenUntil, Notify("This toolbox closed on " & Text(varMtg.OpenUntil, "d mmm") & ".", NotificationType.Error),
            !IsBlank(LookUp('TBX Signatures', Title = key)), Notify("You have already signed this toolbox.", NotificationType.Warning); Navigate(scrHome, ScreenTransition.UnCover),
            IfError(
              Patch('TBX Signatures', Defaults('TBX Signatures'),
                {Title: key,
                 MeetingID: varMtg.Title,
                 PersonName: varPerson.Title,
                 AVLID: varPerson.AVLID,
                 Team: varPerson.Team,
                 Declaration: varDeclaration,
                 Signature: Substitute(sig, Char(34), ""),
                 SignedAt: Now(),
                 SignedWhen: If(DateDiff(varMtg.MeetingDate, Today(), TimeUnit.Days) <= 0, "At meeting", "Read after meeting"),
                 QuestionsRaised: txtQuestions.Text,
                 SignedInEmail: Lower(User().Email),
                 InSheet: false}),
              Notify("NOT signed: " & FirstError.Message & ". Try again.", NotificationType.Error),
              If(!IsBlank(Trim(txtQuestions.Text)),
                Patch('TBX Questions', Defaults('TBX Questions'),
                  {Title: "Q-" & Text(Now(), "yyyymmdd-hhmmss") & "-" & varPerson.AVLID,
                   MeetingID: varMtg.Title,
                   Topic: varMtg.Topic,
                   PersonName: varPerson.Title,
                   AVLID: varPerson.AVLID,
                   Email: Lower(varPerson.Email),
                   Question: Trim(txtQuestions.Text),
                   AskedAt: Now(),
                   AskedFrom: "Sign-off",
                   QStatus: "New"}));
              Notify("Signed. Thank you, " & varPerson.Title & ".", NotificationType.Success);
              ClearCollect(colMySigs, Filter('TBX Signatures', AVLID = varPerson.AVLID));
              Navigate(scrHome, ScreenTransition.UnCover)
            )
          )
        )
```

### Screen YAML — `scrAsk`

```yaml
# Paste onto the blank screen scrAsk. Staff can ask about the toolbox topic before (or without) signing.
# Each question is saved to TBX Questions and emailed to Steve (flow 5), with the asker as reply-to,
# so Steve can answer or forward it to the leader responsible for the meeting.
- hdrAsk:
    Control: Label
    Properties:
      Text: |-
        ="Ask a question"
      X: |-
        =0
      Y: |-
        =0
      Width: |-
        =Parent.Width
      Height: |-
        =90
      Fill: |-
        =varGreen
      Color: |-
        =White
      Size: |-
        =22
      FontWeight: |-
        =FontWeight.Bold
      Align: |-
        =Align.Center
- btnAskBack:
    Control: Classic/Button
    Properties:
      Text: |-
        ="‹ Back"
      OnSelect: |-
        =Back()
      X: |-
        =10
      Y: |-
        =20
      Width: |-
        =120
      Height: |-
        =50
      Fill: |-
        =Transparent
      Color: |-
        =White
      BorderThickness: |-
        =0
      Size: |-
        =16
- lblAskAbout:
    Control: Label
    Properties:
      Text: |-
        ="About: " & varMtg.Topic & " (" & Text(varMtg.MeetingDate, "d mmm yyyy") & ")" & Char(10) &
         "Your question goes to Steve, who will answer or pass it to the leader responsible for this toolbox. The reply comes to your AVL email."
      X: |-
        =20
      Y: |-
        =100
      Width: |-
        =Parent.Width - 40
      Height: |-
        =150
      Size: |-
        =14
- txtAsk:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      HintText: |-
        ="Type your question, or tap the keyboard mic to speak"
      Mode: |-
        =TextMode.MultiLine
      X: |-
        =20
      Y: |-
        =260
      Width: |-
        =Parent.Width - 40
      Height: |-
        =300
      Size: |-
        =16
- btnAskSend:
    Control: Classic/Button
    Properties:
      Text: |-
        ="SEND QUESTION"
      DisplayMode: |-
        =If(Len(Trim(txtAsk.Text)) > 2, DisplayMode.Edit, DisplayMode.Disabled)
      X: |-
        =20
      Y: |-
        =580
      Width: |-
        =Parent.Width - 40
      Height: |-
        =96
      Fill: |-
        =varGreen
      Size: |-
        =20
      OnSelect: |-
        =IfError(
          Patch('TBX Questions', Defaults('TBX Questions'),
            {Title: "Q-" & Text(Now(), "yyyymmdd-hhmmss") & "-" & varPerson.AVLID,
             MeetingID: varMtg.Title,
             Topic: varMtg.Topic,
             PersonName: varPerson.Title,
             AVLID: varPerson.AVLID,
             Email: Lower(varPerson.Email),
             Question: Trim(txtAsk.Text),
             AskedAt: Now(),
             AskedFrom: "Ask button",
             QStatus: "New"}),
          Notify("NOT sent: " & FirstError.Message, NotificationType.Error),
          Notify("Question sent to Steve. The answer will come to your AVL email.", NotificationType.Success);
          Reset(txtAsk);
          Back()
        )
```

### Screen YAML — `scrAdmin`

```yaml
# Paste onto the blank screen scrAdmin. ADMIN ONLY (TbxRole = Admin). Set scrAdmin.OnVisible (App.fx.md).
# Pick a meeting -> who has signed, who in the team hasn't, sheet / PDF / folder links,
# Close now, Extend 7 days, Mark uploaded to WHS Monitor.
- hdrAdmin:
    Control: Label
    Properties:
      Text: |-
        ="Sign-off status"
      X: |-
        =0
      Y: |-
        =0
      Width: |-
        =Parent.Width
      Height: |-
        =90
      Fill: |-
        =RGBA(0, 70, 140, 1)
      Color: |-
        =White
      Size: |-
        =22
      FontWeight: |-
        =FontWeight.Bold
      Align: |-
        =Align.Center
- btnAdminBack:
    Control: Classic/Button
    Properties:
      Text: |-
        ="‹ Home"
      OnSelect: |-
        =Navigate(scrHome, ScreenTransition.UnCover)
      X: |-
        =10
      Y: |-
        =20
      Width: |-
        =120
      Height: |-
        =50
      Fill: |-
        =Transparent
      Color: |-
        =White
      BorderThickness: |-
        =0
      Size: |-
        =16
- ddAdmMtg:
    Control: Classic/DropDown
    Properties:
      Items: |-
        =ForAll(colRecent As m, {Value: m.Title & "  ·  " & m.Status})
      Default: |-
        =varAdm.Title & "  ·  " & varAdm.Status
      OnChange: |-
        =Set(varAdm, LookUp(colRecent, Title & "  ·  " & Status = ddAdmMtg.Selected.Value));
        ClearCollect(colAdmSigs, Filter('TBX Signatures', MeetingID = varAdm.Title));
        ClearCollect(colTeam, If(varAdm.Team = "All", Filter('TBX People', Active = true), Filter('TBX People', Team = varAdm.Team && Active = true)))
      X: |-
        =20
      Y: |-
        =100
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Size: |-
        =14
- lblAdmSummary:
    Control: Label
    Properties:
      Text: |-
        =varAdm.Topic & Char(10) &
         CountRows(colAdmSigs) & " signed (" & CountRows(Filter(colAdmSigs, SignedWhen = "Read after meeting")) & " after the meeting)  ·  " &
         CountRows(Filter(colTeam As p, IsBlank(LookUp(colAdmSigs, AVLID = p.AVLID)))) & " not signed" & Char(10) &
         "Open until " & Text(varAdm.OpenUntil, "ddd d mmm") & "  ·  " & varAdm.Status &
         If(IsBlank(varAdm.WHSMRef), "", "  ·  WHSM " & varAdm.WHSMRef)
      X: |-
        =20
      Y: |-
        =162
      Width: |-
        =Parent.Width - 40
      Height: |-
        =100
      Size: |-
        =14
- btnAdmSheet:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Sheet"
      DisplayMode: |-
        =If(IsBlank(varAdm.SheetUrl), DisplayMode.Disabled, DisplayMode.Edit)
      OnSelect: |-
        =Launch(varAdm.SheetUrl)
      X: |-
        =20
      Y: |-
        =270
      Width: |-
        =190
      Height: |-
        =56
      Size: |-
        =14
- btnAdmPdf:
    Control: Classic/Button
    Properties:
      Text: |-
        ="PDF"
      DisplayMode: |-
        =If(IsBlank(varAdm.PdfUrl), DisplayMode.Disabled, DisplayMode.Edit)
      OnSelect: |-
        =Launch(varAdm.PdfUrl)
      X: |-
        =225
      Y: |-
        =270
      Width: |-
        =190
      Height: |-
        =56
      Size: |-
        =14
- btnAdmFolder:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Folder"
      OnSelect: |-
        =Launch(varAdm.FolderUrl)
      X: |-
        =430
      Y: |-
        =270
      Width: |-
        =190
      Height: |-
        =56
      Size: |-
        =14
- lblAdmNot:
    Control: Label
    Properties:
      Text: |-
        ="Not signed: " & Concat(Filter(colTeam As p, IsBlank(LookUp(colAdmSigs, AVLID = p.AVLID))), Title, ", ")
      X: |-
        =20
      Y: |-
        =336
      Width: |-
        =Parent.Width - 40
      Height: |-
        =110
      Size: |-
        =13
      Color: |-
        =varRed
- galAdmSigs:
    Control: Gallery
    Variant: Vertical
    Properties:
      Items: |-
        =Sort(colAdmSigs, SignedAt, SortOrder.Ascending)
      TemplateSize: |-
        =56
      X: |-
        =0
      Y: |-
        =450
      Width: |-
        =Parent.Width
      Height: |-
        =Parent.Height - 450 - 260
    Children:
      - lblAdmSigRow:
          Control: Label
          Properties:
            Text: |-
              =ThisItem.PersonName & "  ·  " & Text(ThisItem.SignedAt, "d mmm h:mm am/pm") & "  ·  " & ThisItem.SignedWhen &
               If(ThisItem.InSheet, "", "  ·  (not yet in sheet)")
            X: |-
              =20
            Y: |-
              =6
            Width: |-
              =Parent.TemplateWidth - 40
            Height: |-
              =44
            Size: |-
              =13
- btnAdmClose:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Close now"
      Visible: |-
        =varAdm.Status = "Open"
      OnSelect: |-
        =Patch('TBX Meetings', LookUp('TBX Meetings', ID = varAdm.ID), {Status: "Close requested"});
        Notify("Closing - the PDF will be in the folder within a few minutes.", NotificationType.Success);
        Set(varAdm, LookUp('TBX Meetings', ID = varAdm.ID))
      X: |-
        =20
      Y: |-
        =Parent.Height - 250
      Width: |-
        =290
      Height: |-
        =64
      Fill: |-
        =varRed
      Size: |-
        =15
- btnAdmExtend:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Extend 7 days"
      Visible: |-
        =varAdm.Status = "Open"
      OnSelect: |-
        =Patch('TBX Meetings', LookUp('TBX Meetings', ID = varAdm.ID), {OpenUntil: DateAdd(varAdm.OpenUntil, 7, TimeUnit.Days)});
        Set(varAdm, LookUp('TBX Meetings', ID = varAdm.ID))
      X: |-
        =330
      Y: |-
        =Parent.Height - 250
      Width: |-
        =290
      Height: |-
        =64
      Fill: |-
        =RGBA(0, 70, 140, 1)
      Size: |-
        =15
- txtWHSM:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =varAdm.WHSMRef
      HintText: |-
        ="WHS Monitor reference"
      X: |-
        =20
      Y: |-
        =Parent.Height - 170
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Size: |-
        =15
- btnAdmUploaded:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Mark PDF uploaded to WHS Monitor"
      DisplayMode: |-
        =If(varAdm.Status = "Closed" && !IsBlank(Trim(txtWHSM.Text)), DisplayMode.Edit, DisplayMode.Disabled)
      OnSelect: |-
        =Patch('TBX Meetings', LookUp('TBX Meetings', ID = varAdm.ID), {Status: "Uploaded to WHSM", WHSMRef: Trim(txtWHSM.Text)});
        Set(varAdm, LookUp('TBX Meetings', ID = varAdm.ID));
        Notify("Recorded.", NotificationType.Success)
      X: |-
        =20
      Y: |-
        =Parent.Height - 100
      Width: |-
        =Parent.Width - 40
      Height: |-
        =80
      Fill: |-
        =varGreen
      Size: |-
        =16
```

## Appendix D — Flows

### Toolbox flows (Power Automate, standard connectors only)

All four flows use the Buronga Hill Winery site
`https://australianvintagecomau.sharepoint.com/sites/australiawinemakingburongahillwineryUserCreated`
and time zone **(UTC+10:00) Canberra, Melbourne, Sydney**. Build them under Steve's account (or an L&D
service account). The Office Script `SignOffSheet` must be saved in that account's Excel online
(Excel → Automate → New script → paste `office-scripts/SignOffSheet.ts` → rename to **SignOffSheet**).

Settings are read from the `TBX Settings` list. At the start of each flow, add *Get items* (TBX
Settings), renamed `Get_settings`. Then, for each setting the flow needs (SheetMap, SheetMapFallback,
TemplateMatch, FolderPath, OpenDays, AdminEmail), add a *Filter array* (`@equals(item()?['Title'],'SheetMap')`)
and a **Compose** with the same name as the setting: `first(body('Filter_SheetMap'))?['SettingValue']`.

---

#### Flow 1 · TBX - Open toolbox meetings

**Trigger:** Recurrence, daily 5:00 am. Also turn on *Run* from the flow page for a meeting added late.

1. **Compose `Today`:** `formatDateTime(convertFromUtc(utcNow(),'AUS Eastern Standard Time'),'yyyy-MM-dd')`
2. **Compose `WeekAgo`:** `formatDateTime(addDays(convertFromUtc(utcNow(),'AUS Eastern Standard Time'),-7),'yyyy-MM-dd')`
3. **SharePoint › Get files (properties only)**, renamed `GetFolders`. Library: *Documents*. Limit
   entries to folder: the `FolderPath` setting (`/Shared Documents/Managers Toolbox Meeting`). Include nested items: **No**.
   Filter Query: `FSObjType eq 1`
4. **Filter array `DueFolders`.** The folders are named `yyyy-MM-dd`, which sorts as text, so dates can be
   compared as strings:
   `@and(equals(length(item()?['{Name}']),10), lessOrEqual(item()?['{Name}'],outputs('Today')), greaterOrEqual(item()?['{Name}'],outputs('WeekAgo')))`
5. **Apply to each** `body('DueFolders')`:
   1. **Get items** TBX Meetings, Filter `Title eq 'TBX-@{items('Apply_to_each')?['{Name}']}'`, Top 1.
      → **Condition:** `length(body('Get_items')?['value'])` is 0. If it isn't 0, the meeting already
      exists, so do nothing.
   2. **Get files (properties only)** `FolderFiles`, limited to the folder
      `@{outputs('FolderPath')}/@{items('Apply_to_each')?['{Name}']}`, Include nested items: No,
      Filter `FSObjType eq 0`.
   3. **Filter array `Template`:** `.xlsx` files whose name contains the `TemplateMatch` setting:
      `@and(endsWith(toLower(item()?['{FilenameWithExtension}']),'.xlsx'), contains(toLower(item()?['{FilenameWithExtension}']), toLower(outputs('TemplateMatch'))))`
   4. **Compose `SheetName`:** `Toolbox sign-off @{items('Apply_to_each')?['{Name}']}.xlsx`
   5. **Condition** `length(body('Template'))` greater than 0:
      - **Yes:** *Get file content* (id `first(body('Template'))?['{Identifier}']`) → **Create file** in
        the dated folder, named `outputs('SheetName')`, content = that file content →
        **Compose `Map`** = `outputs('SheetMap')`.
      - **No:** *Get file content using path*
        `@{outputs('FolderPath')}/_Templates/TBX-SignOff-Template.xlsx` → **Create file** in the dated
        folder with the same name → **Compose `Map`** = `outputs('SheetMapFallback')`.

      (*Create file* can rename, which *Copy file* can't. The folder's original template is left as it was.)
   6. **Select `TalkFiles`** from `body('FolderFiles')`, leaving out the template and any earlier sign-off
      files. Use a *Filter array* first:
      `@not(or(contains(toLower(item()?['{FilenameWithExtension}']), toLower(outputs('TemplateMatch'))), startsWith(item()?['{FilenameWithExtension}'],'Toolbox sign-off')))`.
      Map: `name` = `item()?['{FilenameWithExtension}']`, `url` = `item()?['{Link}']`
   7. **Compose `Topic`:** the rule decided in build phase 1. Default: the first talk file's name
      without its extension:
      `if(equals(length(body('TalkFiles')),0),'Toolbox talk',first(split(first(body('TalkFiles'))?['name'],'.')))`
   8. **Create item** TBX Meetings: Title `TBX-@{items('Apply_to_each')?['{Name}']}`, Topic, MeetingDate =
      folder name, Team `All`, FolderPath = `@{outputs('FolderPath')}/@{items('Apply_to_each')?['{Name}']}`,
      FolderUrl = `items('Apply_to_each')?['{Link}']`, Files = `string(body('TalkFiles'))`, OpenUntil =
      `addDays(items('Apply_to_each')?['{Name}'], int(outputs('OpenDays')), 'yyyy-MM-dd')`, Status `Open`,
      SheetPath = the created file's `Path`, SheetUrl = the site URL + the created file's `Path`
      (URL-encode the spaces), SheetMap = `outputs('Map')`.
   9. **Excel Online (Business) › Run script.** Location: the site · Library: Documents · File: the
      created file · Script: **SignOffSheet** · action `heading` · mapJson `outputs('Map')` · dataJson:
      ```
      {"Topic":"@{outputs('Topic')}","MeetingDate":"@{formatDateTime(items('Apply_to_each')?['{Name}'],'dddd d MMMM yyyy')}","Team":"Cellar","Location":"Buronga Hill Winery","MeetingID":"TBX-@{items('Apply_to_each')?['{Name}']}"}
      ```

#### Flow 2 · TBX - Add signature to sheet

**Trigger:** SharePoint › *When an item is created* · TBX Signatures. **Settings › Concurrency control
On, Degree of parallelism 1**, so signatures go in one at a time.

1. **Get items** TBX Meetings, Filter `Title eq '@{triggerBody()?['MeetingID']}'`, Top 1 → Compose `Mtg` =
   `first(body('Get_items')?['value'])`
2. **Run script** · File: `outputs('Mtg')?['SheetPath']` · Script **SignOffSheet** · action `append` ·
   mapJson `outputs('Mtg')?['SheetMap']` · dataJson:
   ```
   {"Name":"@{triggerBody()?['PersonName']}","AVL ID":"@{triggerBody()?['AVLID']}","Team":"@{triggerBody()?['Team']}","Signed when":"@{triggerBody()?['SignedWhen']}","Date & time":"@{convertFromUtc(triggerBody()?['SignedAt'],'AUS Eastern Standard Time','dd/MM/yyyy HH:mm')}","Signature":"@{triggerBody()?['Signature']}"}
   ```
3. **Update item** TBX Signatures (Id `triggerBody()?['ID']`, Title `triggerBody()?['Title']`) · InSheet **Yes**

If step 2 fails (for example, someone has the sheet open in desktop Excel and it's locked), InSheet stays
No and Flow 3 rebuilds the sheet at close. Keep the default retry policy.

#### Flow 3 · TBX - Close meetings

**Trigger:** Recurrence, every 1 hour, 6 am–7 pm. It picks up *Close now* from the app within the hour,
and closes meetings the morning after their OpenUntil date.

1. **Compose `Today`** (as in Flow 1).
2. **Get items** TBX Meetings: `Status eq 'Close requested' or (Status eq 'Open' and OpenUntil lt '@{outputs('Today')}')`
3. **Apply to each** meeting `m`:
   1. **Get items** TBX Signatures: `MeetingID eq '@{items('m')?['Title']}'`, Order By `SignedAt asc`,
      Top 5000.
   2. **Filter array `Missing`:** `@equals(item()?['InSheet'], false)`. If its length is > 0:
      **Select `Rows`** (the same keys as Flow 2's dataJson, for every signature) → **Run script**
      action `rebuild`, mapJson `items('m')?['SheetMap']`, dataJson `string(body('Rows'))` → **Apply to
      each** Missing → Update item InSheet Yes.
   3. **PDF:** *Get file content using path* (`items('m')?['SheetPath']`) → **OneDrive for Business ›
      Create file** `/TBX temp/@{items('m')?['Title']}.xlsx` → **Convert file** (Id from Create file,
      Target type PDF) → **SharePoint › Create file** in `items('m')?['FolderPath']`, named
      `Toolbox sign-off @{formatDateTime(items('m')?['MeetingDate'],'yyyy-MM-dd')}.pdf` → **OneDrive ›
      Delete file** (the temp xlsx).
   4. **Not signed:** *Get items* TBX People `Active eq 1` → **Select `SignedIds`** (AVLID) from the
      signatures → **Filter array `NotSigned`**: `@not(contains(body('SignedIds'), item()?['AVLID']))`
      → **Select** the names → Compose `join(body('NotSignedNames'), ', ')`.
   5. **Update item** TBX Meetings: Status `Closed`, ClosedAt `utcNow()`, PdfUrl = the site URL + the PDF
      path.
   6. **Send an email (V2)** to the `AdminEmail` setting:
      - Subject: `Toolbox @{formatDateTime(items('m')?['MeetingDate'],'d MMM yyyy')} closed - @{length(body('Get_signatures')?['value'])} signed`
      - Body: topic, the number signed at the meeting, the number who read it after, *Not signed:*
        list, a link to the PDF, a link to the folder, and *"Upload the PDF to WHS Monitor, then tap Mark
        uploaded in the app."*

#### Flow 4 · TBX - Reminders (optional, build last)

**Trigger:** Recurrence, daily 6:30 am.
- A meeting with **MeetingDate = today**: a Teams chat (Flow bot) to every active TBX People member:
  *"Toolbox talk today: <Topic>. Read and sign in the AVL Toolbox app: <main board link>"*.
- **Open** meetings on **day 3 and day 6** after the meeting: a Teams chat only to people with no
  signature yet.

#### Flow 5 · TBX - Question to Steve

**Trigger:** SharePoint › *When an item is created* · TBX Questions.

1. Settings: `AdminEmail`.
2. **Get items** TBX Meetings, `Title eq '@{triggerBody()?['MeetingID']}'`, Top 1 → Compose `Mtg`.
3. **Office 365 Outlook › Send an email (V2)**
   - To: `outputs('AdminEmail')`
   - Subject: `Toolbox question - @{triggerBody()?['Topic']} (@{formatDateTime(outputs('Mtg')?['MeetingDate'],'d MMM yyyy')}) - @{triggerBody()?['PersonName']}`
   - **Show advanced options › Reply To:** `triggerBody()?['Email']`. When Steve replies, the answer
     goes straight to the person who asked. To pass the question on, he forwards it to the leader
     responsible for the meeting.
   - Body:
     ```
     <p><b>@{triggerBody()?['PersonName']}</b> (AVL ID @{triggerBody()?['AVLID']}, @{triggerBody()?['Email']}) asked about the toolbox talk
     <b>@{triggerBody()?['Topic']}</b> on @{formatDateTime(outputs('Mtg')?['MeetingDate'],'dddd d MMMM yyyy')}:</p>
     <blockquote style="border-left:4px solid #005e38;padding-left:10px">@{triggerBody()?['Question']}</blockquote>
     <p>Asked @{convertFromUtc(triggerBody()?['AskedAt'],'AUS Eastern Standard Time','ddd d MMM h:mm tt')} from the @{triggerBody()?['AskedFrom']}.</p>
     <p>Reply to this email to answer them directly, or forward it to the leader responsible for this toolbox.<br>
     Talk files: <a href="@{outputs('Mtg')?['FolderUrl']}">dated folder</a> · Question record: TBX Questions › @{triggerBody()?['Title']}</p>
     ```
4. **Update item** TBX Questions: QStatus `Emailed to Steve`.

Steve can record who he forwarded it to (ForwardedTo) and the answer (Answer, QStatus = Answered) in the
TBX Questions list if he wants a register of questions and answers. That's optional; email alone works.

## Appendix E — Fallback template generator (`template/make_template.py`)

Needs Python with openpyxl and Pillow, plus `assets/av-logo-small.png` (the AV monogram Steve supplied). Its layout matches `SHEET_MAP_FALLBACK`.

```python
"""Builds TBX-SignOff-Template.xlsx: AV logo, heading block with named cells, declaration, and the
sign-off table heading at the named cell TableStart. Set up to print / save as A4 landscape PDF.

Run:  python3 make_template.py   (needs openpyxl and Pillow)
"""
from pathlib import Path

from openpyxl import Workbook
from openpyxl.drawing.image import Image as XLImage
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.workbook.defined_name import DefinedName

HERE = Path(__file__).parent
LOGO = HERE.parent / "assets" / "av-logo-small.png"
OUT = HERE / "TBX-SignOff-Template.xlsx"

GREEN = "005E38"
DECLARATION = ("I have read and understood the information in this toolbox talk, I have had the "
               "opportunity to ask questions, and I will follow the controls described.")
HEADERS = ["No.", "Name", "AVL ID", "Team", "Signed when", "Date & time", "Signature"]
WIDTHS = [6, 28, 12, 14, 20, 18, 26]

wb = Workbook()
ws = wb.active
ws.title = "Sign-off"
S = "'Sign-off'"

for i, w in enumerate(WIDTHS):
    ws.column_dimensions[chr(65 + i)].width = w

logo = XLImage(str(LOGO))
logo.height, logo.width = 70, int(70 * logo.width / logo.height)
ws.add_image(logo, "A1")

ws["C1"] = "Toolbox Talk Sign-off"
ws["C1"].font = Font(size=18, bold=True, color=GREEN)
ws.merge_cells("C1:G1")
ws["C2"] = "Australian Vintage · Buronga Hill Winery"
ws["C2"].font = Font(size=10, italic=True, color="555555")
ws.merge_cells("C2:G2")

thin = Side(style="thin", color="BBBBBB")
fields = [  # (row, label, name)
    (4, "Topic", "Topic"),
    (5, "Date", "MeetingDate"),
    (6, "Presenter", "Presenter"),
    (7, "Location", "Location"),
    (8, "Team", "Team"),
    (9, "Record", "MeetingID"),
]
for row, label, name in fields:
    ws.cell(row=row, column=2, value=label + ":").font = Font(bold=True)
    ws.cell(row=row, column=2).alignment = Alignment(horizontal="right")
    ws.merge_cells(start_row=row, start_column=3, end_row=row, end_column=7)
    cell = ws.cell(row=row, column=3)
    cell.border = Border(bottom=thin)
    wb.defined_names[name] = DefinedName(name, attr_text=f"{S}!$C${row}")

ws["A11"] = "Declaration"
ws["A11"].font = Font(bold=True, color=GREEN)
ws.merge_cells("A12:G13")
ws["A12"] = DECLARATION
ws["A12"].alignment = Alignment(wrap_text=True, vertical="top")
ws["A12"].font = Font(italic=True)
wb.defined_names["Declaration"] = DefinedName("Declaration", attr_text=f"{S}!$A$12")

TOP = 15
for i, h in enumerate(HEADERS):
    c = ws.cell(row=TOP, column=i + 1, value=h)
    c.font = Font(bold=True, color="FFFFFF")
    c.fill = PatternFill("solid", fgColor=GREEN)
    c.alignment = Alignment(vertical="center")
wb.defined_names["TableStart"] = DefinedName("TableStart", attr_text=f"{S}!$A${TOP}")

ws.freeze_panes = f"A{TOP + 1}"
ws.print_title_rows = f"{TOP}:{TOP}"
ws.page_setup.orientation = "landscape"
ws.page_setup.paperSize = ws.PAPERSIZE_A4
ws.page_setup.fitToWidth = 1
ws.page_setup.fitToHeight = 0
ws.sheet_properties.pageSetUpPr.fitToPage = True
ws.print_options.horizontalCentered = True
ws.page_margins.left = ws.page_margins.right = 0.4
ws.oddFooter.left.text = "Signed electronically in the AVL Toolbox app"
ws.oddFooter.left.size = 8
ws.oddFooter.right.text = "Page &P of &N"
ws.oddFooter.right.size = 8

wb.save(OUT)
print("wrote", OUT)
```
