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
