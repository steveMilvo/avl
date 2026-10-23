# Build plan — AusGrape Packing Supplies (Power Apps + SharePoint)

**For:** Claude Cowork, driving the user's signed-in Chrome (Claude in Chrome).
**Method:** the `sharepoint-powerapps-builder` skill (load it first if you have it). Everything you need
is in this one file: Appendix A is the list setup script, Appendix B the app formulas and screen YAML,
Appendix C the two flows, and Appendix D the main board tile.

## 1. What you are building

A phone app for AusGrape (Australian Vintage, Buronga) that tracks packing supplies in and out, replacing
the month-end count and the daily paperwork.

- **Peter Manovic (manager, pmanovic@avlwines.com.au)** enters all incoming stock: deliveries, stocktake
  counts, and transfers between the BHW and HQ2 stores. Staff cannot reach this screen.
- **Every AusGrape worker** marks off stock as they take it: a button for each of the 12 sections, a
  drop-down for the item, then qty, store and job / order number. Each take is recorded against their AVL ID.
- **Pack items use their supplies.** One 220 L steel drum also takes 1 × Scholle 802955 aseptic bag,
  1 × 60 micron liner, 1 × cable tie, 1 × PP seal and 1 × label (pre-filled and editable).
- **One central register:** the SharePoint list `AG Stock Movements`.
- **Alerts:** an email to Peter at 20%, then a Teams chat to the same address at 10% or less.
- **Daily report:** an email to Peter at 3:00 pm with stock used, the worker, the time and the
  job / order number.
- **A tile** on the Buronga AVL app nest (main board).

## 2. Confirmed decisions — do not re-ask

| Item | Decision |
|---|---|
| SharePoint site | https://australianvintagecomau.sharepoint.com/sites/AustralianVintage |
| Manager | Peter Manovic · pmanovic@avlwines.com.au · role Manager |
| Peter's AVL ID | The setup script asks for it when it runs. Ask the user at that moment. |
| Drum pack | 1 × Scholle 802955 + 1 × 60 micron liner + 1 cable tie + 1 PP seal + 1 label |
| Alerts | 1st: email at ≤20%. 2nd: Teams chat (Flow bot) at ≤10%. Both to pmanovic@avlwines.com.au |
| Daily report | 3:00 pm Mon–Sat, Sydney time, covering everything since the previous report (48 h on Monday) |
| Draft recipes (fibre drum, cardboard IBC) | Loaded but switched off |
| Opening stock | 0. Peter does a go-live count with "Stocktake count" |

## 3. Rules while working

- Work only in the user's own signed-in Chrome. Never accept the "Allow access to your data" consent
  for the user. That click is theirs.
- Never hard-delete. Remove test rows with `.../items(ID)/recycle()`.
- Don't click while the user is clicking. Confirm any unexpected navigation before you "fix" it.
- Before you paste a formula, check the property name in the formula bar. A click can land on `Text`
  or on the screen's `OnVisible`.
- Stop and ask the user if something here doesn't match what you see (for example, a list already
  exists with different columns).

## 4. Phases and checks

### Phase 1 — SharePoint lists (Appendix A)
1. Open `https://australianvintagecomau.sharepoint.com/sites/AustralianVintage/_layouts/15/viewlsts.aspx`.
2. Run the Appendix A script in that tab (javascript tool or DevTools console). It is async, so read
   `window.__agReport` afterwards. It pops a prompt for Peter's AVL ID: ask the user and type it in.
3. **Check:** the report ends `DONE`. It shows AG Stock Items 61, AG Pack Recipes 15, AG Supply Members
   1 and AG Stock Movements 0. Spot-check that `CON-220L-STEEL-RECON` has 5 active recipe rows.
   Versioning is on for all four lists.

### Phase 2 — Canvas app (Appendix B)
1. make.powerapps.com → Create → Blank canvas app → **Phone** → name **AusGrape Packing Supplies**.
2. Add data sources (SharePoint, the site above): `AG Stock Items`, `AG Stock Movements`,
   `AG Pack Recipes`, `AG Supply Members`. Settings → General → Data row limit **2000**.
3. Paste **App.OnStart**. Create 5 screens with New screen → Blank, then rename each: `scrHome`,
   `scrTake`, `scrMyTakes`, `scrLevels`, `scrReceive`. Delete the default `Screen1` once `scrHome` exists.
   Set **App.StartScreen** = `scrHome`.
4. For each screen, select it and paste its YAML. If the first paste after a rename does nothing,
   retry it. Then set that screen's **OnVisible** from Appendix B.
5. App checker → Formulas → Recheck all → **0 errors**. Delegation warnings on `btnRebuild` are
   expected. Column names in `AddColumns`/`Sort` are written without quotes; if the checker rejects
   them, add quotes. If a Title-column rename isn't recognised, use `Title` (as for Name on Members).
6. `ctrl+s`, then Play, and test as Peter:
   - Receive → Stocktake count: set `220L Reconditioned Steel Drum` BHW = 30, and also BHW for the
     Scholle 802955 bag, 60um liner, Zip Tie, PP Seal and Blank Sticker (e.g. 100 each).
   - Take stock → Containers → 220L Reconditioned Steel Drum, qty 2, BHW, job `TEST - delete me` → the
     5 supplies show pre-filled at 2 each → Save.
   - Today's takes → the 6 rows → Undo this take → the stock is back.
   - Transfer 5 drums BHW → HQ2.
7. **Check over REST:** the movements have the right QtyChange signs, TransactionID, WorkerAVLID,
   Reversed flags and the Undo rows; the item balances match. Then **recycle all test movements** and
   reset the test balances to 0 with Stocktake count, or recycle and use Rebuild balances.

### Phase 3 — Flows (Appendix C)
1. Build **AG Supplies - Low stock alert**, including the trigger condition. Test it with one item:
   25% → nothing; ≤20% → one email; ≤10% → one Teams chat; back above 20% → silent reset.
2. Build **AG Supplies - Daily usage report** (3:00 pm). Run it manually once and check that the email
   arrives with the tables.
3. Recycle any test rows and reset `AlertNotifiedLevel` to `OK` on test items.

### Phase 4 — Publish and share
1. `ctrl+s` → Publish → description "AusGrape packing supplies in/out register" → Publish this version.
2. Get the app ID from the URL (`app-id=/providers/Microsoft.PowerApps/apps/<id>`) and build the play
   link: `https://apps.powerapps.com/play/e/<envId>/a/<appId>?tenantId=<tenantId>`. For AVL, envId =
   tenantId (default environment).
3. Make a QR code PNG for the play link, captioned "Scan with iPhone camera / Sign in with your AVL
   Microsoft account".
4. Share the app with Peter and the AusGrape staff. The user supplies the staff list. Add each person to
   `AG Supply Members` (Title = name, AVLID, Email lower case, SupplyRole = Staff, Active = Yes).

### Phase 5 — Main board tile (Appendix D)
Open the Buronga AVL app nest (main board) app, paste the tile button, put the play link in, match the
existing tiles' size and position, then save and publish. If you can't find the main board app, ask
the user for its name.

## 5. Hand back to the user

- The play link and the QR PNG.
- A table of list URLs: `<site>/Lists/AG%20Stock%20Items`, `AG%20Stock%20Movements`,
  `AG%20Pack%20Recipes`, `AG%20Supply%20Members`. Explain Export → Excel and Version history.
- **Still open:** the staff list (name, AVL ID, email); a full stock level (ParLevel) for each item,
  currently seeded from the 31/08/2026 count; and Peter's go-live stocktake count of every item.

---

## Appendix A — SharePoint setup script (`provision-lists.js`)

Run the whole block in a tab on the site.

