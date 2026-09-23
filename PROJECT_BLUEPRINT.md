# MoneyLens — Complete Project Blueprint

> A full, build-from-scratch specification of **every feature, page, function, type,
> data model, and convention** in this codebase. Use this document to recreate the
> same application from zero. Nothing here is aspirational — it documents what the
> code actually does today.

---

## 1. What the App Is

**MoneyLens – Personal Wealth Manager** is an offline-first personal-finance PWA.

- **Local-first:** all data lives in `localStorage` (instant, offline). No mock/seed
  data is ever fabricated — every KPI, chart, and balance is *derived* from the
  real transactions the user enters.
- **Cloud sync:** every financial write is mirrored to **Firebase Firestore** per
  signed-in user (`users/{uid}/appData/{key}`), so the same account stays in sync
  across devices. **Firebase Auth** handles login (email/password, Google, phone OTP).
- **Indian-first:** INR formatting with lakh/crore grouping, Indian bank-SMS parsing,
  Hindi/Hinglish voice logging, CIBIL simulator, khata (notebook) ledger, WhatsApp
  payment reminders.
- **Security:** optional 4-digit PIN lock (SHA-256 hashed) + WebAuthn biometric hook;
  auto-locks after 60s in background.

---

## 2. Tech Stack (exact)

From `package.json`:

| Dependency | Version | Purpose |
|---|---|---|
| `next` | 16.2.9 | App Router framework |
| `react` / `react-dom` | 19.2.4 | UI |
| `firebase` | ^10.12.0 | Auth + Firestore + Storage |
| `recharts` | ^2.12.7 | All charts |
| `framer-motion` | ^11.2.10 | CIBIL score spring animation |
| `lucide-react` | ^0.400.0 | All icons |
| `sonner` | ^2.0.7 | Toast notifications (`<Toaster richColors position="top-right" />`) |
| `nextjs-toploader` | ^3.9.17 | Top navigation progress bar (`#2299DD`) |
| `dexie` | ^4.0.8 | (installed; IndexedDB wrapper) |
| `tailwindcss` | ^4 + `@tailwindcss/postcss` | Styling |
| `tw-animate-css` | ^1.4.0 | `animate-in`, `slide-in-from-*`, `zoom-in-95` utilities |
| `typescript` | ^5 | Language |

Scripts: `dev` → `next dev`, `build` → `next build`, `start` → `next start`, `lint` → `eslint`.

**Path alias:** `@/*` → `src/*`.

> ⚠️ AGENTS.md note: this Next.js version "is not the Next.js you know" — read
> `node_modules/next/dist/docs/` before writing routing/API code. The app uses the
> App Router with route groups, async `params` (unwrapped via React `use()`).

---

## 3. Project Structure

```
src/
├── config/
│   └── firebase.ts                    # Firebase app/auth/db/storage init
├── core/                              # Framework-agnostic logic (pure where possible)
│   ├── store/
│   │   ├── dataStore.ts               # Central data layer + Firestore sync + hooks
│   │   └── CatchUpSync.ts             # Weekly lazy health/insights recompute
│   ├── math/
│   │   ├── HealthEngine.ts            # Financial health score
│   │   └── DebtSimplifier.ts          # Bill-split settlement math
│   ├── insights/
│   │   ├── safeToSpend.ts             # Daily "safe to spend" number
│   │   ├── subscriptions.ts           # Recurring-charge detection
│   │   ├── streaks.ts                 # Streaks + achievement badges
│   │   └── whatIf.ts                  # SIP future-value simulator
│   ├── automation/
│   │   └── SmsParser.ts               # Indian bank/UPI SMS → transaction
│   ├── voice/
│   │   └── VoiceParser.ts             # Hindi/Hinglish speech → transaction
│   └── utils/
│       ├── currencyManager.ts         # Multi-currency formatting
│       ├── csvExporter.ts             # CSV export (RFC 4180)
│       ├── pdfGenerator.ts            # Print-to-PDF HTML report
│       ├── countries.ts              # Country dial codes + phone validation
│       └── AnomalyRadar.ts            # Spend anomaly detection
├── components/
│   ├── providers/providers.tsx        # (pass-through wrapper)
│   ├── dashboard/SafeToSpendCard.tsx
│   ├── automation/SmsPasteZone.tsx
│   ├── voice/VoiceLoggingModal.tsx
│   ├── inputs/PhoneNumberInput.tsx
│   └── modals/
│       ├── AddTransactionModal.tsx
│       ├── AddGoalModal.tsx
│       ├── AddCategoryModal.tsx
│       ├── AddLoanModal.tsx
│       ├── LogDepositModal.tsx
│       ├── SetBudgetModal.tsx
│       └── CurrencyPickerSheet.tsx
└── app/
    ├── layout.tsx                     # Root layout (fonts, Toaster, TopLoader)
    ├── page.tsx                       # Splash + auth-aware redirect
    ├── globals.css                    # Tailwind theme tokens
    ├── (auth)/
    │   ├── login/page.tsx
    │   ├── register/page.tsx
    │   └── pin-lock/page.tsx
    └── (dashboard)/
        ├── layout.tsx                 # Sidebar + mobile nav + global modals
        ├── home/page.tsx
        ├── transactions/page.tsx
        ├── analytics/page.tsx
        ├── comparison/page.tsx
        ├── budgets/page.tsx
        ├── savings/page.tsx
        ├── ledger/page.tsx
        ├── ledger/[id]/page.tsx
        ├── family-wallet/page.tsx
        ├── family-wallet/[groupId]/page.tsx
        ├── emi-tracker/page.tsx
        ├── health-score/page.tsx
        ├── cibil-simulator/page.tsx
        ├── academy/page.tsx
        ├── mood-insights/page.tsx
        ├── what-if/page.tsx
        ├── subscriptions/page.tsx
        ├── streaks/page.tsx
        ├── bill-splitter/page.tsx
        ├── notifications/page.tsx
        ├── export/page.tsx
        ├── settings/page.tsx
        └── settings/categories/page.tsx
```

