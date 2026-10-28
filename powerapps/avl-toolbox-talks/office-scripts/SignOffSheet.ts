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
