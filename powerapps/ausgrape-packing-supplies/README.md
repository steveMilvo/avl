# AusGrape Packing Supplies — Power Apps build pack

A phone app that tracks AusGrape packing supplies at Buronga. Built to the AVL SharePoint + Power Apps
method (`sharepoint-powerapps-builder` skill). It replaces the month-end manual count and the daily
paperwork.

- **Peter Manovic (manager)** enters all incoming stock (deliveries, stocktake counts, transfers between
  BHW and HQ2). Staff never see this screen.
- **Every AusGrape worker** marks off stock as they take it from storage: a **button for each section**
  of the stocktake sheet, then a **drop-down for the item**, quantity, store and **job / order number**.
  Each take is recorded against their **AVL ID**, name and time.
- **Pack items use up their supplies automatically.** Taking a 200 L steel drum also takes 1 × Scholle 802955
  aseptic bag, 1 × 60 micron liner, 1 × cable tie, 1 × PP seal and 1 × label. (Hansin MB6071 and the
  100 micron liner remain selectable alternatives.) The worker can change the bag type or quantity before saving.
- **One central register** (`AG Stock Movements` SharePoint list) holds every movement. It opens in
  Excel in one click.
- **Alerts:** email to Peter when an item hits **20%**. A **Teams** message (the second
  notification) when it hits **10% or less**.
- **Daily report** to Peter: stock used, who used it, the time and the job / order number.
- **Main board:** a tile for the Buronga AVL app nest.

## What's in this folder

| Path | What it is |
|---|---|
| `sharepoint/provision-lists.js` | Creates the 4 SharePoint lists, indexes, unique keys and versioning, and seeds 61 stock items in 12 sections plus the drum pack recipe. Run it in the browser console on the site. Safe to re-run. |
| `app/App.fx.md` | App OnStart, each screen's OnVisible, and design notes. |
| `app/screens/*.yaml` | Controls for each screen, ready to paste in Power Apps Studio. |
| `app/main-board-tile.yaml` | Launch button for the Buronga AVL main board app. |
| `flows/01-low-stock-alerts.md` | Power Automate: 20% email, 10% Teams. |
| `flows/02-daily-usage-report.md` | Power Automate: daily usage email to Peter. |

## Data model (SharePoint lists)

| List | One row per | Key columns |
|---|---|---|
| **AG Stock Items** | stock item | Item (Title, unique), ItemCode (unique), Section, SectionOrder, SupplierCode, Unit, OnHandBHW, OnHandHQ2, OnHand, ParLevel (= 100% "full stock level"), AlertNotifiedLevel, Active |
| **AG Stock Movements** — *the central register* | movement | Movement ID (unique), MovementDate, MovementDay, MovementType (Use · Use - with pack · Receipt · Stocktake count · Transfer out/in · Undo), ItemCode, ItemName, Qty, QtyChange (±), Location, BalanceAfter, JobNumber, TransactionID, PackItemCode, WorkerName, WorkerEmail, WorkerAVLID, RecordedByEmail, Supplier, DocketNo, Reversed, ReversalOf, Notes |
| **AG Pack Recipes** | pack + component | Recipe key (unique), PackItemCode, ComponentCode, AltComponentCode, QtyPerPack, Active |
| **AG Supply Members** | person | Name (Title), AVLID (unique), Email (unique, lower case), SupplyRole (Manager / Staff), Active |

All four lists have version history turned on, so every edit is kept.

## Screens

| Screen | Who | Does |
|---|---|---|
| Home | all | Take stock · Today's takes / undo · Stock levels · *(Manager)* Receive / Count / Transfer |
| Take stock | all | AVL ID → section button → item drop-down → qty, store (BHW / HQ2), job / order no. → pack supplies pre-filled → **Save** |
| Today's takes | all | Your takes today. **Undo this take** reverses the whole take (drum + supplies). The original rows stay in the register, marked Reversed. |
| Stock levels | all | Every item, lowest % first, coloured green / amber (≤20%) / red (≤10%). Manager: *Rebuild balances from register*. |
| Manager – stock in | **Peter only** | Receive delivery (supplier, docket) · Stocktake count · Transfer between stores · set Full stock level |

## Build steps

