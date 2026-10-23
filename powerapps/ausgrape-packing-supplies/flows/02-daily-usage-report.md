# Flow 2 — Daily stock-used report to Peter

Every row in the email comes straight from the `AG Stock Movements` register. Nothing is estimated or
generated. Standard connectors only (SharePoint, Office 365 Outlook).

The email has:
1. **Stock used today:** time, worker, AVL ID, item, qty, store, job / order number, and the pack it was
   used with (e.g. the bag, liner, seal, ties and label used with a 200 L drum). Undone takes are left out.
2. **Stock in / counts / transfers today:** Peter's receipts, stocktake counts and transfers.
3. **Items currently low or critical:** taken from the alert flow's `AlertNotifiedLevel`.

## Build (Power Automate → Create → Scheduled cloud flow)

Name: **AG Supplies - Daily usage report** · Repeat every **1 Day** · At **4:45 PM** · Time zone
**(UTC+10:00) Canberra, Melbourne, Sydney** · On these days: Mon–Sat (adjust to the roster).

### 1. Compose — rename to `Today`
```
formatDateTime(convertFromUtc(utcNow(),'AUS Eastern Standard Time'),'yyyy-MM-dd')
```

### 2. SharePoint — *Get items* — rename to `GetMoves`
- List: `AG Stock Movements`
- Filter Query: `MovementDay eq '@{outputs('Today')}'`
- Order By: `MovementDate asc`
- Top Count: `5000` · Settings → Pagination **On**, threshold `5000`

### 3. Filter array — rename to `Used`
- From: `body('GetMoves')?['value']`
- Advanced mode:
```
@and(startsWith(item()?['MovementType'],'Use'), not(equals(item()?['Reversed'], true)))
```

### 4. Select — rename to `UsedRows`
- From: `body('Used')`
- Map (switch to key/value mode):

| Key | Value (expression) |
|---|---|
| Time | `convertFromUtc(item()?['MovementDate'],'AUS Eastern Standard Time','HH:mm')` |
| Worker | `item()?['WorkerName']` |
| AVL ID | `item()?['WorkerAVLID']` |
| Item | `item()?['ItemName']` |
| Qty | `item()?['Qty']` |
| Store | `item()?['Location']` |
| Job / order no. | `coalesce(item()?['JobNumber'],'')` |
| Used with pack | `coalesce(item()?['PackItemCode'],'')` |

### 5. Create HTML table — rename to `UsedTable`
- From: `body('UsedRows')` · Columns: Automatic

### 6. Filter array — rename to `InOut`
- From: `body('GetMoves')?['value']`
- Advanced mode:
```
@and(not(startsWith(item()?['MovementType'],'Use')), not(equals(item()?['MovementType'],'Undo')))
```

### 7. Select — rename to `InOutRows`
| Key | Value |
|---|---|
| Time | `convertFromUtc(item()?['MovementDate'],'AUS Eastern Standard Time','HH:mm')` |
| Type | `item()?['MovementType']` |
| Item | `item()?['ItemName']` |
| Qty | `item()?['Qty']` |
| Change | `item()?['QtyChange']` |
| Store | `item()?['Location']` |
| Supplier / docket | `concat(coalesce(item()?['Supplier'],''),' ',coalesce(item()?['DocketNo'],''))` |
| By | `item()?['WorkerName']` |

### 8. Create HTML table — rename to `InOutTable` (From: `body('InOutRows')`)

### 9. SharePoint — *Get items* — rename to `GetLow`
- List: `AG Stock Items` · Filter Query: `AlertNotifiedLevel ne 'OK' and Active eq 1`

### 10. Select — rename to `LowRows`
| Key | Value |
|---|---|
| Item | `item()?['Title']` |
| Level | `item()?['AlertNotifiedLevel']` |
| On hand | `item()?['OnHand']` |
| BHW | `item()?['OnHandBHW']` |
| HQ2 | `item()?['OnHandHQ2']` |
| Full level | `item()?['ParLevel']` |

From: `body('GetLow')?['value']`

### 11. Create HTML table — rename to `LowTable` (From: `body('LowRows')`)

### 12. Office 365 Outlook — *Send an email (V2)*
- To: Peter's work email (add others with `;` if wanted)
- Subject: `AusGrape supplies used - @{outputs('Today')} - @{length(body('Used'))} lines`
- Body (switch the editor to code view `</>` and paste):

```html
<style>table{border-collapse:collapse;font-family:Segoe UI,Arial;font-size:13px}th{background:#005e38;color:#fff;padding:4px 8px;text-align:left}td{border:1px solid #ccc;padding:4px 8px}</style>
<h3>Stock used today (@{outputs('Today')})</h3>
@{if(equals(length(body('Used')),0),'<p>No stock was taken today.</p>',body('UsedTable'))}
<h3>Stock in, counts and transfers</h3>
@{if(equals(length(body('InOut')),0),'<p>None.</p>',body('InOutTable'))}
<h3>Items currently low (20% or less) or critical (10% or less)</h3>
@{if(equals(length(body('GetLow')?['value']),0),'<p>None.</p>',body('LowTable'))}
<p style="color:#666">From the AG Stock Movements register: &lt;site&gt;/Lists/AG%20Stock%20Movements</p>
```

## Test
Run the flow manually (Test → Manually) after making a few test takes in the app. Check that each take
shows once, that undone takes are missing, and that the time is local (AEST/AEDT).
