/**
 * Office Script: AppendSignature
 *
 * Adds one signer to a meeting's group spreadsheet, with their drawn signature embedded as a picture
 * in the Signature cell. Run by flow "TBX - Add signature to sheet" each time someone signs.
 * Keep that flow's concurrency at 1 so two signers never write to the same row.
 *
 *   headersJson - JSON array of column headings, in order (the same list WriteAttendanceSheet uses).
 *   rowJson     - JSON object for this signer. Keys match the headings. "Signature" holds the PNG as
 *                 base64, with or without the "data:image/png;base64," prefix.
 *
 * Returns the sheet row number written (1-based), or 0 if this AVL ID is already in the sheet.
 */
function main(workbook: ExcelScript.Workbook, headersJson: string, rowJson: string): number {
  const headers: string[] = JSON.parse(headersJson);
  const r: { [key: string]: string } = JSON.parse(rowJson);
  const rowHeight = 48;

  const sheet = workbook.getWorksheet("Attendance") ?? workbook.addWorksheet("Attendance");
  const sigCol = headers.indexOf("Signature");
  const idCol = headers.indexOf("AVL ID");

  // Write headings if this is the first signer
  const head = sheet.getRangeByIndexes(0, 0, 1, headers.length);
  if (String(head.getValues()[0][0]) === "") {
    head.setValues([headers]);
    head.getFormat().getFont().setBold(true);
    head.getFormat().getFill().setColor("#005E38");
    head.getFormat().getFont().setColor("#FFFFFF");
    sheet.getFreezePanes().freezeRows(1);
    if (sigCol >= 0) sheet.getRangeByIndexes(0, sigCol, 1, 1).getFormat().setColumnWidth(170);
  }

  // Next empty row, and skip if this person is already listed (e.g. the flow was re-run)
  const used = sheet.getUsedRange();
  const lastRow = used ? used.getRowIndex() + used.getRowCount() : 1;
  if (idCol >= 0 && used) {
    const ids = sheet.getRangeByIndexes(1, idCol, Math.max(lastRow - 1, 1), 1).getValues();
    if (ids.some((v) => String(v[0]) !== "" && String(v[0]) === String(r["AVL ID"]))) return 0;
  }
  const rowIndex = Math.max(lastRow, 1);

  const values = headers.map((h) => (h === "Signature" ? "" : (r[h] ?? "")));
  const row = sheet.getRangeByIndexes(rowIndex, 0, 1, headers.length);
  row.setValues([values]);
  row.getFormat().setRowHeight(rowHeight);

  if (sigCol >= 0 && r["Signature"]) {
    const b64 = r["Signature"].replace(/^data:image\/[a-z]+;base64,/, "");
    const cell = sheet.getRangeByIndexes(rowIndex, sigCol, 1, 1);
    const pic = sheet.addImage(b64);
    pic.setLockAspectRatio(true);
    pic.setHeight(rowHeight - 6);
    pic.setLeft(cell.getLeft() + 3);
    pic.setTop(cell.getTop() + 3);
    pic.setPlacement(ExcelScript.Placement.twoCell);
    pic.setName(`sig_${r["AVL ID"] ?? rowIndex}`);
  }
  return rowIndex + 1;
}
