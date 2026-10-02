// ─── Exported Data Shape Interfaces ───────────────────────────────────────────

export interface ExportableTransaction {
  id: string;
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
}

export interface ExportableBudget {
  category: string;
  limit: number;
  spent: number;
  remaining: number;
}

export interface ExportableSavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

/**
 * Wraps a cell value in double-quotes when it contains commas, quotes, or
 * newlines; doubles any embedded quote characters per RFC 4180.
 */
function escapeCsvCell(value: string | number | boolean): string {
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsvContent(
  headers: string[],
  rows: (string | number | boolean)[][]
): string {
  const lines: string[] = [headers.map(escapeCsvCell).join(",")];
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(","));
  }
  return lines.join("\r\n");
}

function triggerDownload(content: string, filename: string): void {
  // BOM prefix ensures Excel opens UTF-8 CSV correctly
  const bom = "﻿";
  const blob = new Blob([bom + content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function dateTag(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Public Export Functions ──────────────────────────────────────────────────

/**
 * Converts a transaction array to a CSV file and triggers an immediate browser
 * download. Works entirely client-side with no external dependencies.
 */
export function exportTransactionsCsv(
  transactions: ExportableTransaction[],
  currencyCode: string = "INR",
  filename?: string
): void {
  const headers = [
    "Date",
    "Type",
    "Category",
    "Description",
    `Amount (${currencyCode})`,
  ];

  const rows = transactions.map((tx) => [
    // Pinned to en-IN, NOT the user's language, on purpose: this value lands in a
    // spreadsheet cell, and mr-IN renders digits in Devanagari ("१५/०१/२०२६"),
    // which Excel and Sheets cannot parse back into a date. Screen dates go
    // through core/utils/dateFormat; file exports stay machine-readable.
    new Date(tx.date).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }),
    tx.type,
    tx.category,
    tx.description,
    tx.amount,
  ]);

  const csv = buildCsvContent(headers, rows);
  triggerDownload(csv, filename ?? `moneylens-transactions-${dateTag()}.csv`);
}

/**
 * Converts a budget summary array to CSV and triggers download.
 */
export function exportBudgetsCsv(
  budgets: ExportableBudget[],
  currencyCode: string = "INR",
  filename?: string
): void {
  const headers = [
    "Category",
    `Budget Limit (${currencyCode})`,
    `Spent (${currencyCode})`,
    `Remaining (${currencyCode})`,
    "Utilization %",
  ];

  const rows = budgets.map((b) => {
    const utilization =
      b.limit > 0 ? ((b.spent / b.limit) * 100).toFixed(1) + "%" : "0%";
    return [b.category, b.limit, b.spent, b.remaining, utilization];
  });

  const csv = buildCsvContent(headers, rows);
  triggerDownload(csv, filename ?? `moneylens-budgets-${dateTag()}.csv`);
}

/**
 * Converts a savings goals array to CSV and triggers download.
 */
export function exportSavingsCsv(
  goals: ExportableSavingsGoal[],
  currencyCode: string = "INR",
  filename?: string
): void {
  const headers = [
    "Goal Name",
    `Target (${currencyCode})`,
    `Saved (${currencyCode})`,
    "Progress %",
    "Deadline",
  ];

  const rows = goals.map((g) => {
    const progress =
      g.target > 0 ? ((g.current / g.target) * 100).toFixed(1) + "%" : "0%";
    return [g.name, g.target, g.current, progress, g.deadline];
  });

  const csv = buildCsvContent(headers, rows);
  triggerDownload(csv, filename ?? `moneylens-savings-${dateTag()}.csv`);
}
