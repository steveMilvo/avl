/**
 * Office Script: AppendSignature
 *
 * Adds one signer to a meeting's sign-off sheet (in the toolbox talk's dated folder), with their drawn
 * signature embedded as a picture in the Signature cell. Run by flow "TBX - Add signature to sheet"
 * each time someone signs. Keep that flow's concurrency at 1 so two signers never write to the same row.
 *
 * The template has a heading block (topic, date, presenter, declaration) above the table. The cell where
 * the table's heading row starts is given the workbook name "TableStart" (Formulas > Define Name).
 * Without that name, the table starts at A1 of the "Sign-off" sheet.
 *
 *   headersJson - JSON array of table headings in order, e.g.
 *                 ["No.","Name","AVL ID","Team","Signed when","Date & time","Signature"]
 *   rowJson     - JSON object for this signer, keyed by heading. "No." is filled in by the script.
 *                 "Signature" holds the PNG as base64, with or without the "data:image/png;base64," prefix.
 *
 * Returns the sheet row number written (1-based), or 0 if this AVL ID is already in the sheet.
 */
function main(workbook: ExcelScript.Workbook, headersJson: string, rowJson: string): number {
  const headers: string[] = JSON.parse(headersJson);
  const r: { [key: string]: string } = JSON.parse(rowJson);
  const rowHeight = 48; // points; tall enough to read a signature

  const start = tableStart(workbook);
  const sheet = start.getWorksheet();
  const top = start.getRowIndex();
  const left = start.getColumnIndex();
  const sigCol = headers.indexOf("Signature");
  const idCol = headers.indexOf("AVL ID");
  const noCol = headers.indexOf("No.");

  // Heading row (rewritten every time so it always matches the flow's headings)
  const head = sheet.getRangeByIndexes(top, left, 1, headers.length);
  head.setValues([headers]);
  head.getFormat().getFont().setBold(true);
  head.getFormat().getFill().setColor("#005E38");
  head.getFormat().getFont().setColor("#FFFFFF");
  if (sigCol >= 0) sheet.getRangeByIndexes(top, left + sigCol, 1, 1).getFormat().setColumnWidth(170);

  // Count the rows already in the table, and skip this person if already listed (e.g. a re-run)
  let n = 0;
  const maxRows = 1000;
  const keyCol = idCol >= 0 ? idCol : 1;
  const existing = sheet.getRangeByIndexes(top + 1, left + keyCol, maxRows, 1).getValues();
  while (n < maxRows && String(existing[n][0]) !== "") {
    if (idCol >= 0 && String(existing[n][0]) === String(r["AVL ID"])) return 0;
    n++;
  }
  const rowIndex = top + 1 + n;

  const values = headers.map((h, i) =>
    i === noCol ? String(n + 1) : h === "Signature" ? "" : (r[h] ?? ""));
  const row = sheet.getRangeByIndexes(rowIndex, left, 1, headers.length);
  row.setValues([values]);
  row.getFormat().setRowHeight(rowHeight);
  row.getFormat().setVerticalAlignment(ExcelScript.VerticalAlignment.center);
  row.getFormat().getBorders().getItem(ExcelScript.BorderIndex.edgeBottom).setStyle(ExcelScript.BorderLineStyle.continuous);

  if (sigCol >= 0 && r["Signature"]) {
    placeSignature(sheet, sheet.getRangeByIndexes(rowIndex, left + sigCol, 1, 1), r["Signature"], rowHeight, `sig_${r["AVL ID"] ?? rowIndex}`);
  }
  return rowIndex + 1;
}

function tableStart(workbook: ExcelScript.Workbook): ExcelScript.Range {
  const named = workbook.getNamedItem("TableStart");
  if (named) return named.getRange().getCell(0, 0);
  const sheet = workbook.getWorksheet("Sign-off") ?? workbook.addWorksheet("Sign-off");
  return sheet.getRange("A1");
}

function placeSignature(sheet: ExcelScript.Worksheet, cell: ExcelScript.Range, data: string, rowHeight: number, name: string) {
  const b64 = data.replace(/^data:image\/[a-z]+;base64,/, "");
  const pic = sheet.addImage(b64);
  pic.setLockAspectRatio(true);
  pic.setHeight(rowHeight - 6);
  pic.setLeft(cell.getLeft() + 3);
  pic.setTop(cell.getTop() + 3);
  pic.setPlacement(ExcelScript.Placement.twoCell); // picture moves and sizes with its cell
  pic.setName(name);
}
