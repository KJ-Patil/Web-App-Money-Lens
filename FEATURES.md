# DhanBook — Complete Features & Functions Reference

> An exhaustive catalog of **every feature the app offers** and **every function in the codebase** — down to the small helpers. Generated from a full read of `src/`. For a build-from-scratch spec see [PROJECT_BLUEPRINT.md](PROJECT_BLUEPRINT.md).

**DhanBook – Personal Wealth Manager** is an offline-first personal-finance PWA: local-first (`localStorage`) with per-user Firebase Firestore cloud sync, encrypted at rest, Indian-first (INR lakh/crore, bank-SMS parsing, Hindi/Hinglish voice logging, CIBIL, khata ledger, WhatsApp reminders). No mock/seed data is ever fabricated — every KPI and chart is *derived* from the real transactions a user enters.

---

## Part A — Feature Catalog (everything the user can do)

### 1. Authentication & Account
- **Splash screen** with animated logo + auth-aware redirect (login / pin-lock / home).
- **Email + password login** (Firebase Auth).
- **Google sign-in** (popup).
- **Phone OTP login** (invisible reCAPTCHA + SMS code, E.164 validated).
- **Registration** with display name, email/password, and avatar upload (local blob + simulated progress); writes a Firestore user profile.
- **Sign out** and **"Switch Account"** (clears the local session).
- **"Sign Out Everywhere"** from settings.

### 2. Security & Privacy
- **4-digit PIN lock** with on-screen keypad — setup, verify, and change flows.
- **PIN hashing** (SHA-256, salted `v2$` format; legacy unsalted hashes auto-upgraded on next verify).
- **Biometric unlock hook** (WebAuthn platform-authenticator check + assertion).
- **Forgot-PIN flow** verifying the account owner by email.
- **Auto-lock** after 60s in the background (Page Visibility API).
- **Encryption at rest** — sensitive local data is AES-GCM encrypted with a PIN-derived key; legacy plaintext is migrated to ciphertext on unlock.

### 3. Data, Sync & Backup
- **Local-first storage** — instant, fully offline via `localStorage`.
- **Per-user cloud sync** to Firestore (`users/{uid}/appData/{key}`), live via `onSnapshot`, across devices/tabs.
- **Data-loss guard** — a stale/empty cloud snapshot can never clobber populated local data; local is pushed up to reconcile instead.
- **Offline cache** (Firestore `persistentLocalCache` + multi-tab manager).
- **Cloud backup & restore** — create timestamped labeled snapshots, list, restore, and delete them.
- **Weekly lazy "catch-up" recompute** of health score + insights (runs once per 7-day window).
- **Clear all financial data** and full local wipe (multi-stage confirm, optional email-code verification).

### 4. Transactions
- **Add transaction** (expense/income, category grid, amount, description) via modal.
- **Live transactions list** with search, type tabs (all/income/expense), grouped Today / Yesterday / Previous Weeks.
- **Inline edit** (amount + description) and **inline delete** with confirm.
- **Budget-threshold alert** — an expense that pushes a category to ≥80% of its budget writes a notification + inline warning.
- **Anomaly detection** — flags an amount >2.5× the category's rolling average.

### 5. Automated Entry
- **Bank SMS paste → transaction** — parses HDFC, SBI, ICICI, Axis, Kotak, UPI (GPay/PhonePe/Paytm/BHIM) and a generic "Bank Alert" fallback; edit before saving.
- **Voice logging** (Web Speech API) — Hindi/Hinglish/Devanagari; parses amount, type, category; runs anomaly check before saving.
- **Floating calculator** — global arithmetic calculator (Shunting-Yard evaluator) for quick math during entry.

### 6. Budgets
- **Monthly budgets per category** with a month switcher (prev/next).
- **Progress bars** comparing real spend vs limit, color-coded (≥100% error, ≥80% warning).
- **Set/adjust budget** modal (syncs through the store).

