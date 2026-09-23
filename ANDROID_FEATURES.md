# DhanBook (Android) — Complete Features & Functions Reference

> A build-from-scratch reference for recreating **DhanBook – Personal Wealth Manager**
> as a **native Android app in Android Studio**. Every feature, function, and module from
> the existing Next.js/React web app is mapped here to its Android (Kotlin + Jetpack)
> equivalent so the same product can be built with the same behavior.
>
> Source of truth for behavior: `PROJECT_BLUEPRINT.md`, `FEATURES.md` and `CALENDAR.md` (web).
> This file is the **Android translation layer**.

---

## 0. How to Read This Doc

Each section gives:
- **What it does** (identical to the web app's behavior).
- **Android building block** — the Jetpack/AndroidX/library API to use.
- **Functions** — the concrete Kotlin function signatures to implement (1:1 with the web logic).

The financial/business logic (health score, EMI math, SMS/voice parsing, safe-to-spend,
subscriptions, streaks, what-if, bill-split, **Budgeting Rule, bucket resolution, due-date
projection, expression evaluation**) is **pure Kotlin** and ports directly — no Android APIs
needed there. Only I/O, UI, auth, sync, and device features change.

### Recently added — read these before estimating scope
Areas the earlier revision of this doc didn't cover:

| Area | Where |
|---|---|
| **Budgeting Rule (50/30/20)** — user-adjustable split, income, bucket rollups | §5.17, §8.1 |
| **Category buckets** — per-category Needs/Wants/Investments + layered resolution | §5.16 |
| **Encryption at rest** — PBKDF2 + AES-GCM, unlock/lock lifecycle, auto-unlock | §4 |
| **Write durability** — pending-write tracking, flush-before-logout, offline retry | §4 |
| **Cloud backup & restore** — snapshots, `defaultForKey` guard | §4 |
| **Calendar** — month grid, heatmap, day detail, EMI/subscription due projection | §5.18, §8 |
| **SMS gateway (Fast2SMS)** — per-user key, Quick route, honest not-sending state | §5.21 |
| **Live FX rates** (12 h TTL, offline fallback) | §5.11 |
| **Floating calculator**, **Excel export**, **i18n** (en/hi/mr) | §5.19, §5.22, §5.23 |
| **Profile editing** — photo crop/downscale, name sync, re-auth for wipes | §6.6, §6.7 |
| **Transaction discounts**, income source groups, "Other" category expander | §3, §9 |
| **Shared Family-Wallet collection + Firestore security rules** | §4.1 |
| **Dark theme** — full token mirror, no-flash boot, follow-OS-until-chosen, header toggle | §11.1, §9 |
| **Cloud-backed profile** — `users/{uid}` name + avatar, survives sign-out, subscribed store | §4.2, §6.6 |
| **Avatar & name sanitization** — URL scheme allowlist, size cap, control/bidi stripping | §5.24 |
| **Offline cache must stay off-disk** — Firestore in-memory cache, worker never caches cloud data | §4.3 |

Four things were **removed** on the web and must not be ported: the simulated Twilio SMS
channel (§5.20), the hardcoded support phone number (§8, Help), the register screen's
fake avatar upload — now genuinely implemented (§6.3) — and the ledger's
`customer`/`supplier` **type** field (§3, §8).

### Latest revision — correctness rules that change stored numbers
These came out of a correctness pass on the web app. Each one is a case where the obvious
implementation is *wrong in a way that silently corrupts data or reports a figure the user
never earned*, so port the rule, not just the function:

| Area | Rule | Where |
|---|---|---|
| **Loan math** (`LoanMath.kt`, new shared module) | Settle-today balance ≠ sum of remaining instalments. `getTotalDebt` derives from the schedule. | §5.3, §4, §8 |
| **Base-currency storage** | Every persisted amount is INR; `toBaseAmount` on input, `fromBaseAmount` to pre-fill, `convert=false` for as-typed derivations. Affects 7 sheets/screens. | §5.11, §9 |
| **Auto-lock actually locks** | Flush → `lockDataStore()` → navigate. Routing alone leaves the key and plaintext cache in memory. | §6.4 |
| **No cloud writes while locked** | A sensitive-key write before unlock is truncated; flushing it later wipes the account. | §4 |
| **Legacy-cache cleanup** | Remove four local prefs directly — never via `clearFinancialData()`, which mirrors empties to the cloud on every new device. | §7.1 |
| **Family Wallet join rule** | `new == old.concat([caller])`, not "caller ∈ new" — which let anyone evict a whole group. Pool total via `increment`. | §4.1 |
| **Bucket exclusions** | `Ledger` mirrors are receivables, not spending — filter before `resolveBucketForCategory`, in rollups *and* itemized lists. | §5.16, §5.17, §8 |
| **Month-end recurrence** | `addMonthsClamped`, and re-derive the anchor each month so one short month can't shift the whole series. | §5.18, §5.7 |
| **Health score edges** | Zero income + debt payments scores **0** on DTI, not 100; vault velocity clamps at both ends. | §5.1 |
| **Anomaly baseline** | Median over a 180-day window, not an all-time mean (one big spend silenced every later alert). | §5.10 |
| **SMS direction** | Whole-word match, earliest signal wins, scrub "credit/debit card"; drop `neft`/`payment`. | §5.4 |
| **Unary minus** | Fold into the operand (`-3`, or `-1 *` for a group) — the `0 -` trick breaks `2*-3` and `8/-2`. | §5.19 |
| **Catch-up sync** | Skip while locked, re-run on store change, recompute instead of defaulting to a flattering score. | §5.15 |
| **No refresh-on-save** | Sheets don't trigger a reload; it can abandon an unacknowledged write. | §7.1, §9 |

---

## 1. Tech Stack (Android equivalent)

| Web (current) | Android (target) | Purpose |
|---|---|---|
| Next.js App Router | **Jetpack Compose + Navigation-Compose** | UI + screen routing |
| React 19 | **Kotlin + Compose** | Declarative UI |
| localStorage | **Room** (structured) + **Jetpack DataStore** (prefs) | Offline-first local store |
| Firebase JS SDK | **Firebase Android SDK (BoM)** | Auth + Firestore + Storage |
| Recharts | **MPAndroidChart** or **Vico** (Compose-native) | Charts |
| framer-motion | **Compose `animate*AsState` / `Animatable`** | CIBIL spring counter |
| lucide-react | **Material Symbols / Compose `Icon`** | Iconography |
| sonner (toasts) | **Compose `Snackbar` / `SnackbarHost`** | Toast/snackbar |
| nextjs-toploader | **`LinearProgressIndicator`** on nav | Loading bar |
| dexie / IndexedDB | **Room** | Local DB |
| Web Speech API | **`android.speech.SpeechRecognizer`** | Hindi/Hinglish voice logging |
| WebAuthn / SHA-256 PIN | **`androidx.biometric.BiometricPrompt`** + PIN hash | App lock |
| Service Worker (PWA) | **`WorkManager`** (background) | Weekly catch-up sync |
| CSV Blob download | **`MediaStore` / Storage Access Framework** | CSV export |
| Print-to-PDF | **`android.graphics.pdf.PdfDocument`** or **`PdfRenderer`/print framework** | PDF report |
| exceljs (`.xlsx`) | **Apache POI (`poi-ooxml`)** or **fastexcel** | Styled Excel workbook export |
| Web Crypto PBKDF2 + AES-GCM | **`javax.crypto` (PBKDF2WithHmacSHA256 + AES/GCM)** or **Jetpack Security (`EncryptedSharedPreferences`)** | Encrypt financial data at rest |
| `sessionStorage` PIN cache | **in-memory `Application`/`ViewModel` scope** (never on disk) | Auto-unlock across a screen rotation / process warm start |
| JSON dictionaries + `I18nProvider` | **`res/values-hi/strings.xml`, `values-mr/`** + `AppCompatDelegate.setApplicationLocales` | English / Hindi / Marathi UI |
| `fetch` open.er-api.com | **Retrofit / OkHttp** + DataStore cache | Live FX rates (12 h TTL) |
| framer-motion draggable FAB | **Compose `Modifier.draggable` / `detectDragGestures`** | Floating calculator bubble |
| Tailwind theme tokens | **Material 3 `ColorScheme` + theme.kt** | Design tokens |
| `.dark` class + `ThemeProvider` | **`darkColorScheme()` + a `themeMode` `Flow` from DataStore** | Light / dark / follow-system |
| `matchMedia("prefers-color-scheme")` | **`isSystemInDarkTheme()`** | Follow the OS until the user chooses |
| `useSyncExternalStore` on `user_session` | **`Flow<SessionProfile>` from DataStore** | Live profile — no screen holds a stale copy |
| Firestore `memoryLocalCache()` | **`FirebaseFirestoreSettings.setLocalCacheSettings(MemoryCacheSettings)`** | Keep plaintext cloud data off disk (§4.3) |

**Suggested Gradle dependencies (Kotlin DSL):**
```kotlin
// Compose
implementation(platform("androidx.compose:compose-bom:<latest>"))
implementation("androidx.compose.material3:material3")
implementation("androidx.navigation:navigation-compose:<latest>")
implementation("androidx.lifecycle:lifecycle-viewmodel-compose:<latest>")

// Local storage
implementation("androidx.room:room-runtime:<latest>")
implementation("androidx.room:room-ktx:<latest>")
ksp("androidx.room:room-compiler:<latest>")
implementation("androidx.datastore:datastore-preferences:<latest>")

// Firebase
implementation(platform("com.google.firebase:firebase-bom:<latest>"))
implementation("com.google.firebase:firebase-auth-ktx")
implementation("com.google.firebase:firebase-firestore-ktx")
implementation("com.google.firebase:firebase-storage-ktx")
implementation("com.google.android.gms:play-services-auth:<latest>") // Google sign-in

// Charts, biometric, background, coroutines
implementation("com.github.PhilJay:MPAndroidChart:v3.1.0")
implementation("androidx.biometric:biometric:<latest>")
implementation("androidx.work:work-runtime-ktx:<latest>")
implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:<latest>")

// Encryption at rest, Excel export, networking (FX rates / SMS gateway)
implementation("androidx.security:security-crypto:<latest>")
implementation("org.apache.poi:poi-ooxml:<latest>")      // .xlsx workbook export
implementation("com.squareup.retrofit2:retrofit:<latest>")
implementation("com.squareup.retrofit2:converter-kotlinx-serialization:<latest>")
```

---

## 2. Architecture (recommended)

**MVVM + Repository + single-source-of-truth store**, mirroring the web `dataStore.ts`.

```
app/
├─ data/
│  ├─ local/            # Room DB, DAOs, DataStore prefs
│  │   ├─ entities/     # TransactionEntity, GoalEntity, LoanEntity, ...
│  │   ├─ dao/          # TransactionDao, LedgerDao, ...
│  │   └─ AppDatabase.kt
│  ├─ remote/           # FirestoreSync.kt (mirror per-user docs)
│  └─ repository/       # DataRepository.kt        (== dataStore.ts)
│                       # UserProfileRepository.kt (== userProfile.ts — NOT encrypted, §4.2)
├─ domain/              # PURE Kotlin logic (ports of core/)
│  ├─ math/             # HealthEngine.kt, DebtSimplifier.kt, LoanMath.kt,
│  │                    # MathEvaluator.kt
│  ├─ insights/         # SafeToSpend.kt, Subscriptions.kt, Streaks.kt, WhatIf.kt,
│  │                    # MoneyRule.kt
│  ├─ automation/       # SmsParser.kt
│  ├─ voice/            # VoiceParser.kt
│  ├─ crypto/           # Encryption.kt  (PBKDF2 + AES-GCM at rest)
│  └─ util/             # CurrencyManager.kt, CsvExporter.kt, PdfGenerator.kt,
│                       # ExcelExporter.kt, Countries.kt, AnomalyRadar.kt,
│                       # BucketConfig.kt, Categories.kt, CalendarUtil.kt,
│                       # DueDates.kt, ReminderService.kt, Languages.kt,
│                       # AvatarUtils.kt
├─ ui/
│  ├─ theme/            # Color.kt, Theme.kt, Type.kt  (== globals.css tokens)
│  │                    # ThemeController.kt — light/dark/system mode (§11.1)
│  ├─ auth/             # LoginScreen, RegisterScreen, PinLockScreen
│  ├─ dashboard/        # HomeScreen + all feature screens
│  ├─ components/       # reusable composables & "modals" (bottom sheets)
│  └─ navigation/       # NavGraph.kt  (== NAV_ITEMS)
└─ MainActivity.kt
```

**Concurrency:** Kotlin Coroutines + `Flow`. Repository exposes `Flow<List<Transaction>>`
from Room — this replaces the web's `datastore:change` event + React hooks. Compose
collects with `collectAsStateWithLifecycle()`.

---

## 3. Data Models (Kotlin data classes / Room entities)

Port of `dataStore.ts` interfaces. Annotate as Room `@Entity` where persisted.

```kotlin
@Entity data class Transaction(
    @PrimaryKey val id: String,
    val amount: Double,        // effective amount (POST-discount for expenses)
    val type: String,          // "expense" | "income"
    val category: String,
    val description: String,
    val date: String,          // ISO string, keep parity with web
    val originalAmount: Double? = null,  // pre-discount price, when a discount was applied
    val discountAmount: Double? = null   // already subtracted from `amount`
)

@Entity data class SavingsGoal(
    @PrimaryKey val id: String, val name: String,
    val target: Double, val current: Double, val deadline: String,
    // Which 50/30/20 bucket this goal's DEPOSITS count toward — a phone fund is
    // a "want", an emergency fund an "investment". Nullable for goals created
    // before the tag existed; those fall back to "investments" (old behaviour).
    val bucket: BucketType? = null
)

// BudgetMap: category -> monthly limit
@Entity data class Budget(@PrimaryKey val category: String, val limit: Double)

@Entity data class LoanRecord(
    @PrimaryKey val id: String, val name: String, val lender: String,
    val principal: Double, val annualInterestRate: Double,
    val tenureMonths: Int, val monthsPaid: Int, val startDate: String
)

@Entity data class LedgerCustomer(
    @PrimaryKey val id: String, val name: String, val phone: String,
    /** positive: they owe us (credit) · negative: we owe them (debit) */
    val balance: Double,
    val description: String? = null
    // history stored in a related table or JSON column
)
// NOTE: there is no `type` ("customer" | "supplier") field. It was removed — the
// SIGN OF THE BALANCE already says which way the book runs, and the label went
// stale the moment a customer's balance went negative. The add-account sheet now
// asks for the DIRECTION of the opening balance ("You will get" / "You will give")
// and folds it into the sign. Drop the column; migrate old rows by keeping the
// balance as-is.
data class LedgerEntry(
    val id: String, val amount: Double, val type: String, // "gave" | "got"
    val description: String, val date: String, val txId: String? = null
)

@Entity data class FamilyGroup(
    @PrimaryKey val id: String, val name: String,
    val code: String,           // 6-digit join code — ALSO the shared Firestore doc id
    val members: Int,           // headcount; == memberNames.size once populated
    /** Display names from the shared directory doc. Nullable for older local rows. */
    val memberNames: List<String>? = null,
    val totalBalance: Double, val spendingLimit: Double? = null
)
// NOTE: the shared cloud doc additionally carries `memberUids: List<String>` —
// real Firebase UIDs, which is what the security rules authorize against (§4.1).
@Entity data class GroupExpense(
    @PrimaryKey val id: String, val groupId: String, val amount: Double,
    val description: String, val paidBy: String, val date: String
)

// A subscription the user added by hand (vs. auto-detected from transactions).
@Entity data class ManualSubscription(
    @PrimaryKey val id: String, val name: String,
    val monthlyAmount: Double, val category: String, val createdAt: String
)

// ── User-managed categories ──
enum class BucketType { NEEDS, WANTS, INVESTMENTS }

@Entity data class CategoryData(
    @PrimaryKey val id: String, val name: String,
    val type: String,          // "expense" | "income"
    val color: String, val iconName: String,
    /** Expense-only. Null on categories created before buckets were selectable. */
    val bucket: BucketType? = null
)

// ── Budgeting Rule (50/30/20, user-adjustable) ──
data class MoneyRuleSplit(val needs: Int = 50, val wants: Int = 30, val investments: Int = 20)

// ── Per-user SMS gateway credentials (Fast2SMS Quick route) ──
data class SmsGatewayConfig(val enabled: Boolean = false, val apiKey: String = "")

// ── Cloud backup snapshot metadata ──
data class BackupRecord(
    val id: String, val createdAt: String, val label: String,
    val itemCount: Int
)

// Derived (not persisted)
data class Totals(val income: Double, val expense: Double, val balance: Double)
data class CategorySlice(val name: String, val value: Double, val percentage: Double)
data class DailyBalancePoint(val day: String, val balance: Double)
data class MonthlyTrendPoint(val month: String, val income: Double, val expense: Double)
data class DueItem(val kind: String, val label: String, val amount: Double) // "emi" | "subscription"
```

**Transaction extras.** The Add-Transaction sheet supports a **discount** on expenses: the
user types the pre-discount price plus either a percentage or a flat amount; the discount is
clamped to `0…gross` and the **post-discount** value is what hits the ledger. The original
price and the discount are kept on the row so the saving stays visible — carry
`originalAmount` / `discountAmount` as nullable columns.

---

## 4. Core Data Layer — `DataRepository.kt` (== `dataStore.ts`)

The single source of truth. **Room = instant offline cache; Firestore = cloud mirror**
at `users/{uid}/appData/{key}`.

### Storage keys / synced collections
Synced (cloud-mirrored), one Firestore doc each:
`transactions`, `budgets`, `savings_goals`, `loans`, `ledger_customers`,
`family_groups`, `family_expenses`, `manual_subscriptions`, **`monthly_income`**,
**`money_rule_split`**, **`sms_gateway`**, **`custom_categories`**, **`archived_categories`**.

> Categories are synced deliberately: they carry the user's 50/30/20 bucket choices, which
> the Budgeting Rule computes from. Left local-only they silently reset on a restore or a new
> device and the split reports different numbers with no error shown.

Local-only (DataStore prefs, never synced): auth/session cache, PIN hash, biometric flag,
active currency, active language, **theme mode**, notifications, mood logs, academy progress,
FX-rate cache. The **profile** (name + avatar) is cloud-backed but lives outside this store
entirely — see §4.2.

### 4.1 The one shared collection — Family Wallet (`familyGroups/{code}`)
Everything else in the app is a **per-user mirror** at `users/{uid}/appData/{key}`. Family
Wallet is the exception and the only multi-user surface: it reads and writes a **genuinely
shared, real-time** top-level collection keyed by the 6-digit join code.

```
familyGroups/{code}                    ← group doc: name, memberNames[], memberUids[],
  └─ expenses/{expenseId}                 members, spendingLimit, createdAt
```

| Operation | Android |
|---|---|
| Generate a code | random 6 digits, then `get()` the doc to confirm it's free before claiming it |
| Create | `set(...)` with **the creator's own uid already in `memberUids`** (the rules require it) |
| Join by code | `get()` the doc, then `update(memberNames to FieldValue.arrayUnion(name), memberUids to FieldValue.arrayUnion(uid), members to …)` — `arrayUnion` keeps the roster authoritative and idempotent |
| Live group + expenses | two `addSnapshotListener`s: one on the group doc, one on the `expenses` subcollection |
| Add expense claim | `add()` into `expenses`, then roll the group total forward with **`FieldValue.increment(amountInBase)`** — never `poolBalance + amount` read from the current render. A read-then-write starts from a figure captured before the other member's claim landed, so two people filing at the same time both write the same total and the second silently erases the first. `increment` is applied server-side against whatever the value actually is. |
| **Leave vs delete** | not the same action. A member leaving is `update(memberNames/members)`. The **last** member leaving deletes every `expenses` doc **and then** the group doc — the group ceases to exist for everyone. Say which one is happening in the confirm dialog, because the web does. |

**Security rules — port these verbatim; they are the whole access model.**
```
match /users/{userId}/{document=**}   // everything else: owner-only
  allow read, write: if request.auth != null && request.auth.uid == userId;

match /familyGroups/{code} {
  allow get:    if request.auth != null;   // join needs a lookup by known code
  allow list:   if false;                  // ← nobody can ENUMERATE other families
  allow create: if request.auth.uid in request.resource.data.memberUids;
  allow update: if request.auth.uid in resource.data.memberUids            // member edits/leaves
             // Joining: the new roster must be EXACTLY the old one plus the caller.
             || request.resource.data.memberUids
                == resource.data.memberUids.concat([request.auth.uid]);
  allow delete: if request.auth.uid in resource.data.memberUids;
  match /expenses/{expenseId} {           // the bulk of the sensitive shared data
    allow read, write: if request.auth.uid in
      get(/databases/$(database)/documents/familyGroups/$(code)).data.memberUids;
  }
}
```
`allow get` with `allow list: false` is deliberate and load-bearing: a known code can be
looked up (otherwise joining is impossible) but the collection can never be walked. Authorize
on **`memberUids`** (real Firebase UIDs), never on `memberNames` — display names are neither
unique nor trustworthy. A native client hits exactly the same rules, so nothing here is
web-specific.

**The join branch must compare the whole list, not test membership.** "Is my uid in the
*new* list" is the obvious rule and it is wrong: it lets any signed-in user who knows a code
rewrite `memberUids` to `[themselves]`, which both admits a stranger and evicts every real
member in one write. Requiring `new == old.concat([caller])` allows exactly one append —
the caller's own — and rejects every removal or substitution. `arrayUnion` on the client
produces precisely this shape when the caller isn't already a member.

### 4.2 User profile — `UserProfileRepository.kt` (== `core/store/userProfile.ts`)
The display name and avatar are the one piece of user data that deliberately **does not go
through the encrypted store**, for two reasons: the profile has to be resolved *before* the
lock screen in order to greet the user, and it must survive sign-out, which wipes every local
key on purpose (§4, `clearLocalCache`). It therefore lives in the user's own Firestore
document — the same `users/{uid}` doc registration creates, covered by the owner-only rule in
§4.1 — with the local copy as a **cache only**.

```kotlin
data class UserProfile(val name: String, val avatarUrl: String?)   // null = explicitly removed
data class SessionProfile(val name: String, val avatarUrl: String?, val email: String?)

suspend fun saveUserProfile(profile: UserProfile): Boolean   // merge write; false = not synced
suspend fun fetchUserProfile(): UserProfile?                 // null when signed out / offline
suspend fun resolveSessionProfile(user: FirebaseUser, fallbackName: String): SessionProfile
fun sessionProfile(): Flow<SessionProfile>                   // live; every screen collects this
suspend fun writeSessionProfile(session: SessionProfile)
```

- **`merge = true`** on the write, so it never clobbers the `uid` / `email` / `createdAt`
  fields registration put on the same document. Store `profileUpdatedAt` alongside.
- **Take the uid from `auth.currentUser`, never from a caller, a nav arg or storage.** The
  security rules would reject a mis-aimed read anyway; this is the second lock.
- **Precedence in `resolveSessionProfile`:** saved profile → identity provider
  (`displayName` / `photoUrl`) → `fallbackName` (e.g. the email local-part) → `"Guest"`.
  It **always resolves** — a failed profile read must never block login.
- **The avatar is three-state, and the distinction is load-bearing:** *absent* means never
  set, so fall back to the provider photo; **`null` means the user removed it** and must stay
  null, or Google's photo silently reappears at the next sign-in; a string is the saved photo.
  Persist the null explicitly — don't omit the field.
- **Report sync failure honestly.** `saveUserProfile` returns false when the cloud write
  fails; the UI then says *"saved on this device — could not sync to your account"* rather
  than a plain success toast, because the edit will not survive a sign-out until it lands.
  A failed cloud write never discards the local edit.
- Re-validate on the way **in** as well as out (§5.24): the document is user-writable, so it
  is untrusted input even though this app wrote it.

**Subscribe, don't snapshot** — the same rule as §4. The web replaced its read-once-at-mount
pattern with `useSyncExternalStore` because an edit on Settings stayed invisible on Home until
a full reload. On Android this is free: expose a `Flow<SessionProfile>` from DataStore and
collect it with `collectAsStateWithLifecycle()` in every screen that shows the name or photo
(Home header, Settings profile card). Hold no separate copy in local state. Sign-out must
emit on that flow too, so the name and photo clear immediately.

### 4.3 Offline cache must stay off disk
The web pins Firestore to an **in-memory cache** (`memoryLocalCache()`) and the service worker
refuses to store any cross-origin response. Both are the same deliberate decision: the app's
own offline cache is encrypted at rest (§4), and a second, *plaintext* copy of the same
financial data sitting in browser storage would defeat that entirely.

**This is the one place the Android defaults work against you.** Firestore's Android SDK
enables persistent disk caching by default, which is exactly the plaintext second copy the web
build removed:

```kotlin
firestore.firestoreSettings = firestoreSettings {
    setLocalCacheSettings(memoryCacheSettings {})   // no plaintext mirror on disk
}
```
Room stays the offline store — encrypt it (SQLCipher, or encrypt sensitive column values with
the §4 key) so the on-device copy matches the web's guarantee. If you deliberately choose to
keep Firestore's disk cache for offline resilience, that is a **conscious weakening** of the
threat model and belongs in the app's privacy copy — not an implementation detail.

### Encryption at rest — `Encryption.kt` (== `core/store/encryption.ts`)
Every **sensitive** key is stored on-device as ciphertext, never plaintext.

```kotlin
suspend fun deriveKeyFromPin(pin: String): SecretKey   // PBKDF2-HMAC-SHA256, 200_000 iters
fun isEncrypted(raw: String): Boolean                  // "enc:v1:" prefix test
fun encryptValue(key: SecretKey, value: Any?): String  // "enc:v1:" + base64(iv|ciphertext)
fun decryptValue(key: SecretKey, raw: String): Any?    // throws on wrong key / corrupt data
```
- **Salt:** 16 random bytes, generated once per device and kept in prefs under `enc_salt`.
  Not secret — it only stops the key being a plain hash of the PIN.
- **Cipher:** AES-GCM 256, 12-byte random IV prepended to the ciphertext.
- The key lives **in memory only** after unlock. On Android prefer `javax.crypto` for the
  PBKDF2/AES work and keep the `SecretKey` in a singleton/`Application` scope; the Android
  Keystore can additionally wrap it.
- **Deliberate limitation (state it honestly):** the Firestore copy stays **plaintext**,
  protected by Auth + security rules. That is the safety net — a forgotten PIN never loses
  data, it re-syncs from the cloud and re-encrypts under the new PIN.

### Lock / unlock lifecycle
| Web function | Android function |
|---|---|
| `unlockDataStore(pin)` | `suspend fun unlockDataStore(pin: String)` — derive key, decrypt (and migrate any legacy plaintext) into the in-memory cache, cache the PIN for the session, emit change, then **restart sync** (capture the uid *before* `stopSync()`, which clears it). |
| `lockDataStore()` | `fun lockDataStore()` — drop the key + cache, forget the session PIN, clear pending-write bookkeeping, `stopSync()`. |
| `isUnlocked()` | `fun isUnlocked(): Boolean` — true while the key is held. |
| `tryAutoUnlock()` | `suspend fun tryAutoUnlock(): Boolean` — re-derive from the session-cached PIN so a process restart doesn't show an empty screen. On Android the cache is an in-memory/`ViewModel`-scoped value (the web uses `sessionStorage`); a cold start still asks for the PIN. |

**Signed in ≠ unlocked.** The dashboard guard must check both: if `!isUnlocked()`, call
`tryAutoUnlock()` and route to PinLock when it fails, rather than rendering the dashboard
over undecryptable data.

### Write durability — never claim "saved" falsely
```kotlin
fun hasUnsyncedWrites(): Boolean          // in-flight or failed writes exist
suspend fun flushPendingWrites(): Boolean // resend failures, await all; true = all in cloud
```
- Track every cloud write: `inFlight` (awaiting server ack) and `failedKeys` (offline / not
  signed in / rejected → latest value to resend).
- A write made while signed out goes straight into `failedKeys` so it is retried at sign-in
  rather than silently discarded.
- Retry automatically when connectivity returns — on Android, a
  `ConnectivityManager.NetworkCallback` (`onAvailable`) in place of the web `online` event.
- **Before logout / switch-account:** `flushPendingWrites()`; if it returns false, warn with a
  confirm dialog before wiping the local cache — otherwise a transaction that never synced is
  lost for good.
- Log sync failures rather than swallowing them (the web version logs every failed key).
- **Never queue a cloud write for a sensitive key while the store is locked.** Locked reads
  serve the empty fallback, so any read-modify-write before unlock produces a truncated
  value — and flushing that on sign-in would push the emptiness over the cloud copy, wiping
  the account from a fresh device. Drop the write with a warning instead. Every legitimate
  write path (Settings purge, backup restore, the entry sheets) runs after unlock, so
  nothing real is lost.

### Cloud backup & restore (Firestore `users/{uid}/backups/{id}`)
```kotlin
suspend fun createCloudBackup(label: String? = null): String
suspend fun listCloudBackups(): List<BackupRecord>     // newest first
suspend fun deleteCloudBackup(backupId: String)
suspend fun restoreCloudBackup(backupId: String)
fun defaultForKey(key: String): Any                    // {} for budgets, 0 for income, …
```
Snapshots read the **decrypted** in-memory cache (disk holds ciphertext) and are stored
plaintext like `appData`. `defaultForKey` is what keeps a backup taken before a key existed
from restoring that key as `[]` and clobbering an object-shaped config — every non-array
synced key **must** have a case there.

### Storage & sync functions
| Web function | Android function |
|---|---|
| `readJSON` / `writeJSON` | Room DAO queries + `DataStore.edit {}` |
| `emitChange` | Room `Flow` emissions (automatic) |
| `generateId` | `fun generateId(): String = UUID.randomUUID().toString().take(9)` |
| `pushToFirestore(key,value)` | `suspend fun pushToFirestore(key: String, value: Any)` — `firestore.document("users/$uid/appData/$key").set(mapOf("value" to value))`; skip when signed-out / not a synced key / value came from remote snapshot (`applyingRemote` guard). |
| `isEmptyValue(value)` | `fun isEmptyValue(v: Any?): Boolean` — true for null / empty list / empty map. **Prevents stale-cloud data loss.** |
| `applyRemote(key,value)` | `suspend fun applyRemote(...)` — write remote value into Room **without** re-pushing. |
| `startSync(uid)` | `fun startSync(uid: String)` — attach a Firestore `addSnapshotListener` per synced key. If cloud doc missing → seed from local; if remote empty but local has data → push local up. |
| `stopSync()` | remove all registered `ListenerRegistration`s. |
| `onAuthStateChanged` wiring | `FirebaseAuth.addAuthStateListener { startSync / stopSync }` |
| `clearFinancialData()` | `suspend fun clearFinancialData()` — wipe all synced tables (local + cloud) then clear local-only financial prefs. Its `SYNCED_KEYS` guard deliberately **keeps** categories and gateway credentials: a data reset is not an account reset. |
| `clearLocalCache()` | `suspend fun clearLocalCache()` — sign-out purge. Drops **everything local** (including categories and credentials) so leftover financial data can't be read by the next person on a shared device; the cloud copy survives and re-syncs at next sign-in. Distinct from `clearFinancialData` — do not collapse the two. |
| `getCurrentUid()` | `fun currentUid(): String?` |

### CRUD (Room DAOs + repository methods)
- **Transactions:** `getTransactions()`, `setTransactions()`, `addTransaction(input)` (auto id + date, insert at top), `updateTransaction(id, patch)`, `deleteTransaction(id)`.
- **Savings:** `getSavingsGoals()`, `setSavingsGoals()`.
- **Loans:** `getLoans()`, `setLoans()`.
- **Budgets:** `getBudgets()`, `setBudgets()`.
- **Ledger:** `getLedgerCustomers()`, `setLedgerCustomers()`.
- **Family:** `getFamilyGroups()`, `setFamilyGroups()`, `getFamilyExpenses()`, `setFamilyExpenses()`, `computeGroupPoolBalance(expenses)`.
- **Manual subscriptions:** `getManualSubscriptions()`, `setManualSubscriptions()`, `addManualSubscription(input)`, `deleteManualSubscription(id)`.
- **Budgeting Rule:** `getMonthlyIncome()` / `setMonthlyIncome(v)`, `getMoneyRuleSplit()` / `setMoneyRuleSplit(split)`.
- **Categories:** `getCustomCategories()` / `setCustomCategories(list)`, `getArchivedCategoryIds()` / `setArchivedCategoryIds(ids)`. Raw accessors — UI reads through `Categories.kt` (§5.16).
- **SMS gateway:** `getSmsGateway()` / `setSmsGateway(config)`. Read each field explicitly instead of spreading, so a partial cloud doc can't leave a field undefined and stale keys from an older shape are dropped.

### Derived selectors (pure Kotlin, computed from real rows)
```kotlin
fun getTotals(txs: List<Transaction>): Totals
fun getMonthTotals(monthOffset: Int = 0, txs: List<Transaction>): Totals
fun getCategoryBreakdown(type: String = "expense", monthOffset: Int?, txs: List<Transaction>): List<CategorySlice>
fun getDailyBalanceTrend(days: Int = 7, txs: List<Transaction>): List<DailyBalancePoint>
fun getMonthlyTrend(months: Int = 6, txs: List<Transaction>): List<MonthlyTrendPoint>
fun getSavingsRate(txs: List<Transaction>): Double
fun getTotalSaved(goals: List<SavingsGoal>): Double
fun getTotalDebt(loans: List<LoanRecord>): Double
```

**`getTotalDebt` must go through the amortization schedule** (`calcOutstandingPrincipal`,
§5.3) — one call per loan, summed. Do not reach for an `outstanding` / `balance` / `amount`
field: `LoanRecord` has none, so a lookup like that silently falls through to `principal`,
and the reported debt never moves however many EMIs have been paid. The health score reads
this number, so the error propagates. Derived properly it falls as `monthsPaid` rises and
reaches 0 when the loan closes.

### "Hooks" → Flows
Web hooks `useTransactions`, `useBudgets`, `useLedgerCustomers`, `useLoans`,
`useSavingsGoals`, `useFamilyGroups`, `useFamilyExpenses`, `useManualSubscriptions`,
`useMonthlyIncome`, `useMoneyRuleSplit`, `useSmsGateway` become **`Flow<…>`**
exposed by DAOs and surfaced through ViewModels as `StateFlow`. Compose collects them;
they auto-update on any write (replacing the manual change-event system).

**Subscribe, never snapshot.** Any screen holding an editable copy of synced state must
*observe* it: on a fresh device there is no local ciphertext to decrypt at unlock, so the
value reads empty until the Firestore snapshot lands. A screen that read once on mount would
hold that empty value and write it back over the real data. Two rules follow:
- `useSmsGateway` returns **null while locked** so callers can tell "not loaded yet" from
  "loaded and genuinely empty" — render nothing rather than an empty form whose Save wipes
  the stored key.
- Where the user is editing a draft (SMS gateway), keep a `dirty` flag: track the store until
  the first edit, then let the draft win so a late sync can't overwrite typing.

---

## 5. Core Logic Modules (pure Kotlin — port directly)

### 5.1 `HealthEngine.kt` — Financial Health Score (0–100)
```kotlin
fun computeHealthScore(
    monthlyIncome: Double, monthlyExpenses: Double, totalSavings: Double,
    monthlyDebtPayments: Double, budgetAdherencePercentage: Double
): HealthMetrics
fun getHealthRecommendations(metrics: HealthMetrics): List<String>
```
Weights: **Savings Rate 30%, Budget Discipline 25%, Vault Velocity 20%,
Debt-to-Income 15%, Spending Stability 10%.** `HealthMetrics` holds the five sub-scores
+ `totalScore`. (Logic identical to web.)

Two edge cases decide real scores — get them right:
- **Vault Velocity is clamped at both ends**, `0…100`. Only the ceiling is obvious; without
  the floor a negative savings total yields a negative sub-score, and a single component
  then subtracts more from the weighted total than its own weight.
- **Debt-to-Income with zero income is 0, not 100** (when there are debt payments; with no
  debt it is genuinely 100). DTI is `debt / income`, so income 0 makes it undefined — and
  computing it as "0% DTI" awards full marks, scoring someone with EMIs and no income a
  perfect 100 on debt health. Debt no income can service is the worst case, not the best.

### 5.2 `DebtSimplifier.kt` — Bill Splitting
```kotlin
fun calculateBalances(expenses: List<ExpenseEntry>): List<BalanceRecord>   // net per person
fun simplifyDebts(expenses: List<ExpenseEntry>): List<Settlement>          // greedy min-transfers
```
Types: `ExpenseEntry(paidBy, amount, participants, description?)`,
`BalanceRecord(person, balance)`, `Settlement(from, to, amount)`.

### 5.3 `LoanMath.kt` — reducing-balance loan math (== `core/math/loan.ts`)
**The single source of truth for every EMI and debt figure in the app.** Three screens need
it — the EMI Tracker, the Add-Loan sheet's live preview, and the calendar's due-date
projection (§5.18) — plus `getTotalDebt` in the repository (§4). Put it in one file and call
it from all four; on the web the formula was copy-pasted into three places and the debt
figure was wrong in every one.

```kotlin
data class LoanTerms(                      // what the helpers need; LoanRecord satisfies it
    val principal: Double, val annualInterestRate: Double,
    val tenureMonths: Int, val monthsPaid: Int
)

fun calcEmi(principal: Double, annualRate: Double, tenureMonths: Int): Double
// reducing-balance: P·r(1+r)^n / ((1+r)^n − 1); straight-line P/n at 0% interest
fun calcOutstandingPrincipal(loan: LoanTerms): Double   // settle-today balance
fun calcTotalInterest(loan: LoanTerms): Double          // over the full original schedule
fun calcRemainingPayments(loan: LoanTerms): Double      // Σ instalments still due
fun calcAmortization(loan: LoanRecord): Amortization
// -> emi, totalPayable, totalInterest, remaining, amountPaid,
//    outstandingBalance, remainingPayments, progressPct, completionDate
```

**Outstanding balance ≠ remaining payments — never conflate them.** This is the one thing to
get right in this module:

| Figure | Formula | Means |
|---|---|---|
| `calcOutstandingPrincipal` | `EMI × (1 − (1+r)^−k) / r`, `k` = instalments left | What would **settle the loan today** — the present value of the remaining instalments. Label it "Outstanding" / "Settle-today balance". |
| `calcRemainingPayments` | `EMI × k` | The **sum of future instalments**, i.e. principal *plus every future interest charge*. Label it "left to pay", never "outstanding". |

`EMI × k` is strictly larger; the gap is the interest avoided by settling early. On a 20-year
home loan that gap is roughly the entire interest cost, so showing it as "remaining
principal" overstates the debt enormously — and `getTotalDebt` feeds the health score, so the
error spreads. Zero-interest and fully-repaid loans short-circuit: at 0% the balance is the
unpaid share of principal (`principal × k / n`), and `monthsPaid >= tenureMonths` returns 0.

The EMI Tracker shows **both** numbers (settle-today in the summary card, "left to pay" on the
progress bar) precisely so they can't be mistaken for one another again.

### 5.4 `SmsParser.kt` — Bank SMS → Transaction
```kotlin
fun parseSmsMessage(raw: String): ParsedSmsTransaction?
fun parseSmsMessages(messages: List<String>): List<ParsedSmsTransaction>
```
Regex rule sets for **HDFC, SBI, ICICI, Axis, Kotak, UPI (GPay/PhonePe/Paytm/BHIM),
generic "Bank Alert" fallback**. `DEBIT_SIGNALS`/`CREDIT_SIGNALS` decide direction;
`NOISE_PATTERNS` clean the merchant string. Internal: `cleanDescription`, `parseAmount`,
`detectTypeFromKeywords`. **Fully offline.**

**Direction detection — three rules, all load-bearing.** Used whenever the matched bank
pattern didn't capture an explicit type word, which is most generic messages. A wrong
direction files a spend as income, so this is worth porting exactly:
1. **Whole-word matching** (`\bword\b`), not substring — otherwise "credit" fires inside
   unrelated text.
2. **Earliest signal wins** when both a debit and a credit word appear. Bank SMS state the
   direction up front ("Rs 3200 debited from …") and mention references, rails and offers
   afterwards. Track the first match index of each set and compare.
3. **Blank out `\b(credit|debit)\s+card\b` before scanning.** It names the instrument, not
   the direction — a credit-card spend is an *expense*. Card SMS are among the most common
   kind, so this alone fixes a large slice of misfiles.

**Keep these words out of the signal sets:** `neft`, `imps`, `rtgs`, `upi` are transfer
rails used in both directions (`neft` in the credit set booked every NEFT-referenced debit
as income), and `payment` reads either way ("payment sent" / "payment received"). The
explicit verbs already cover the cases these were meant to catch.
- **Android bonus:** with the `RECEIVE_SMS`/`READ_SMS` permission (or **SMS Retriever API**,
  no permission), a `BroadcastReceiver` can auto-feed incoming bank SMS into `parseSmsMessage`
  instead of manual paste. Guard behind explicit user opt-in for Play Store policy.

### 5.5 `VoiceParser.kt` — Speech → Transaction
```kotlin
fun parseVoiceInput(text: String): ParsedVoiceData   // amount?, type?, category?, description
```
`NUMBER_MAP` (Hinglish + Devanagari digits + sau/hazaar/lakh/crore), `CATEGORY_MAP`
(khana→Groceries, petrol→Travel…), `INCOME_WORDS`/`EXPENSE_WORDS`. Defaults expense + Housing/Salary.
- **Android capture:** `SpeechRecognizer.createSpeechRecognizer()` with
  `RecognizerIntent.EXTRA_LANGUAGE = "hi-IN"` (offer 9 Indian languages). Feed the recognized
  string into `parseVoiceInput`. Needs `RECORD_AUDIO` permission.

### 5.6 `SafeToSpend.kt`
```kotlin
fun computeSafeToSpend(
    txs: List<Transaction>, budgets: Map<String,Double>,
    goals: List<SavingsGoal>, today: LocalDate = LocalDate.now()
): SafeToSpendResult
```
Pool = month income (or total budget). `remainingForMonth = pool − monthExpense − savingsReserve`;
`perDay = floor(remaining / daysLeft)`. `monthlySavingsReserve` = Σ per-goal `remaining/monthsLeft`.

### 5.7 `Subscriptions.kt`
```kotlin
fun detectSubscriptions(txs: List<Transaction>, minOccurrences: Int = 2): List<DetectedSubscription>
fun summarizeSubscriptions(subs: List<DetectedSubscription>): SubscriptionSummary
```
Group expenses by normalized merchant; require charges across ≥2 distinct months; median
monthly amount; next charge = **`addMonthsClamped(last, 1)`** (§5.18 — a charge on the 31st
must estimate end-of-February, not overflow into March); `possiblyUnused` if no charge in
~45 days.

### 5.8 `WhatIf.kt`
```kotlin
fun simulateWhatIf(input: WhatIfInput): WhatIfResult
// monthly-compounding annuity-due -> futureValue, totalInvested, totalReturns, timeline
```

### 5.9 `Streaks.kt`
```kotlin
fun computeStreaksAndBadges(
    txs: List<Transaction>, budgets: Map<String,Double> = emptyMap(),
    goals: List<SavingsGoal> = emptyList(), today: LocalDate = LocalDate.now()
): StreaksResult   // currentStreak, longestStreak, activeDays, badges, earnedCount
```
10 badges: First Step, Getting Consistent (3d), On Fire (7d), Unstoppable (30d),
Smart Saver (20%), Super Saver (40%), Budget Boss, Goal Crusher, Well Rounded (5 cats),
Centurion (100 tx). Current streak counts only if it reaches today/yesterday.

### 5.10 `AnomalyRadar.kt`
```kotlin
fun checkAnomaly(
    amount: Double, category: String,
    transactions: List<Transaction>,        // typed — not a raw/untyped list
    now: Instant = Instant.now()            // injectable, for tests
): String?
// baseline = MEDIAN of same-category expenses in the last 180 days;
// needs >= 3 such samples; flags if amount > 2.5 × that median
```
- **Median, not mean.** A single large past spend permanently lifts an average and then
  suppresses every later alert — the failure direction that matters, since this is a warning
  that goes quiet exactly when it shouldn't. A median barely moves for one outlier, which is
  the point: the function exists to detect outliers, so its baseline must be robust to them.
- **180-day window** (`BASELINE_WINDOW_DAYS`): "usual" means recent habit, not something from
  two years ago. Filter by date before computing.
- Guard the inputs: non-finite or non-positive `amount` → null, unparseable dates skipped,
  fewer than `MIN_SAMPLES` (3) surviving samples → null, median ≤ 0 → null.
- **The transaction list must not already contain the spend being checked**, or it inflates
  its own baseline. Call this *before* `addTransaction`.

### 5.11 `CurrencyManager.kt`
```kotlin
val PRESET_CURRENCIES: List<CurrencyInfo>   // INR, USD, EUR, AUD (exactly 4)
const val BASE_CURRENCY = "INR"
fun formatAmount(amount: Double, code: String = "INR", includeSymbol: Boolean = true,
                 decimalPlaces: Int? = null, useIndianLayoutForINR: Boolean = true,
                 convert: Boolean = true): String
fun getCurrencySymbol(code: String): String
fun getCurrencyInfo(code: String): CurrencyInfo
fun getAllCurrencies(): List<CurrencyInfo>
fun convertAmount(amount: Double, fromRate: Double, toRate: Double): Double

// Base-currency conversion — the input/output pair around every amount field
fun toBaseAmount(amount: Double, code: String = BASE_CURRENCY): Double    // typed → stored
fun fromBaseAmount(amount: Double, code: String = BASE_CURRENCY): Double  // stored → field

// Live FX (base = INR)
fun getExchangeRate(code: String): Double                  // synchronous; cache → static fallback → 1
suspend fun refreshExchangeRates(force: Boolean = false)   // no-op if cache < 12 h old
```
INR uses lakh/crore grouping (Android: `NumberFormat.getInstance(Locale("en","IN"))` or the
manual grouping fallback). Returns `"—"` for NaN/Infinity.

#### Everything is stored in the base currency — convert at both edges
**Invariant: every persisted amount is INR.** The active currency is a *display* setting.
`formatAmount` already converts base → display on the way out, so the input side needs the
exact inverse or values corrode:

> a user with USD active types `100` into a field labelled `$`, 100 is stored as ₹100, and it
> reads back as `$1.20` — and shrinks again every time the display currency changes.

So **every amount the user types goes through `toBaseAmount(typed, activeCurrency)` before
it is stored**, and **every amount pre-filled into an editable field goes through
`fromBaseAmount`** (a bare number in the active currency — same conversion as `formatAmount`,
without the symbol and grouping). Screens/sheets that must do this: Add Transaction (amount,
plus `originalAmount` and `discountAmount`), Add Goal (target), Log Deposit, Set Budget (in
*and* out, and the field label + symbol follow the active currency — not a hardcoded `₹`),
Add Loan (principal), Ledger entries (gave/got, which also drive the mirrored transaction),
and the Family Wallet spending limit (out on open, in on save — otherwise the limit is
compared against a pool balance in a different unit).

**`convert = false` is for figures derived from a value as typed.** The Add-Loan preview
computes EMI/total-payable/interest from the principal the user just entered, which is
already in the display currency; formatting it normally would convert a second time. Use the
flag there, and only there — stored amounts always take the default.

**Rates:** `refreshExchangeRates` fetches `https://open.er-api.com/v6/latest/INR` and caches
`{base, rates, ts}` in DataStore with a **12-hour TTL**; call it once per app start. Every
failure path (offline, non-200, malformed body) is a silent no-op — the cache, then a static
fallback table (`INR 1, USD .012, EUR .011, AUD .018`), then `1.0` keep `getExchangeRate`
total and `formatAmount` pure.

### 5.12 `CsvExporter.kt`
```kotlin
fun exportTransactionsCsv(context: Context, txs: List<Transaction>, currencyCode: String = "INR", filename: String? = null)
fun exportBudgetsCsv(...)
fun exportSavingsCsv(...)
```
RFC-4180 escaping + UTF-8 BOM (Excel). Write via **MediaStore (`Downloads`)** or SAF
`ACTION_CREATE_DOCUMENT`. Default names `dhanbook-<type>-<yyyy-MM-dd>.csv`.

### 5.13 `PdfGenerator.kt`
```kotlin
fun generatePdfReport(context: Context, options: PdfReportOptions)
```
Build a styled A4 statement (brand header, income/expense/net boxes, transaction/budget/
savings tables with progress bars) using **`android.graphics.pdf.PdfDocument`** (draw to a
`Canvas`) or the **Android print framework**; save via MediaStore. Replaces the web
print-window approach.

### 5.14 `Countries.kt`
```kotlin
val COUNTRIES: List<CountryInfo>   // 26 countries: name, iso2, dialCode, min/max digits, currency, flag
fun getCountryByIso(iso2: String): CountryInfo?
fun getCountryByCurrency(currency: String): CountryInfo?
fun digitsOnly(value: String): String
fun validatePhone(iso2: String, nationalNumber: String): String?   // error or null
fun toFullNumber(iso2: String, nationalNumber: String): String     // "+<dial><digits>"
```

### 5.15 `CatchUpSync.kt` — weekly lazy recompute → `WorkManager`
```kotlin
fun runLazyCatchUpSync(): CatchUpResult   // executed, healthScore, weeklyInsights, lastRun
```
Runs once per 7-day window (tracked in DataStore `last_catchup_run`); else returns cached
health score / insights. On Android, schedule with a **`PeriodicWorkRequest`** (WorkManager)
that calls this, instead of running on layout mount. Internal: `calculateFinancialHealthScore`
(40 + savingsRate×0.6, clamped), `generateWeeklyInsights`.

Three rules keep it from caching fiction for a week:
- **Bail out when the store is locked** (`if (!isUnlocked()) return notExecuted`). Locked
  reads return empty fallbacks, so the score computes as the no-income floor and then gets
  cached — hiding the real number long after the user signs in. The worker/observer re-runs
  on unlock.
- **Re-run on every store change, not once at mount.** At mount the store is normally still
  locked (no PIN yet), so the first run is a deliberate no-op; unlocking is what makes the
  data readable. On Android this falls out of collecting the repository `Flow` — the web
  needs an explicit `datastore:change` listener because it has no equivalent.
- **Fall back to a fresh computation, never to invented numbers.** A missing or corrupt
  cache recomputes the score and the insight list. Do not seed a default like `75` plus two
  congratulatory sentences — that reports a health score the user never earned. Parse the
  cached insights defensively too: this runs during dashboard mount, so an exception here
  takes down the whole screen instead of degrading to a recomputed list.

### 5.16 `BucketConfig.kt` + `Categories.kt` — the 50/30/20 category system
The foundation the Budgeting Rule computes on, and the single source of truth for every
category picker in the app.

```kotlin
// BucketConfig.kt
val BUCKET_PERCENTAGES: Map<BucketType, Double>       // needs .50, wants .30, investments .20
val CATEGORY_BUCKET_MAP: Map<String, BucketType>      // built-in name → bucket (fallback layer)
val SAVINGS_DEPOSIT_CATEGORY: Map<BucketType, String> // needs→"Savings (Needs)", wants→"Savings (Wants)",
                                                      // investments→"Investment" (unchanged, for old goals)
val BUCKET_LABELS: Map<BucketType, String>            // "Needs" | "Wants" | "Investments"

// Categories.kt
val DEFAULT_CATEGORIES: List<CategoryData>            // 10-item seed set (6 expense + 4 income)
val BUCKET_EXCLUDED_CATEGORIES: List<String>          // ["Ledger"] — outside 50/30/20 entirely
fun isBucketExcludedCategory(name: String): Boolean   // trimmed name test
val EXTRA_CATEGORY_GROUPS: List<ExtraCategoryGroup>   // expense "Other", grouped by bucket (35 entries)
val INCOME_EXTRA_CATEGORY_GROUPS: List<IncomeCategoryGroup> // income "Other": Earned / Investment / Passive & Other
fun isExtraCategory(name: String): Boolean
fun isIncomeExtraCategory(name: String): Boolean
fun getIncomeGroupForCategory(name: String): IncomeGroup?   // income mirror of resolveBucketForCategory
fun getStoredCategories(): List<CategoryData>         // stored, else DEFAULT_CATEGORIES
fun getActiveCategories(type: String? = null): List<CategoryData>  // minus archived ids
fun resolveCategoryIcon(iconName: String): ImageVector          // Layers as fallback
fun resolveBucketForCategory(name: String): BucketType
```

**`resolveBucketForCategory` is the app-wide answer — every spending rollup calls it**, never
`CATEGORY_BUCKET_MAP` directly (that would misfile user-created categories as *needs*).
Resolution is layered, most specific first:
1. the bucket the user picked for their own category (Category Manager);
2. `CATEGORY_BUCKET_MAP`, for built-in and "Other" names;
3. `needs`, as a last resort.

Layer 2 is why **no migration is needed** — categories stored before `bucket` existed resolve
exactly as they did when the map was the only lookup. Archived categories still resolve: old
transactions keep their category name and their history must stay in the assigned bucket.

Categories are identified **by `name`** throughout (`Transaction.category`, budget map keys) —
the `id` is internal. Buckets are **expense-only**; income is grouped by *source* instead
(Earned / Investment / Passive & Other), which is what powers the Investment-Returns rollup.

The seed set includes **`Food`** (needs, `Utensils` icon) alongside `Groceries` — eating in
general is a need; `Dining Out` stays a want.

**Some categories sit outside the rule entirely — filter before resolving.**
`resolveBucketForCategory` has no "none" answer, so anything passed to it lands in a bucket,
defaulting to *needs*. Every rollup must call `isBucketExcludedCategory` first and skip.
Today the list is just **`Ledger`**, the mirror the notebook writes into the transaction
store to keep the dashboard balance and calendar correct: money handed to a notebook contact
is a **receivable, not consumption**, and its repayment comes back as *income*, which no
bucket rollup subtracts. Counting the outflow would strand it in a bucket forever, even
after the book is fully settled. Apply the filter in **both** places or the numbers stop
agreeing: the bucket totals (`computeMoneyRule`, over transactions *and* over per-category
budget limits) and the itemized expense lists the Budgets screen renders underneath them.

### 5.17 `MoneyRule.kt` — Budgeting Rule engine (50/30/20, user-adjustable)
```kotlin
fun computeMoneyRule(
    income: Double, transactions: List<Transaction>, targetDate: LocalDate,
    split: MoneyRuleSplit, budgets: Map<String, Double>
): MoneyRuleResult   // needs / wants / investments : BucketSummary

data class BucketSummary(
    val budget: Double,          // income × split%
    val spent: Double,           // this month's expenses in this bucket
    val remaining: Double,       // budget − spent
    val usage: Double,           // (spent / budget) × 100, 2 dp
    val status: String,          // "On Track" | "Near Limit" | "Over Budget"
    val allocatedBudget: Double  // Σ per-category budgets that fall in this bucket
)
```
- Filters to the **target month's expenses**, skips `isBucketExcludedCategory` rows (§5.16),
  buckets the rest via `resolveBucketForCategory`. The same skip applies when rolling up
  per-category budget limits.
- Also rolls up per-category budget limits per bucket (`allocatedBudget`) so the UI can warn
  when category limits **exceed** the bucket's rule limit.
- Status: `> 100%` (or budget 0 with spend) → **Over Budget**; `>= 90%` → **Near Limit**;
  else **On Track**. With no budget and no spend, usage is 0.
- The split is **user-editable** (e.g. 60/20/20, 40/40/20) and must sum to exactly 100.

### 5.18 `CalendarUtil.kt` + `DueDates.kt` — calendar & upcoming obligations
```kotlin
// CalendarUtil.kt — all LOCAL time, so days match the rest of the app
val WEEKDAY_LABELS: List<String>   // M T W T F S S — Monday-first
val MONTH_LABELS: List<String>
fun toDateKey(d: LocalDate): String                 // "yyyy-MM-dd"; grouping key AND nav arg
fun isSameDay(a: LocalDate, b: LocalDate): Boolean
fun addMonthsClamped(date: LocalDate, months: Int): LocalDate  // day clamped to the target month
fun parseDateKey(key: String?): LocalDate?          // null when malformed — guards the route
fun buildMonthGrid(year: Int, month: Int): List<LocalDate>  // 42 cells, Monday-first, with spill-over

// DueDates.kt — read-only projection, nothing persisted
fun computeDueDates(
    loans: List<LoanRecord>, transactions: List<Transaction>,
    manualSubs: List<ManualSubscription>
): Map<String, List<DueItem>>       // dayKey → items, ~12 months ahead
```
- **EMIs:** each loan's remaining **future** payments (`monthsPaid + 1 … tenureMonths`),
  anchored to `startDate`, amount from the shared `calcEmi` in `LoanMath.kt` (§5.3) — not a
  local copy of the formula.
- **Subscriptions:** next 12 monthly charges for manual subs (anchored to `createdAt`) and
  auto-detected ones (`detectSubscriptions`, skipping `possiblyUnused`).

**Month-end dates must clamp, and the anchor must be re-derived every month.** Two related
bugs, both of which drift a recurring series forward:
- A naive "add one month" *overflows* rather than clamping — 31 January + 1 month lands on
  2 or 3 March, so anything anchored to a month-end day skips the short month entirely.
  `addMonthsClamped` computes the last valid day of the target month and takes
  `min(anchorDay, lastDay)`, setting year/month/day together to avoid an intermediate
  overflow. Java's `LocalDate.plusMonths` already clamps this way — the helper exists so the
  behavior is explicit and identical to the web's.
- Worse, **rolling each occurrence off the previous one** makes a single short month shift
  the entire rest of the series (a 31st anchor clamped to 28 Feb then produces the 28th
  forever). Always recompute from the original anchor day: for occurrence *i*, take the
  anchor day clamped into that month. EMIs are likewise measured from `startDate` every
  time, so a short month clamps once instead of dragging every later instalment with it.

`detectSubscriptions` uses the same clamped step for its `nextEstimated` date (§5.7), so a
charge on the 31st estimates end-of-February rather than overflowing into March.
- `buildMonthGrid` converts JS/Java Sunday-first to Monday-first via `(dayOfWeek + 6) % 7`.
- Java's `DayOfWeek` is already Monday=1 — do the conversion once and keep the grid identical
  to the web's, or the columns shift.

### 5.19 `MathEvaluator.kt` — expression evaluator (floating calculator)
```kotlin
fun evaluateArithmetic(expr: String): Double   // throws on invalid input
```
Shunting-yard: tokenize → RPN → evaluate. Supports `+ - * /`, decimals, parentheses, and
**unary minus**.

**Handle the unary minus by folding it into its operand — not by rewriting it as `0 -`.**
The `0 -` trick only works next to `+` and `−`, which share precedence with the subtraction
it becomes: `2*-3` turns into `2*0-3` = −3 instead of −6, and `8/-2` turns into `8/0-2`,
which throws "Division by zero". Instead, track whether an **operand is expected** (true at
the start, just after `(`, and just after any operator — exactly where `-` means "negative"):
- `-` before a digit → emit the number literal negated (`-3` as one token);
- `-` before `(` → emit `-1` and `*`, so it binds to the whole group rather than its first
  term;
- a leading `+` is a no-op.
Rejects any character outside `[0-9+\-*/().]`; throws on mismatched parentheses, division by
zero, and malformed structure.

### 5.20 `ReminderService.kt` — ledger payment reminders
```kotlin
enum class ReminderTone { FRIENDLY, FORMAL, URGENT }
enum class ReminderLang { EN, HI, MR }
enum class ReminderRelation { CREDIT, DEBIT, SETTLEMENT }

fun generateReminderMessage(
    name: String, amount: Double, tone: ReminderTone,
    lang: ReminderLang, relation: ReminderRelation
): String
fun normalizePhoneNumber(phone: String): String
fun getWhatsAppLink(phone: String, message: String): String   // https://wa.me/<digits>?text=…
fun getSmsLink(phone: String, message: String): String        // sms:<number>?body=…
```
3 tones × 3 languages × 3 relations of templated copy, editable by the user before sending.
Two dispatch channels only — **WhatsApp** and the **device SMS app** (both plain `Intent`s on
Android).

> **Deprecated / removed:** the simulated "Twilio SMS" channel and `sendTwilioSmsSimulated`
> are gone. Do not port them — a fake success screen that claims a message was delivered is
> worse than no feature. Real sending needs a server route (see §5.21).

### 5.21 SMS gateway (Fast2SMS) — bring-your-own credentials
Per-user config (`SmsGatewayConfig`), scoped to Fast2SMS's **Quick route**: no DLT
registration, sender ID, or pre-approved templates — hence the single API-key field. The
trade-off is that messages come from a shared number, are reviewed before dispatch, and never
reach DND-registered numbers.

**No send path is wired up yet, on any platform.** Storing a key does not make the app send
SMS; the reminder screen still simulates delivery, and the settings screen says so in a
warning banner. Sending for real requires a **server** route holding the key — and on Android
the same rule applies for the same reason: a key shipped in the APK is extractable. Keep the
key encrypted at rest (it is a `SENSITIVE_KEY`) and synced only to the user's own account.

### 5.22 `ExcelExporter.kt` — styled `.xlsx` workbook
```kotlin
suspend fun exportWorkbookXlsx(context: Context, options: ExcelExportOptions)
data class ExcelExportOptions(
    val transactions: List<Transaction> = emptyList(),
    val budgets: List<BudgetRow> = emptyList(),
    val savingsGoals: List<SavingsGoal> = emptyList(),
    val currencyCode: String = "INR", val currencySymbol: String = "₹",
    val dateRangeLabel: String = "All Records", val filename: String? = null
)
```
One sheet per **non-empty** dataset (Transactions / Budgets / Savings), each with a title row,
a `DhanBook · Period: … · Generated: …` subtitle, styled headers, gridlines off, and a
currency number format (`"₹"#,##0`). Use **Apache POI** (`XSSFWorkbook`) and write through
MediaStore/SAF. Default name `dhanbook-export-<yyyy-MM-dd>.xlsx`.

### 5.23 `Languages.kt` + localization
```kotlin
val INDIAN_LANGUAGES: List<LanguageInfo>   // code, name, nativeName, regions
const val DEFAULT_LANGUAGE = "en"
fun getLanguage(code: String): LanguageInfo   // falls back to English
```
Three dictionaries ship today — **English, हिन्दी (Hindi), मराठी (Marathi)** — with the data
class shaped for the 22 Eighth-Schedule languages so more can be added without a refactor.

Web resolves dot-notated keys (`t("budgets.categoryBudgets")`) against nested JSON, falling
back to English and then to the raw key, with `{var}` interpolation. On Android this is just
**resource qualifiers**: `res/values/strings.xml`, `values-hi/`, `values-mr/`, with
`getString(R.string.x, args…)` for interpolation and the framework doing the fallback. Switch
languages with `AppCompatDelegate.setApplicationLocales(...)` (per-app language, API 33+, with
the AppCompat backport below that) instead of the web's persist-and-reload.

### 5.24 `AvatarUtils.kt` — profile photo & display-name validation
The avatar is stored **inline** (a small data URL on the web; a 256px JPEG on Android) rather
than in a Storage bucket, so every value that reaches persistence or an `<img>`/`AsyncImage`
passes through these validators. Port them — they are security code, not formatting helpers.

```kotlin
const val AVATAR_SIZE = 256              // square thumbnail edge, px
const val MAX_AVATAR_CHARS = 300_000     // data-URL cap; Firestore docs are limited to 1 MiB
const val MAX_NAME_CHARS = 40
private const val MAX_SOURCE_FILE_BYTES = 8 * 1024 * 1024   // largest image we will decode

fun isSafeAvatarUrl(value: Any?): Boolean
fun sanitizeAvatarUrl(value: Any?): String?      // → null when unsafe
fun sanitizeDisplayName(value: Any?): String
suspend fun uriToAvatarJpeg(context: Context, uri: Uri): Result<ByteArray>
```

**Two failure modes drive the rules.**
- **Size.** The value is stored inline in the user's Firestore profile document, which has a
  hard **1 MiB** limit. Oversized input makes the write fail and silently loses the edit — so
  cap it *before* saving, and reject a source image too large to decode safely (8 MB).
- **Shape.** Only an **image data URL** (`jpeg` / `png` / `webp`, base64) or an **`https:` URL**
  (what an identity provider returns) is ever legitimate. Everything else — `javascript:`,
  `data:text/html`, `blob:`, plain `http:` — is rejected on **both write and read**, so a
  tampered profile document can never put an attacker-chosen URL in front of an image loader.
  **Parse the URL, don't string-match it**: `"https:evil"` passes a `startsWith` check and
  fails a real parse. On Android, validate with `Uri.parse(value).scheme == "https"` and
  reject anything Coil/Glide would resolve to a local file or content provider.

**Display names** are stripped of characters that must never survive into rendered text —
C0/C1 controls, `DEL`, zero-width marks (`U+200B–200F`), and the bidirectional overrides
(`U+202A–202E`, `U+2066–2069`) that let one name be rendered to look like another. Tab /
newline / CR become a space so `"First\nLast"` collapses to `"First Last"` rather than
`"FirstLast"`; then whitespace is collapsed, trimmed, and capped at 40 chars.

**Photo processing** is a centered square crop → `AVATAR_SIZE` → JPEG q=0.85, with the result
re-checked against the size cap. Non-image input is rejected up front with a message the user
can act on ("Please choose an image file", "pick one under 8 MB"), and picking the *same* file
again after an error must work — clear the picker's selection state on failure.

---

## 6. Auth & Security Flow

### 6.1 Splash & redirect (== web `app/page.tsx`)
A launcher `SplashActivity` / start destination: after ~1.5s → no session → Login;
session + PIN set → PinLock; else → Home.

### 6.2 Login (3 methods)
| Web | Android (Firebase Auth) |
|---|---|
| `signInWithEmailAndPassword` | `auth.signInWithEmailAndPassword(email, pass)` |
| Google popup | **Credential Manager / Google Sign-In** → `GoogleAuthProvider.getCredential(idToken)` → `auth.signInWithCredential(...)` |
| Phone OTP | `PhoneAuthProvider.verifyPhoneNumber(...)` + `PhoneAuthProvider.getCredential(verificationId, code)`; E.164 validation `^\+[1-9]\d{6,14}$` |
**Every sign-in path ends in the same tail** — factor it out as
`suspend fun finishSignIn(user: FirebaseUser, fallbackName: String)`, which calls
`resolveSessionProfile` (§4.2), caches the result, and *then* routes to PinLock. This is not
tidiness: sign-out wipes the local session on purpose, so the name and photo the user set in
Settings have to be **rehydrated from the cloud profile at every login** or each one resets
them to the provider defaults. `fallbackName` differs per path — the email local-part,
`user.phoneNumber ?: "Phone User"`, `"Google User"` — and is only reached when neither the
saved profile nor the provider has a name.

On success: cache the resolved session in DataStore, then **always route through PinLock** —
it sets up a PIN if none exists (the PIN derives the decryption key) or verifies the existing
one. Google's name and photo are only the seed for a brand-new account; a profile the user has
since edited — including a *removed* photo — wins.

### 6.3 Register
`auth.createUserWithEmailAndPassword` → `user.updateProfile { displayName }` →
Firestore `users/{uid}` doc
`{uid, name, avatarUrl, email, createdAt = FieldValue.serverTimestamp()}`.
Cache the session, route to PinLock.

The name and photo go into that document — **not only into local storage** — because signing
out clears the local copy; the Firestore doc is what survives to the next login (§4.2). Run
both through `sanitizeDisplayName` / `sanitizeAvatarUrl` (§5.24) before either write.

> **Previously a known defect, now fixed on the web — port the fixed version.** The register
> screen's avatar upload used to be a **fake progress bar** (a 150 ms interval ticking to
> 100%) that stashed a dead `URL.createObjectURL` blob URL. It now really processes the file:
> `fileToAvatarDataUrl` → 256px JPEG → saved to the profile document. On Android, decode the
> picked `Uri` off the main thread (`uriToAvatarJpeg`, §5.24), show progress tied to the real
> work, and surface decode failures as an actionable message. If you would rather have the
> photo follow the account as a file, **Firebase Storage**
> (`storage.reference.child("avatars/$uid").putFile(uri)` with an `OnProgressListener`) is the
> alternative — but store the resulting **https** download URL, which `sanitizeAvatarUrl`
> already accepts.

