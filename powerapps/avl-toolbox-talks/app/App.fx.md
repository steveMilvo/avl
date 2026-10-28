# App-level settings and screen formulas — AVL Toolbox

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

## App.OnStart

```
=Set(varGreen, RGBA(0, 94, 56, 1));
Set(varRed, RGBA(184, 28, 28, 1));
Set(varDeclaration, LookUp('TBX Settings', Title = "Declaration").SettingValue);
Set(varPerson, Blank());
Set(varMtg, Blank())
```

## scrHome.OnVisible

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

## scrSign.OnVisible

```
=Reset(chkDecl);
Reset(penSig);
Reset(txtQuestions);
Set(varBlankSig, JSON(penSig.Image, JSONFormat.IncludeBinaryData))
```

## scrAsk.OnVisible

```
=Reset(txtAsk)
```

## scrAdmin.OnVisible

```
=If(varPerson.TbxRole <> "Admin", Navigate(scrHome, ScreenTransition.None));
ClearCollect(colRecent, FirstN(Sort('TBX Meetings', MeetingDate, SortOrder.Descending), 30));
If(IsBlank(varAdm), Set(varAdm, First(colRecent)));
ClearCollect(colAdmSigs, Filter('TBX Signatures', MeetingID = varAdm.Title));
ClearCollect(colTeam, If(varAdm.Team = "All", Filter('TBX People', Active = true), Filter('TBX People', Team = varAdm.Team && Active = true)))
```

## Notes

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