### 7. Savings Goals
- **Create goals** (name, target, deadline).
- **Radial % progress ring**, target/deadline display, **required monthly deposit** calculation.
- **Log deposit** (increments goal + logs an Investment transaction).
- **Completed-goal** state.

### 8. Ledger / Khata (Notebook)
- **Customer & supplier accounts** ("owes me" / "I owe") with phone numbers.
- **Receivable / Payable / Net Position** summary.
- **Filter tabs** (all/credit/debit/settled) + search.
- **"You Gave" / "You Got"** quick entries (mirrored into transactions under a `Ledger` category).
- **Running-balance history** with per-entry delete (also removes the linked transaction).
- **WhatsApp / SMS payment reminders** per customer, with tone (friendly/formal/urgent) and language (EN/HI/MR) templates.

### 9. Family Wallet
- **Create a shared group** (random 6-digit code) or **join by code**.
- **Shared pool balance** with optional **spending limit** + over-limit alert.
- **Group expense claims** and collaborative expense history.

### 10. Bill Splitter
- **Add shared expenses** (equal split or assign-to-one), define people + mobile numbers, pick "you are".
- **Optimized settlements** (greedy debt simplification) with WhatsApp request links.
- **Your summary** (who owes you / you owe) and net balances. Local-only (not persisted).

### 11. Loans & EMI
- **Add loans** (lender presets, principal, rate, tenure, months paid, start date) with live amortization preview.
- **EMI tracker** — active loans, monthly outflow, outstanding, total interest; per-loan card with progress, expandable breakdown, delete.
- **Reducing-balance EMI + amortization** math (payable, interest, outstanding, completion date).

### 12. Subscriptions
- **Auto-detected recurring charges** from transaction history (median amount, next-charge estimate, "possibly unused" after ~45 days).
- **Manually added subscriptions**.
- **Summary KPIs** (detected, monthly cost, annual cost, possibly-unused count).

### 13. Calendar
- **Month grid** of upcoming financial obligations (loan EMIs + subscription charges) projected forward ~12 months.
- **Day-detail page** listing that day's due items.

### 14. Insights & Scores
- **Financial Health Score (0–100)** — weighted (savings rate, budget discipline, vault velocity, debt-to-income, spending stability) with gauge + "AI prescriptions".
- **CIBIL simulator** — sliders (payment history, utilization, age, mix, inquiries) → 300–900 score with animated counter and band label. Educational.
- **Safe-to-Spend** — daily spendable number after month expenses + savings reserve.
- **Mood insights** — log daily mood, correlate spend/income with mood, variance alert.
- **Streaks & achievements** — logging streaks + 10 unlockable badges.
- **What-If simulator** — SIP future-value projection (monthly compounding annuity-due) with chart.

### 15. Analytics & Reporting
- **Home dashboard** — greeting, balance card, safe-to-spend, 4-stat grid, 7-day balance + monthly category charts, notifications bell.
- **Analytics** — KPI cards with MoM change, income-vs-expense area chart, allocation pie, comparative bars, top-5 category rankers.
- **Month-vs-month comparison** — headline totals, per-category deltas, grouped bars.
- **Export** — date-range + data-type + type filters → **CSV**, **Excel (.xlsx)**, or **PDF** report.

### 16. Learning
- **Academy** — lessons (`lessons.json`) → per-question quiz → results; 100% unlocks a reward badge; progress tracked.
- **Help** page and **About** page.

### 17. Personalization & System
- **Multi-currency** (INR/USD/EUR/AUD) with searchable picker; **live exchange rates** (open.er-api.com, cached 12h, offline fallback), Indian lakh/crore layout for INR.
- **Language preference** (English/Hindi/Marathi with i18n dictionaries; full Indian-languages dataset for the picker).
- **Category manager** — active vs archived categories, custom colors/icons, archive/restore.
- **Notifications center** — severity icons, mark-all-read, delete per item.
- **Flash reminder modal**, **top progress loader**, **toast notifications**.
- **PWA** — manifest + service worker (production only).

---

## Part B — Function Reference (every exported function/module)