**Public assets expected:** `/manifest.json` (PWA), `/sw.js` (service worker,
registered only in production), `/assets/lessons/lessons.json` (academy lessons).

---

## 4. Configuration

### `src/config/firebase.ts`
Initializes Firebase from `NEXT_PUBLIC_FIREBASE_*` env vars:
`API_KEY, AUTH_DOMAIN, PROJECT_ID, STORAGE_BUCKET, MESSAGING_SENDER_ID, APP_ID, MEASUREMENT_ID`.

- `app` — singleton via `getApps().length === 0 ? initializeApp : getApp`.
- `auth` — `getAuth(app)`.
- `db` — on the client, `initializeFirestore` with `persistentLocalCache` +
  `persistentMultipleTabManager` (offline cache, multi-tab). On the server, `getFirestore`.
- `storage` — `getStorage(app)`.
- Exports: `{ app, auth, db, storage }`, default `app`.

### Root layout `src/app/layout.tsx`
- Fonts: `Geist` + `Geist_Mono` (CSS vars `--font-geist-sans` / `--font-geist-mono`).
- `metadata`: title "MoneyLens - Personal Wealth Manager", description, `manifest: /manifest.json`.
- Renders `<NextTopLoader>`, `<Providers>{children}</Providers>`, `<Toaster richColors position="top-right" closeButton duration={4000} />`.

### Providers `src/components/providers/providers.tsx`
Currently a pass-through: `<>{children}</>` (placeholder for future context).

---

## 5. Data Models (TypeScript interfaces)

All defined in `core/store/dataStore.ts` unless noted.

```ts
interface Transaction { id; amount:number; type:"expense"|"income"; category; description; date:string }
interface SavingsGoal { id; name; target:number; current:number; deadline:string }
type BudgetMap = Record<string, number>          // category -> monthly limit
interface LoanRecord { id; name; lender; principal; annualInterestRate; tenureMonths; monthsPaid; startDate }
interface LedgerEntry { id; amount; type:"gave"|"got"; description; date; txId?:string }
interface LedgerCustomer { id; name; phone; type:"customer"|"supplier"; balance:number; history:LedgerEntry[] }
interface FamilyGroup { id; name; code; members:number; totalBalance:number; spendingLimit?:number }
interface GroupExpense { id; groupId; amount; description; paidBy; date }
interface Totals { income; expense; balance }
interface CategorySlice { name; value; percentage }
interface DailyBalancePoint { day; Balance }
interface MonthlyTrendPoint { month; Income; Expense }
```

Other module-local types: `HealthMetrics` (HealthEngine), `ExpenseEntry/BalanceRecord/Settlement`
(DebtSimplifier), `ParsedSmsTransaction` (SmsParser), `ParsedVoiceData` (VoiceParser),
`SafeToSpendResult` (safeToSpend), `DetectedSubscription` (subscriptions),
`BadgeDefinition/StreaksResult` (streaks), `WhatIfInput/WhatIfYearPoint/WhatIfResult` (whatIf),
`CurrencyInfo` (currencyManager), `CountryInfo` (countries), `CategoryData` (AddCategoryModal).

---

## 6. Central Data Layer — `core/store/dataStore.ts`

The single source of truth. `"use client"`. localStorage = instant cache; Firestore = cloud mirror.

