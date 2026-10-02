// ─── Styled Excel (.xlsx) Exporter ─────────────────────────────────────────────
//
// Produces a polished, multi-sheet Excel workbook with coloured header rows,
// full cell borders ("gridding"), zebra striping, currency number formats and
// colour-coded amounts. Runs entirely client-side; exceljs is dynamically
// imported so it never weighs down the main bundle.

import type {
  ExportableTransaction,
  ExportableBudget,
  ExportableSavingsGoal,
} from "@/core/utils/csvExporter";
import type {
  Workbook,
  Worksheet,
  Fill,
  Borders,
  Alignment,
} from "exceljs";

// ─── Theme ─────────────────────────────────────────────────────────────────────

const BRAND = "FF1D4ED8"; // header background (brand blue)
const HEADER_TEXT = "FFFFFFFF"; // white
const TITLE_TEXT = "FF0F172A"; // near-black slate
const GRID = "FFCBD5E1"; // border grey-blue
const ZEBRA = "FFF1F5F9"; // even-row fill
const INCOME = "FF059669"; // green
const EXPENSE = "FFDC2626"; // red
const MUTED = "FF64748B"; // meta text

const HEADER_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: BRAND },
};

const ZEBRA_FILL: Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: ZEBRA },
};

const THIN_GRID: Partial<Borders> = {
  top: { style: "thin", color: { argb: GRID } },
  left: { style: "thin", color: { argb: GRID } },
  bottom: { style: "thin", color: { argb: GRID } },
  right: { style: "thin", color: { argb: GRID } },
};

const CENTER: Partial<Alignment> = { horizontal: "center", vertical: "middle" };
const RIGHT: Partial<Alignment> = { horizontal: "right", vertical: "middle" };
const LEFT: Partial<Alignment> = { horizontal: "left", vertical: "middle" };

// ─── Column definition helper ──────────────────────────────────────────────────

interface ColumnDef {
  header: string;
  key: string;
  width: number;
  align?: "left" | "right" | "center";
  /** Excel number format string, e.g. `"₹"#,##0.00`. */
  numFmt?: string;
}

/**
 * Lays a styled table onto a worksheet: a title band, a coloured header row,
 * bordered + zebra-striped data rows, a frozen header and auto column widths.
 * `colourAmount` optionally tints a numeric column green/red based on the row.
 */
function paintSheet<T extends Record<string, unknown>>(
  ws: Worksheet,
  title: string,
  subtitle: string,
  columns: ColumnDef[],
  rows: T[],
  colourAmount?: (row: T) => string | undefined
): void {
  const lastCol = columns.length;

  // ── Title band (row 1) + subtitle (row 2) ──────────────────────────────────
  ws.mergeCells(1, 1, 1, lastCol);
  const titleCell = ws.getCell(1, 1);
  titleCell.value = title;
  titleCell.font = { bold: true, size: 15, color: { argb: TITLE_TEXT } };
  titleCell.alignment = LEFT;
  ws.getRow(1).height = 24;

  ws.mergeCells(2, 1, 2, lastCol);
  const subCell = ws.getCell(2, 1);
  subCell.value = subtitle;
  subCell.font = { size: 9, italic: true, color: { argb: MUTED } };
  subCell.alignment = LEFT;
  ws.getRow(2).height = 16;

  // ── Header row (row 3) ──────────────────────────────────────────────────────
  const headerRowIdx = 3;
  const headerRow = ws.getRow(headerRowIdx);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.header;
    cell.fill = HEADER_FILL;
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.alignment = {
      horizontal: col.align ?? "left",
      vertical: "middle",
      wrapText: true,
    };
    cell.border = THIN_GRID;
    ws.getColumn(i + 1).width = col.width;
  });
  headerRow.height = 22;

  // ── Data rows ───────────────────────────────────────────────────────────────
  rows.forEach((row, r) => {
    const excelRow = ws.getRow(headerRowIdx + 1 + r);
    const isEven = r % 2 === 1;
    columns.forEach((col, i) => {
      const cell = excelRow.getCell(i + 1);
      cell.value = row[col.key] as string | number;
      cell.border = THIN_GRID;
      cell.alignment =
        col.align === "right" ? RIGHT : col.align === "center" ? CENTER : LEFT;
      if (col.numFmt) cell.numFmt = col.numFmt;
      if (isEven) cell.fill = ZEBRA_FILL;

      // Colour-code the amount column if a resolver is supplied
      if (col.key === "amount" && colourAmount) {
        const argb = colourAmount(row);
        if (argb) cell.font = { color: { argb }, bold: true };
      }
    });
    excelRow.height = 18;
  });

  // ── Finishing touches ───────────────────────────────────────────────────────
  ws.views = [{ state: "frozen", ySplit: headerRowIdx }];
  ws.autoFilter = {
    from: { row: headerRowIdx, column: 1 },
    to: { row: headerRowIdx, column: lastCol },
  };
}

// ─── Download plumbing ──────────────────────────────────────────────────────────

