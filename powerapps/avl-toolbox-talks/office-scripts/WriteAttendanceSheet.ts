/**
 * Office Script: WriteAttendanceSheet
 *
 * Rewrites the whole sign-off table of a meeting's sheet from the TBX Signatures list, with each
 * person's signature embedded as a picture. Flow "TBX - Close meeting" runs it when any signature
 * failed to reach the sheet, so the sheet always matches the list. It is also used to fill the heading
 * block when the sheet is first created (pass an empty rows array).
 *
 * Template: the table heading row starts at the cell named "TableStart" (see AppendSignature).
 * Heading-block cells are filled from the names in meetingJson where the template defines a name with
 * the same key (e.g. Topic, MeetingDate, Presenter, Location, Team, Declaration, MeetingID).
 *
 *   headersJson - JSON array of table headings in order (the same list AppendSignature uses).
 *   rowsJson    - JSON array of signer objects keyed by heading; "No." is filled in by the script.
 *   meetingJson - JSON object of heading-block values, e.g. {"Topic":"Hearing protection", ...}.
 *
 * Returns the number of signer rows written, so the flow can check it against the list.
 */
function main(workbook: ExcelScript.Workbook, headersJson: string, rowsJson: string, meetingJson: string): number {
  const headers: string[] = JSON.parse(headersJson);
  const rows: { [key: string]: string }[] = JSON.parse(rowsJson);
  const meeting: { [key: string]: string } = JSON.parse(meetingJson);
  const rowHeight = 48;

  // Heading block
  Object.keys(meeting).forEach((k) => {
    const item = workbook.getNamedItem(k);
    if (item) item.getRange().getCell(0, 0).setValue(meeting[k]);
  });

  const start = tableStart(workbook);
  const sheet = start.getWorksheet();
  const top = start.getRowIndex();
  const left = start.getColumnIndex();
  const sigCol = headers.indexOf("Signature");
  const noCol = headers.indexOf("No.");

  // Start clean: remove earlier signature pictures and table rows
  sheet.getShapes().forEach((sh) => {
    if (sh.getName().startsWith("sig_")) sh.delete();
  });
  sheet.getRangeByIndexes(top + 1, left, 1000, headers.length).clear(ExcelScript.ClearApplyTo.contents);

  const head = sheet.getRangeByIndexes(top, left, 1, headers.length);
  head.setValues([headers]);
  head.getFormat().getFont().setBold(true);
  head.getFormat().getFill().setColor("#005E38");
  head.getFormat().getFont().setColor("#FFFFFF");
  if (sigCol >= 0) sheet.getRangeByIndexes(top, left + sigCol, 1, 1).getFormat().setColumnWidth(170);

  rows.forEach((r, i) => {
    const rowIndex = top + 1 + i;
    const values = headers.map((h, c) =>
      c === noCol ? String(i + 1) : h === "Signature" ? "" : (r[h] ?? ""));
    const row = sheet.getRangeByIndexes(rowIndex, left, 1, headers.length);
    row.setValues([values]);
    row.getFormat().setRowHeight(rowHeight);
    row.getFormat().setVerticalAlignment(ExcelScript.VerticalAlignment.center);
    row.getFormat().getBorders().getItem(ExcelScript.BorderIndex.edgeBottom).setStyle(ExcelScript.BorderLineStyle.continuous);
    if (sigCol >= 0 && r["Signature"]) {
      placeSignature(sheet, sheet.getRangeByIndexes(rowIndex, left + sigCol, 1, 1), r["Signature"], rowHeight, `sig_${r["AVL ID"] ?? rowIndex}`);
    }
  });

  return rows.length;
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
  pic.setPlacement(ExcelScript.Placement.twoCell);
  pic.setName(name);
}