### 6.4 PIN Lock + Biometric
- 4-digit keypad composable. Hash with `MessageDigest.getInstance("SHA-256")`; store hex in
  **encrypted DataStore / EncryptedSharedPreferences**. Setup (enter→confirm) vs verify.
- Biometric: **`androidx.biometric.BiometricPrompt`** with `BiometricManager.canAuthenticate(BIOMETRIC_STRONG)`
  capability check (replaces WebAuthn). On success + PIN exists → Home. "Switch Account" clears session.
- **Auto-lock:** in `Application`/lifecycle observer (`ProcessLifecycleOwner`), if the app is
  backgrounded >60s and a PIN is set, lock on return (== web Page Visibility API).

  **Actually lock — navigating to PinLock is not locking.** Showing the lock screen while the
  encryption key and the fully decrypted cache sit in memory protects the *view* and nothing
  else. The sequence is:

  1. `flushPendingWrites()` **first** — `lockDataStore()` drops the pending-write bookkeeping,
     and an auto-lock must not silently turn an unsynced change into one the user is never
     warned about;
  2. `lockDataStore()` — drop the key and the plaintext cache;
  3. *then* navigate to PinLock.

  Nothing is lost either way: on-disk data stays encrypted and is re-read at unlock. Clear
  the "backgrounded at" timestamp before the suspend call so a re-entrant visibility change
  can't fire the sequence twice.