### Storage keys (`KEYS`)
`transactions`, `budgets`, `savings_goals`, `loans`, `ledger_customers`, `family_groups`, `family_expenses`.
Event name: `datastore:change`.

### Synced keys (mirrored to cloud)
The 7 `KEYS` above. **Not** synced: auth/session, preferences, categories.

### Low-level helpers
- `readJSON<T>(key, fallback)` — safe parse, returns fallback on SSR/error.
- `writeJSON(key, value)` — sets localStorage, calls `pushToFirestore`, emits change.
- `emitChange()` — dispatches `datastore:change` window event (same-tab live updates).
- `generateId()` — `Math.random().toString(36).substring(2,9)`.

### Firestore sync (internal)
- `pushToFirestore(key, value)` — `setDoc(doc(db,"users",uid,"appData",key),{value})`; skips when not signed in, not a synced key, or value came from a remote snapshot (`applyingRemote` set).
- `isEmptyValue(value)` — true for null/`[]`/`{}`. **Guard against data loss.**
- `applyRemote(key, value)` — writes remote value to localStorage without echoing back; emits change.
- `startSync(uid)` — subscribes (`onSnapshot`) to every synced key. If cloud doc missing → seed from local. If remote is empty but local has data → push local up (never let stale empty cloud clobber local).
- `stopSync()` — detaches all listeners.
- `onAuthStateChanged` wires start/stop on sign in/out (runs once per client, no-op on SSR).

### CRUD
- Transactions: `getTransactions`, `setTransactions`, `addTransaction(input)` (auto id+date, prepends), `updateTransaction(id, patch)`, `deleteTransaction(id)`.
- Savings: `getSavingsGoals`, `setSavingsGoals`.
- Loans: `getLoans`, `setLoans`.
- Budgets: `getBudgets`, `setBudgets`.
- Ledger: `getLedgerCustomers`, `setLedgerCustomers`.
- Family: `getFamilyGroups`, `setFamilyGroups`, `getFamilyExpenses`, `setFamilyExpenses`.
- `clearFinancialData()` — writes empty defaults to all synced keys (also wipes cloud), then removes local-only financial keys (`notifications`, `mood_logs`, legacy caches `total_income`, `total_savings`, `financial_health_score`, `weekly_insights`, `last_catchup_run`).

### Derived selectors (all pure, all from real data)
- `getTotals(txs?)` → `{income, expense, balance}` (lifetime).
- `getMonthTotals(monthOffset=0, txs?)` → month totals (0=current, -1=last).
- `getCategoryBreakdown(type="expense", monthOffset|null, txs?)` → `CategorySlice[]` sorted desc with % share.
- `getDailyBalanceTrend(days=7, txs?)` → running balance per day (labelled short weekday).
- `getMonthlyTrend(months=6, txs?)` → income vs expense per month (oldest→newest, short month label).
- `getSavingsRate(txs?)` → `(income−expense)/income` as %.
- `getTotalSaved(goals?)` → sum of goal `current`.
- `getTotalDebt()` → best-effort outstanding from loans (`outstanding ?? balance ?? principal ?? amount`).

### React hooks (live-updating; subscribe to `datastore:change` + `storage`)
`useTransactions`, `useBudgets`, `useLedgerCustomers`, `useLoans`, `useSavingsGoals`, `useFamilyGroups`, `useFamilyExpenses`.

---

## 7. Core Logic Modules

### 7.1 `math/HealthEngine.ts` — Financial Health Score (0–100)
- `computeHealthScore(monthlyIncome, monthlyExpenses, totalSavings, monthlyDebtPayments, budgetAdherencePercentage)` → `HealthMetrics`.
  - Weights: **Savings Rate 30%**, **Budget Discipline 25%**, **Vault Velocity 20%**, **Debt-to-Income 15%**, **Spending Stability 10%**.
  - Savings rate: ideal >20% → full marks. Budget discipline: 100% adherence = 100; over 100% drops `100−(over)×2`. Vault velocity: savings/income ideal 3× → 100. DTI: ideal <30%, 50% DTI = 0. Stability: proxy 80 ± 10 based on discipline.
- `getHealthRecommendations(metrics)` → `string[]` advice from weak sub-scores.
- `HealthMetrics`: `savingsRateScore, budgetDisciplineScore, vaultVelocityScore, debtToIncomeScore, spendingStabilityScore, totalScore`.

### 7.2 `math/DebtSimplifier.ts` — Bill Splitting
- `calculateBalances(expenses: ExpenseEntry[])` → `BalanceRecord[]` (net per person; +=receive, −=owe; rounded 2dp; sorted desc).
- `simplifyDebts(expenses)` → `Settlement[]` greedy: biggest debtor pays biggest creditor until settled.
- Types: `ExpenseEntry{paidBy, amount, participants[], description?}`, `BalanceRecord{person, balance}`, `Settlement{from, to, amount}`.