1. **Lists:** open https://australianvintagecomau.sharepoint.com/sites/AustralianVintage/_layouts/15/viewlsts.aspx → DevTools console → paste `sharepoint/provision-lists.js` (first
   fill in Peter's email and AVL ID in `CONFIG`). Check the summary: 61 items, 15 recipe rows.
2. **App:** Power Apps → Create → Blank canvas app → **Phone** → name *AusGrape Packing Supplies*. Add the
   4 lists as SharePoint data sources. Settings → Data row limit = 2000.
3. Paste `App.OnStart` from `App.fx.md`. Create the 5 blank screens (`scrHome`, `scrTake`,
   `scrMyTakes`, `scrLevels`, `scrReceive`), rename them, and paste each YAML file onto its screen. Set
   each OnVisible from `App.fx.md`. Set StartScreen = `scrHome`.
4. App checker → Recheck all → zero errors. Delegation warnings on *Rebuild balances* are expected
   (each item's history up to 2000 rows).
5. Test with rows marked "TEST - delete me": take a drum with supplies, undo it, receive, count,
   transfer. Check the register rows over REST or in the list, then recycle the test rows.
6. **Flows:** build `flows/01` and `flows/02`, then test them.
7. **Publish** and share the app with the AusGrape staff group. Add the tile to the main board
   (`app/main-board-tile.yaml`) with the play link.
8. **Go-live count:** OnHand starts at **0**. On day 1 Peter does one count of each item with *Stocktake
   count* (BHW and HQ2). From then on the app keeps the balance and the month-end count isn't needed.
   A spot check now and then is still sensible.

## Where the data is, and how to see it

| What | Where |
|---|---|
| Central movement register | `https://australianvintagecomau.sharepoint.com/sites/AustralianVintage/Lists/AG%20Stock%20Movements` — sort or filter by day, worker, job or item. **Export → Export to Excel** gives a live-refreshing spreadsheet. |
| Current stock | `https://australianvintagecomau.sharepoint.com/sites/AustralianVintage/Lists/AG%20Stock%20Items` (or the Stock levels screen) |
| Pack recipes | `https://australianvintagecomau.sharepoint.com/sites/AustralianVintage/Lists/AG%20Pack%20Recipes` — Peter edits these in grid view. |
| Who can use the app | `https://australianvintagecomau.sharepoint.com/sites/AustralianVintage/Lists/AG%20Supply%20Members` |
| Change history of any row | the row's `…` menu → Version history |

## Things to know

- **Who is recorded on a take.** The app records the AVL ID typed on the Take screen. It is pre-filled
  with the signed-in person's ID. This works on shared site phones, and the phone's login is also stored
  in RecordedByEmail.
- **Staff can't reach the manager screen in the app.** Staff do need edit rights on the lists so their
  takes can save, though, which means they could edit a list directly in SharePoint. Every edit is kept
  in version history and named. To lock it down further, IT can hide the lists from site navigation, or
  route writes through a flow. Ask if you want that.
- **Two people saving at the same second** can, rarely, both read the same balance. The register stays
  correct either way, and *Rebuild balances from register* fixes the totals from it.
- Only the BHW and HQ2 stores are tracked. A third store (e.g. PTG) would need one extra column.

## Decisions (confirmed 23/10/2026)

| Question | Answer |
|---|---|
| Cable ties per drum | 1 |
| Drum bag and liner | 1 × Scholle 802955 + 1 × 60 micron (defaults; alternatives still selectable) |
| Alerts | 1st notification email at 20%, 2nd notification Teams at 10% |
| 31/08 sheet discrepancies | Settled by the go-live count |
| Draft recipes (fibre drum, cardboard IBC) | Left switched off until Peter turns them on in `AG Pack Recipes` |
| SharePoint site | https://australianvintagecomau.sharepoint.com/sites/AustralianVintage |
| Manager name | Peter Manovic |

## Still needed before go-live

1. `pmanovic@avlwines.com.au` and AVL ID (fill in `CONFIG` in `provision-lists.js`).
2. Staff list: name, AVL ID, work email for each AusGrape worker.
3. Teams alert destination: Peter's chat with Flow bot (default) or a team channel.
4. Full stock level for each item. These are seeded from the 31/08 count; items that were 0 have no alerts until set.
5. Daily report time: 4:45 pm Mon–Sat unless changed.