```js
/*
 * AusGrape Packing Supplies - SharePoint list provisioning
 *
 * HOW TO RUN
 *   1. Open the target SharePoint site in Chrome or Edge (e.g. {site}/_layouts/15/viewlsts.aspx).
 *   2. Add any staff you already know to CONFIG below. Peter's AVL ID is asked for when the script runs.
 *   3. Open DevTools > Console, paste this whole file and press Enter.
 *   4. Wait for "DONE". Run `window.__agReport` to see the summary again.
 *
 * Safe to run more than once: it skips lists, fields and rows that already exist.
 * It never deletes anything.
 */
(async () => {
  const CONFIG = {
    // Members of the app. Role "Manager" sees Receive / Stocktake / Transfer. "Staff" can only take stock.
    members: [
      { Title: 'Peter Manovic', AVLID: 'ASK', Email: 'pmanovic@avlwines.com.au', SupplyRole: 'Manager' }, // AVLID 'ASK' = the script asks for it when run
      // { Title: 'Rick Podmore', AVLID: '12345', Email: 'rick.podmore@...', SupplyRole: 'Staff' },
    ],
  };

  // ---------------------------------------------------------------- seed data
  // Items and sections copied from "AG PACKING SUPPLIES 21-10-2026", sheet "New Stocktake sheet".
  // OnHand starts at 0: Peter does one go-live count with Stocktake mode in the app.
  // ParLevel (the 100% level for alerts) is seeded from the 31/08/2026 count (BHW + HQ2).
  // Peter must confirm every ParLevel; an item with ParLevel 0 never raises an alert.
  const S = (n, name) => ({ n, name });
  const SEC = {
    CON: S(1, 'Containers'),
    LIN: S(2, 'Liners'),
    SCH: S(3, 'Scholle Aseptic'),
    JET: S(4, 'Jet Aseptic Bags'),
    HAN: S(5, 'Multipac / Hansin'),
    DUN: S(6, 'Dunnage'),
    SEA: S(7, 'Seals / Packaging'),
    PAL: S(8, 'Pallets'),
    STK: S(9, 'Stickers'),
    PLC: S(10, 'New Pallecons'),
    ASH: S(11, 'Ashborn Industries'),
    CMT: S(12, 'CMTP'),
  };
  // [section, ItemCode, Title, SupplierCode, Unit, ParLevel]
  const ITEMS = [
    ['CON', 'CON-10L-PAIL', '10L Square Pail', 'VP10LSQWHG', 'each', 993],
    ['CON', 'CON-20L-PAIL', '20L Pail', 'VP20LSQWH', 'each', 1130],
    ['CON', 'CON-20L-DGQUAD', '20L DG Quad', 'CB20LNATDGV', 'each', 132],
    ['CON', 'CON-MAUSER-NEW', 'Plastic Mauser (new)', '', 'each', 0],
    ['CON', 'CON-MAUSER-OLD', 'Plastic Mauser (old)', '', 'each', 7],
    ['CON', 'CON-205L-FIBRE', '205L Fibre Drum (new)', '', 'each', 146],
    ['CON', 'CON-1000L-RIGID-IBC', '1000L Rigid IBC', '', 'each', 0],
    ['CON', 'CON-220L-STEEL-RECON', '220L Reconditioned Steel Drum', '', 'each', 863],
    ['CON', 'CON-220L-STEEL-2ND', '220L Secondhand Steel Drum', '', 'each', 50],
    ['CON', 'CON-1000L-CB-IBC', '1000L Cardboard IBC', '', 'each', 157],
    ['CON', 'CON-1000L-POCO-IBC', 'Poco 6 Ply 1000L Cardboard IBC', '', 'each', 48],
    ['CON', 'CON-WOODEN-BIN', 'Wooden Bin (internal use only)', '', 'each', 0],
    ['CON', 'CON-CHEP-IBC', 'Chep IBC', '', 'each', 0],
    ['CON', 'CON-WALKERS-IBC', 'Walkers Plastic IBC', '', 'each', 0],
    ['LIN', 'LIN-200L-60UM', '200L 60um Bag (60 micron)', 'PFB5523', 'each', 5100],
    ['LIN', 'LIN-200L-100UM', '200L 100um Bag (100 micron)', 'PFB5522', 'each', 3500],
    ['LIN', 'LIN-1000L-PW', '1000L PW Pallet Bag', 'PWB5065', 'each', 3500],
    ['SCH', 'SCH-3L-804038', 'Scholle 3L Aseptic Sample Bag #804038', '804038', 'each', 0],
    ['SCH', 'SCH-5L-264590', 'Scholle 5L Aseptic Bag #264590', '264590', 'each', 2600],
    ['SCH', 'SCH-20L-262742', 'Scholle 20L Aseptic Bag #262742', '262742', 'each', 700],
    ['SCH', 'SCH-200L-802955', 'Scholle 200L Aseptic Bag #802955', '802955', 'each', 635],
    ['JET', 'JET-3L-FS1V0174', 'Jet 3L Aseptic Bag #FS1V.0174', 'FS1V.0174', 'each', 0],
    ['JET', 'JET-1000L-FS2V0679', 'Jet 1000L Aseptic Bag #FS2V.0679', 'FS2V.0679', 'each', 0],
    ['HAN', 'HAN-220L-MB6071', 'Hansin 220L Bag MB6071', 'MB6071', 'each', 9075],
    ['HAN', 'HAN-3L', 'Hansin 3L Bag', '', 'each', 2200],
    ['HAN', 'HAN-1400L-MB7242', 'Hansin 1400L Bag MB7242', 'MB7242', 'each', 926],
    ['HAN', 'HAN-20L-ML1020S', 'Hansin 20L Bag ML1020S', 'ML1020S', 'each', 1490],
    ['DUN', 'DUN-FOAM-SLAB', 'Foam Slab', '', 'each', 30],
    ['DUN', 'DUN-FOAM-RING', 'Foam Ring', '', 'each', 0],
    ['DUN', 'DUN-CB-RING', 'Cardboard Ring', '', 'each', 870],
    ['DUN', 'DUN-CB-SLAB', 'Cardboard Slab', '', 'each', 42],
    ['DUN', 'DUN-CELLAIR', 'Cellair PO4 Polyfoam Roll', '20604100', 'roll', 17],
    ['DUN', 'DUN-CB-SHEET', 'Cardboard Sheet', '', 'each', 0],
    ['DUN', 'DUN-CB-SLEEVE', 'Cardboard Sleeve 480x480x830', '', 'each', 500],
    ['SEA', 'SEA-DUCT-TAPE', 'Duct Tape', '', 'roll', 7],
    ['SEA', 'SEA-PALLET-WRAP', 'Pallet Wrap', '', 'roll', 1],
    ['SEA', 'SEA-BLACK-STRAP', 'Black Strapping', '', 'roll', 6],
    ['SEA', 'SEA-STRAP-CLAMP', 'Strapping Clamp', '', 'each', 2400],
    ['SEA', 'SEA-HAND-WRAP', 'Bundling Hand Wrap', '', 'roll', 8],
    ['SEA', 'SEA-WOVEN-STRAP', 'Woven Strapping', '', 'roll', 5],
    ['SEA', 'SEA-WOVEN-BUCKLE', 'Woven Strapping Buckle', '', 'each', 760],
    ['SEA', 'SEA-PP-SEAL', 'PP Seal', '', 'each', 4500],
    ['SEA', 'SEA-ZIP-TIE', 'Zip Tie (cable tie)', '', 'each', 4000],
    ['SEA', 'SEA-TEK-BIN', 'Tech Screw (wooden bin lids)', '', 'each', 50],
    ['SEA', 'SEA-TEK-FIBRE', 'Tech Screw (wedges for fibres)', '', 'each', 1050],
    ['SEA', 'SEA-STAPLE', 'Staple (fibre lids)', '', 'each', 2800],
    ['PAL', 'PAL-CHEP-EMPTY', 'Empty Chep Pallet', '', 'each', 41],
    ['PAL', 'PAL-1120-BLACK', 'Export Pallet 1120 (BLACK)', '', 'each', 4],
    ['PAL', 'PAL-1120-SILVER', 'Export Pallet 1120 LP for IBC (SILVER)', '', 'each', 194],
    ['PAL', 'PAL-1165-BLUE', 'Export Pallet 1165 (BLUE)', '', 'each', 8],
    ['PAL', 'PAL-GREEN-POCO', 'Export Pallet Green (Poco IBC)', '', 'each', 140],
    ['PAL', 'PAL-TWIN-HIRISE', 'Export Pallet Twin Hi Rise', '', 'each', 0],
    ['PAL', 'PAL-VIP-DRUM-RED', 'VIP Drum Pallet (RED)', '', 'each', 18],
    ['STK', 'STK-BLANK', 'Blank Sticker (label)', '', 'each', 8700],
    ['STK', 'STK-PRINTER-INK', 'Printer Ink', '', 'each', 60],
    ['PLC', 'PLC-DG-RATED', 'Pallecon DG Rated', '', 'each', 3],
    ['ASH', 'ASH-H-FRAME', 'Container Frame - H Frame', '', 'each', 51],
    ['ASH', 'ASH-BOOKSHELF', 'Container Frame - Bookshelf', '', 'each', 1],
    ['ASH', 'ASH-WOODEN-EXPORT-BIN', 'Wooden Export Bin', '', 'each', 0],
    ['CMT', 'CMT-PINE-2240x1120', 'Export Stamped Pine Sheet 2240x1120 (pails)', '', 'each', 12],
    ['CMT', 'CMT-PINE-2240x840', 'Export Stamped Pine Sheet 2240x840 (pails)', '', 'each', 3],
  ];

  // Pack recipes: what one pack unit also uses up.
  // [PackItemCode, ComponentCode, AltComponentCode, QtyPerPack, Active, Notes]
  const RECIPES = [
    // 200 L steel drum, from the Packaging Request Form "PACK 1" block (confirmed by AusGrape 23/10/2026).
    ['CON-220L-STEEL-RECON', 'SCH-200L-802955', 'HAN-220L-MB6071', 1, true, '1 x Scholle 802955 (confirmed default). Hansin MB6071 selectable if used instead.'],
    ['CON-220L-STEEL-RECON', 'LIN-200L-60UM', 'LIN-200L-100UM', 1, true, '1 x 60 micron liner (confirmed default)'],
    ['CON-220L-STEEL-RECON', 'SEA-ZIP-TIE', '', 1, true, '1 x cable tie (confirmed)'],
    ['CON-220L-STEEL-RECON', 'SEA-PP-SEAL', '', 1, true, 'PP seal - 1 per steel drum (Stock Weights sheet)'],
    ['CON-220L-STEEL-RECON', 'STK-BLANK', '', 1, true, 'Label 1: 1/3 top of drum - batch details'],
    ['CON-220L-STEEL-2ND', 'SCH-200L-802955', 'HAN-220L-MB6071', 1, true, 'Same as reconditioned drum'],
    ['CON-220L-STEEL-2ND', 'LIN-200L-60UM', 'LIN-200L-100UM', 1, true, ''],
    ['CON-220L-STEEL-2ND', 'SEA-ZIP-TIE', '', 1, true, '1 x cable tie (confirmed)'],
    ['CON-220L-STEEL-2ND', 'SEA-PP-SEAL', '', 1, true, ''],
    ['CON-220L-STEEL-2ND', 'STK-BLANK', '', 1, true, ''],
    // Drafts from the Stock Weights comments. Inactive until Peter confirms them.
    ['CON-205L-FIBRE', 'SEA-TEK-FIBRE', '', 2, false, 'DRAFT - 2 per fibre drum'],
    ['CON-205L-FIBRE', 'SEA-STAPLE', '', 4, false, 'DRAFT - 4 per fibre drum lid'],
    ['CON-1000L-CB-IBC', 'JET-1000L-FS2V0679', 'HAN-1400L-MB7242', 1, false, 'DRAFT - spec option 2 bag'],
    ['CON-1000L-CB-IBC', 'LIN-1000L-PW', '', 1, false, 'DRAFT - 1 x 100um PW5 liner'],
    ['CON-1000L-CB-IBC', 'SEA-STRAP-CLAMP', '', 4, false, 'DRAFT - 4 per IBC'],
  ];

  // ------------------------------------------------------------- list schemas
  // Field: [InternalName, Type, {indexed, unique, def}]
  const LISTS = [
    {
      title: 'AG Stock Items',
      desc: 'AusGrape packing supplies - one row per stock item with live on-hand balances.',
      titleName: 'Item', titleUnique: true,
      fields: [
        ['ItemCode', 'Text', { indexed: true, unique: true }],
        ['Section', 'Text', { indexed: true }],
        ['SectionOrder', 'Number'],
        ['SupplierCode', 'Text'],
        ['Unit', 'Text'],
        ['OnHandBHW', 'Number', { def: '0' }],
        ['OnHandHQ2', 'Number', { def: '0' }],
        ['OnHand', 'Number', { def: '0' }],
        ['ParLevel', 'Number', { def: '0' }],
        ['AlertNotifiedLevel', 'Text'],
        ['Active', 'Boolean', { indexed: true, def: '1' }],
        ['Notes', 'Note'],
      ],
    },
    {
      title: 'AG Stock Movements',
      desc: 'AusGrape packing supplies - central register of every stock movement (in, out, count, transfer).',
      titleName: 'Movement ID', titleUnique: true,
      fields: [
        ['MovementDate', 'DateTime', { indexed: true }],
        ['MovementDay', 'Text', { indexed: true }],
        ['MovementType', 'Text', { indexed: true }],
        ['ItemCode', 'Text', { indexed: true }],
        ['ItemName', 'Text'],
        ['Section', 'Text'],
        ['Qty', 'Number'],
        ['QtyChange', 'Number'],
        ['Location', 'Text'],
        ['BalanceAfter', 'Number'],
        ['JobNumber', 'Text', { indexed: true }],
        ['TransactionID', 'Text', { indexed: true }],
        ['PackItemCode', 'Text'],
        ['WorkerName', 'Text'],
        ['WorkerEmail', 'Text'],
        ['WorkerAVLID', 'Text', { indexed: true }],
        ['RecordedByEmail', 'Text'],
        ['Supplier', 'Text'],
        ['DocketNo', 'Text'],
        ['Reversed', 'Boolean', { indexed: true, def: '0' }],
        ['ReversalOf', 'Text'],
        ['Notes', 'Note'],
      ],
    },
    {
      title: 'AG Pack Recipes',
      desc: 'AusGrape packing supplies - supplies used automatically with each pack (e.g. one 200 L drum).',
      titleName: 'Recipe key', titleUnique: true,
      fields: [
        ['PackItemCode', 'Text', { indexed: true }],
        ['ComponentCode', 'Text'],
        ['AltComponentCode', 'Text'],
        ['QtyPerPack', 'Number'],
        ['Active', 'Boolean', { indexed: true, def: '1' }],
        ['Notes', 'Note'],
      ],
    },
    {
      title: 'AG Supply Members',
      desc: 'AusGrape packing supplies - who can use the app and their role (Manager / Staff).',
      titleName: 'Name', titleUnique: false,
      fields: [
        ['AVLID', 'Text', { indexed: true, unique: true }],
        ['Email', 'Text', { indexed: true, unique: true }],
        ['SupplyRole', 'Text'],
        ['Active', 'Boolean', { indexed: true, def: '1' }],
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
    const extra = type === 'DateTime' ? ' Format="DateTime"' : type === 'Note' ? ' NumLines="6" RichText="FALSE"' : '';
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
  await seed('AG Stock Items', 'ItemCode', ITEMS.map(([s, code, title, sup, unit, par]) => ({
    Title: title, ItemCode: code, Section: SEC[s].name, SectionOrder: SEC[s].n, SupplierCode: sup, Unit: unit,
    OnHandBHW: 0, OnHandHQ2: 0, OnHand: 0, ParLevel: par, AlertNotifiedLevel: 'OK', Active: true,
  })));
  await seed('AG Pack Recipes', 'Title', RECIPES.map(([pack, comp, alt, qty, active, notes]) => ({
    Title: `${pack}|${comp}`, PackItemCode: pack, ComponentCode: comp, AltComponentCode: alt, QtyPerPack: qty, Active: active, Notes: notes,
  })));
  for (const m of CONFIG.members) {
    if (m.AVLID === 'ASK') m.AVLID = (window.prompt(`AVL ID for ${m.Title} (${m.Email})`) || '').trim() || 'CHANGE-ME';
  }
  await seed('AG Supply Members', 'Email', CONFIG.members
    .filter((m) => !m.Email.includes('CHANGE-ME') && m.AVLID !== 'CHANGE-ME')
    .map((m) => ({ ...m, Email: m.Email.toLowerCase(), Active: true })));
  if (CONFIG.members.some((m) => m.Email.includes('CHANGE-ME') || m.AVLID === 'CHANGE-ME')) say('NOTE: members with no email or AVL ID were skipped - run again and enter the AVL ID.');

  // ----------------------------------------------------------------- verify
  for (const def of LISTS) {
    const n = (await api(`${L(def.title)}?$select=ItemCount`)).ItemCount;
    say(`${def.title}: ${n} rows  ->  ${web}/Lists/${encodeURIComponent(def.title)}`);
  }
  say('DONE');
  window.__agReport = log.join('\n');
})().catch((e) => { console.error(e); window.__agReport = 'FAILED: ' + e.message; });
```