### 6.5 Session keys (DataStore, not synced)
`user_session` (a **cache** of `name`, `email`, `avatarUrl` — the durable copy is the Firestore
profile, §4.2), `pin_hash`, `biometrics_enabled`, `active_currency`, `active_language`,
`theme`, `enc_salt` (KDF salt), `fx_rates`, `legacy_seed_cleared_v1`. The session PIN cache is
**memory-only** — never write it to disk.

### 6.6 Profile (name + photo)
- Google sign-in seeds the avatar from the account's `photoUrl` **only when the user has never
  saved one**. Once they save — or explicitly remove — a photo, that wins at every subsequent
  login (§4.2's three-state rule). On the web these remote photos need
  `referrerPolicy="no-referrer"` to load; on Android, Coil/Glide have no such restriction.
- **Edit Profile** writes to three places, in this order: the session cache (which re-renders
  every subscriber — Home header and Settings card update instantly, with no second copy in
  screen state), the **Firestore profile document** (the only durable copy), and Firebase
  Auth's `displayName` (best-effort, so the name follows the account into anything reading
  `displayName`). A failed cloud write never loses the local edit — but say so: *"saved on
  this device — could not sync to your account"*.
- The photo is **not** mirrored to Firebase Auth: `photoURL` cannot hold a data URL. It goes
  in the profile document as an inline value (Android: the cropped 256px JPEG, or a Storage
  https URL — §6.3).