### `core/store/dataStore.ts` — central data layer
- `KEYS` — storage-key constants.
- `clearFinancialData()` — wipe all synced financial data (local + cloud) and local-only caches.
- `clearLocalCache()` — clear the in-memory decrypted cache.
- `emitChange()` — dispatch the `datastore:change` event for live updates.
- `generateId()` — short random id.
- `unlockDataStore(pin)` — derive AES key, load/migrate local data, start sync.
- `lockDataStore()` — forget key + cache, stop sync.
- `getTransactions` / `setTransactions` / `addTransaction` / `updateTransaction` / `deleteTransaction`.
- `getSavingsGoals` / `setSavingsGoals`.
- `getLoans` / `setLoans`.
- `getBudgets` / `setBudgets`.
- `getLedgerCustomers` / `setLedgerCustomers`.
- `getFamilyGroups` / `setFamilyGroups` / `getFamilyExpenses` / `setFamilyExpenses`.
- `computeGroupPoolBalance(expenses)` — net family-pool balance.
- `getManualSubscriptions` / `setManualSubscriptions` / `addManualSubscription` / `deleteManualSubscription`.
- **Selectors:** `getTotals`, `getMonthTotals`, `getCategoryBreakdown`, `getDailyBalanceTrend`, `getMonthlyTrend`, `getSavingsRate`, `getTotalSaved`, `getTotalDebt`.
- **Hooks (live):** `useTransactions`, `useBudgets`, `useLedgerCustomers`, `useLoans`, `useSavingsGoals`, `useFamilyGroups`, `useManualSubscriptions`, `useFamilyExpenses`.
- **Cloud backup:** `getCurrentUid`, `createCloudBackup`, `listCloudBackups`, `deleteCloudBackup`, `restoreCloudBackup`.

### `core/store/encryption.ts` — at-rest encryption
- `deriveKeyFromPin(pin)` — PBKDF2 → AES-GCM `CryptoKey`.
- `isEncrypted(raw)` — detect ciphertext format.
- `encryptValue(key, value)` / `decryptValue(key, raw)`.

### `core/store/CatchUpSync.ts` — weekly recompute
- `runLazyCatchUpSync()` — recompute health + weekly insights once per 7-day window (else cached).
- `useLazyCatchUpSync()` — run it on mount.

### `core/math/HealthEngine.ts`
- `computeHealthScore(income, expenses, savings, debtPayments, budgetAdherence)` → `HealthMetrics` (savings rate 30%, budget discipline 25%, vault velocity 20%, debt-to-income 15%, stability 10%).
- `getHealthRecommendations(metrics)` → advice strings from weak sub-scores.

### `core/math/DebtSimplifier.ts`
- `calculateBalances(expenses)` → net balance per person (+owed / −owes).
- `simplifyDebts(expenses)` → minimal settlement transfers (greedy).

### `core/math/mathEvaluator.ts`
- `evaluateArithmetic(expr)` — safe Shunting-Yard arithmetic evaluator (+ − × ÷, parentheses, unary minus).

### `core/insights/safeToSpend.ts`
- `computeSafeToSpend(txs, budgets, goals, today?)` → daily safe-to-spend result.

### `core/insights/subscriptions.ts`
- `detectSubscriptions(txs, minOccurrences=2)` → recurring charges (median amount, next-charge estimate, possibly-unused flag).
- `summarizeSubscriptions(subs)` → monthly/annual totals + counts.

### `core/insights/streaks.ts`
- `computeStreaksAndBadges(txs, budgets, goals, today?)` → current/longest streak, active days, and 10 badges with progress.

### `core/insights/whatIf.ts`
- `simulateWhatIf(input)` → SIP future value, invested, returns, per-year timeline.

### `core/automation/SmsParser.ts`
- `parseSmsMessage(raw)` → parsed transaction | null (bank-specific + UPI + fallback regex).
- `parseSmsMessages(messages[])` → batch parse (skips unrecognized).

### `core/voice/VoiceParser.ts`
- `parseVoiceInput(text)` → amount/type/category/description from Hindi/Hinglish/Devanagari speech.