## Appendix B — App formulas and screens

### App-level settings and screen formulas

App name: **AusGrape Packing Supplies** · Format: **Phone** (640 × 1136) · Data sources (SharePoint, the site you ran `provision-lists.js` on):
`AG Stock Items`, `AG Stock Movements`, `AG Pack Recipes`, `AG Supply Members`.

Settings → General → **Data row limit = 2000** (used by "Rebuild balances from register" on the Levels screen).

#### Screens (create each with New screen → Blank, then rename)

| Screen | Who | Paste file |
|---|---|---|
| `scrHome` | everyone | `screens/scrHome.yaml` |
| `scrTake` | everyone (staff + manager) | `screens/scrTake.yaml` |
| `scrMyTakes` | everyone | `screens/scrMyTakes.yaml` |
| `scrLevels` | everyone (rebuild button is manager only) | `screens/scrLevels.yaml` |
| `scrReceive` | **manager only** (Peter) | `screens/scrReceive.yaml` |

Set `App.StartScreen` to `=scrHome`.

#### App.OnStart

```
=Set(varLocations, ["BHW", "HQ2"]);
Set(varGreen, RGBA(0, 94, 56, 1));
Set(varAmber, RGBA(214, 140, 0, 1));
Set(varRed, RGBA(184, 28, 28, 1))
```

#### scrHome.OnVisible

Loads the signed-in person, the item catalogue and the section buttons (in spreadsheet order).

```
=Set(varMe, LookUp('AG Supply Members', Email = Lower(User().Email) && Active = true));
Set(varIsManager, !IsBlank(varMe) && varMe.SupplyRole = "Manager");
Refresh('AG Stock Items');
ClearCollect(colItems, Filter('AG Stock Items', Active = true));
ClearCollect(colSections,
    Sort(
        ForAll(Distinct(colItems, Section) As d,
            {Section: d.Value, SecOrder: Min(Filter(colItems, Section = d.Value), SectionOrder)}),
        SecOrder))
```

#### scrTake.OnVisible

```
=Set(varSection, Blank());
Set(varItem, Blank());
Clear(colBom);
Reset(txtQty); Reset(txtJob); Reset(txtNote); Reset(txtAVL)
```

#### scrReceive.OnVisible

```
=If(!varIsManager, Navigate(scrHome, ScreenTransition.None));
Reset(txtRQty); Reset(txtRSupplier); Reset(txtRDocket); Reset(txtRNote)
```

#### scrLevels.OnVisible

```
=Set(varConfirmRebuild, false);
Refresh('AG Stock Items');
ClearCollect(colItems, Filter('AG Stock Items', Active = true))
```

#### scrMyTakes.OnVisible

```
=Refresh('AG Stock Movements')
```

#### Notes on the Power Fx