- **Removing the photo** persists an explicit `null`, not an omitted field, so the provider's
  photo is not re-seeded at the next sign-in.
- Images are **downscaled before saving** — centered square crop to **256×256**, re-encoded
  JPEG q=0.85, then size-checked (§5.24). A full-resolution phone photo would otherwise be
  megabytes and the profile write would fail.

### 6.7 Re-authentication for destructive actions
Clear-All-Data requires a **real** Firebase re-auth, not an on-screen code:
`reauthenticateWithCredential(EmailAuthProvider…)` for password accounts,
`reauthenticateWithPopup(GoogleAuthProvider)` for Google (Android: Credential Manager →
`reauthenticate(credential)`); providers that support neither are marked *unsupported* rather
than waved through.

---

## 7. Navigation & Screens (== NAV_ITEMS)

**Navigation-Compose `NavHost`** with these routes. Desktop sidebar → a
**Navigation Rail** (tablet) / **Navigation Drawer**; mobile bottom nav → **`NavigationBar`**.

**Bottom nav (5):** Home, Transactions, Notebooks (Ledger), Analytics, Settings —
plus a center **FAB** (Add Transaction) and a **voice mic** action.

**Full route list (23), in menu order:** `home`, `transactions`, **`ledger`**, `calendar`,
`budgets`, `savings`, `bill-splitter`, `family-wallet`, `mood-insights`, `health-score`,
`cibil-simulator`, `academy`, `analytics`, `comparison`, `subscriptions`, `what-if`,
`streaks`, `emi-tracker`, `export`, `notifications`, `help`, `settings`
(+ nested: `ledger/{id}`, `family-wallet/{groupId}`, `calendar/{date}`,
`settings/categories`, `settings/sms-gateway`, `settings/about`).
Use typed nav args for `{id}` / `{groupId}` / `{date}` (`yyyy-MM-dd`).
**Notebooks (Ledger) sits third**, right after Transactions — it is a primary surface in the
bottom nav, so keep it near the top of the drawer/rail too rather than below the planning
screens.

