# Session Summary — MoneyLens

_A recap of what was diagnosed, fixed, and built in this working session._

---

## 1. 🐛 Data loss bug — FIXED (the big one)

**Symptom:** Add a transaction → it shows → refresh (or logout/login) → it's gone.

**Root cause (two parts):**
1. Saves were confirmed from local memory, but the cloud write was fire-and-forget with no error surfaced — so a silently failed cloud write looked "saved."
2. The real killer: data is **encrypted at rest**, and the decryption key lived only in memory. A page **refresh wiped the key**, and the app never re-unlocked — so it couldn't read its own data and showed empty.

**Fixes** (in `src/core/store/dataStore.ts`, `src/app/(dashboard)/layout.tsx`, `src/app/(auth)/pin-lock/page.tsx`):
- **Auto-unlock on refresh:** PIN is cached in `sessionStorage` (survives refresh, cleared on tab close / logout). The dashboard now re-unlocks automatically instead of showing empty data.
- **Durable saves:** every cloud write is tracked; failures are remembered.
- **Logout guard:** logout now flushes pending writes first and warns if something isn't saved (e.g. offline) before wiping local data.
- **Auto-retry:** failed writes retry when the connection returns or on next sign-in.

**Result:** transactions now survive refresh, logout, and login. ✅

---

## 2. 🏷️ "Other" category expander — ADDED

The transaction category picker only offered 5 categories. Added an **"Other"** tile (in both Expense and Income modes) that expands to a full grouped list.

- **Expense → grouped by bucket:** Needs / Wants / Investments (35 categories: Mobile Bill, Salon, Bitcoin, EPF, etc.)
- **Income → grouped by source:** Earned / Investment / Passive & Other

Files: `src/core/utils/categories.ts` (`EXTRA_CATEGORY_GROUPS`, `INCOME_EXTRA_CATEGORY_GROUPS`), `src/components/modals/AddTransactionModal.tsx`.

---

## 3. 💰 Income sources — ADDED (web-researched)

The Income "Other" list wrongly reused expense categories. Replaced with real **income sources** (where money comes from), grouped by the standard personal-finance classification:

- **Earned:** Salary, Bonus, Overtime, Commission, Freelance, Business Profit, Tips
- **Investment:** Dividends, Interest, Capital Gains, Mutual Fund Returns, Stock Gains, Crypto Gains
- **Passive & Other:** Rental Income, Royalty, Pension, Gift Received, Cashback/Rewards, Refund, Government Benefit

---

## 4. 📊 "Spent vs Invested" tab — ADDED

A new third tab in the Budgeting Rule (`src/app/(dashboard)/budgets/page.tsx`) that separates:

- **Spent** — money consumed (Needs + Wants), itemized
- **Where you invested** — money put into investments (SIP, Stocks…), itemized
- **Investment Returns** — investment income received (Dividends, Interest…), shown as money coming in

Plus a KPI row (Spent · Invested · Returns · Invest Rate) and a Spent-vs-Invested donut. New helper: `getIncomeGroupForCategory()` in `categories.ts`.

---

## 5. 📖 Key concepts clarified (no code change)

- **"Actual Spent"** is not stored — it's calculated live by summing this month's **expense** transactions per bucket. You fill it by **Add → Expense → category → Save**.
- **"Allocated Budgets"** = the category budget *limits* you set (a plan), not spending.
- **Red "exceeds target limit" warning** = your **Monthly Take-Home Income is ₹0**, so the Rule Limit is ₹0 and any allocated budget looks over-allocated. Fix: set your income at the top of the Rule Allocations tab. (No bug — working as intended.)
- **Savings Goals are NOT connected** to the Needs/Wants/Investments buckets.

---

## 6. 💡 Open idea — Savings Goals → buckets (NOT yet built)

Discussed connecting savings-goal contributions to the buckets. Conclusion: a goal isn't always an investment (saving for a phone = a *Want*; emergency fund = an *Investment*).

**Recommended approach (pending your go-ahead):** give each savings goal a **bucket tag** (Needs / Wants / Investments, default Investments) chosen at creation, so contributions count toward the right bucket.

---

## ✅ Status
- All changes above type-check clean (`npx tsc --noEmit`).
- Changes are **uncommitted** in the working tree.
- Suggested next steps: commit these changes (ideally split into logical commits), and decide on the Savings-Goals → bucket idea.