### 7.3 `automation/SmsParser.ts` — Bank SMS → Transaction
- `parseSmsMessage(raw)` → `ParsedSmsTransaction | null`.
- `parseSmsMessages(messages[])` → batch, skips unrecognized.
- Bank rule sets (regex with named groups `amount`/`desc`/`typeword`): **HDFC, SBI, ICICI, Axis, Kotak, UPI (GPay/PhonePe/Paytm/BHIM), generic "Bank Alert" fallback**.
- `DEBIT_SIGNALS` / `CREDIT_SIGNALS` keyword sets decide direction; `NOISE_PATTERNS` clean the merchant string.
- Internal: `cleanDescription`, `parseAmount` (strips commas), `detectTypeFromKeywords`.
- `ParsedSmsTransaction`: `{type, amount, description, source, date(ISO), rawMessage}`. Fully client-side, no network.

### 7.4 `voice/VoiceParser.ts` — Speech → Transaction
- `parseVoiceInput(text)` → `ParsedVoiceData{amount|null, type|null, category|null, description}`.
- `NUMBER_MAP` (Hinglish + Devanagari digits + multipliers sau/hazaar/lakh/crore), `CATEGORY_MAP` (e.g. khana→Groceries, petrol→Travel), `INCOME_WORDS`/`EXPENSE_WORDS`.
- Extracts amount (digits or spoken words, with multiplier look-ahead), category (map or direct English), type (keyword); defaults expense + category Housing/Salary.

### 7.5 `insights/safeToSpend.ts`
- `computeSafeToSpend(txs, budgets, goals, today?)` → `SafeToSpendResult`.
  - Pool = month income (or total budget fallback). `remainingForMonth = pool − monthExpense − savingsReserve`. `perDay = floor(remaining/daysLeft)`.
  - `monthlySavingsReserve` = sum of per-goal `remaining / monthsLeft`.
- Result: `{perDay, remainingForMonth, daysLeft, monthIncome, monthSpent, reservedForSavings, insufficientData}`.

### 7.6 `insights/subscriptions.ts`
- `detectSubscriptions(txs, minOccurrences=2)` → `DetectedSubscription[]`. Groups expenses by normalized merchant; requires charges across ≥2 distinct months; median monthly amount; estimates next charge (+1 month); `possiblyUnused` if no charge in ~45 days. Sorted by annual cost desc.
- `summarizeSubscriptions(subs)` → `{monthlyTotal, annualTotal, count, unusedCount}`.

### 7.7 `insights/streaks.ts`
- `computeStreaksAndBadges(txs, budgets={}, goals=[], today?)` → `StreaksResult{currentStreak, longestStreak, activeDays, badges[], earnedCount}`.
- 10 badges (id/title/desc/icon/earned/progress): **First Step** (1 tx), **Getting Consistent** (3-day), **On Fire** (7-day), **Unstoppable** (30-day), **Smart Saver** (20% rate), **Super Saver** (40%), **Budget Boss** (1 budget), **Goal Crusher** (1 completed goal), **Well Rounded** (5 categories), **Centurion** (100 tx).
- Current streak only counts if it reaches today/yesterday.

### 7.8 `insights/whatIf.ts`
- `simulateWhatIf(input: WhatIfInput)` → `WhatIfResult`. Monthly compounding annuity-due (deposit at start of month). Returns `{futureValue, totalInvested, totalReturns, timeline: WhatIfYearPoint[]}`.

### 7.9 `utils/AnomalyRadar.ts`
- `checkAnomaly(amount, category, transactions)` → string warning | null. Needs ≥3 prior same-category expenses; flags if amount > **2.5×** category rolling average.

### 7.10 `utils/currencyManager.ts`
- `PRESET_CURRENCIES`: **INR, USD, EUR, AUD** (code/symbol/name/locale/decimalDigits). *(Note: only 4 — the currency picker lists exactly these.)*
- `formatAmount(amount, code="INR", {includeSymbol, decimalPlaces, useIndianLayoutForINR})` — Indian lakh/crore grouping for INR (with manual fallback), `Intl.NumberFormat` otherwise; returns "—" for NaN/Infinity.
- `getCurrencySymbol(code)`, `getCurrencyInfo(code)`, `getAllCurrencies()`, `convertAmount(amount, fromRate, toRate)`.