### 7.1 The authenticated shell — what the layout owns
Everything below belongs to the shell composable that wraps the dashboard graph, not to any
one screen.

- **Guard on signed-in *and* unlocked** (§4). Also mount the floating calculator, the
  Add-Transaction sheet and the Voice sheet here — inside the authenticated shell only, never
  over Login/Register.
- **Do not refresh the screen after a sheet saves.** The web shell used to force a full page
  reload when Add-Transaction or Voice succeeded on `/home` or `/transactions`. It was not
  merely redundant — every screen reads through subscribing hooks and already re-renders on
  write — it tore the page down mid-save and could abandon a Firestore write that had not
  been acknowledged. On Android the equivalent mistake is popping/recreating the destination
  or invalidating the ViewModel on success: don't. The `Flow` emission is the refresh.
- **Legacy-cache cleanup runs once per device — and must touch local keys only.** An earlier
  build seeded fabricated balances; the cleanup removes their derived caches
  (`total_income`, `total_savings`, `financial_health_score`, `weekly_insights`) and sets
  `legacy_seed_cleared_v1`. Remove those prefs **directly**. Do **not** route it through
  `clearFinancialData()`: that writes empty defaults through the data store, which mirrors
  them to Firestore — and since the "already ran" flag is local, the purge fires on every
  device the app has not run on before, exactly where there is no legacy data and the cloud
  holds the user's only copy. That combination wipes the account on a new install. The four
  keys are local-only derived caches, so deleting them does the intended job with no cloud
  write at all.