### `core/utils/AnomalyRadar.ts`
- `checkAnomaly(amount, category, transactions)` → warning string | null (>2.5× rolling average, needs ≥3 samples).

### `core/utils/currencyManager.ts`
- `BASE_CURRENCY` constant (INR).
- `getExchangeRate(code)` — synchronous INR→code rate (cache → fallback → 1).
- `refreshExchangeRates(force?)` — fetch + cache live rates (12h TTL, offline-safe).
- `formatAmount(amount, code, opts?)` — Indian lakh/crore for INR, `Intl.NumberFormat` otherwise.
- `getCurrencySymbol`, `getCurrencyInfo`, `getAllCurrencies`, `convertAmount`.

### `core/utils/reminderService.ts`
- `generateReminderMessage(...)` — templated reminder (credit/debit/settlement × EN/HI/MR × friendly/formal/urgent).
- `normalizePhoneNumber(phone)`, `getWhatsAppLink(phone, msg)`, `getSmsLink(phone, msg)`.
- `sendTwilioSmsSimulated(...)` — simulated SMS send.

### `core/utils/dueDates.ts`
- `computeDueDates(...)` — map of day-key → upcoming EMI + subscription obligations (~12 months).

### `core/utils/calendar.ts`
- `WEEKDAY_LABELS`, `MONTH_LABELS` constants.
- `toDateKey(d)`, `isSameDay(a, b)`, `parseDateKey(key)`, `buildMonthGrid(year, month)`.

### `core/utils/categories.ts`
- `resolveCategoryIcon(iconName)` → Lucide icon.
- `getStoredCategories()`, `getActiveCategories(type?)`.

### `core/utils/countries.ts`
- `getCountryByIso`, `getCountryByCurrency`, `digitsOnly`, `validatePhone`, `toFullNumber` (+ `COUNTRIES` dataset).

### `core/utils/languages.ts`
- `DEFAULT_LANGUAGE`, `INDIAN_LANGUAGES` dataset, `getLanguage(code)`.

### `core/utils/csvExporter.ts`
- `exportTransactionsCsv`, `exportBudgetsCsv`, `exportSavingsCsv` (RFC-4180, UTF-8 BOM).

### `core/utils/excelExporter.ts`
- `exportWorkbookXlsx(...)` — multi-sheet `.xlsx` export.

### `core/utils/pdfGenerator.ts`
- `generatePdfReport(options)` — styled A4 HTML statement → print/PDF (download fallback).

### `i18n/i18nContext.tsx`
- `I18nProvider` + `useI18n()` — `t(key, vars?)` lookups, `locale`, `setLocale` (EN/HI/MR dictionaries with English fallback).

### Components & Modals
- **Modals:** `AddTransactionModal`, `AddGoalModal`, `AddCategoryModal`, `AddLoanModal`, `LogDepositModal`, `SetBudgetModal`, `CurrencyPickerSheet`, `LanguagePickerSheet`, `FlashReminderModal`.
- **Inputs:** `PhoneNumberInput`, `GlobalFloatingCalculator`.
- **Feature components:** `SafeToSpendCard`, `SmsPasteZone`, `VoiceLoggingModal`.
- **Infrastructure:** `Providers` (app wrapper).

### Pages (routes)
- **Auth:** `/login`, `/register`, `/pin-lock`.
- **Dashboard:** `/home`, `/transactions`, `/analytics`, `/comparison`, `/budgets`, `/savings`, `/ledger`, `/ledger/[id]`, `/family-wallet`, `/family-wallet/[groupId]`, `/emi-tracker`, `/health-score`, `/cibil-simulator`, `/academy`, `/mood-insights`, `/what-if`, `/subscriptions`, `/streaks`, `/bill-splitter`, `/calendar`, `/calendar/[date]`, `/notifications`, `/export`, `/help`, `/settings`, `/settings/categories`, `/settings/about`.

---

*Generated from a full read of every source file in `src/`. Reflects the current codebase.*