### 7.11 `utils/csvExporter.ts`
- `exportTransactionsCsv(txs, currencyCode="INR", filename?)`, `exportBudgetsCsv`, `exportSavingsCsv`. RFC-4180 escaping, UTF-8 BOM for Excel, client-side `Blob` download. Default filenames `moneylens-<type>-<YYYY-MM-DD>.csv`.
- Internal: `escapeCsvCell`, `buildCsvContent`, `triggerDownload`, `dateTag`.
- Types: `ExportableTransaction`, `ExportableBudget`, `ExportableSavingsGoal`.

### 7.12 `utils/pdfGenerator.ts`
- `generatePdfReport(options: PdfReportOptions)` — builds a styled A4 HTML statement (brand header, income/expense/net metric boxes, transaction/budget/savings tables with progress bars), opens a print window + `.print()`; falls back to downloading `.html` if popup blocked.
- Types: `PdfTransaction`, `PdfBudget`, `PdfSavingsGoal`, `PdfReportOptions`.

### 7.13 `utils/countries.ts`
- `COUNTRIES: CountryInfo[]` — **26 countries** (name, iso2, dialCode, minLength, maxLength national digits, currency, flag emoji). Default = India.
- `getCountryByIso(iso2)`, `getCountryByCurrency(currency)`, `digitsOnly(value)`, `validatePhone(iso2, nationalNumber)` (→ error string|null), `toFullNumber(iso2, nationalNumber)` (→ `+<dial><digits>`).

### 7.14 `store/CatchUpSync.ts` — Weekly lazy recompute
- `runLazyCatchUpSync()` → `CatchUpResult{executed, healthScore, weeklyInsights[], lastRun}`. Runs once per 7-day window (`last_catchup_run`); else returns cached `financial_health_score` / `weekly_insights`.
- `useLazyCatchUpSync()` — hook that runs it on mount (called from dashboard layout).
- Internal: `calculateFinancialHealthScore` (40 + savingsRate×0.6, clamped), `generateWeeklyInsights`.

---

## 8. Routing, Layouts & Auth Flow

### Splash & redirect — `app/page.tsx`
`"use client"`. Registers `/sw.js` (production only). After 1.5s: no `user_session` → `/login`; has session + `pin_hash` → `/pin-lock`; else → `/home`. Renders branded splash with animated logo + spinner.

### Dashboard layout — `app/(dashboard)/layout.tsx`
- **NAV_ITEMS** (desktop sidebar, 19 links): Workspace `/home`, Transactions, Budgets, Savings Goals, Notebooks `/ledger`, Bill Splitter, Family Wallet, Mood Insights, Health Score, CIBIL Sim, Academy, Analytics, Compare Months, Subscriptions, What-If Sim, Streaks, EMI Tracker, Export, Settings (each with a lucide icon).
- **Mobile bottom nav (5):** Workspace, Transactions, Notebooks, Analytics, Settings + central FAB (Add Transaction) and Voice mic button.
- One-time legacy seed purge (`legacy_seed_cleared_v1` flag → `clearFinancialData()`).
- Runs `useLazyCatchUpSync()`.
- **Auto-lock:** Page Visibility API — if hidden >60s and `pin_hash` set, redirect to `/pin-lock`.
- Currency stored in `active_currency`; selecting a new currency reloads the route.
- Hosts global `AddTransactionModal`, `VoiceLoggingModal`, `CurrencyPickerSheet`.
- `handleLogout` removes `user_session` → `/login`.

### Auth — `app/(auth)/`
**login** (`login/page.tsx`): three methods —
- Email/password (`signInWithEmailAndPassword`).
- Google (`GoogleAuthProvider` + `signInWithPopup`).
- Phone OTP (`RecaptchaVerifier` invisible + `signInWithPhoneNumber` → `ConfirmationResult.confirm`). E.164 validation `^\+[1-9]\d{6,14}$`.
- On success writes `user_session` JSON `{email, name}`, then routes to `/pin-lock` if `pin_hash` exists else `/home`.

**register** (`register/page.tsx`): `createUserWithEmailAndPassword` → `updateProfile(displayName)` → Firestore `setDoc(users/{uid}, {uid,name,email,createdAt:serverTimestamp()})`. Avatar via local blob URL with simulated upload progress (stored `user_avatar_blob`). Stores `user_session{email,name,avatarUrl}` → routes to `/pin-lock`.

**pin-lock** (`pin-lock/page.tsx`): 4-digit keypad. `sha256()` via Web Crypto. Setup mode (enter→confirm, stores `pin_hash`) vs verify mode (compares hash → `/home`). WebAuthn capability check (`isUserVerifyingPlatformAuthenticatorAvailable`); biometric button mocks an assertion then grants if `pin_hash` exists. "Switch Account" clears session.