---

## 8. Feature Screens (Compose) — behavior parity

> Common pattern: each screen is a composable backed by a `ViewModel` that collects
> repository `Flow`s into `StateFlow`; read `active_currency` from DataStore; format money
> with `formatAmount`; show **empty states** when there's no real data; charts via MPAndroidChart/Vico.

| Screen | Android composable | Key behavior |
|---|---|---|
| **Home / Workspace** | `HomeScreen` | Hourly greeting + name (collected from the profile flow, §4.2 — not read once at mount), header actions **theme toggle + notifications bell**, `SmsPasteZone`, balance card (`getTotals().balance`), `SafeToSpendCard`, 4-stat grid (Remaining Budget %, Goal Progress %, Health Index, Ledger count), 7-day balance line + monthly category bar with Both/Income/Spent toggle. |
| **Transactions** | `TransactionsScreen` | Live list (`Flow`), search, type tabs (all/income/expense), KPI totals for the *currently filtered* rows, grouped Today/Yesterday/Previous Weeks, inline edit + delete-confirm, add via bottom sheet. Editing an amount inline **clears `originalAmount`/`discountAmount`** — the stored discount breakdown no longer describes the new number. |
| **Analytics** | `AnalyticsScreen` | KPI cards with MoM % badges, income-vs-expense area chart (6 mo), category pie + legend, grouped bar (this vs last), top-5 category bars. |
| **Comparison** | `ComparisonScreen` | Month-vs-month per-category deltas, grouped bar (top 8); expense decrease=green, increase=red. |
| **Budgets** | `BudgetsScreen` | **Three tabs** over a shared month switcher — see §8.1. The itemized per-bucket expense lists apply the same `isBucketExcludedCategory` filter as `computeMoneyRule`, so the items always add up to the bucket totals above them. |
| **Calendar** | `CalendarScreen` | Month grid (`buildMonthGrid`), per-day income/expense/Ledger/Due markers, red expense heatmap tint (`0.06 + spend/maxSpend × 0.22`), Today button; tap a day → `calendar/{dateKey}`. Ledger-mirrored transactions are excluded from the transaction totals so they aren't double-counted. |
| **Day Detail** | `CalendarDayScreen` | nav arg `date`; validated via `parseDateKey`. Due/EMI items, transactions, and notebook-ledger entries for that day, with search and KPI totals where **Income = income txs + ledger "got"** and **Expense = expense txs + ledger "gave"**. |
| **Savings** | `SavingsScreen` | Goal cards with radial % ring (Compose `Canvas`/arc), required monthly deposit, **bucket tag chip** (Needs/Wants/Investments), AddGoal + LogDeposit sheets. |
| **Ledger (Khata)** | `LedgerScreen` | Titled **Notebook Ledger** — "track credits and debts across your account books". Receivable/Payable/Net summary, filter tabs + search, add account (`PhoneNumberInput` + **opening balance** + a two-way direction toggle, **"You will get" / "You will give"**, which sets the sign), per-row balance state, quick reminder trigger → `FlashReminderSheet`. **No customer/supplier type badge** — the balance sign is the truth, and a fixed label went stale as soon as the balance crossed zero. |
| **Ledger Detail** | `LedgerDetailScreen` | nav arg `id`; balance card, You-Gave/You-Got entry (amount typed in the active currency → `toBaseAmount` before it touches the balance *or* the mirrored transaction), mirrors into transactions under category `Ledger` (excluded from bucket rollups, §5.16), running history with per-entry delete (removes linked `txId`), WhatsApp quick action + reminder composer. Back-link reads "Notebook Ledger"; no type badge in the header. |
| **Family Wallet** | `FamilyWalletScreen` | Join by 6-digit code or create a group (random code, checked for collision); group cards → detail; **leave/delete confirm** that states which is happening (§4.1). Backed by the shared `familyGroups` collection, not the per-user mirror. |
| **Family Group Detail** | `FamilyGroupScreen` | nav arg `groupId`; **live** group doc + expenses listeners, member roster, pool balance vs optional spending limit, add expense claim (rolls the group total with `increment`, §4.1), set-limit overlay (`fromBaseAmount` to fill the field, `toBaseAmount` to save), leave/delete. |
| **EMI Tracker** | `EmiTrackerScreen` | `useLoans` flow, summary cards, per-loan card with amortization (`calcEmi`/`calcAmortization` from the shared `LoanMath.kt`, §5.3), expandable breakdown, delete-confirm, AddLoan sheet. Shows **two distinct debt figures**: "Total Outstanding / Settle-today balance" (`calcOutstandingPrincipal`) in the summary, and "… left to pay" (`calcRemainingPayments`) on the progress bar. |
| **Health Score** | `HealthScoreScreen` | Aggregate real ledger → `computeHealthScore`; semicircle gauge (`Canvas` arc, color by band), per-metric breakdown rows, recommendations. |
| **CIBIL Simulator** | `CibilSimulatorScreen` | Sliders (Payment 35%, Utilization 30%, Age 15%, Mix 10%, Inquiries 10%), score 300–900, animated spring counter via `Animatable`. Educational only. |
| **Academy** | `AcademyScreen` | Load lessons from bundled `assets/lessons/lessons.json` (Moshi/kotlinx.serialization), lesson→quiz→results, 100% unlocks reward badge, progress in DataStore. |
| **Mood Insights** | `MoodInsightsScreen` | Log mood (Good/Okay/Stressed) keyed `yyyy-MM-dd`, 7-day bar of spend/income colored by mood, variance alert. |
| **What-If** | `WhatIfScreen` | Sliders (contribution, lump sum, years, return %), `simulateWhatIf`, area chart Value vs Invested. |
| **Subscriptions** | `SubscriptionsScreen` | Two sources merged: **auto-detected** (`detectSubscriptions` + `summarizeSubscriptions`, possibly-unused badge) and **manually added** ones the user tracks by hand (`useManualSubscriptions`, add sheet, per-row delete). Manual subs also feed the calendar's due projection (§5.18). |
| **Streaks** | `StreaksScreen` | `computeStreaksAndBadges`, three stat cards, achievements grid (earned vs locked w/ progress). |
| **Bill Splitter** | `BillSplitterScreen` | Local-only state, add shared expense (equal/assign), `simplifyDebts` + `calculateBalances`, WhatsApp request links, live split preview. |
| **Notifications** | `NotificationsScreen` | Notification feed with severity icons, mark-all-read, delete per item. Consider mirroring to **system notifications** via `NotificationManager`. |
| **Export** | `ExportScreen` | Date-range presets + custom, data-type multiselect with live counts, **three output formats: Excel (.xlsx) / CSV / PDF**. |
| **Help & Support** | `HelpScreen` | Searchable FAQ accordion. WhatsApp + call cards render **only when a support number is configured** (build config, not hardcoded) — no placeholder number ever ships as a live link. |
| **Settings** | `SettingsScreen` | Profile card (tap photo → viewer, Edit Profile / Remove Photo) bound to the profile flow, with the sync-failure warning of §6.6 — and **no "Local Account" badge**, since the profile is now cloud-backed; currency + language pickers, category manager, **SMS gateway**, About, biometric toggle, reset PIN, **Backup & Recovery**, sign-out-everywhere, multi-stage Clear-All-Data with real re-auth (Danger Zone). |
| **Category Manager** | `CategoriesScreen` | Active vs archived categories, archive/restore, AddCategory sheet, and a **3-way bucket selector on every expense category** (Needs/Wants/Investments) that drives the Budgeting Rule. Rows show the *resolved* fallback until the user picks explicitly. |
| **SMS Gateway** | `SmsGatewayScreen` | Fast2SMS key (masked, reveal toggle), enable switch, Quick-route caveats, published recharge tiers with a date stamp + link out to Fast2SMS, and an honest "not sending yet" banner. Draft-and-Save, not live-write (§4). |
| **About** | `AboutScreen` | App version, credits, policy links. |