async function downloadWorkbook(wb: Workbook, filename: string): Promise<void> {
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
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

/**
 * Pinned to en-IN, NOT the user's language, on purpose: this value lands in a
 * spreadsheet cell, and mr-IN renders digits in Devanagari ("१५/०१/२०२६"), which
 * Excel and Sheets cannot parse back into a date. Screen dates go through
 * core/utils/dateFormat; file exports stay machine-readable.
 */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export interface ExcelExportOptions {
  transactions?: ExportableTransaction[];
  budgets?: ExportableBudget[];
  savingsGoals?: ExportableSavingsGoal[];
  currencyCode?: string;
  currencySymbol?: string;
  dateRangeLabel?: string;
  filename?: string;
}

/**
 * Builds a single styled `.xlsx` workbook containing one sheet per supplied
 * data type and triggers an immediate browser download. Sheets are only added
 * for non-empty datasets.
 */
export async function exportWorkbookXlsx(
  options: ExcelExportOptions
): Promise<void> {
  const {
    transactions = [],
    budgets = [],
    savingsGoals = [],
    currencyCode = "INR",
    currencySymbol = "₹",
    dateRangeLabel = "All Records",
    filename,
  } = options;

  // Escape the currency symbol for use inside an Excel number-format string.
  const money = `"${currencySymbol}"#,##0`;
  // Pinned alongside fmtDate above so one workbook never mixes two date styles.
  const generatedOn = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const subtitle = `MoneyLens  ·  Period: ${dateRangeLabel}  ·  Generated: ${generatedOn}`;

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "MoneyLens";
  wb.created = new Date();

  // ── Transactions sheet ──────────────────────────────────────────────────────
  if (transactions.length > 0) {
    const ws = wb.addWorksheet("Transactions", {
      views: [{ showGridLines: false }],
    });
    paintSheet(
      ws,
      "Transaction Ledger",
      subtitle,
      [
        { header: "Date", key: "date", width: 14 },
        { header: "Type", key: "type", width: 12, align: "center" },
        { header: "Category", key: "category", width: 20 },
        { header: "Description", key: "description", width: 38 },
        {
          header: `Amount (${currencyCode})`,
          key: "amount",
          width: 18,
          align: "right",
          numFmt: money,
        },
      ],
      transactions.map((tx) => ({
        date: fmtDate(tx.date),
        type: tx.type,
        category: tx.category,
        description: tx.description,
        amount: tx.amount,
      })),
      (row) => (row.type === "income" ? INCOME : EXPENSE)
    );
  }

  // ── Budgets sheet ───────────────────────────────────────────────────────────
  if (budgets.length > 0) {
    const ws = wb.addWorksheet("Budgets", {
      views: [{ showGridLines: false }],
    });
    paintSheet(
      ws,
      "Budget Overview",
      subtitle,
      [
        { header: "Category", key: "category", width: 22 },
        {
          header: `Limit (${currencyCode})`,
          key: "limit",
          width: 16,
          align: "right",
          numFmt: money,
        },
        {
          header: `Spent (${currencyCode})`,
          key: "spent",
          width: 16,
          align: "right",
          numFmt: money,
        },
        {
          header: `Remaining (${currencyCode})`,
          key: "remaining",
          width: 18,
          align: "right",
          numFmt: money,
        },
        { header: "Utilization", key: "utilization", width: 14, align: "right" },
      ],
      budgets.map((b) => ({
        category: b.category,
        limit: b.limit,
        spent: b.spent,
        remaining: b.remaining,
        utilization:
          b.limit > 0 ? ((b.spent / b.limit) * 100).toFixed(1) + "%" : "0%",
      }))
    );
  }

  // ── Savings sheet ───────────────────────────────────────────────────────────
  if (savingsGoals.length > 0) {
    const ws = wb.addWorksheet("Savings Goals", {
      views: [{ showGridLines: false }],
    });
    paintSheet(
      ws,
      "Savings Goals",
      subtitle,
      [
        { header: "Goal Name", key: "name", width: 26 },
        {
          header: `Target (${currencyCode})`,
          key: "target",
          width: 16,
          align: "right",
          numFmt: money,
        },
        {
          header: `Saved (${currencyCode})`,
          key: "current",
          width: 16,
          align: "right",
          numFmt: money,
        },
        { header: "Progress", key: "progress", width: 12, align: "right" },
        { header: "Deadline", key: "deadline", width: 16, align: "center" },
      ],
      savingsGoals.map((g) => ({
        name: g.name,
        target: g.target,
        current: g.current,
        progress:
          g.target > 0 ? ((g.current / g.target) * 100).toFixed(1) + "%" : "0%",
        deadline: g.deadline ? fmtDate(g.deadline) : "—",
      }))
    );
  }

  // Guarantee at least one sheet so exceljs doesn't throw on an empty workbook.
  if (wb.worksheets.length === 0) {
    wb.addWorksheet("Empty");
  }

  await downloadWorkbook(wb, filename ?? `moneylens-export-${dateTag()}.xlsx`);
}