### Auth/session localStorage keys
`user_session` (JSON), `pin_hash` (SHA-256 hex), `user_avatar_blob`, `biometrics_enabled`, `active_currency`, `legacy_seed_cleared_v1`.

---

## 9. Dashboard Pages (each described to rebuild)

> Common pattern: `"use client"`, read `active_currency` from localStorage, use the
> live store hooks, `formatAmount` for money, lucide icons, Tailwind theme tokens,
> empty states when no data, `isMounted` guard to avoid Recharts hydration mismatch.

### `/home` (Workspace)
Greeting by hour + user name. Notifications bell dropdown (reads `notifications`, clear-all). `SmsPasteZone`. Primary balance card (`getTotals().balance`, month inflow/outflow). `SafeToSpendCard`. 4-stat grid: Remaining Budget %, Goal Progress %, Health Index (40+rate×0.6), Ledger Entries count. Charts: 7-day balance line + monthly category bar, with Both/Income/Spent toggle. `EmptyChart` placeholder.

### `/transactions`
Live list via `useTransactions`. Search (description/category), type tabs (all/income/expense). Grouped Today/Yesterday/Previous Weeks. Inline edit (amount+description → `updateTransaction`) and inline delete-confirm (`deleteTransaction`). Add via `AddTransactionModal`.

### `/analytics`
KPI cards (Total Income, Total Expense, Net Savings, Savings Rate) with MoM % change badges. Charts: income-vs-expense `AreaChart` (6 months, gradients), capital-allocation `PieChart` + side legend, comparative grouped `BarChart` (this vs last month top-6), top-5 category rankers with animated bars. `CHART_COLORS` palette of 6. Custom tooltips. `pctChange` helper.

### `/comparison` (Month vs Month)
Headline totals (last/this month + change `TrendBadge`). Per-category deltas (`getCategoryBreakdown` current vs −1), grouped bar chart (top 8), per-category rows. For expenses: decrease=green, increase=red.

### `/budgets`
Month switcher (prev/next). `CATEGORIES_META` = Housing, Groceries, Entertainment, Investment (icons). Per-category progress bar: spent (from real expenses that month) vs limit (`getBudgets`). Color: ≥100% error, ≥80% warning, else primary. `SetBudgetModal` to adjust.

### `/savings`
Goal cards with SVG radial % ring, target/deadline, required monthly deposit (`remaining / monthsLeft`), completed state. `AddGoalModal` (create), `LogDepositModal` (deposit). Empty state when none.

### `/ledger` (Notebook / Khata)
`useLedgerCustomers`. Summary: Total Receivable / Payable / Net Position. Filter tabs (all/credit/debit/settled) + search. Add Account dialog (customer owes-me / supplier I-owe) with `PhoneNumberInput` validation; opening balance mirrors into a `Ledger`-category transaction. WhatsApp reminder link per customer (`wa.me`). Customer avatar, last-activity label, links to detail.

### `/ledger/[id]`
Async `params` via `use()`. Re-derives customer on `datastore:change`. Balance card (credit/debit/settled), Total Given/Received strip. "You Gave"/"You Got" quick entry (mirrors into transactions via `addTransaction`, category `Ledger`), WhatsApp reminder. Running-balance history with per-entry delete (also deletes linked `txId`).

### `/family-wallet`
`useFamilyGroups`. Join via 6-digit code (simulated) or create group (random 6-digit code). Group cards (name, code, members, pool balance) link to detail. Create-group card.

### `/family-wallet/[groupId]`
Group pool balance vs optional `spendingLimit` (over-limit alert). Add expense claim (`GroupExpense`, paidBy "You", increments `totalBalance`). Set limit overlay. Collaborative expense history.

### `/emi-tracker`
`useLoans`. `calcEmi` (reducing-balance: `P·r(1+r)^n/((1+r)^n−1)`), `calcAmortization` (EMI, totalPayable, totalInterest, outstanding, progress %, completion date). Summary cards (active loans, monthly outflow, outstanding, total interest). Per-loan `LoanCard` with status badge, metrics, progress bar, expandable breakdown, delete-confirm. `AddLoanModal`.

### `/health-score`
Aggregates real ledger (`getTotals`, `getTotalSaved`, `getTotalDebt`, budget adherence) → `computeHealthScore`. SVG semicircle arc gauge (color by band: ≥80 green, ≥50 orange, else red). `BreakdownRow` per metric (score/100 + weight). "AI Prescriptions" = `getHealthRecommendations`.

### `/cibil-simulator`
Sliders: Payment History (35%), Utilization (30%, lower better), Credit Age (15%), Credit Mix (10%), Recent Inquiries (10%, lower better). Score 300–900 via weighted points; `framer-motion` spring counter. Band label (Excellent/Good/Fair/Poor). Reusable `SliderControl` with invert-color logic. Educational only.

