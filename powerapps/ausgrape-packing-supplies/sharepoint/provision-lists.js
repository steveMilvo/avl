/*
 * AusGrape Packing Supplies - SharePoint list provisioning
 *
 * HOW TO RUN
 *   1. Open the target SharePoint site in Chrome or Edge (e.g. {site}/_layouts/15/viewlsts.aspx).
 *   2. Edit CONFIG below (Peter's AVL ID, plus any staff you already know).
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
      { Title: 'Peter Manovic', AVLID: 'TBC-PMANOVIC', Email: 'pmanovic@avlwines.com.au', SupplyRole: 'Manager' }, // AVLID: replace with Peter's real AVL ID
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
  await seed('AG Supply Members', 'Email', CONFIG.members
    .filter((m) => !m.Email.includes('CHANGE-ME'))
    .map((m) => ({ ...m, Email: m.Email.toLowerCase(), Active: true })));
  if (CONFIG.members.some((m) => m.Email.includes('CHANGE-ME'))) say('NOTE: members with CHANGE-ME were skipped - fill in CONFIG and run again.');

  // ----------------------------------------------------------------- verify
  for (const def of LISTS) {
    const n = (await api(`${L(def.title)}?$select=ItemCount`)).ItemCount;
    say(`${def.title}: ${n} rows  ->  ${web}/Lists/${encodeURIComponent(def.title)}`);
  }
  say('DONE');
  window.__agReport = log.join('\n');
})().catch((e) => { console.error(e); window.__agReport = 'FAILED: ' + e.message; });
