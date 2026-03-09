/**
 * Formats a single cell for CSV, handling quoting and escaping
 */
export function formatCSVCell(cell: any): string {
  if (cell === null || cell === undefined) return '""';
  
  const stringValue = String(cell);
  // Escape double quotes by doubling them
  const escapedValue = stringValue.replace(/"/g, '""');
  
  // Wrap in double quotes
  return `"${escapedValue}"`;
}

/**
 * Generates a CSV string from an array of rows
 */
export function generateCSV(rows: any[][]): string {
  return rows
    .map((row) => row.map(formatCSVCell).join(","))
    .join("\n");
}

/**
 * Triggers a browser download of a CSV file
 */
export function downloadCSVFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}