### `/academy`
Fetches `/assets/lessons/lessons.json` (`Lesson{id,title,theme,content,quiz[],reward}`, `QuizQuestion{question,options[],answerIndex}`). Lesson view → quiz (one Q at a time) → results; 100% unlocks `reward` badge. Progress in `academy_badges` / `academy_completed`. Directory grid with completed checkmarks.

### `/mood-insights`
Log today's mood (Good/Okay/Stressed) → `mood_logs` (keyed `YYYY-MM-DD`). 7-day bar chart of spend/income colored by that day's mood. Expense/Income toggle. Variance alert ("you spend X% more on Stressed days"). `MOOD_COLORS` map.

### `/what-if`
Sliders: Monthly Contribution, Initial Lump Sum, Time Horizon (years), Expected Annual Return %. `simulateWhatIf` → projected value, invested, returns, growth %. `AreaChart` of Value vs Invested per year. `SliderControl` with `format` fn.

### `/subscriptions`
`detectSubscriptions(useTransactions())` + `summarizeSubscriptions`. KPI cards (Detected, Monthly Cost, Annual Cost, Possibly Unused). List rows: name (capitalized), "possibly unused" badge, category · occurrences · next est. date, monthly/annual cost. `SummaryCard` sub-component.

### `/streaks`
`computeStreaksAndBadges(transactions, budgets, goals)`. Three stat cards (Current/Longest/Active Days). Achievements grid (earned vs locked with progress bar). `ICON_MAP` resolves badge icon names. `StreakStat` sub-component.

### `/bill-splitter`
Local-only (state, not persisted). Add shared expense (equal split or assign-to-one). Auto-recompute `simplifyDebts` + `calculateBalances`. People + mobile numbers, "you are" selector. Optimized settlements list with WhatsApp request links. "Your summary" (who owes you / you owe). Net balances (to take back / to give / settled). Live split preview.

### `/notifications`
Reads `notifications` (migrates string[] → `NotificationItem{id,text,type,read,date}`). Severity icons/colors (success/alert/error). Mark all read, delete per item. Empty state.

### `/export`
Date range (presets: Today / Last 7 / Last 30 / This Month / All Time + custom inputs). Data type multi-select (transactions/budgets/savings) with live record counts; transaction type filter (all/income/expense). Format: CSV (one file per type, staggered downloads) or PDF (`generatePdfReport`). Reads raw localStorage directly. Computes per-category spent for budgets. Loading/done button states. All client-side.

### `/settings`
Loads profile from `user_session`. Currency picker (`CurrencyPickerSheet`), link to Category Manager. Biometric toggle (`biometrics_enabled`). Reset PIN / Sign Out Everywhere buttons. **Danger Zone:** multi-stage Clear-All-Data modal (confirm → final confirm → wipe, or optional email-verification stage with demo 6-digit code shown on screen). `purgeData` calls `clearFinancialData()` + `localStorage.clear()`, keeps `active_currency`, redirects `/login`. `maskEmail` helper.

### `/settings/categories`
`DEFAULT_CATEGORIES` (6, seeded to `custom_categories`). Active vs archived lists (`archived_categories`). `iconMap` resolves icon names. Archive/restore toggle. `AddCategoryModal` to create. *(Note: categories are stored separately and not yet wired into transaction entry, which uses fixed category lists.)*

---

## 10. Components & Modals

