# Toolbox flows (Power Automate, standard connectors only)

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

## Flow 1 · TBX - Open toolbox meetings

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

## Flow 2 · TBX - Add signature to sheet

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

## Flow 3 · TBX - Close meetings

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

## Flow 4 · TBX - Reminders (optional, build last)

**Trigger:** Recurrence, daily 6:30 am.
- A meeting with **MeetingDate = today**: a Teams chat (Flow bot) to every active TBX People member:
  *"Toolbox talk today: <Topic>. Read and sign in the AVL Toolbox app: <main board link>"*.
- **Open** meetings on **day 3 and day 6** after the meeting: a Teams chat only to people with no
  signature yet.

## Flow 5 · TBX - Question to Steve

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