- **Staff are tracked by AVL ID, not only by phone login.** Site phones may be shared, so the Take
  screen asks for the AVL ID (pre-filled with the signed-in person's ID) and records the member that ID
  belongs to. Unknown or inactive IDs are refused.
- **On-hand is held per location** (`OnHandBHW`, `OnHandHQ2`) plus a total `OnHand` that the alert flow
  reads. Every change also writes a row to `AG Stock Movements`, so the register can always rebuild
  the balances (Levels → *Rebuild balances from register*).
- **Delegation:** every list filter uses `=` on an indexed column (`ItemCode`, `MovementDay`,
  `WorkerAVLID`, `TransactionID`, `Active`), which SharePoint delegates. The register can grow without
  limit.
- **New Power Fx syntax:** column names in `AddColumns`/`Sort` are written without quotes. If the App
  checker flags them in an older app, wrap them in quotes.

### Screen YAML — `scrHome`

```yaml
# Paste onto the blank screen scrHome (select the screen, then Ctrl+V).
# Set scrHome.OnVisible separately - see App.fx.md.
- hdrHome:
    Control: Label
    Properties:
      Text: |-
        ="AusGrape Packing Supplies"
      X: |-
        =0
      Y: |-
        =0
      Width: |-
        =Parent.Width
      Height: |-
        =110
      Fill: |-
        =varGreen
      Color: |-
        =White
      Size: |-
        =24
      FontWeight: |-
        =FontWeight.Bold
      Align: |-
        =Align.Center
- lblHello:
    Control: Label
    Properties:
      Text: |-
        =If(IsBlank(varMe),
            "You are not set up yet (" & User().Email & "). You can still take stock with your AVL ID. Ask Peter to add you.",
            "Hi " & varMe.Title & If(varIsManager, "  ·  Manager", ""))
      X: |-
        =20
      Y: |-
        =125
      Width: |-
        =Parent.Width - 40
      Height: |-
        =80
      Size: |-
        =15
- btnHomeTake:
    Control: Classic/Button
    Properties:
      Text: |-
        ="TAKE STOCK FROM STORAGE"
      OnSelect: |-
        =Navigate(scrTake, ScreenTransition.Cover)
      X: |-
        =20
      Y: |-
        =220
      Width: |-
        =Parent.Width - 40
      Height: |-
        =140
      Fill: |-
        =varGreen
      Size: |-
        =22
      RadiusTopLeft: |-
        =12
      RadiusTopRight: |-
        =12
      RadiusBottomLeft: |-
        =12
      RadiusBottomRight: |-
        =12
- btnHomeMine:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Today's takes / undo"
      OnSelect: |-
        =Navigate(scrMyTakes, ScreenTransition.Cover)
      X: |-
        =20
      Y: |-
        =380
      Width: |-
        =Parent.Width - 40
      Height: |-
        =90
      Fill: |-
        =RGBA(60, 60, 60, 1)
      Size: |-
        =18
- btnHomeLevels:
    Control: Classic/Button
    Properties:
      Text: |-
        ="Stock levels"
      OnSelect: |-
        =Navigate(scrLevels, ScreenTransition.Cover)
      X: |-
        =20
      Y: |-
        =490
      Width: |-
        =Parent.Width - 40
      Height: |-
        =90
      Fill: |-
        =RGBA(60, 60, 60, 1)
      Size: |-
        =18
- btnHomeReceive:
    Control: Classic/Button
    Properties:
      Text: |-
        ="MANAGER: Receive / Count / Transfer"
      OnSelect: |-
        =Navigate(scrReceive, ScreenTransition.Cover)
      Visible: |-
        =varIsManager
      X: |-
        =20
      Y: |-
        =620
      Width: |-
        =Parent.Width - 40
      Height: |-
        =110
      Fill: |-
        =RGBA(0, 70, 140, 1)
      Size: |-
        =18
- lblHomeFoot:
    Control: Label
    Properties:
      Text: |-
        ="Every take is recorded against your AVL ID with the time and job / order number."
      X: |-
        =20
      Y: |-
        =Parent.Height - 90
      Width: |-
        =Parent.Width - 40
      Height: |-
        =70
      Size: |-
        =12
      Color: |-
        =RGBA(90, 90, 90, 1)
```

### Screen YAML — `scrTake`

```yaml
# Paste onto the blank screen scrTake. Set scrTake.OnVisible separately - see App.fx.md.
# Step 1: worker taps a SECTION button (one per section of the stocktake sheet).
# Step 2: worker picks the ITEM from the drop-down, enters qty, location and job / order number.
#         If the item is a pack (e.g. 220L steel drum) the supplies it uses are listed and pre-filled
#         (qty x per-pack) - the worker can change the bag type or quantity before saving.
- hdrTake:
    Control: Label
    Properties:
      Text: |-
        ="Take stock"
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
- btnTakeBack:
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
- lblAVL:
    Control: Label
    Properties:
      Text: |-
        ="Your AVL ID"
      X: |-
        =20
      Y: |-
        =100
      Width: |-
        =190
      Height: |-
        =56
      Size: |-
        =16
      FontWeight: |-
        =FontWeight.Semibold
- txtAVL:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =varMe.AVLID
      HintText: |-
        ="AVL ID"
      X: |-
        =220
      Y: |-
        =100
      Width: |-
        =400
      Height: |-
        =56
      Size: |-
        =18
- lblWho:
    Control: Label
    Properties:
      Text: |-
        =With({w: LookUp('AG Supply Members', AVLID = Trim(txtAVL.Text) && Active = true)},
            If(IsBlank(Trim(txtAVL.Text)), "Enter your AVL ID",
               IsBlank(w), "AVL ID not found - ask Peter to add you",
               "Taking as: " & w.Title))
      Color: |-
        =If(IsBlank(LookUp('AG Supply Members', AVLID = Trim(txtAVL.Text) && Active = true)), varRed, varGreen)
      X: |-
        =20
      Y: |-
        =160
      Width: |-
        =Parent.Width - 40
      Height: |-
        =40
      Size: |-
        =14
- lblPickSection:
    Control: Label
    Properties:
      Text: |-
        ="1. Tap the section"
      Visible: |-
        =IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =205
      Width: |-
        =Parent.Width - 40
      Height: |-
        =40
      Size: |-
        =17
      FontWeight: |-
        =FontWeight.Semibold
- galSections:
    Control: Gallery
    Variant: Vertical
    Properties:
      Items: |-
        =colSections
      Visible: |-
        =IsBlank(varSection)
      WrapCount: |-
        =2
      TemplateSize: |-
        =84
      TemplatePadding: |-
        =6
      X: |-
        =14
      Y: |-
        =250
      Width: |-
        =Parent.Width - 28
      Height: |-
        =Parent.Height - 270
    Children:
      - btnSection:
          Control: Classic/Button
          Properties:
            Text: |-
              =ThisItem.Section
            OnSelect: |-
              =Set(varSection, ThisItem.Section);
              Set(varItem, Blank());
              Reset(ddItem);
              Clear(colBom)
            X: |-
              =0
            Y: |-
              =0
            Width: |-
              =Parent.TemplateWidth - 12
            Height: |-
              =Parent.TemplateHeight - 12
            Fill: |-
              =varGreen
            Size: |-
              =16
- btnSectionChip:
    Control: Classic/Button
    Properties:
      Text: |-
        =varSection & "   (tap to change section)"
      OnSelect: |-
        =Set(varSection, Blank());
        Set(varItem, Blank());
        Reset(ddItem);
        Clear(colBom)
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =205
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Fill: |-
        =RGBA(225, 240, 230, 1)
      Color: |-
        =varGreen
      Size: |-
        =16
- lblItem:
    Control: Label
    Properties:
      Text: |-
        ="2. Item taken"
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =268
      Width: |-
        =Parent.Width - 40
      Height: |-
        =34
      Size: |-
        =15
      FontWeight: |-
        =FontWeight.Semibold
- ddItem:
    Control: Classic/DropDown
    Properties:
      Items: |-
        =ForAll(Sort(Filter(colItems, Section = varSection), Title) As i, {Value: i.Title})
      AllowEmptySelection: |-
        =true
      Default: |-
        =""
      OnChange: |-
        =Set(varItem, LookUp(colItems, Title = ddItem.Selected.Value));
        ClearCollect(colBom,
            ForAll(Filter('AG Pack Recipes', PackItemCode = varItem.ItemCode && Active = true) As r,
                {ComponentCode: r.ComponentCode,
                 AltComponentCode: r.AltComponentCode,
                 QtyPerPack: r.QtyPerPack,
                 CompName: LookUp(colItems, ItemCode = r.ComponentCode).Title,
                 AltName: LookUp(colItems, ItemCode = r.AltComponentCode).Title}))
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =302
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Size: |-
        =16
- lblQty:
    Control: Label
    Properties:
      Text: |-
        ="Quantity"
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =366
      Width: |-
        =180
      Height: |-
        =34
      Size: |-
        =15
      FontWeight: |-
        =FontWeight.Semibold
- txtQty:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      Format: |-
        =TextFormat.Number
      HintText: |-
        ="e.g. 24"
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =400
      Width: |-
        =180
      Height: |-
        =56
      Size: |-
        =18
- lblLoc:
    Control: Label
    Properties:
      Text: |-
        ="From store"
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =215
      Y: |-
        =366
      Width: |-
        =180
      Height: |-
        =34
      Size: |-
        =15
      FontWeight: |-
        =FontWeight.Semibold
- ddLoc:
    Control: Classic/DropDown
    Properties:
      Items: |-
        =varLocations
      Default: |-
        ="BHW"
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =215
      Y: |-
        =400
      Width: |-
        =180
      Height: |-
        =56
      Size: |-
        =16
- lblOnHand:
    Control: Label
    Properties:
      Text: |-
        =If(IsBlank(varItem), "",
            "On hand " & ddLoc.Selected.Value & ": " &
            Text(If(ddLoc.Selected.Value = "BHW", varItem.OnHandBHW, varItem.OnHandHQ2)))
      Color: |-
        =If(!IsBlank(varItem) && Value(txtQty.Text) > If(ddLoc.Selected.Value = "BHW", varItem.OnHandBHW, varItem.OnHandHQ2), varRed, RGBA(60, 60, 60, 1))
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =410
      Y: |-
        =400
      Width: |-
        =Parent.Width - 425
      Height: |-
        =56
      Size: |-
        =13
- lblJob:
    Control: Label
    Properties:
      Text: |-
        ="Job / order number (if any)"
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =464
      Width: |-
        =Parent.Width - 40
      Height: |-
        =34
      Size: |-
        =15
      FontWeight: |-
        =FontWeight.Semibold
- txtJob:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      HintText: |-
        ="e.g. BX6295-BJWS or PO number"
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =498
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Size: |-
        =16
- lblBom:
    Control: Label
    Properties:
      Text: |-
        ="Also used with this pack (change bag type or qty if different):"
      Visible: |-
        =!IsBlank(varSection) && !IsEmpty(colBom)
      X: |-
        =20
      Y: |-
        =562
      Width: |-
        =Parent.Width - 40
      Height: |-
        =34
      Size: |-
        =13
      FontWeight: |-
        =FontWeight.Semibold
      Color: |-
        =varGreen
- galBom:
    Control: Gallery
    Variant: Vertical
    Properties:
      Items: |-
        =colBom
      Visible: |-
        =!IsBlank(varSection) && !IsEmpty(colBom)
      TemplateSize: |-
        =64
      TemplatePadding: |-
        =2
      X: |-
        =14
      Y: |-
        =598
      Width: |-
        =Parent.Width - 28
      Height: |-
        =330
    Children:
      - ddBomItem:
          Control: Classic/DropDown
          Properties:
            Items: |-
              =Filter(Table({Value: ThisItem.CompName}, {Value: ThisItem.AltName}), !IsBlank(Value))
            Default: |-
              =ThisItem.CompName
            X: |-
              =6
            Y: |-
              =4
            Width: |-
              =Parent.TemplateWidth - 180
            Height: |-
              =54
            Size: |-
              =13
      - txtBomQty:
          Control: Classic/TextInput
          Properties:
            Default: |-
              =Text(ThisItem.QtyPerPack * Value(txtQty.Text))
            Format: |-
              =TextFormat.Number
            X: |-
              =Parent.TemplateWidth - 165
            Y: |-
              =4
            Width: |-
              =150
            Height: |-
              =54
            Size: |-
              =16
- txtNote:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      HintText: |-
        ="Note (optional) - tap the mic on the keyboard to dictate"
      Mode: |-
        =TextMode.MultiLine
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =934
      Width: |-
        =Parent.Width - 40
      Height: |-
        =66
      Size: |-
        =14
- btnTakeSave:
    Control: Classic/Button
    Properties:
      Text: |-
        ="SAVE - I TOOK THIS"
      DisplayMode: |-
        =If(IsBlank(varItem) || Value(txtQty.Text) <= 0, DisplayMode.Disabled, DisplayMode.Edit)
      Visible: |-
        =!IsBlank(varSection)
      X: |-
        =20
      Y: |-
        =1012
      Width: |-
        =Parent.Width - 40
      Height: |-
        =100
      Fill: |-
        =varGreen
      Size: |-
        =20
      OnSelect: |-
        =With({w: LookUp('AG Supply Members', AVLID = Trim(txtAVL.Text) && Active = true),
               q: Value(txtQty.Text),
               loc: ddLoc.Selected.Value,
               job: Upper(Trim(txtJob.Text))},
          If(
            IsBlank(w), Notify("Enter a valid AVL ID. Ask Peter to add you if you are not set up.", NotificationType.Error),
            IsBlank(varItem), Notify("Choose the item you took.", NotificationType.Error),
            IsBlank(q) || q <= 0, Notify("Enter the quantity you took.", NotificationType.Error),
            Set(varTxn, Text(Now(), "yyyymmdd-hhmmss") & "-" & w.AVLID);
            ClearCollect(colTake, {Code: varItem.ItemCode, Qty: q, Kind: "Use", Parent: ""});
            Collect(colTake,
                ForAll(Filter(galBom.AllItems, Value(txtBomQty.Text) > 0),
                    {Code: LookUp(colItems, Title = ddBomItem.Selected.Value).ItemCode,
                     Qty: Value(txtBomQty.Text),
                     Kind: "Use - with pack",
                     Parent: varItem.ItemCode}));
            IfError(
              ForAll(colTake As t,
                With({it: LookUp('AG Stock Items', ItemCode = t.Code)},
                  With({bhw: it.OnHandBHW - If(loc = "BHW", t.Qty, 0),
                        hq2: it.OnHandHQ2 - If(loc = "HQ2", t.Qty, 0)},
                    Patch('AG Stock Items', it, {OnHandBHW: bhw, OnHandHQ2: hq2, OnHand: bhw + hq2});
                    Patch('AG Stock Movements', Defaults('AG Stock Movements'),
                      {Title: varTxn & "-" & t.Code,
                       MovementDate: Now(),
                       MovementDay: Text(Today(), "yyyy-mm-dd"),
                       MovementType: t.Kind,
                       ItemCode: t.Code,
                       ItemName: it.Title,
                       Section: it.Section,
                       Qty: t.Qty,
                       QtyChange: -t.Qty,
                       Location: loc,
                       BalanceAfter: bhw + hq2,
                       JobNumber: job,
                       TransactionID: varTxn,
                       PackItemCode: t.Parent,
                       WorkerName: w.Title,
                       WorkerEmail: w.Email,
                       WorkerAVLID: w.AVLID,
                       RecordedByEmail: Lower(User().Email),
                       Reversed: false,
                       Notes: txtNote.Text})))),
              Notify("NOT saved: " & FirstError.Message & ". Try again or tell Peter.", NotificationType.Error),
              Notify("Saved: " & q & " x " & varItem.Title & If(CountRows(colTake) > 1, " + " & (CountRows(colTake) - 1) & " supplies", "") & If(job <> "", " for " & job, ""), NotificationType.Success);
              ClearCollect(colItems, Filter('AG Stock Items', Active = true));
              Set(varItem, Blank());
              Reset(ddItem);
              Reset(txtQty);
              Reset(txtNote);
              Clear(colBom)
            )
          )
        )
```

### Screen YAML — `scrMyTakes`

```yaml
# Paste onto the blank screen scrMyTakes. Today's movements for one AVL ID (manager can show everyone).
# "Undo this take" reverses the whole take (e.g. the drum AND the bag, liner, seal, ties and label used with it).
# The original rows stay in the register marked Reversed, and an "Undo" row is added, so nothing is lost.
- hdrMine:
    Control: Label
    Properties:
      Text: |-
        ="Today's takes"
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
- btnMineBack:
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
- txtLogAVL:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =varMe.AVLID
      HintText: |-
        ="Your AVL ID"
      X: |-
        =20
      Y: |-
        =100
      Width: |-
        =300
      Height: |-
        =56
      Size: |-
        =18
- tglAll:
    Control: Classic/Toggle
    Properties:
      Default: |-
        =false
      TrueText: |-
        ="All workers"
      FalseText: |-
        ="Just this ID"
      Visible: |-
        =varIsManager
      X: |-
        =340
      Y: |-
        =100
      Width: |-
        =280
      Height: |-
        =56
- galMine:
    Control: Gallery
    Variant: Vertical
    Properties:
      Items: |-
        =If(varIsManager && tglAll.Value,
            Sort(Filter('AG Stock Movements', MovementDay = Text(Today(), "yyyy-mm-dd")), MovementDate, SortOrder.Descending),
            Sort(Filter('AG Stock Movements', MovementDay = Text(Today(), "yyyy-mm-dd") && WorkerAVLID = Trim(txtLogAVL.Text)), MovementDate, SortOrder.Descending))
      TemplateSize: |-
        =120
      X: |-
        =0
      Y: |-
        =166
      Width: |-
        =Parent.Width
      Height: |-
        =Parent.Height - 166
    Children:
      - lblMineLine1:
          Control: Label
          Properties:
            Text: |-
              =Text(ThisItem.MovementDate, "hh:mm") & "   " & Text(ThisItem.QtyChange) & " x " & ThisItem.ItemName
            Color: |-
              =If(ThisItem.Reversed, RGBA(150, 150, 150, 1), RGBA(20, 20, 20, 1))
            X: |-
              =20
            Y: |-
              =6
            Width: |-
              =Parent.TemplateWidth - 40
            Height: |-
              =38
            Size: |-
              =15
            FontWeight: |-
              =FontWeight.Semibold
      - lblMineLine2:
          Control: Label
          Properties:
            Text: |-
              =ThisItem.MovementType & "  ·  " & ThisItem.Location & "  ·  " & ThisItem.WorkerName &
              If(IsBlank(ThisItem.JobNumber), "", "  ·  Job " & ThisItem.JobNumber) &
              If(ThisItem.Reversed && ThisItem.MovementType <> "Undo", "  ·  UNDONE", "")
            X: |-
              =20
            Y: |-
              =44
            Width: |-
              =Parent.TemplateWidth - 220
            Height: |-
              =66
            Size: |-
              =12
            Color: |-
              =RGBA(90, 90, 90, 1)
      - btnUndo:
          Control: Classic/Button
          Properties:
            Text: |-
              ="Undo this take"
            Visible: |-
              =ThisItem.MovementType = "Use" && !ThisItem.Reversed
            X: |-
              =Parent.TemplateWidth - 190
            Y: |-
              =50
            Width: |-
              =170
            Height: |-
              =56
            Fill: |-
              =varRed
            Size: |-
              =13
            OnSelect: |-
              =ClearCollect(colUndo, Filter('AG Stock Movements', TransactionID = ThisItem.TransactionID && Reversed = false));
              IfError(
                ForAll(colUndo As m,
                  With({it: LookUp('AG Stock Items', ItemCode = m.ItemCode)},
                    With({nb: it.OnHandBHW - If(m.Location = "BHW", m.QtyChange, 0),
                          nh: it.OnHandHQ2 - If(m.Location = "HQ2", m.QtyChange, 0)},
                      Patch('AG Stock Items', it, {OnHandBHW: nb, OnHandHQ2: nh, OnHand: nb + nh});
                      Patch('AG Stock Movements', LookUp('AG Stock Movements', ID = m.ID), {Reversed: true});
                      Patch('AG Stock Movements', Defaults('AG Stock Movements'),
                        {Title: m.Title & "-UNDO",
                         MovementDate: Now(),
                         MovementDay: Text(Today(), "yyyy-mm-dd"),
                         MovementType: "Undo",
                         ItemCode: m.ItemCode,
                         ItemName: m.ItemName,
                         Section: m.Section,
                         Qty: m.Qty,
                         QtyChange: -m.QtyChange,
                         Location: m.Location,
                         BalanceAfter: nb + nh,
                         JobNumber: m.JobNumber,
                         TransactionID: m.TransactionID & "-UNDO",
                         PackItemCode: m.PackItemCode,
                         WorkerName: m.WorkerName,
                         WorkerEmail: m.WorkerEmail,
                         WorkerAVLID: m.WorkerAVLID,
                         RecordedByEmail: Lower(User().Email),
                         Reversed: true,
                         ReversalOf: m.Title,
                         Notes: "Undo of " & m.Title})))),
                Notify("Undo failed: " & FirstError.Message, NotificationType.Error),
                Notify("Take undone and stock put back.", NotificationType.Success);
                Refresh('AG Stock Movements')
              )
```

### Screen YAML — `scrLevels`

```yaml
# Paste onto the blank screen scrLevels. Lowest stock (as % of full level) is listed first.
- hdrLevels:
    Control: Label
    Properties:
      Text: |-
        ="Stock levels"
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
- btnLevelsBack:
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
- txtFind:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      HintText: |-
        ="Search item or section"
      X: |-
        =20
      Y: |-
        =100
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Size: |-
        =16
- galLevels:
    Control: Gallery
    Variant: Vertical
    Properties:
      Items: |-
        =Sort(
            AddColumns(
                Filter(colItems, IsBlank(Trim(txtFind.Text)) || Trim(txtFind.Text) in Title || Trim(txtFind.Text) in Section),
                Pct, If(ParLevel > 0, OnHand / ParLevel, Blank())),
            Coalesce(Pct, 99))
      TemplateSize: |-
        =96
      X: |-
        =0
      Y: |-
        =166
      Width: |-
        =Parent.Width
      Height: |-
        =Parent.Height - 166 - If(varIsManager, 110, 0)
    Children:
      - lblLvlName:
          Control: Label
          Properties:
            Text: |-
              =ThisItem.Title
            X: |-
              =20
            Y: |-
              =6
            Width: |-
              =Parent.TemplateWidth - 170
            Height: |-
              =36
            Size: |-
              =15
            FontWeight: |-
              =FontWeight.Semibold
      - lblLvlDetail:
          Control: Label
          Properties:
            Text: |-
              =ThisItem.Section & "  ·  BHW " & ThisItem.OnHandBHW & "  ·  HQ2 " & ThisItem.OnHandHQ2 & "  ·  Full " & ThisItem.ParLevel
            X: |-
              =20
            Y: |-
              =44
            Width: |-
              =Parent.TemplateWidth - 170
            Height: |-
              =40
            Size: |-
              =12
            Color: |-
              =RGBA(90, 90, 90, 1)
      - lblLvlPct:
          Control: Label
          Properties:
            Text: |-
              =ThisItem.OnHand & If(IsBlank(ThisItem.Pct), "", Char(10) & Text(ThisItem.Pct, "0%"))
            Align: |-
              =Align.Center
            X: |-
              =Parent.TemplateWidth - 140
            Y: |-
              =8
            Width: |-
              =120
            Height: |-
              =78
            Size: |-
              =15
            FontWeight: |-
              =FontWeight.Bold
            Color: |-
              =White
            Fill: |-
              =If(IsBlank(ThisItem.Pct), RGBA(140, 140, 140, 1),
                  ThisItem.Pct <= 0.1, varRed,
                  ThisItem.Pct <= 0.2, varAmber,
                  varGreen)
- btnRebuild:
    Control: Classic/Button
    Properties:
      Text: |-
        =If(varConfirmRebuild, "TAP AGAIN to rebuild all balances", "Rebuild balances from register")
      Visible: |-
        =varIsManager
      X: |-
        =20
      Y: |-
        =Parent.Height - 100
      Width: |-
        =Parent.Width - 40
      Height: |-
        =84
      Fill: |-
        =If(varConfirmRebuild, varRed, RGBA(0, 70, 140, 1))
      Size: |-
        =16
      OnSelect: |-
        =If(!varConfirmRebuild,
            Set(varConfirmRebuild, true),
            Set(varConfirmRebuild, false);
            IfError(
              ForAll(colItems As i,
                With({mv: Filter('AG Stock Movements', ItemCode = i.ItemCode)},
                  With({b: Sum(Filter(mv, Location = "BHW"), QtyChange),
                        h: Sum(Filter(mv, Location = "HQ2"), QtyChange)},
                    Patch('AG Stock Items', LookUp('AG Stock Items', ItemCode = i.ItemCode),
                      {OnHandBHW: Coalesce(b, 0), OnHandHQ2: Coalesce(h, 0), OnHand: Coalesce(b, 0) + Coalesce(h, 0)})))),
              Notify("Rebuild failed: " & FirstError.Message, NotificationType.Error),
              ClearCollect(colItems, Filter('AG Stock Items', Active = true));
              Notify("Balances rebuilt from the register.", NotificationType.Success)))
```

### Screen YAML — `scrReceive`

```yaml
# Paste onto the blank screen scrReceive. MANAGER ONLY (Peter).
# The Home button is hidden for staff, and scrReceive.OnVisible sends anyone else back to Home.
# Modes:
#   Receive delivery        - adds the quantity to the chosen store.
#   Stocktake count         - sets the chosen store to the counted quantity (use this for the go-live count).
#                             Register row: Qty = the count, QtyChange = the adjustment.
#   Transfer to other store - moves the quantity BHW -> HQ2 or HQ2 -> BHW (two register rows).
# "Full stock level" is the 100% level the 20% / 10% alerts are measured against.
- hdrRecv:
    Control: Label
    Properties:
      Text: |-
        ="Manager - stock in"
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
- btnRecvBack:
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
- ddMode:
    Control: Classic/DropDown
    Properties:
      Items: |-
        =["Receive delivery", "Stocktake count", "Transfer to other store"]
      Default: |-
        ="Receive delivery"
      X: |-
        =20
      Y: |-
        =105
      Width: |-
        =Parent.Width - 40
      Height: |-
        =60
      Size: |-
        =18
- lblRSection:
    Control: Label
    Properties:
      Text: |-
        ="Section"
      X: |-
        =20
      Y: |-
        =175
      Width: |-
        =Parent.Width - 40
      Height: |-
        =32
      Size: |-
        =14
      FontWeight: |-
        =FontWeight.Semibold
- ddRSection:
    Control: Classic/DropDown
    Properties:
      Items: |-
        =ForAll(colSections As s, {Value: s.Section})
      X: |-
        =20
      Y: |-
        =207
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Size: |-
        =16
- lblRItem:
    Control: Label
    Properties:
      Text: |-
        ="Item"
      X: |-
        =20
      Y: |-
        =270
      Width: |-
        =Parent.Width - 40
      Height: |-
        =32
      Size: |-
        =14
      FontWeight: |-
        =FontWeight.Semibold
- ddRItem:
    Control: Classic/DropDown
    Properties:
      Items: |-
        =ForAll(Sort(Filter(colItems, Section = ddRSection.Selected.Value), Title) As i, {Value: i.Title})
      X: |-
        =20
      Y: |-
        =302
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Size: |-
        =16
- lblRNow:
    Control: Label
    Properties:
      Text: |-
        =With({it: LookUp(colItems, Title = ddRItem.Selected.Value)},
            If(IsBlank(it), "",
               "Now: BHW " & it.OnHandBHW & "  ·  HQ2 " & it.OnHandHQ2 & "  ·  Total " & it.OnHand &
               If(it.ParLevel > 0, "  (" & Text(it.OnHand / it.ParLevel, "0%") & " of full)", "  (no full level set)")))
      X: |-
        =20
      Y: |-
        =362
      Width: |-
        =Parent.Width - 40
      Height: |-
        =40
      Size: |-
        =13
- lblRLoc:
    Control: Label
    Properties:
      Text: |-
        =If(ddMode.Selected.Value = "Transfer to other store", "From store", "Store")
      X: |-
        =20
      Y: |-
        =408
      Width: |-
        =290
      Height: |-
        =32
      Size: |-
        =14
      FontWeight: |-
        =FontWeight.Semibold
- ddRLoc:
    Control: Classic/DropDown
    Properties:
      Items: |-
        =varLocations
      Default: |-
        ="BHW"
      X: |-
        =20
      Y: |-
        =440
      Width: |-
        =290
      Height: |-
        =56
      Size: |-
        =16
- lblRQty:
    Control: Label
    Properties:
      Text: |-
        =Switch(ddMode.Selected.Value, "Stocktake count", "Counted quantity", "Transfer to other store", "Quantity to move", "Quantity received")
      X: |-
        =330
      Y: |-
        =408
      Width: |-
        =290
      Height: |-
        =32
      Size: |-
        =14
      FontWeight: |-
        =FontWeight.Semibold
- txtRQty:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      Format: |-
        =TextFormat.Number
      X: |-
        =330
      Y: |-
        =440
      Width: |-
        =290
      Height: |-
        =56
      Size: |-
        =18
- lblRPar:
    Control: Label
    Properties:
      Text: |-
        ="Full stock level (100%) - alerts at 20% (email) and 10% (Teams)"
      X: |-
        =20
      Y: |-
        =506
      Width: |-
        =Parent.Width - 40
      Height: |-
        =32
      Size: |-
        =13
      FontWeight: |-
        =FontWeight.Semibold
- txtRPar:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =Text(LookUp(colItems, Title = ddRItem.Selected.Value).ParLevel)
      Format: |-
        =TextFormat.Number
      X: |-
        =20
      Y: |-
        =538
      Width: |-
        =290
      Height: |-
        =56
      Size: |-
        =16
- txtRSupplier:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      HintText: |-
        ="Supplier"
      Visible: |-
        =ddMode.Selected.Value = "Receive delivery"
      X: |-
        =20
      Y: |-
        =610
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Size: |-
        =16
- txtRDocket:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      HintText: |-
        ="Delivery docket / PO number"
      Visible: |-
        =ddMode.Selected.Value = "Receive delivery"
      X: |-
        =20
      Y: |-
        =676
      Width: |-
        =Parent.Width - 40
      Height: |-
        =56
      Size: |-
        =16
- txtRNote:
    Control: Classic/TextInput
    Properties:
      Default: |-
        =""
      HintText: |-
        ="Note (optional)"
      Mode: |-
        =TextMode.MultiLine
      X: |-
        =20
      Y: |-
        =742
      Width: |-
        =Parent.Width - 40
      Height: |-
        =90
      Size: |-
        =14
- btnRecvSave:
    Control: Classic/Button
    Properties:
      Text: |-
        ="SAVE"
      X: |-
        =20
      Y: |-
        =850
      Width: |-
        =Parent.Width - 40
      Height: |-
        =100
      Fill: |-
        =RGBA(0, 70, 140, 1)
      Size: |-
        =22
      OnSelect: |-
        =With({sel: LookUp(colItems, Title = ddRItem.Selected.Value),
               q: Value(txtRQty.Text),
               par: Value(txtRPar.Text),
               loc: ddRLoc.Selected.Value,
               other: If(ddRLoc.Selected.Value = "BHW", "HQ2", "BHW"),
               m: ddMode.Selected.Value},
          If(
            !varIsManager, Notify("Manager only.", NotificationType.Error),
            IsBlank(sel), Notify("Choose the item.", NotificationType.Error),
            IsBlank(q) || q < 0 || (q = 0 && m <> "Stocktake count"), Notify("Enter the quantity.", NotificationType.Error),
            With({it: LookUp('AG Stock Items', ItemCode = sel.ItemCode),
                  txn: Text(Now(), "yyyymmdd-hhmmss") & "-" & Coalesce(varMe.AVLID, "MGR")},
              With({nb: Switch(m,
                          "Receive delivery", it.OnHandBHW + If(loc = "BHW", q, 0),
                          "Stocktake count", If(loc = "BHW", q, it.OnHandBHW),
                          it.OnHandBHW + If(loc = "BHW", -q, q)),
                    nh: Switch(m,
                          "Receive delivery", it.OnHandHQ2 + If(loc = "HQ2", q, 0),
                          "Stocktake count", If(loc = "HQ2", q, it.OnHandHQ2),
                          it.OnHandHQ2 + If(loc = "HQ2", -q, q))},
                With({change: (nb + nh) - (it.OnHandBHW + it.OnHandHQ2),
                      base: {MovementDate: Now(),
                             MovementDay: Text(Today(), "yyyy-mm-dd"),
                             ItemCode: it.ItemCode,
                             ItemName: it.Title,
                             Section: it.Section,
                             BalanceAfter: nb + nh,
                             TransactionID: txn,
                             WorkerName: varMe.Title,
                             WorkerEmail: varMe.Email,
                             WorkerAVLID: varMe.AVLID,
                             RecordedByEmail: Lower(User().Email),
                             Reversed: false,
                             Notes: txtRNote.Text}},
                  IfError(
                    Patch('AG Stock Items', it,
                      {OnHandBHW: nb, OnHandHQ2: nh, OnHand: nb + nh,
                       ParLevel: If(IsBlank(par), it.ParLevel, par)});
                    If(m = "Transfer to other store",
                      Patch('AG Stock Movements', Defaults('AG Stock Movements'), base,
                        {Title: txn & "-" & it.ItemCode & "-OUT", MovementType: "Transfer out",
                         Qty: q, QtyChange: -q, Location: loc, JobNumber: "TRANSFER TO " & other});
                      Patch('AG Stock Movements', Defaults('AG Stock Movements'), base,
                        {Title: txn & "-" & it.ItemCode & "-IN", MovementType: "Transfer in",
                         Qty: q, QtyChange: q, Location: other, JobNumber: "TRANSFER FROM " & loc}),
                      Patch('AG Stock Movements', Defaults('AG Stock Movements'), base,
                        {Title: txn & "-" & it.ItemCode,
                         MovementType: If(m = "Receive delivery", "Receipt", "Stocktake count"),
                         Qty: q, QtyChange: change, Location: loc,
                         Supplier: txtRSupplier.Text, DocketNo: Upper(Trim(txtRDocket.Text))})),
                    Notify("NOT saved: " & FirstError.Message, NotificationType.Error),
                    Notify(m & " saved for " & it.Title & ". New total " & (nb + nh), NotificationType.Success);
                    ClearCollect(colItems, Filter('AG Stock Items', Active = true));
                    Reset(txtRQty);
                    Reset(txtRSupplier);
                    Reset(txtRDocket);
                    Reset(txtRNote)
                  )
                )
              )
            )
          )
        )
```

## Appendix C — Power Automate flows

### Flow 1 — Low stock alerts (email at 20%, Teams at 10%)

Standard connectors only: SharePoint, Office 365 Outlook, Microsoft Teams. No premium licence needed.

**Rule.** For each item, level = `OnHand ÷ ParLevel` (ParLevel is the "Full stock level" Peter sets).

| Level | When | Alert to Peter |
|---|---|---|
| OK | above 20% | none |
| Low | 20% or less (and above 10%) | **email** |
| Critical | 10% or less | **Teams message** (the second notification) |

Each alert fires once, when an item drops into a worse band. The flow stores the band it last reported
in `AlertNotifiedLevel`, so Peter doesn't get an alert on every take. After a delivery lifts the item
back above 20%, the band resets to OK silently, ready for next time. An item with ParLevel 0 never alerts.

So an item normally produces two notifications on the way down: the **email at 20%**, then the **Teams
message at 10%**. If one take drops an item straight from above 20% to 10% or less, only the Teams
message is sent.

#### Build (Power Automate → Create → Automated cloud flow)

Name: **AG Supplies - Low stock alert**

##### Trigger: SharePoint — *When an item is created or modified*
- Site address: `https://australianvintagecomau.sharepoint.com/sites/AustralianVintage` · List name: `AG Stock Items`
- Settings → **Trigger conditions** → add the line below. It runs the flow only when the band has
  changed, so the flow's own update can't loop.

```
@not(equals(coalesce(triggerBody()?['AlertNotifiedLevel'],'OK'),if(lessOrEqual(float(coalesce(triggerBody()?['ParLevel'],0)),0),'OK',if(lessOrEqual(div(float(coalesce(triggerBody()?['OnHand'],0)),float(triggerBody()?['ParLevel'])),0.1),'Critical',if(lessOrEqual(div(float(coalesce(triggerBody()?['OnHand'],0)),float(triggerBody()?['ParLevel'])),0.2),'Low','OK')))))
```

##### 1. Compose — rename to `NewLevel`
```
if(lessOrEqual(float(coalesce(triggerBody()?['ParLevel'],0)),0),'OK',if(lessOrEqual(div(float(coalesce(triggerBody()?['OnHand'],0)),float(triggerBody()?['ParLevel'])),0.1),'Critical',if(lessOrEqual(div(float(coalesce(triggerBody()?['OnHand'],0)),float(triggerBody()?['ParLevel'])),0.2),'Low','OK')))
```

##### 2. Compose — rename to `Pct`
```
if(lessOrEqual(float(coalesce(triggerBody()?['ParLevel'],0)),0),0,div(mul(float(coalesce(triggerBody()?['OnHand'],0)),100),float(triggerBody()?['ParLevel'])))
```

##### 3. Condition — "Is it worse than last time?"
Left side (expression):
```
if(equals(outputs('NewLevel'),'Critical'),2,if(equals(outputs('NewLevel'),'Low'),1,0))
```
**is greater than**, right side (expression):
```
if(equals(coalesce(triggerBody()?['AlertNotifiedLevel'],'OK'),'Critical'),2,if(equals(coalesce(triggerBody()?['AlertNotifiedLevel'],'OK'),'Low'),1,0))
```

**If yes:** add a **Switch** on `outputs('NewLevel')`.

**Case `Low` (20%): first notification, email.** Office 365 Outlook — *Send an email (V2)*
- To: `pmanovic@avlwines.com.au`
- Subject: `AusGrape stock LOW (20%): @{triggerBody()?['Title']} at @{formatNumber(outputs('Pct'),'0')}%`
- Body:
  ```
  @{triggerBody()?['Title']} (@{triggerBody()?['ItemCode']}, section @{triggerBody()?['Section']})
  On hand: @{triggerBody()?['OnHand']}  (BHW @{triggerBody()?['OnHandBHW']}, HQ2 @{triggerBody()?['OnHandHQ2']})
  Full stock level: @{triggerBody()?['ParLevel']}
  Level: @{formatNumber(outputs('Pct'),'0')}%
  Register: https://australianvintagecomau.sharepoint.com/sites/AustralianVintage/Lists/AG%20Stock%20Movements
  ```

**Case `Critical` (10% or less): second notification, Teams.** Microsoft Teams — *Post message in a chat or channel*
- Post as: **Flow bot** · Post in: **Chat with Flow bot** · Recipient: `pmanovic@avlwines.com.au`
- Message: `🔴 CRITICAL - @{triggerBody()?['Title']} is at @{formatNumber(outputs('Pct'),'0')}% (@{triggerBody()?['OnHand']} left of @{triggerBody()?['ParLevel']}: BHW @{triggerBody()?['OnHandBHW']}, HQ2 @{triggerBody()?['OnHandHQ2']}). Order now.`

##### 4. SharePoint — *Update item* (after the condition, not inside it)
- List: `AG Stock Items` · Id: `triggerBody()?['ID']`
- Item (Title): `triggerBody()?['Title']` (required by the action)
- AlertNotifiedLevel: `outputs('NewLevel')`

#### Test
1. In the app (Receive → Stocktake count), set a test item to 25% of its full level → no alert.
2. Take stock so it drops to 20% → **one email**.
3. Take more so it drops to 10% → **one Teams message** (no email).
4. Take more → nothing (already Critical).
5. Receive a delivery so it's back above 20% → nothing, `AlertNotifiedLevel` returns to OK.

### Flow 2 — Daily stock-used report to Peter

Every row in the email comes straight from the `AG Stock Movements` register. Nothing is estimated or
generated. Standard connectors only (SharePoint, Office 365 Outlook).

The email has:
1. **Stock used in the last 24 hours (3 pm yesterday to 3 pm today):** time, worker, AVL ID, item, qty, store, job / order number, and the pack it was
   used with (e.g. the bag, liner, seal, ties and label used with a 200 L drum). Undone takes are left out.
2. **Stock in / counts / transfers in the same 24 hours:** Peter's receipts, stocktake counts and transfers.
3. **Items currently low or critical:** taken from the alert flow's `AlertNotifiedLevel`.

#### Build (Power Automate → Create → Scheduled cloud flow)

Name: **AG Supplies - Daily usage report** · Repeat every **1 Day** · At **3:00 PM** · Time zone
**(UTC+10:00) Canberra, Melbourne, Sydney** · On these days: Mon–Sat (adjust to the roster).

##### 1. Compose — rename to `Today`
```
formatDateTime(convertFromUtc(utcNow(),'AUS Eastern Standard Time'),'yyyy-MM-dd')
```

##### 2. SharePoint — *Get items* — rename to `GetMoves`
- List: `AG Stock Movements`
- Filter Query: `MovementDate ge '@{addHours(utcNow(),if(equals(dayOfWeek(convertFromUtc(utcNow(),'AUS Eastern Standard Time')),1),-48,-24))}'`
  (everything since the previous 3 pm report: 24 hours, or 48 hours on Monday so Saturday afternoon and
  Sunday are included. Takes made after 3 pm show in the next report, so nothing is missed.)
- Order By: `MovementDate asc`
- Top Count: `5000` · Settings → Pagination **On**, threshold `5000`

##### 3. Filter array — rename to `Used`
- From: `body('GetMoves')?['value']`
- Advanced mode:
```
@and(startsWith(item()?['MovementType'],'Use'), not(equals(item()?['Reversed'], true)))
```

##### 4. Select — rename to `UsedRows`
- From: `body('Used')`
- Map (switch to key/value mode):

| Key | Value (expression) |
|---|---|
| Time | `convertFromUtc(item()?['MovementDate'],'AUS Eastern Standard Time','ddd HH:mm')` |
| Worker | `item()?['WorkerName']` |
| AVL ID | `item()?['WorkerAVLID']` |
| Item | `item()?['ItemName']` |
| Qty | `item()?['Qty']` |
| Store | `item()?['Location']` |
| Job / order no. | `coalesce(item()?['JobNumber'],'')` |
| Used with pack | `coalesce(item()?['PackItemCode'],'')` |

##### 5. Create HTML table — rename to `UsedTable`
- From: `body('UsedRows')` · Columns: Automatic

##### 6. Filter array — rename to `InOut`
- From: `body('GetMoves')?['value']`
- Advanced mode:
```
@and(not(startsWith(item()?['MovementType'],'Use')), not(equals(item()?['MovementType'],'Undo')))
```

##### 7. Select — rename to `InOutRows`
| Key | Value |
|---|---|
| Time | `convertFromUtc(item()?['MovementDate'],'AUS Eastern Standard Time','ddd HH:mm')` |
| Type | `item()?['MovementType']` |
| Item | `item()?['ItemName']` |
| Qty | `item()?['Qty']` |
| Change | `item()?['QtyChange']` |
| Store | `item()?['Location']` |
| Supplier / docket | `concat(coalesce(item()?['Supplier'],''),' ',coalesce(item()?['DocketNo'],''))` |
| By | `item()?['WorkerName']` |

##### 8. Create HTML table — rename to `InOutTable` (From: `body('InOutRows')`)

##### 9. SharePoint — *Get items* — rename to `GetLow`
- List: `AG Stock Items` · Filter Query: `AlertNotifiedLevel ne 'OK' and Active eq 1`

##### 10. Select — rename to `LowRows`
| Key | Value |
|---|---|
| Item | `item()?['Title']` |
| Level | `item()?['AlertNotifiedLevel']` |
| On hand | `item()?['OnHand']` |
| BHW | `item()?['OnHandBHW']` |
| HQ2 | `item()?['OnHandHQ2']` |
| Full level | `item()?['ParLevel']` |

From: `body('GetLow')?['value']`

##### 11. Create HTML table — rename to `LowTable` (From: `body('LowRows')`)

##### 12. Office 365 Outlook — *Send an email (V2)*
- To: `pmanovic@avlwines.com.au` (add others with `;` if wanted)
- Subject: `AusGrape supplies used - @{outputs('Today')} - @{length(body('Used'))} lines`
- Body (switch the editor to code view `</>` and paste):

```html
<style>table{border-collapse:collapse;font-family:Segoe UI,Arial;font-size:13px}th{background:#005e38;color:#fff;padding:4px 8px;text-align:left}td{border:1px solid #ccc;padding:4px 8px}</style>
<h3>Stock used - 3 pm yesterday to 3 pm today (@{outputs('Today')})</h3>
@{if(equals(length(body('Used')),0),'<p>No stock was taken in the last 24 hours.</p>',body('UsedTable'))}
<h3>Stock in, counts and transfers</h3>
@{if(equals(length(body('InOut')),0),'<p>None.</p>',body('InOutTable'))}
<h3>Items currently low (20% or less) or critical (10% or less)</h3>
@{if(equals(length(body('GetLow')?['value']),0),'<p>None.</p>',body('LowTable'))}
<p style="color:#666">From the AG Stock Movements register: https://australianvintagecomau.sharepoint.com/sites/AustralianVintage/Lists/AG%20Stock%20Movements</p>
```

#### Test
Run the flow manually (Test → Manually) after making a few test takes in the app. Check that each take
shows once, that undone takes are missing, and that the time is local (AEST/AEDT).

## Appendix D — Main board tile

```yaml
# Tile for the Buronga AVL app nest (main board).
# Open the main board app in Studio, select its home screen, paste, then move the button into the tile grid
# and copy the size and colours of the existing tiles.
# Replace <appId> after publishing. For AVL the environment ID equals the tenant ID (see the skill notes).
- btnTileAGSupplies:
    Control: Classic/Button
    Properties:
      Text: |-
        ="AusGrape Packing Supplies"
      OnSelect: |-
        =Launch("https://apps.powerapps.com/play/e/<envId>/a/<appId>?tenantId=<tenantId>", {}, LaunchTarget.Replace)
      Width: |-
        =280
      Height: |-
        =140
      Fill: |-
        =RGBA(0, 94, 56, 1)
      Size: |-
        =16
```
