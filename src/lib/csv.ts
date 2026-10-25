// CSV escaping shared by every export (currently the admin inquiries
// dashboard export).

/**
 * Escape one CSV cell.
 *
 * Quotes are doubled per RFC 4180. Additionally, values that a spreadsheet
 * app would interpret as a FORMULA (leading =, +, -, @, or a tab/CR control
 * character) are defused with a leading apostrophe — otherwise a crafted
 * inquiry like `=HYPERLINK(...)` would execute when the owner opens the
 * exported file in Excel or Google Sheets (CSV formula injection).
 */
export function csvCell(value: string): string {
  const isFormulaLike = /^[=+\-@\t\r]/.test(value);
  const guarded = isFormulaLike ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

/** Join rows of string cells into RFC 4180 CSV text. */
export function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
