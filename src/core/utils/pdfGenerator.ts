// ─── Data Shape Interfaces ────────────────────────────────────────────────────

export interface PdfTransaction {
  date: string;
  type: "income" | "expense";
  category: string;
  description: string;
  amount: number;
}

export interface PdfBudget {
  category: string;
  limit: number;
  spent: number;
  remaining: number;
}

export interface PdfSavingsGoal {
  name: string;
  target: number;
  current: number;
  deadline: string;
}

export interface PdfReportOptions {
  transactions?: PdfTransaction[];
  budgets?: PdfBudget[];
  savingsGoals?: PdfSavingsGoal[];
  currencyCode?: string;
  currencySymbol?: string;
  dateRangeLabel?: string;
  transactionFilter?: string;
}

// ─── Internal Helpers ──────────────────────────────────────────────────────────

function fmt(amount: number, symbol: string): string {
  return `${symbol}${amount.toLocaleString("en-IN")}`;
}

function buildHtml(opts: PdfReportOptions): string {
  const {
    transactions = [],
    budgets = [],
    savingsGoals = [],
    currencyCode = "INR",
    currencySymbol = "₹",
    dateRangeLabel = "All Records",
  } = opts;

  const totalIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);
  const netBalance = totalIncome - totalExpense;
  const netColor = netBalance >= 0 ? "#059669" : "#dc2626";

  // The report body is English throughout (headings, column labels), so its
  // dates stay en-IN rather than following the UI language — a Marathi date
  // under an English heading reads as a bug, not as localization. Localizing
  // this export means translating the whole template, not just the dates.
  const generatedOn = new Date().toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Transaction rows ──────────────────────────────────────────────────────
  const txRows = transactions
    .map((tx) => {
      const sign = tx.type === "income" ? "+" : "−";
      const color = tx.type === "income" ? "#059669" : "#dc2626";
      const bg = tx.type === "income" ? "#d1fae5" : "#fee2e2";
      const dateStr = new Date(tx.date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return `
        <tr>
          <td>${dateStr}</td>
          <td>
            <span class="badge" style="background:${bg};color:${color};">
              ${tx.type}
            </span>
          </td>
          <td>${tx.category}</td>
          <td class="desc">${tx.description}</td>
          <td class="num" style="color:${color};font-weight:700;">
            ${sign}${fmt(tx.amount, currencySymbol)}
          </td>
        </tr>`;
    })
    .join("");

  // ── Budget rows ───────────────────────────────────────────────────────────
  const budgetRows = budgets
    .map((b) => {
      const pct = b.limit > 0 ? (b.spent / b.limit) * 100 : 0;
      const barColor =
        pct > 90 ? "#dc2626" : pct > 70 ? "#d97706" : "#059669";
      const pctLabel = pct.toFixed(1) + "%";
      return `
        <tr>
          <td>${b.category}</td>
          <td class="num">${fmt(b.limit, currencySymbol)}</td>
          <td class="num">${fmt(b.spent, currencySymbol)}</td>
          <td class="num">${fmt(b.remaining, currencySymbol)}</td>
          <td class="num">
            <div class="bar-wrap">
              <div class="bar-fill" style="width:${Math.min(pct, 100)}%;background:${barColor};"></div>
            </div>
            <span style="color:${barColor};font-weight:700;font-size:8pt;">${pctLabel}</span>
          </td>
        </tr>`;
    })
    .join("");

  // ── Savings rows ──────────────────────────────────────────────────────────
  const savingsRows = savingsGoals
    .map((g) => {
      const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
      return `
        <tr>
          <td>${g.name}</td>
          <td class="num">${fmt(g.target, currencySymbol)}</td>
          <td class="num">${fmt(g.current, currencySymbol)}</td>
          <td class="num">
            <div class="bar-wrap">
              <div class="bar-fill" style="width:${Math.min(pct, 100)}%;background:#1d4ed8;"></div>
            </div>
            <span style="color:#1d4ed8;font-weight:700;font-size:8pt;">${pct.toFixed(1)}%</span>
          </td>
          <td>${g.deadline}</td>
        </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>MoneyLens · Financial Report</title>
  <style>
    @page { size: A4 portrait; margin: 18mm 16mm; }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 9.5pt;
      color: #0f172a;
      background: #ffffff;
      line-height: 1.45;
    }

    /* ── Header ── */
    .header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      padding-bottom: 14px;
      border-bottom: 3px solid #1d4ed8;
      margin-bottom: 18px;
    }
    .header-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 4px;
    }
    .header-brand svg { width: 30px; height: 30px; }
    .header-name {
      font-size: 20pt;
      font-weight: 800;
      color: #1d4ed8;
      letter-spacing: -0.5px;
    }
    .header-tagline {
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 4px;
    }
    .header-meta {
      font-size: 7.5pt;
      color: #94a3b8;
    }

    /* ── Balance metric boxes ── */
    .metrics {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 20px;
    }
    .metric {
      border: 1.5px solid #e2e8f0;
      border-radius: 8px;
      padding: 11px 14px;
    }
    .metric-label {
      font-size: 6.5pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #64748b;
      margin-bottom: 4px;
    }
    .metric-value {
      font-size: 13.5pt;
      font-weight: 800;
      letter-spacing: -0.5px;
    }
    .m-income  { border-left: 4px solid #059669; }
    .m-expense { border-left: 4px solid #dc2626; }
    .m-net     { border-left: 4px solid #1d4ed8; }
    .m-income  .metric-value { color: #059669; }
    .m-expense .metric-value { color: #dc2626; }
    .m-net     .metric-value { color: ${netColor}; }

    /* ── Section headers ── */
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    .section-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 10pt;
      font-weight: 800;
      color: #1e293b;
      padding-bottom: 6px;
      border-bottom: 1.5px solid #e2e8f0;
      margin-bottom: 10px;
    }
    .section-count {
      font-size: 7pt;
      font-weight: 700;
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #dbeafe;
      border-radius: 20px;
      padding: 1px 8px;
    }

    /* ── Tables ── */
    table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    thead tr { background: #f1f5f9; }
    thead th {
      text-align: left;
      font-size: 6.8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #475569;
      padding: 7px 8px;
      border-bottom: 1.5px solid #cbd5e1;
    }
    tbody td {
      padding: 6px 8px;
      color: #334155;
      border-bottom: 1px solid #f1f5f9;
      vertical-align: middle;
    }
    tbody tr:last-child td { border-bottom: none; }
    tbody tr:nth-child(even) { background: #fafafa; }

    td.num { text-align: right; white-space: nowrap; }
    td.desc { max-width: 180px; }

    .badge {
      display: inline-block;
      font-size: 7pt;
      font-weight: 700;
      text-transform: capitalize;
      padding: 1px 7px;
      border-radius: 20px;
    }

    /* ── Progress bar ── */
    .bar-wrap {
      height: 5px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 2px;
    }
    .bar-fill { height: 100%; border-radius: 3px; }

    /* ── Footer ── */
    .footer {
      text-align: center;
      font-size: 7pt;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 10px;
      margin-top: 20px;
    }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>

  <!-- HEADER -->
  <div class="header">
    <div class="header-brand">
      <svg viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2
                 m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1
                 m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
      </svg>
      <span class="header-name">MoneyLens</span>
    </div>
    <div class="header-tagline">Financial Statement Report</div>
    <div class="header-meta">
      Period: ${dateRangeLabel}&nbsp;&nbsp;·&nbsp;&nbsp;Generated: ${generatedOn}&nbsp;&nbsp;·&nbsp;&nbsp;Currency: ${currencyCode}
    </div>
  </div>

  ${
    transactions.length > 0
      ? `<!-- BALANCE METRICS -->
  <div class="metrics">
    <div class="metric m-income">
      <div class="metric-label">Total Income</div>
      <div class="metric-value">${fmt(totalIncome, currencySymbol)}</div>
    </div>
    <div class="metric m-expense">
      <div class="metric-label">Total Expense</div>
      <div class="metric-value">${fmt(totalExpense, currencySymbol)}</div>
    </div>
    <div class="metric m-net">
      <div class="metric-label">Net Balance</div>
      <div class="metric-value">${fmt(netBalance, currencySymbol)}</div>
    </div>
  </div>`
      : ""
  }

  ${
    transactions.length > 0
      ? `<!-- TRANSACTIONS -->
  <div class="section">
    <div class="section-header">
      Transaction Ledger
      <span class="section-count">${transactions.length} records</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Type</th>
          <th>Category</th>
          <th>Description</th>
          <th style="text-align:right;">Amount (${currencyCode})</th>
        </tr>
      </thead>
      <tbody>${txRows}</tbody>
    </table>
  </div>`
      : ""
  }

  ${
    budgets.length > 0
      ? `<!-- BUDGETS -->
  <div class="section">
    <div class="section-header">
      Budget Overview
      <span class="section-count">${budgets.length} categories</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Category</th>
          <th style="text-align:right;">Limit (${currencyCode})</th>
          <th style="text-align:right;">Spent (${currencyCode})</th>
          <th style="text-align:right;">Remaining (${currencyCode})</th>
          <th style="text-align:right;">Utilization</th>
        </tr>
      </thead>
      <tbody>${budgetRows}</tbody>
    </table>
  </div>`
      : ""
  }

  ${
    savingsGoals.length > 0
      ? `<!-- SAVINGS GOALS -->
  <div class="section">
    <div class="section-header">
      Savings Goals
      <span class="section-count">${savingsGoals.length} goals</span>
    </div>
    <table>
      <thead>
        <tr>
          <th>Goal Name</th>
          <th style="text-align:right;">Target (${currencyCode})</th>
          <th style="text-align:right;">Saved (${currencyCode})</th>
          <th style="text-align:right;">Progress</th>
          <th>Deadline</th>
        </tr>
      </thead>
      <tbody>${savingsRows}</tbody>
    </table>
  </div>`
      : ""
  }

  <!-- FOOTER -->
  <div class="footer">
    MoneyLens &nbsp;·&nbsp; Zero-license client-side financial tracker
    &nbsp;·&nbsp; All data processed locally on your device. Never uploaded to any server.
  </div>

</body>
</html>`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Compiles financial data into a professionally styled HTML document and opens
 * the browser's native print dialog so the user can save it as a PDF.
 *
 * If the browser blocks the popup, falls back to downloading the document as an
 * HTML file which can be opened and printed separately.
 */
export function generatePdfReport(options: PdfReportOptions): void {
  const html = buildHtml(options);
  const printWindow = window.open("", "_blank", "width=960,height=720");

  if (!printWindow) {
    // Popup blocked — download as HTML fallback
    const blob = new Blob([html], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `moneylens-report-${new Date().toISOString().slice(0, 10)}.html`;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();

  // Small delay lets the browser fully render before the print dialog fires
  setTimeout(() => {
    printWindow.print();
  }, 450);
}