| Component | Props | Behavior |
|---|---|---|
| `AddTransactionModal` | `{isOpen, onClose, onSuccess?}` | Expense/Income toggle, fixed category grids (expense: Housing/Groceries/Entertainment/Investment; income: Salary/Investment/Gift/Other), amount, description → `addTransaction`. On expense ≥80% of a set budget, writes a `notifications` alert + inline warning. Success splash. |
| `AddGoalModal` | `{isOpen, onClose, onSuccess?}` | Name, target, deadline (min tomorrow) → new `SavingsGoal` (current 0) via `setSavingsGoals`. |
| `AddCategoryModal` | `{isOpen, onClose, onSuccess?(CategoryData)}` | Type toggle, name, 8 preset colors, 12 preset icons → `CategoryData`. Exports `CategoryData` type. |
| `AddLoanModal` | `{isOpen, onClose, onSave(LoanRecord), currencyCode?}` | Name, lender presets (HDFC/SBI/ICICI/Axis/Kotak/LIC Housing/Bajaj/Other+custom), principal, rate, tenure, monthsPaid, startDate. Live amortization preview (`calcEmi`). Exports `LoanRecord`. |
| `LogDepositModal` | `{isOpen, onClose, onSuccess?, goalId, goalName}` | Amount → increments goal `current` + logs an `Investment` expense transaction. |
| `SetBudgetModal` | `{isOpen, onClose, onSuccess?}` | Category chips (Housing/Groceries/Entertainment/Investment), monthly limit → `setBudgets` (routes through store so it syncs). |
| `CurrencyPickerSheet` | `{isOpen, onClose, onSelect?, activeCurrencyCode?}` | Searchable list of `PRESET_CURRENCIES`; writes `active_currency`. |
| `SafeToSpendCard` | — | Hero card; `computeSafeToSpend`; shows per-day number + "left this month" / "reserved to save"; "Set a budget" when insufficient data. |
| `SmsPasteZone` | `{currencyCode?, onTransactionSaved?}` | Collapsible paste area; `parseSmsMessage` on paste/Enter; `ConfirmSheet` to edit type/description + raw preview → `addTransaction` (category Salary/Other). |
| `VoiceLoggingModal` | `{isOpen, onClose, onSuccess?}` | Web Speech API (`SpeechRecognition`); language select (9 Indian languages, default hi-IN); `parseVoiceInput`; `checkAnomaly`; confirm → `addTransaction`. |
| `PhoneNumberInput` | `{country, onCountryChange, value, onChange, error?, id?}` | Country selector (flag+dial+currency) + national number field enforcing per-country digit limits via `countries.ts`. |

---

## 11. localStorage Key Reference (complete)

**Synced (cloud-mirrored):** `transactions`, `budgets`, `savings_goals`, `loans`, `ledger_customers`, `family_groups`, `family_expenses`.

**Local-only:** `user_session`, `pin_hash`, `user_avatar_blob`, `biometrics_enabled`, `active_currency`, `legacy_seed_cleared_v1`, `notifications`, `mood_logs`, `custom_categories`, `archived_categories`, `academy_badges`, `academy_completed`, `last_catchup_run`, `financial_health_score`, `weekly_insights` (+ legacy `total_income`, `total_savings`).

---

## 12. Design System & Conventions

- **Tailwind v4** with semantic theme tokens used throughout (`globals.css` defines them):
  `bg-card`, `bg-background`, `bg-background-subtle`, `bg-secondary`, `border-border`/`border-border-strong`,
  `text-foreground`/`-secondary`/`-muted`, `text-primary`/`bg-primary-lighter`, `text-brand`/`bg-brand-light`,
  `text-success`/`bg-success-light`, `text-error`/`bg-error-light`, `text-warning`/`bg-warning-light`,
  `text-icon-default`/`-muted`/`-active`, `text-destructive`/`bg-destructive`, `chart-1..6`.
- **Reusable utility classes:** `btn-primary`, `btn-secondary`, `input-base`.
- **Modal pattern:** fixed overlay `bg-black/60`, bottom-sheet on mobile / centered card on desktop, `animate-in slide-in-from-bottom md:zoom-in-95`, success splash with `CheckCircle2`, 1.2–1.5s auto-close.
- **Charts:** Recharts with `ResponsiveContainer`, gridded, custom tooltips, gradient area fills, `isMounted` guard.
- **Money:** always `formatAmount(value, activeCurrency)`; many places pass `{ decimalPlaces: 0 }`.
- **Empty states:** `Inbox` icon + helper text whenever there's no real data.
- **Icons:** `lucide-react` exclusively.

---

## 13. Rebuild Checklist (order of operations)

1. Scaffold Next.js (App Router) + TS + Tailwind v4; add deps from §2; set `@/*` alias.
2. `globals.css` theme tokens + `btn-primary`/`btn-secondary`/`input-base`; root layout (fonts, Toaster, TopLoader, Providers).
3. Firebase config + env vars (Auth + Firestore persistent cache).
4. `dataStore.ts` (types, KEYS, read/write, Firestore sync with empty-value guard, CRUD, selectors, hooks).
5. Core logic modules (§7) — all pure/testable: HealthEngine, DebtSimplifier, SmsParser, VoiceParser, safeToSpend, subscriptions, streaks, whatIf, AnomalyRadar, currencyManager, csvExporter, pdfGenerator, countries, CatchUpSync.
6. Auth flow: splash redirect, login (3 methods), register (+Firestore profile), pin-lock (SHA-256 + WebAuthn).
7. Dashboard layout (nav, auto-lock, global modals, legacy purge, catch-up sync).
8. Components & modals (§10).
9. Feature pages (§9) — wire each to the store hooks + core modules.
10. Public assets: `manifest.json`, `sw.js`, `assets/lessons/lessons.json`.

---

*Generated from a full read of every source file in `src/`. Reflects the current codebase exactly.*
</content>