### 8.1 Budgets — three tabs
| Tab | Content |
|---|---|
| **Rule Allocations** | Monthly take-home **income** card (inline edit) with the three allocation amounts; **split configuration** card (editable Needs/Wants/Invest %, validated to sum to exactly 100, with Reset to 50/30/20); donut of actual spend per bucket with total in the center; one card per bucket showing Rule Limit / Allocated Budgets / Actual Spent / Utilized % / Discipline, an over- or under-allocation warning, a progress bar, and the itemized expenses for that bucket. |
| **Category Limits** | The original per-category view — progress bars, ≥80% warning, ≥100% breach, "no limit configured" state, Adjust Budgets sheet. |
| **Spent vs Invested** | KPI row (Total Spent = Needs+Wants, Total Invested, **Investment Returns** = income whose category resolves to the *Investment* income group, Invest Rate = invested ÷ outflow); Spent-vs-Invested donut; three category rollups sorted high→low. Returns are money **coming in** — shown separately and never netted against spending. |

All three share the month navigator, so `‹ ›` re-computes whichever tab is open.

---

## 9. Reusable Components & "Modals" (bottom sheets)

Web modals → **Compose `ModalBottomSheet`** (Material 3) or full-screen dialogs.

> **Every sheet with an amount field converts currency at both edges** (§5.11): read the
> active currency, `toBaseAmount` on save, `fromBaseAmount` to pre-fill. Marked ⇄ below.
> And none of them asks the caller to refresh on success — the store emits, the screen
> re-renders (§7.1).

