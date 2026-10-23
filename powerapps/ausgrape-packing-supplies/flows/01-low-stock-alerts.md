# Flow 1 — Low stock alerts (email at 20%, Teams at 10%)

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

## Build (Power Automate → Create → Automated cloud flow)

Name: **AG Supplies - Low stock alert**

### Trigger: SharePoint — *When an item is created or modified*
- Site address: `https://australianvintagecomau.sharepoint.com/sites/AustralianVintage` · List name: `AG Stock Items`
- Settings → **Trigger conditions** → add the line below. It runs the flow only when the band has
  changed, so the flow's own update can't loop.

```
@not(equals(coalesce(triggerBody()?['AlertNotifiedLevel'],'OK'),if(lessOrEqual(float(coalesce(triggerBody()?['ParLevel'],0)),0),'OK',if(lessOrEqual(div(float(coalesce(triggerBody()?['OnHand'],0)),float(triggerBody()?['ParLevel'])),0.1),'Critical',if(lessOrEqual(div(float(coalesce(triggerBody()?['OnHand'],0)),float(triggerBody()?['ParLevel'])),0.2),'Low','OK')))))
```

### 1. Compose — rename to `NewLevel`
```
if(lessOrEqual(float(coalesce(triggerBody()?['ParLevel'],0)),0),'OK',if(lessOrEqual(div(float(coalesce(triggerBody()?['OnHand'],0)),float(triggerBody()?['ParLevel'])),0.1),'Critical',if(lessOrEqual(div(float(coalesce(triggerBody()?['OnHand'],0)),float(triggerBody()?['ParLevel'])),0.2),'Low','OK')))
```

### 2. Compose — rename to `Pct`
```
if(lessOrEqual(float(coalesce(triggerBody()?['ParLevel'],0)),0),0,div(mul(float(coalesce(triggerBody()?['OnHand'],0)),100),float(triggerBody()?['ParLevel'])))
```

### 3. Condition — "Is it worse than last time?"
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
- To: Peter's work email
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
- Post as: **Flow bot** · Post in: **Chat with Flow bot** · Recipient: Peter's work email
- Message: `🔴 CRITICAL - @{triggerBody()?['Title']} is at @{formatNumber(outputs('Pct'),'0')}% (@{triggerBody()?['OnHand']} left of @{triggerBody()?['ParLevel']}: BHW @{triggerBody()?['OnHandBHW']}, HQ2 @{triggerBody()?['OnHandHQ2']}). Order now.`
- To post to a team channel instead, choose Post in: **Channel** and pick the team and channel.

### 4. SharePoint — *Update item* (after the condition, not inside it)
- List: `AG Stock Items` · Id: `triggerBody()?['ID']`
- Item (Title): `triggerBody()?['Title']` (required by the action)
- AlertNotifiedLevel: `outputs('NewLevel')`

## Test
1. In the app (Receive → Stocktake count), set a test item to 25% of its full level → no alert.
2. Take stock so it drops to 20% → **one email**.
3. Take more so it drops to 10% → **one Teams message** (no email).
4. Take more → nothing (already Critical).
5. Receive a delivery so it's back above 20% → nothing, `AlertNotifiedLevel` returns to OK.
