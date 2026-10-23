# App-level settings and screen formulas

App name: **AusGrape Packing Supplies** · Format: **Phone** (640 × 1136) · Data sources (SharePoint, the site you ran `provision-lists.js` on):
`AG Stock Items`, `AG Stock Movements`, `AG Pack Recipes`, `AG Supply Members`.

Settings → General → **Data row limit = 2000** (used by "Rebuild balances from register" on the Levels screen).

## Screens (create each with New screen → Blank, then rename)

| Screen | Who | Paste file |
|---|---|---|
| `scrHome` | everyone | `screens/scrHome.yaml` |
| `scrTake` | everyone (staff + manager) | `screens/scrTake.yaml` |
| `scrMyTakes` | everyone | `screens/scrMyTakes.yaml` |
| `scrLevels` | everyone (rebuild button is manager only) | `screens/scrLevels.yaml` |
| `scrReceive` | **manager only** (Peter) | `screens/scrReceive.yaml` |

Set `App.StartScreen` to `=scrHome`.

## App.OnStart

```
=Set(varLocations, ["BHW", "HQ2"]);
Set(varGreen, RGBA(0, 94, 56, 1));
Set(varAmber, RGBA(214, 140, 0, 1));
Set(varRed, RGBA(184, 28, 28, 1))
```

## scrHome.OnVisible

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

## scrTake.OnVisible

```
=Set(varSection, Blank());
Set(varItem, Blank());
Clear(colBom);
Reset(txtQty); Reset(txtJob); Reset(txtNote); Reset(txtAVL)
```

## scrReceive.OnVisible

```
=If(!varIsManager, Navigate(scrHome, ScreenTransition.None));
Reset(txtRQty); Reset(txtRSupplier); Reset(txtRDocket); Reset(txtRNote)
```

## scrLevels.OnVisible

```
=Set(varConfirmRebuild, false);
Refresh('AG Stock Items');
ClearCollect(colItems, Filter('AG Stock Items', Active = true))
```

## scrMyTakes.OnVisible

```
=Refresh('AG Stock Movements')
```

## Notes on the Power Fx

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