| Web component | Android composable | Behavior |
|---|---|---|
| `AddTransactionModal` ⇄ | `AddTransactionSheet` | Expense/Income toggle, category grid, **"Other" expander** (expense: grouped by bucket; income: grouped by source), **discount field** (% or flat, clamped, live "you saved" line), amount + description → `addTransaction`; on expense ≥80% of a budget, push a notification + inline warning; success animation. The live breakdown is shown in the typed currency; `amount`, `originalAmount` **and** `discountAmount` are all converted to base before saving. |
| `AddGoalModal` ⇄ | `AddGoalSheet` | Name, target (converted to base), deadline (min tomorrow), **"Counts As" bucket picker** (defaults Investments) → new goal (current 0). |
| `AddCategoryModal` | `AddCategorySheet` | Type toggle, name, 8 colors, 12 icons, **bucket picker (expense only)** → `CategoryData`. |
| `AddLoanModal` ⇄ | `AddLoanSheet` | Name, lender presets, principal (→ base on save), rate, tenure, monthsPaid, startDate; live amortization preview showing Monthly EMI / Total Payable / Total Interest / **Outstanding Now** (`calcOutstandingPrincipal`, §5.3). The preview is derived from the principal *as typed*, so it formats with **`convert = false`** — converting again would double-apply the rate. |
| `LogDepositModal` ⇄ | `LogDepositSheet` | Amount (→ base) → increment goal `current` + log an expense **under the goal's bucket category** (`SAVINGS_DEPOSIT_CATEGORY[goal.bucket ?: investments]`), so a phone fund counts as a *want*, not an investment. |
| `SetBudgetModal` ⇄ | `SetBudgetSheet` | Category chips + monthly limit → `setBudgets`. Converts **both ways** — the stored base limit fills the field via `fromBaseAmount`, the typed value saves via `toBaseAmount` — and the label and prefix show the **active** currency/symbol, not a hardcoded `₹`. |
| `CurrencyPickerSheet` | `CurrencyPickerSheet` | Searchable `PRESET_CURRENCIES`; writes `active_currency`. |
| `LanguagePickerSheet` | `LanguagePickerSheet` | `INDIAN_LANGUAGES` with endonyms; writes `active_language` (Android: `setApplicationLocales`). |
| `MoneyRuleCard` | `MoneyRuleCard` | Home-screen summary: three bucket bars (spent / limit, % and status badge) from `computeMoneyRule`; when income is 0, an empty state with a **Set Income** action deep-linking to Budgets. |
| `SafeToSpendCard` | `SafeToSpendCard` | `computeSafeToSpend`; per-day number + "left"/"reserved"; "Set a budget" when insufficient. |
| `SmsPasteZone` | `SmsPasteZone` | Paste area; `parseSmsMessage` → confirm sheet → `addTransaction`. |
| `VoiceLoggingModal` | `VoiceLoggingSheet` | `SpeechRecognizer` (9 langs, default hi-IN) → `parseVoiceInput` → `checkAnomaly` → confirm → `addTransaction`. |
| `AddSubscriptionModal` | `AddSubscriptionSheet` | Name, category preset, monthly amount → `addManualSubscription`. |
| `FlashReminderModal` | `FlashReminderSheet` | Reminder composer: tone × language × relation template (`generateReminderMessage`), editable draft, **two channels — WhatsApp / device SMS** (`Intent`). Shared by **Ledger**, **Ledger Detail** and **Bill Splitter**. |
| `EditProfileModal` | `EditProfileSheet` | Photo pick → validate + square-crop to 256px JPEG (§5.24) → preview, Remove, display-name field (≤40 chars). Copy says *"saved to your account"*, not "on this device" — it is cloud-backed now. |
| `ThemeToggle` | `ThemeToggle` | Icon button in the Home header, styled to match the notification bell beside it. Sun and moon are **both** rendered and cross-faded by rotation/scale (`animateFloatAsState`) rather than swapped, so there's no pop. Content description flips with the theme ("Switch to dark/light mode") and is translated. |
| `ProfilePhotoViewerModal` | `ProfilePhotoViewerDialog` | Full-bleed photo view with a delete action. |
| `GlobalFloatingCalculator` | `FloatingCalculator` | Draggable FAB bubble (constrained to the viewport) opening a keypad popover with a **live result** via `evaluateArithmetic`, plus copy-to-clipboard. Mounted **inside the authenticated shell only** — not over the login/register screens. |
| `PhoneNumberInput` | `PhoneNumberField` | Country selector (flag+dial) + national field enforcing per-country digit limits via `Countries.kt`. |

---

## 10. Android-Specific Integrations (device features)

| Feature | Android API |
|---|---|
| WhatsApp reminders | `Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/$number?text=$msg"))` |
| Auto SMS capture | **SMS Retriever API** (no permission) or `BroadcastReceiver` + `RECEIVE_SMS` (opt-in) → `parseSmsMessage` |
| Voice logging | `SpeechRecognizer` + `RECORD_AUDIO` |
| Biometric unlock | `androidx.biometric.BiometricPrompt` |
| Weekly insights | `WorkManager` `PeriodicWorkRequest` → `runLazyCatchUpSync` |
| CSV / PDF / Excel files | `MediaStore` / Storage Access Framework; `PdfDocument`; Apache POI `XSSFWorkbook` |
| System notifications | `NotificationManager` + notification channels |
| Offline cache | Room only. **Turn Firestore's disk cache off** (`MemoryCacheSettings`) — it is on by default and would keep a plaintext copy of the financial data (§4.3) |
| Encryption at rest | `javax.crypto` PBKDF2 + AES-GCM (or Jetpack Security); key in memory only |
| Connectivity-aware retry | `ConnectivityManager.NetworkCallback.onAvailable` → `flushPendingWrites()` |
| Live FX rates | Retrofit/OkHttp → `open.er-api.com`, cached in DataStore with a 12 h TTL |
| Profile photo | Photo Picker (`ACTION_PICK_IMAGES`) → centered square crop → 256px JPEG → internal storage |
| Theming / dark mode | Fixed light + dark `ColorScheme` from the theme tokens (§11.1); mode persisted in DataStore, `isSystemInDarkTheme()` until chosen |
| Profile photo storage | Cropped JPEG in internal storage (or Firebase Storage), path/URL in the `users/{uid}` profile doc (§4.2) |
| App language | `AppCompatDelegate.setApplicationLocales` + `values-hi` / `values-mr` |
| Currency/number format | `java.text.NumberFormat` with `Locale("en","IN")` |
| Dates | `java.time.LocalDate` / `DateTimeFormatter` (keep ISO strings for parity) |
| Config-driven values (support number, gateway URLs) | `BuildConfig` fields / `local.properties` — never hardcoded in source |

**Manifest permissions to declare (only those you enable):**
`INTERNET`, `RECORD_AUDIO` (voice), `RECEIVE_SMS`/`READ_SMS` (optional auto-SMS),
`USE_BIOMETRIC`, `POST_NOTIFICATIONS` (Android 13+). Photo picking needs **no** permission via
the Android Photo Picker.

---

## 11. Design System (== `globals.css` tokens)

Map Tailwind semantic tokens to a Material 3 `ColorScheme` + custom extension colors in
`ui/theme/Color.kt`:

| Web token | Material 3 / custom slot |
|---|---|
| `bg-background` / `bg-card` | `background` / `surface` |
| `bg-secondary` | `surfaceVariant` / `secondaryContainer` |
| `text-foreground` / `-secondary` / `-muted` | `onBackground` / `onSurfaceVariant` / muted custom |
| `text-primary` / `bg-primary-lighter` | `primary` / `primaryContainer` |
| `text-brand` / `bg-brand-light` | custom brand color pair |
| `text-success` / `text-error` / `text-warning` | custom `success`/`error`/`warning` extension colors |
| `chart-1..6` | a `ChartColors` list for MPAndroidChart |

- **Buttons:** `btn-primary`/`btn-secondary` → `Button`/`OutlinedButton` styles.
- **Inputs:** `input-base` → `OutlinedTextField` default.
- **Modal pattern:** `ModalBottomSheet` (bottom on mobile), success splash with a check icon,
  auto-dismiss ~1.2–1.5s.
- **Charts:** consistent grid, custom marker/tooltip, gradient fills.
- **Money:** always `formatAmount(value, activeCurrency)` (often `decimalPlaces = 0`).
- **Empty states:** an inbox icon + helper text whenever there's no real data.
- **Icons:** Material Symbols (map from lucide names).

### 11.1 Dark theme
The web ships a **full dark token set that mirrors every `:root` token one-for-one**. Because
the whole app consumes colour through semantic names (`bg-card`, `text-foreground`,
`border-border`…), overriding the variables is the entire implementation — there is not a
single per-component dark override. Compose works the same way: build **two complete
`ColorScheme`s + one matching extension-colour set** and change nothing at the call sites. A
screen that hardcodes a colour (the web had a literal `bg-white/60` that had to become
`bg-card/60`) is the one thing that breaks this, and it breaks silently — white-on-white in
dark mode. Grep for raw colour literals before you ship.

**Two rules when adding a token**, or the pairs drift apart:
- A `*-light` tint is a **background** — it goes *dark* in dark mode, while its solid
  counterpart *brightens* to stay readable on top of it.
- A `*-foreground` is the text that sits **on** the solid colour, so for the mid-tone status
  colours (success / warning / error / info / brand) it flips to a dark shade.

**Mode selection — three states, not two.** The stored value is `light` / `dark` / *unset*;
while it is unset the app follows the OS and keeps following it if the system setting changes
mid-session. An explicit choice ends that. On Android:
`isSystemInDarkTheme()` as the default, a DataStore `theme` key as the override, both folded
into one `themeMode` flow read by the root composable.

**Boot with the right theme.** The web needs a synchronous inline `<script>` in `<head>` to
add `.dark` before first paint, or a returning dark-mode user gets a white flash. Android's
equivalent problem is the **launch theme**: set the windowBackground in `themes.xml` /
`themes-night.xml` so the cold-start window matches, and read the persisted mode *before*
`setContent`. Also set `colorScheme` on the window (`WindowCompat` + light/dark status and
navigation bar icons) so system chrome, scrollbars, and text handles follow.

- **Transition:** animate only colour, never layout — the web transitions
  `background-color` / `color` over 0.25s and skips it under `prefers-reduced-motion`.
  Compose: `animateColorAsState`, gated on
  `Settings.Global.TRANSITION_ANIMATION_SCALE == 0f` / the accessibility reduce-motion setting.
- **Dynamic colour is deliberately *not* used.** Material You would override the brand palette
  the tokens define; keep the fixed schemes so both platforms look like the same product.

**App identity** (from the web `manifest.json` — carry it over so both platforms match):
name **DhanBook**, short name **DhanBook**, description *"Your Secure Personal Finance
Companion"*, theme color **`#1d4ed8`** (= `primary`), background `#ffffff`, **portrait**
orientation. The web's `sw.js` has no Android counterpart — the APK plus Room fill that role —
but **one rule inside it does carry over**: the worker passes every cross-origin request
straight through and never stores it, because Cache Storage is unencrypted disk and those
responses hold financial data and identity tokens. That is the same decision as §4.3, and on
Android it is Firestore's disk cache you have to switch off to honour it.

---

## 12. Build Checklist (order of operations)

1. New Android Studio project (Empty Compose Activity, min SDK 24+), add deps (§1), `google-services.json`.
2. `ui/theme/` — port color tokens, typography, shapes; **both** light and dark
   `ColorScheme`s plus the launch-theme/night-theme pair, and the `themeMode` flow (§11.1).
   Do this before any screen exists — retrofitting dark mode means auditing every literal.
3. Firebase console: enable Auth (email, Google, phone), Firestore, Storage. Pin Firestore to
   `MemoryCacheSettings` in the same commit that initializes it (§4.3).
4. **Room** entities + DAOs + `AppDatabase`; **DataStore** for prefs.
5. `Encryption.kt` + the unlock/lock lifecycle (§4) — get this in before any real data lands,
   so nothing is ever written plaintext and has to be migrated.
6. `DataRepository.kt` — CRUD, derived selectors, Flows, `FirestoreSync` with empty-value
   guard, **write-durability tracking**, and cloud backup/restore (§4).
7. **Pure logic** (`domain/`) — port all §5 modules (they're framework-free; unit-test them).
   `BucketConfig`/`Categories` first: `MoneyRule`, budgets, savings deposits and the Category
   Manager all resolve through them.
8. `AvatarUtils` + `UserProfileRepository` (§4.2, §5.24) — the profile sits outside the
   encrypted store and every auth screen depends on it, so land it before the auth flow.
9. Auth flow — splash, login (3 methods) sharing one `finishSignIn` that rehydrates the cloud
   profile, register (+Firestore profile doc with a *real* avatar), PinLock (SHA-256 +
   BiometricPrompt), auto-lock via `ProcessLifecycleOwner`, and the
   **signed-in-≠-unlocked** dashboard guard (§4).
10. `NavGraph` + scaffold (bottom bar + FAB + mic + floating calculator) (§7).
11. Reusable composables & bottom sheets (§9), including the header `ThemeToggle`.
12. Feature screens (§8) — each wired to its ViewModel/Flows + domain modules.
13. Device integrations (§10): SpeechRecognizer, WorkManager catch-up, CSV/PDF/Excel,
    WhatsApp & SMS intents, notifications, FX refresh, connectivity retry.
14. Localization — `values-hi` / `values-mr` string resources + language picker.
15. Bundle `assets/lessons/lessons.json`; QA offline-first + sync parity vs the web app.
    Specifically test: airplane-mode edit → logout warning, PIN change → re-encrypt, restore
    of a backup taken before a key existed, bucket resolution for archived categories,
    **sign-out → sign-in keeps the edited name and a removed photo**, **every screen in dark
    mode including cold start**, and that no plaintext financial data lands on disk (§4.3).

---

*This document mirrors `PROJECT_BLUEPRINT.md` / `FEATURES.md` / `CALENDAR.md` and translates
every feature and function of the web app into its Android Studio (Kotlin + Jetpack Compose)
equivalent. Behavior and business logic are identical; only platform I/O, UI, and device APIs
change.*

*Last synced against the web app at commit `b56562a` (2026-08-07).*
