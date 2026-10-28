/**
 * Office Script: WriteAttendanceSheet
 *
 * Rewrites the "Attendance" sheet of a copied toolbox template with one row per attendee and embeds
 * each person's drawn signature as a picture in the Signature column.
 *
 * Called from Power Automate: Excel Online (Business) > Run script, on the copy of the template.
 *   headersJson - JSON array of column headings, in order. Match the WHS Monitor import template.
 *   rowsJson    - JSON array of objects. Keys must match the headings. The key "Signature" holds the
 *                 PNG as base64, with or without the "data:image/png;base64," prefix.
 *   meetingJson - JSON object written into the "Meeting" sheet as label / value pairs.
 *
 * Returns the number of rows written, so the flow can check it against the attendance count.
 */
function main(workbook: ExcelScript.Workbook, headersJson: string, rowsJson: string, meetingJson: string): number {
  const headers: string[] = JSON.parse(headersJson);
  const rows: { [key: string]: string }[] = JSON.parse(rowsJson);
  const meeting: { [key: string]: string } = JSON.parse(meetingJson);

  const sheet = workbook.getWorksheet("Attendance") ?? workbook.addWorksheet("Attendance");
  const sigCol = headers.indexOf("Signature");
  const rowHeight = 48; // points; tall enough to read a signature

  // Start clean: a rebuild must not leave rows or pictures from earlier appends behind
  sheet.getShapes().forEach((sh) => sh.delete());
  sheet.getRange().clear(ExcelScript.ClearApplyTo.all);

  // Header row
  const head = sheet.getRangeByIndexes(0, 0, 1, headers.length);
  head.setValues([headers]);
  head.getFormat().getFont().setBold(true);
  head.getFormat().getFill().setColor("#005E38");
  head.getFormat().getFont().setColor("#FFFFFF");

  rows.forEach((r, i) => {
    const rowIndex = i + 1;
    const values = headers.map((h) => (h === "Signature" ? "" : (r[h] ?? "")));
    sheet.getRangeByIndexes(rowIndex, 0, 1, headers.length).setValues([values]);
    sheet.getRangeByIndexes(rowIndex, 0, 1, headers.length).getFormat().setRowHeight(rowHeight);

    if (sigCol >= 0 && r["Signature"]) {
      const b64 = r["Signature"].replace(/^data:image\/[a-z]+;base64,/, "");
      const cell = sheet.getRangeByIndexes(rowIndex, sigCol, 1, 1);
      const pic = sheet.addImage(b64);
      pic.setLockAspectRatio(true);
      pic.setHeight(rowHeight - 6);
      pic.setLeft(cell.getLeft() + 3);
      pic.setTop(cell.getTop() + 3);
      pic.setPlacement(ExcelScript.Placement.twoCell); // picture moves and sizes with its cell
      pic.setName(`sig_${rowIndex}`);
    }
  });

  if (sigCol >= 0) sheet.getRangeByIndexes(0, sigCol, 1, 1).getFormat().setColumnWidth(170);
  sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).getFormat().autofitColumns();
  if (sigCol >= 0) sheet.getRangeByIndexes(0, sigCol, 1, 1).getFormat().setColumnWidth(170);
  sheet.getFreezePanes().freezeRows(1);

  // Meeting details
  const info = workbook.getWorksheet("Meeting") ?? workbook.addWorksheet("Meeting");
  const pairs = Object.keys(meeting).map((k) => [k, meeting[k]]);
  if (pairs.length) info.getRangeByIndexes(0, 0, pairs.length, 2).setValues(pairs);
  info.getRangeByIndexes(0, 0, Math.max(pairs.length, 1), 1).getFormat().getFont().setBold(true);
  info.getRangeByIndexes(0, 0, Math.max(pairs.length, 1), 2).getFormat().autofitColumns();

  return rows.length;
}
