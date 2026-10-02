"use client";

import { useEffect, useState } from "react";
import { auth, db } from "@/config/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, setDoc, collection, getDocs, deleteDoc, query, orderBy, getDoc } from "firebase/firestore";
import { deriveKeyFromPin, encryptValue, decryptValue, isEncrypted } from "./encryption";
// Type-only: erased at compile time, so this does not form an import cycle with
// categories.ts, which imports the category accessors below at runtime.
import type { CategoryData } from "@/core/utils/categories";
import { calcOutstandingPrincipal } from "@/core/math/loan";

import { formatDate } from "@/core/utils/dateFormat";
/**
 * Central data layer — the single source of truth for the app.
 *
 * Everything is backed by `localStorage` (same keys the app already used) but
 * with EMPTY defaults: no mock/seed data is ever fabricated. Display values
 * (balances, charts, KPIs) are DERIVED from the real transactions a user adds,
 * rather than stored as separate fake counters.
 *
 * Writes go through the helpers below, which emit a `datastore:change` event so
 * every mounted page recomputes live (same-tab updates — the native `storage`
 * event only fires across tabs).
 */

export interface Transaction {
  id: string;
  /** The effective amount that hits the ledger (post-discount for expenses). */
  amount: number;
  type: "expense" | "income";
  category: string;
  description: string;
  date: string;
  /** Pre-discount price, present only when a discount was applied. */
  originalAmount?: number;
  /** Discount value in ₹ (already subtracted from `amount`). */
  discountAmount?: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  /**
   * Which 50/30/20 bucket this goal's deposits count toward. A goal isn't always
   * an investment — saving for a phone is a "want", an emergency fund is an
   * "investment". Optional for backwards compatibility: goals created before
   * this field existed are treated as "investments" (the previous behaviour).
   * Mirrors BucketType in core/utils/bucketConfig.
   */
  bucket?: "needs" | "wants" | "investments";
}

export type BudgetMap = Record<string, number>;

export interface LoanRecord {
  id: string;
  name: string;
  lender: string;
  principal: number;
  annualInterestRate: number;
  tenureMonths: number;
  monthsPaid: number;
  startDate: string;
}

export interface LedgerEntry {
  id: string;
  amount: number;
  type: "gave" | "got";
  description: string;
  date: string;
  /** Linked transaction id so dashboard totals stay in sync on add/delete. */
  txId?: string;
}

export interface LedgerCustomer {
  id: string;
  name: string;
  phone: string;
  /** positive: credit (they owe us), negative: debit (we owe them) */
  balance: number;
  history: LedgerEntry[];
  description?: string;
}

export interface FamilyGroup {
  id: string;
  name: string;
  code: string;
  members: number;
  /**
   * Display names of everyone in the group, synced from the shared
   * `familyGroups` directory doc. `members` stays as the headcount
   * (== memberNames.length once populated) for backward compatibility.
   */
  memberNames?: string[];
  totalBalance: number;
  spendingLimit?: number;
}

export interface GroupExpense {
  id: string;
  groupId: string;
  amount: number;
  description: string;
  paidBy: string;
  date: string;
}

/** A subscription the user added by hand (vs. auto-detected from transactions). */
/**
 * Fast2SMS gateway settings. The user brings their own Fast2SMS account, so
 * this is a per-user credential rather than an app-wide key.
 *
 * Scoped to Fast2SMS's Quick route, which needs no DLT registration: no entity,
 * sender ID, or pre-approved template — hence the single field. The trade-off is
 * that numbers on the DND registry will not receive these messages.
 *
 * NOTE: no send path is wired up yet. Storing a key does not make the app send
 * SMS; the reminder screen still simulates delivery. Sending for real needs a
 * server route that holds the key, because anything reachable from the browser
 * bundle is readable by anyone who opens DevTools.
 */
export interface SmsGatewayConfig {
  enabled: boolean;
  /** Fast2SMS authorization key (Dashboard → Dev API). */
  apiKey: string;
}

export const DEFAULT_SMS_GATEWAY: SmsGatewayConfig = {
  enabled: false,
  apiKey: "",
};

export interface ManualSubscription {
  id: string;
  name: string;
  category: string;
  /** Recurring charge per month, in the active currency. */
  monthlyAmount: number;
  createdAt: string;
}

// ──────────────── STORAGE KEYS ────────────────
export const KEYS = {
  transactions: "transactions",
  budgets: "budgets",
  savingsGoals: "savings_goals",
  loans: "loans",
  ledgerCustomers: "ledger_customers",
  familyGroups: "family_groups",
  familyExpenses: "family_expenses",
  manualSubscriptions: "manual_subscriptions",
  monthlyIncome: "monthly_income",
  moneyRuleSplit: "money_rule_split",
  smsGateway: "sms_gateway",
  customCategories: "custom_categories",
  archivedCategories: "archived_categories",
} as const;

const STORE_EVENT = "datastore:change";

/**
 * Financial/PII keys that are encrypted at rest in localStorage and synced to
 * the cloud. Reads/writes for these go through the in-memory `memCache` (below)
 * so callers stay synchronous while the on-disk copy is always ciphertext.
 */
const SENSITIVE_KEYS: string[] = [
  KEYS.transactions,
  KEYS.budgets,
  KEYS.savingsGoals,
  KEYS.loans,
  KEYS.ledgerCustomers,
  KEYS.familyGroups,
  KEYS.familyExpenses,
  KEYS.manualSubscriptions,
  KEYS.monthlyIncome,
  KEYS.moneyRuleSplit,
  // Holds the user's own SMS gateway credentials — secret, so it must never sit
  // in plaintext on disk.
  KEYS.smsGateway,
  // Categories carry the user's 50/30/20 bucket choices, which the Money Rule
  // computes from. Left unsynced they silently reset on a restore or a new
  // device, and the split reports different numbers with no error shown.
  KEYS.customCategories,
  KEYS.archivedCategories,
];

/**
 * The PIN-derived AES key (in memory only, set by unlockDataStore) and the
 * decrypted working copy of every sensitive key. localStorage holds only the
 * encrypted blobs; the app reads/writes plaintext here, synchronously.
 */
let aesKey: CryptoKey | null = null;
const memCache = new Map<string, unknown>();

/**
 * Keys that hold financial/ledger data (as opposed to auth, preferences, or
 * category config). Used when resetting the app's data without logging out.
 */
const FINANCIAL_KEYS = [
  KEYS.transactions,
  KEYS.budgets,
  KEYS.savingsGoals,
  KEYS.loans,
  KEYS.ledgerCustomers,
  KEYS.familyGroups,
  KEYS.familyExpenses,
  KEYS.manualSubscriptions,
  KEYS.monthlyIncome,
  KEYS.moneyRuleSplit,
  // Sensitive keys listed here only so clearLocalCache purges them from a
  // shared device on sign-out. clearFinancialData skips them via its
  // SYNCED_KEYS guard, so a data reset still keeps categories and credentials —
  // as its doc comment above promises.
  KEYS.smsGateway,
  KEYS.customCategories,
  KEYS.archivedCategories,
  "notifications",
  "mood_logs",
  // Legacy / derived caches that were seeded with fabricated values
  "total_income",
  "total_savings",
  "financial_health_score",
  "weekly_insights",
  "last_catchup_run",
] as const;

/**
 * Wipe all financial/ledger data so the app reflects a clean slate, while
 * keeping the user logged in and their preferences (currency, PIN, categories).
 */
export function clearFinancialData(): void {
  if (typeof window === "undefined") return;

  // 1. Wipe synced keys by writing empty defaults. This triggers pushToFirestore 
  // so the cloud is also wiped, preventing it from restoring deleted data.
  writeJSON(KEYS.transactions, []);
  writeJSON(KEYS.budgets, {});
  writeJSON(KEYS.savingsGoals, []);
  writeJSON(KEYS.loans, []);
  writeJSON(KEYS.ledgerCustomers, []);
  writeJSON(KEYS.familyGroups, []);
  writeJSON(KEYS.familyExpenses, []);
  writeJSON(KEYS.manualSubscriptions, []);
  writeJSON(KEYS.monthlyIncome, 0);
  writeJSON(KEYS.moneyRuleSplit, { needs: 50, wants: 30, investments: 20 });

  // 2. Remove any remaining local-only financial keys
  FINANCIAL_KEYS.forEach((key) => {
    if (!SYNCED_KEYS.includes(key)) {
      localStorage.removeItem(key);
    }
  });

  emitChange();
}

/**
 * Purge the LOCAL cache of financial data on sign-out — WITHOUT touching the
 * user's cloud copy. Unlike clearFinancialData (which writes empty defaults and
 * so wipes Firestore too), this removes localStorage keys directly, so the next
 * person on a shared device sees nothing, while the signed-out user's cloud data
 * is preserved and re-synced on their next login.
 */
export function clearLocalCache(): void {
  if (typeof window === "undefined") return;

  FINANCIAL_KEYS.forEach((key) => localStorage.removeItem(key));
  localStorage.removeItem("user_session");
  // Wake anything subscribed to the session (see useSessionProfile) so the name
  // and photo clear immediately rather than lingering until the next navigation.
  window.dispatchEvent(new Event("moneylens:session-profile"));
  // Forget the decrypted cache + key so nothing sensitive lingers in memory.
  lockDataStore();

  emitChange();
}

// ──────────────── LOW-LEVEL HELPERS ────────────────
function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  // Sensitive keys are served from the decrypted in-memory cache (populated at
  // unlock). Until unlocked, they read as the empty fallback.
  if (SENSITIVE_KEYS.includes(key)) {
    return memCache.has(key) ? (memCache.get(key) as T) : fallback;
  }
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  if (SENSITIVE_KEYS.includes(key)) {
    // Plaintext to memory (synchronous), ciphertext to disk (async), plaintext
    // to the cloud (auth-protected). Never write plaintext to localStorage.
    memCache.set(key, value);
    void persistEncrypted(key, value);
    pushToFirestore(key, value);
    emitChange();
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
  pushToFirestore(key, value);
  emitChange();
}

/** Encrypt a sensitive value and write the ciphertext to localStorage. */
async function persistEncrypted(key: string, value: unknown): Promise<void> {
  if (!aesKey) return; // locked — memCache holds it; unlock will persist it
  try {
    localStorage.setItem(key, await encryptValue(aesKey, value));
  } catch {
    /* storage full / transient — memCache + cloud remain the source of truth */
  }
}

/** Notify all subscribers in the current tab that stored data changed. */
export function emitChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STORE_EVENT));
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

// ──────────────── FIRESTORE SYNC ────────────────
/**
 * Cloud sync layer. localStorage stays the instant, offline-capable local
 * cache; these helpers mirror every write up to Firestore and stream remote
 * changes back down so the same account stays in sync across devices.
 *
 * Design: one document per collection at `users/{uid}/appData/{key}` holding a
 * single `value` field. A whole-collection write is one Firestore write op and
 * load is one read op per key — a personal finance app uses a few ops per day,
 * far under the free Spark plan's 20k writes / 50k reads daily quota.
 */

/**
 * Keys synced to the cloud — the same set that is encrypted locally. The cloud
 * copy is plaintext (protected by Firebase Auth + rules) and acts as the
 * recovery source if the local ciphertext can't be decrypted (e.g. after a PIN
 * reset).
 */
const SYNCED_KEYS: string[] = SENSITIVE_KEYS;

let currentUid: string | null = null;
const detachers: Array<() => void> = [];
/** Keys currently being written from a remote snapshot — skip pushing back. */
const applyingRemote = new Set<string>();

/**
 * Durability tracking so a "saved" is never a lie. Every cloud write is watched
 * to completion:
 *  - `inFlight` holds writes waiting for the server to acknowledge them.
 *  - `failedKeys` holds writes that couldn't reach the cloud (offline, not
 *    signed in yet, or a rejected write) mapped to the latest value to resend.
 * If either is non-empty, the local copy holds data the cloud does NOT, so it
 * must not be wiped on logout without warning the user. See hasUnsyncedWrites.
 */
const inFlight = new Set<Promise<void>>();
const failedKeys = new Map<string, unknown>();

/** True while any local change has not yet been confirmed saved to the cloud. */
export function hasUnsyncedWrites(): boolean {
  return inFlight.size > 0 || failedKeys.size > 0;
}

/** Perform one tracked cloud write, recording success/failure for durability. */
function trackWrite(key: string, value: unknown): Promise<void> {
  let p: Promise<void>;
  p = setDoc(doc(db, "users", currentUid!, "appData", key), { value })
    .then(() => {
      failedKeys.delete(key); // confirmed in the cloud
    })
    .catch((err) => {
      console.error(`[Firestore Sync Error] Failed to write key "${key}":`, err);
      failedKeys.set(key, value); // remember it so we can retry / warn on logout
    })
    .finally(() => {
      inFlight.delete(p);
    });
  inFlight.add(p);
  return p;
}

/** Mirror a local write up to the signed-in user's Firestore document. */
function pushToFirestore(key: string, value: unknown): void {
  if (!SYNCED_KEYS.includes(key)) return; // not a synced key
  if (applyingRemote.has(key)) return; // came FROM the cloud, don't echo back
  // A sensitive key written while the store is LOCKED cannot reflect real data:
  // readJSON serves the empty fallback until unlock, so any read-modify-write
  // before then produces a truncated value. Queuing it would let
  // flushPendingWrites push that emptiness over the cloud copy once the user
  // signs in — which is how a fresh device could wipe an account. Every real
  // write path (Settings purge, backup restore, the entry modals) runs after
  // unlock, so nothing legitimate is dropped here.
  if (SENSITIVE_KEYS.includes(key) && !aesKey) {
    console.warn(`[Firestore Sync] Skipped cloud write for "${key}": store is locked.`);
    return;
  }
  if (!currentUid) {
    // Not signed in yet: this change lives only locally. Remember it as unsynced
    // so logout warns instead of silently discarding it, and retry once we sign in.
    failedKeys.set(key, value);
    return;
  }
  void trackWrite(key, value);
}

/**
 * Push every queued/failed write and wait for all in-flight writes to settle.
 * Returns true when everything is confirmed in the cloud (safe to wipe local),
 * false if something still couldn't be saved (e.g. offline). Call before logout.
 */
export async function flushPendingWrites(): Promise<boolean> {
  if (currentUid) {
    for (const [key, value] of [...failedKeys]) void trackWrite(key, value);
    // New writes may be added while we await, so keep draining until empty.
    while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
  }
  return !hasUnsyncedWrites();
}

// When connectivity returns, retry anything that failed while offline so the
// cloud quietly catches up without the user having to do anything.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    if (currentUid && failedKeys.size > 0) void flushPendingWrites();
  });
}

/** True for `null`/`undefined`, an empty array, or an empty object — i.e. a
 *  value that carries no user data and must never overwrite a populated one. */
function isEmptyValue(value: unknown): boolean {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "object") return Object.keys(value as object).length === 0;
  return false;
}

/** Write a value that arrived from Firestore into the decrypted memory cache
 *  (synchronous reads) and, encrypted, to localStorage (at rest). */
function applyRemote(key: string, value: unknown): void {
  applyingRemote.add(key);
  try {
    memCache.set(key, value);
    void persistEncrypted(key, value);
  } finally {
    applyingRemote.delete(key);
  }
  emitChange();
}

/** Subscribe to every synced key for the given user. Requires the store to be
 *  unlocked first so the decrypted cache (`memCache`) reflects on-disk data. */
function startSync(uid: string): void {
  currentUid = uid;
  for (const key of SYNCED_KEYS) {
    const ref = doc(db, "users", uid, "appData", key);
    detachers.push(
      onSnapshot(ref, (snap) => {
        if (!snap.exists()) {
          // No cloud copy yet — seed it from whatever is already local.
          const local = memCache.get(key);
          if (local != null && !isEmptyValue(local)) {
            void setDoc(ref, { value: local }).catch((err) => {
              console.error(`[Firestore Sync Error] Failed to seed initial local key "${key}":`, err);
            });
          }
          return;
        }

        const remote = snap.data().value;

        // Guard against data loss: never let an empty/stale remote snapshot
        // clobber data the user already has locally. This is what made saves
        // "not stick" — a stale empty cloud doc would overwrite a just-saved
        // budget on the next snapshot. When the cloud is empty but local has
        // data, push local up to reconcile instead of wiping it.
        if (isEmptyValue(remote)) {
          const local = memCache.get(key);
          if (local != null && !isEmptyValue(local)) {
            void setDoc(ref, { value: local }).catch((err) => {
              console.error(`[Firestore Sync Error] Failed to reconcile remote key "${key}":`, err);
            });
            return;
          }
        }

        applyRemote(key, remote);
      })
    );
  }
}

/** Tear down all listeners (called on sign-out). */
function stopSync(): void {
  while (detachers.length) detachers.pop()?.();
  currentUid = null;
}

// Track the signed-in user, but DON'T start cloud sync here: sync (and reading
// the encrypted local data) requires the PIN-derived key, which only exists
// after unlockDataStore runs on the lock screen. Sign-out locks the store.
if (typeof window !== "undefined") {
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUid = user.uid;
      // If the user unlocked before auth resolved, sync couldn't start then —
      // start it now that we have the uid.
      if (aesKey) {
        stopSync();
        startSync(user.uid);
      }
      // Now that we can reach the cloud, push anything written while signed out.
      if (failedKeys.size > 0) void flushPendingWrites();
    } else {
      currentUid = null;
      lockDataStore();
    }
  });
}

/**
 * Session-only PIN cache. The AES key lives in memory and is lost on every page
 * refresh; without re-deriving it the app can't read its own encrypted data and
 * shows an empty screen. We stash the PIN in `sessionStorage` — which survives a
 * refresh but is cleared when the tab/browser closes — so `tryAutoUnlock` can
 * transparently re-derive the key. A fresh session or logout still requires the
 * PIN, keeping a shared device protected.
 */
const SESSION_PIN_KEY = "session_pin";

/** True when the store is unlocked (the encryption key is held in memory). */
export function isUnlocked(): boolean {
  return aesKey !== null;
}

/**
 * Re-unlock automatically after a refresh using the session-cached PIN, so the
 * user doesn't have to retype it and their data doesn't vanish on reload.
 * Returns true if the store is unlocked afterwards.
 */
export async function tryAutoUnlock(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (aesKey) return true; // already unlocked this session
  const pin = sessionStorage.getItem(SESSION_PIN_KEY);
  if (!pin) return false;
  try {
    await unlockDataStore(pin);
  } catch {
    sessionStorage.removeItem(SESSION_PIN_KEY); // stale/invalid — force re-entry
  }
  return isUnlocked();
}

/**
 * Unlock the encrypted local store with the user's PIN. Derives the AES key,
 * loads (and migrates any legacy plaintext) into the in-memory cache, then
 * starts cloud sync. Called by the lock screen after a successful PIN
 * setup/verify/change. Safe to call again (re-derives + re-syncs).
 */
export async function unlockDataStore(pin: string): Promise<void> {
  if (typeof window === "undefined") return;
  aesKey = await deriveKeyFromPin(pin);
  // Remember the PIN for THIS browser session so a refresh can auto-unlock.
  sessionStorage.setItem(SESSION_PIN_KEY, pin);

  for (const key of SENSITIVE_KEYS) {
    const raw = localStorage.getItem(key);
    if (raw == null) continue;
    try {
      if (isEncrypted(raw)) {
        memCache.set(key, await decryptValue(aesKey, raw));
      } else {
        // Legacy plaintext from before encryption existed — adopt it, then
        // rewrite it as ciphertext now that we hold the key.
        const value = JSON.parse(raw);
        memCache.set(key, value);
        localStorage.setItem(key, await encryptValue(aesKey, value));
      }
    } catch {
      // Wrong key or corrupt blob (e.g. after a PIN reset). Drop the local copy;
      // the plaintext cloud copy will repopulate it via startSync below.
      memCache.delete(key);
      localStorage.removeItem(key);
    }
  }

  emitChange();

  if (currentUid) {
    // Capture the uid first: stopSync() clears currentUid, so reading it after
    // would pass null into startSync (→ Firestore doc() crash on a null path).
    const uid = currentUid;
    stopSync();
    startSync(uid);
  }
}

/** Lock the store: forget the key and the decrypted cache, stop cloud sync.
 *  On-disk data stays encrypted. Called on sign-out. */
export function lockDataStore(): void {
  aesKey = null;
  memCache.clear();
  // Forget the cached PIN so this device can't auto-unlock after sign-out.
  if (typeof window !== "undefined") sessionStorage.removeItem(SESSION_PIN_KEY);
  // The local plaintext is gone, so any "unsynced" bookkeeping is moot — either
  // it flushed before we got here, or the user chose to discard it on logout.
  failedKeys.clear();
  inFlight.clear();
  stopSync();
}

// ──────────────── TRANSACTIONS ────────────────
export function getTransactions(): Transaction[] {
  return readJSON<Transaction[]>(KEYS.transactions, []);
}

export function setTransactions(txs: Transaction[]): void {
  writeJSON(KEYS.transactions, txs);
}

/** Create a transaction (id + date auto-filled) and prepend it to the ledger. */
export function addTransaction(
  input: Omit<Transaction, "id" | "date"> & { id?: string; date?: string }
): Transaction {
  const tx: Transaction = {
    id: input.id ?? generateId(),
    date: input.date ?? new Date().toISOString(),
    amount: input.amount,
    type: input.type,
    category: input.category,
    description: input.description,
    ...(input.originalAmount !== undefined && { originalAmount: input.originalAmount }),
    ...(input.discountAmount !== undefined && { discountAmount: input.discountAmount }),
  };
  setTransactions([tx, ...getTransactions()]);
  return tx;
}

export function updateTransaction(id: string, patch: Partial<Transaction>): void {
  setTransactions(getTransactions().map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function deleteTransaction(id: string): void {
  setTransactions(getTransactions().filter((t) => t.id !== id));
}

// ──────────────── SAVINGS GOALS ────────────────
export function getSavingsGoals(): SavingsGoal[] {
  return readJSON<SavingsGoal[]>(KEYS.savingsGoals, []);
}

export function setSavingsGoals(goals: SavingsGoal[]): void {
  writeJSON(KEYS.savingsGoals, goals);
}

// ──────────────── LOANS (EMI TRACKER) ────────────────
export function getLoans(): LoanRecord[] {
  return readJSON<LoanRecord[]>(KEYS.loans, []);
}

export function setLoans(loans: LoanRecord[]): void {
  writeJSON(KEYS.loans, loans);
}

// ──────────────── BUDGETS ────────────────
export function getBudgets(): BudgetMap {
  return readJSON<BudgetMap>(KEYS.budgets, {});
}

export function setBudgets(budgets: BudgetMap): void {
  writeJSON(KEYS.budgets, budgets);
}

// ──────────────── LEDGER (NOTEBOOK) CUSTOMERS ────────────────
export function getLedgerCustomers(): LedgerCustomer[] {
  return readJSON<LedgerCustomer[]>(KEYS.ledgerCustomers, []);
}

export function setLedgerCustomers(customers: LedgerCustomer[]): void {
  writeJSON(KEYS.ledgerCustomers, customers);
}

// ──────────────── FAMILY WALLET ────────────────
export function getFamilyGroups(): FamilyGroup[] {
  return readJSON<FamilyGroup[]>(KEYS.familyGroups, []);
}

export function setFamilyGroups(groups: FamilyGroup[]): void {
  writeJSON(KEYS.familyGroups, groups);
}

export function getFamilyExpenses(): GroupExpense[] {
  return readJSON<GroupExpense[]>(KEYS.familyExpenses, []);
}

export function setFamilyExpenses(expenses: GroupExpense[]): void {
  writeJSON(KEYS.familyExpenses, expenses);
}

/**
 * A group's shared pool balance is the sum of its expense amounts (base INR).
 * Deriving it from the expense list — rather than tracking a standalone number —
 * makes the balance a single source of truth that can never drift from the
 * history every member sees. Invalid/NaN amounts are ignored so one bad record
 * can't poison the total.
 */
export function computeGroupPoolBalance(expenses: GroupExpense[]): number {
  return expenses.reduce(
    (total, exp) => total + (Number.isFinite(exp.amount) ? exp.amount : 0),
    0
  );
}

// ──────────────── MANUAL SUBSCRIPTIONS ────────────────
export function getManualSubscriptions(): ManualSubscription[] {
  return readJSON<ManualSubscription[]>(KEYS.manualSubscriptions, []);
}

export function setManualSubscriptions(subs: ManualSubscription[]): void {
  writeJSON(KEYS.manualSubscriptions, subs);
}

/** Create a manual subscription (id + createdAt auto-filled) and prepend it. */
export function addManualSubscription(
  input: Omit<ManualSubscription, "id" | "createdAt">
): ManualSubscription {
  const sub: ManualSubscription = {
    id: generateId(),
    createdAt: new Date().toISOString(),
    ...input,
  };
  setManualSubscriptions([sub, ...getManualSubscriptions()]);
  return sub;
}

export function deleteManualSubscription(id: string): void {
  setManualSubscriptions(getManualSubscriptions().filter((s) => s.id !== id));
}

// ──────────────── MONTHLY INCOME ────────────────
export function getMonthlyIncome(): number {
  return readJSON<number>(KEYS.monthlyIncome, 0);
}

export function setMonthlyIncome(income: number): void {
  writeJSON(KEYS.monthlyIncome, income);
}

// ──────────────── MONEY RULE SPLIT RATIOS ────────────────
export interface MoneyRuleSplit {
  needs: number;
  wants: number;
  investments: number;
}

export function getMoneyRuleSplit(): MoneyRuleSplit {
  return readJSON<MoneyRuleSplit>(KEYS.moneyRuleSplit, { needs: 50, wants: 30, investments: 20 });
}

export function setMoneyRuleSplit(split: MoneyRuleSplit): void {
  writeJSON(KEYS.moneyRuleSplit, split);
}

export function getSmsGateway(): SmsGatewayConfig {
  const stored = readJSON<Partial<SmsGatewayConfig>>(KEYS.smsGateway, DEFAULT_SMS_GATEWAY);
  // Read each field explicitly rather than spreading: a partial cloud doc can't
  // leave a field undefined, and stale keys from an earlier config shape are
  // dropped instead of riding along.
  return {
    enabled: stored?.enabled ?? DEFAULT_SMS_GATEWAY.enabled,
    apiKey: stored?.apiKey ?? DEFAULT_SMS_GATEWAY.apiKey,
  };
}

export function setSmsGateway(config: SmsGatewayConfig): void {
  writeJSON(KEYS.smsGateway, config);
}

/**
 * Raw stored categories — `[]` means "none stored", which callers read as "use
 * the seed set". Prefer `getStoredCategories`/`getActiveCategories` in
 * core/utils/categories; these exist so that module can reach the store without
 * touching localStorage directly (categories are encrypted and synced).
 */
export function getCustomCategories(): CategoryData[] {
  return readJSON<CategoryData[]>(KEYS.customCategories, []);
}

export function setCustomCategories(categories: CategoryData[]): void {
  writeJSON(KEYS.customCategories, categories);
}

export function getArchivedCategoryIds(): string[] {
  return readJSON<string[]>(KEYS.archivedCategories, []);
}

export function setArchivedCategoryIds(ids: string[]): void {
  writeJSON(KEYS.archivedCategories, ids);
}

// ──────────────── DERIVED SELECTORS ────────────────
const sum = (txs: Transaction[]) => txs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);

export interface Totals {
  income: number;
  expense: number;
  balance: number;
}

/** Lifetime income / expense / net balance computed from real transactions. */
export function getTotals(txs: Transaction[] = getTransactions()): Totals {
  const income = sum(txs.filter((t) => t.type === "income"));
  const expense = sum(txs.filter((t) => t.type === "expense"));
  return { income, expense, balance: income - expense };
}

function inMonth(date: Date, monthOffset = 0): (t: Transaction) => boolean {
  const target = new Date(date.getFullYear(), date.getMonth() + monthOffset, 1);
  const m = target.getMonth();
  const y = target.getFullYear();
  return (t: Transaction) => {
    const d = new Date(t.date);
    return d.getMonth() === m && d.getFullYear() === y;
  };
}

/** Income / expense / balance for a single month (0 = current, -1 = last). */
export function getMonthTotals(
  monthOffset = 0,
  txs: Transaction[] = getTransactions()
): Totals {
  return getTotals(txs.filter(inMonth(new Date(), monthOffset)));
}

export interface CategorySlice {
  name: string;
  value: number;
  percentage: number;
}

/**
 * Spend (or income) grouped by category, sorted high→low, with each slice's
 * share of the total. Optionally restrict to a given month offset.
 */
export function getCategoryBreakdown(
  type: "expense" | "income" = "expense",
  monthOffset: number | null = null,
  txs: Transaction[] = getTransactions()
): CategorySlice[] {
  let filtered = txs.filter((t) => t.type === type);
  if (monthOffset !== null) filtered = filtered.filter(inMonth(new Date(), monthOffset));

  const byCategory = new Map<string, number>();
  for (const t of filtered) {
    byCategory.set(t.category, (byCategory.get(t.category) || 0) + (Number(t.amount) || 0));
  }

  const total = [...byCategory.values()].reduce((a, b) => a + b, 0);
  return [...byCategory.entries()]
    .map(([name, value]) => ({
      name,
      value,
      percentage: total > 0 ? Math.round((value / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export interface DailyBalancePoint {
  day: string;
  Balance: number;
}

/**
 * Running balance over the last `days` days, ending at the current net balance.
 * Returns one point per day labelled with the short weekday.
 */
export function getDailyBalanceTrend(
  days = 7,
  txs: Transaction[] = getTransactions()
): DailyBalancePoint[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Net change per day within the window.
  const windowStart = new Date(startOfToday);
  windowStart.setDate(windowStart.getDate() - (days - 1));

  const dailyNet = new Array(days).fill(0);
  let netInWindow = 0;
  for (const t of txs) {
    const d = new Date(t.date);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const idx = Math.round((dayStart.getTime() - windowStart.getTime()) / 86400000);
    if (idx >= 0 && idx < days) {
      const delta = t.type === "income" ? t.amount : -t.amount;
      dailyNet[idx] += delta;
      netInWindow += delta;
    }
  }

  const currentBalance = getTotals(txs).balance;
  let running = currentBalance - netInWindow; // balance at the start of the window
  const points: DailyBalancePoint[] = [];
  for (let i = 0; i < days; i++) {
    running += dailyNet[i];
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i);
    points.push({ day: formatDate(d, { weekday: "short" }), Balance: running });
  }
  return points;
}

export interface MonthlyTrendPoint {
  month: string;
  Income: number;
  Expense: number;
}

/** Income vs expense per month for the last `months` months (oldest → newest). */
export function getMonthlyTrend(
  months = 6,
  txs: Transaction[] = getTransactions()
): MonthlyTrendPoint[] {
  const now = new Date();
  const points: MonthlyTrendPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const ref = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthTxs = txs.filter(inMonth(now, -i));
    const t = getTotals(monthTxs);
    points.push({
      month: formatDate(ref, { month: "short" }),
      Income: t.income,
      Expense: t.expense,
    });
  }
  return points;
}

/** Savings rate as a percentage: (income − expense) / income. */
export function getSavingsRate(txs: Transaction[] = getTransactions()): number {
  const { income, expense } = getTotals(txs);
  if (income <= 0) return 0;
  return Math.round(((income - expense) / income) * 1000) / 10;
}

/** Total amount accumulated across all savings goals. */
export function getTotalSaved(goals: SavingsGoal[] = getSavingsGoals()): number {
  return goals.reduce((acc, g) => acc + (Number(g.current) || 0), 0);
}

/**
 * Outstanding debt across all loans — what would settle them today.
 *
 * Previously this looked for `outstanding` / `balance` / `amount` fields that
 * LoanRecord does not have, so it always fell through to `principal`: the
 * reported debt never moved no matter how many EMIs had been paid, and the
 * health score inherited that. It is now derived from the amortization schedule,
 * so it falls as `monthsPaid` rises and reaches 0 when the loan closes.
 */
export function getTotalDebt(): number {
  return getLoans().reduce((acc, loan) => {
    const owed = calcOutstandingPrincipal({
      principal: Number(loan.principal) || 0,
      annualInterestRate: Number(loan.annualInterestRate) || 0,
      tenureMonths: Number(loan.tenureMonths) || 0,
      monthsPaid: Number(loan.monthsPaid) || 0,
    });
    return acc + (Number.isFinite(owed) ? owed : 0);
  }, 0);
}

// ──────────────── REACT HOOKS ────────────────
/**
 * Subscribe to the transactions ledger. Re-renders whenever data changes in
 * this tab (via `datastore:change`) or another tab (via `storage`).
 */
export function useTransactions(): Transaction[] {
  const [txs, setTxs] = useState<Transaction[]>([]);
  useEffect(() => {
    const sync = () => setTxs(getTransactions());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return txs;
}

/** Subscribe to the budgets store. Re-renders whenever budgets change. */
export function useBudgets(): BudgetMap {
  const [budgets, setBudgetsState] = useState<BudgetMap>({});
  useEffect(() => {
    const sync = () => setBudgetsState(getBudgets());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return budgets;
}

/** Subscribe to the notebook ledger customers store. */
export function useLedgerCustomers(): LedgerCustomer[] {
  const [customers, setCustomers] = useState<LedgerCustomer[]>([]);
  useEffect(() => {
    const sync = () => setCustomers(getLedgerCustomers());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return customers;
}

/** Subscribe to the loans (EMI tracker) store. */
export function useLoans(): LoanRecord[] {
  const [loans, setLoansState] = useState<LoanRecord[]>([]);
  useEffect(() => {
    const sync = () => setLoansState(getLoans());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return loans;
}

/** Subscribe to the savings goals store. */
export function useSavingsGoals(): SavingsGoal[] {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  useEffect(() => {
    const sync = () => setGoals(getSavingsGoals());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return goals;
}

/** Subscribe to the family groups store. */
export function useFamilyGroups(): FamilyGroup[] {
  const [groups, setGroups] = useState<FamilyGroup[]>([]);
  useEffect(() => {
    const sync = () => setGroups(getFamilyGroups());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return groups;
}

/** Subscribe to the manual subscriptions store. */
export function useManualSubscriptions(): ManualSubscription[] {
  const [subs, setSubs] = useState<ManualSubscription[]>([]);
  useEffect(() => {
    const sync = () => setSubs(getManualSubscriptions());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return subs;
}

/** Subscribe to the monthly income. */
export function useMonthlyIncome(): number {
  const [income, setIncomeState] = useState<number>(0);
  useEffect(() => {
    const sync = () => setIncomeState(getMonthlyIncome());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return income;
}

/** Subscribe to custom budget splitting ratios. */
export function useMoneyRuleSplit(): MoneyRuleSplit {
  const [split, setSplitState] = useState<MoneyRuleSplit>({ needs: 50, wants: 30, investments: 20 });
  useEffect(() => {
    const sync = () => setSplitState(getMoneyRuleSplit());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return split;
}

/**
 * Subscribe to the SMS gateway config.
 *
 * Must be a subscription, not a one-shot read: on a fresh device there is no
 * local ciphertext to decrypt at unlock, so the config reads as empty until the
 * Firestore snapshot lands and fires STORE_EVENT. A caller that read once on
 * mount would hold that empty config and write it back over the real key.
 *
 * Returns `null` while locked so callers can tell "not loaded yet" from a
 * config that has loaded and is genuinely empty.
 */
export function useSmsGateway(): SmsGatewayConfig | null {
  const [config, setConfig] = useState<SmsGatewayConfig | null>(null);
  useEffect(() => {
    const sync = () => setConfig(isUnlocked() ? getSmsGateway() : null);
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return config;
}

/** Subscribe to the family expenses store. */
export function useFamilyExpenses(): GroupExpense[] {
  const [expenses, setExpenses] = useState<GroupExpense[]>([]);
  useEffect(() => {
    const sync = () => setExpenses(getFamilyExpenses());
    sync();
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return expenses;
}

// ──────────────── CLOUD BACKUP & RESTORE ────────────────

/**
 * The empty value for a synced key, used when a backup predates that key.
 *
 * Every synced key must be listed here if its shape is not an array: a missing
 * case silently restores the key as `[]`, which would overwrite an object-shaped
 * config with garbage.
 */
function defaultForKey(key: string): unknown {
  switch (key) {
    case KEYS.budgets:
      return {};
    case KEYS.moneyRuleSplit:
      return { needs: 50, wants: 30, investments: 20 };
    case KEYS.monthlyIncome:
      return 0;
    case KEYS.smsGateway:
      return DEFAULT_SMS_GATEWAY;
    default:
      return [];
  }
}

export interface BackupRecord {
  id: string;
  createdAt: string;
  label: string;
  data: Record<string, unknown>;
}

/** Check if the user is authenticated (exposed for conditional UI) */
export function getCurrentUid(): string | null {
  return currentUid;
}

/** Create a timestamped backup snapshot in the cloud */
export async function createCloudBackup(label?: string): Promise<string> {
  if (!currentUid) {
    throw new Error("User must be signed in to create cloud backups.");
  }
  
  const backupId = `backup_${Date.now()}`;
  const backupRef = doc(db, "users", currentUid, "backups", backupId);
  
  const backupData: Record<string, unknown> = {};
  for (const key of SYNCED_KEYS) {
    // Read the decrypted value from the in-memory cache (localStorage holds
    // ciphertext). The backup doc, like appData, is plaintext in the cloud.
    const val = memCache.get(key);
    backupData[key] = val !== undefined ? val : defaultForKey(key);
  }
  
  const backupRecord = {
    id: backupId,
    createdAt: new Date().toISOString(),
    label: label || `Backup (${new Date().toLocaleString()})`,
    data: backupData
  };
  
  await setDoc(backupRef, backupRecord);
  return backupId;
}

/** List all available backups from Firestore */
export async function listCloudBackups(): Promise<BackupRecord[]> {
  if (!currentUid) {
    return [];
  }
  
  const backupsColl = collection(db, "users", currentUid, "backups");
  const q = query(backupsColl, orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  
  const list: BackupRecord[] = [];
  snap.forEach((d) => {
    const data = d.data();
    list.push({
      id: d.id,
      createdAt: data.createdAt || "",
      label: data.label || "Untitled Backup",
      data: data.data || {}
    });
  });
  
  return list;
}

/** Delete a backup document from Firestore */
export async function deleteCloudBackup(backupId: string): Promise<void> {
  if (!currentUid) {
    throw new Error("User must be signed in to delete cloud backups.");
  }
  
  const docRef = doc(db, "users", currentUid, "backups", backupId);
  await deleteDoc(docRef);
}

/** Restore a backup by writing it locally and syncing active firestore docs */
export async function restoreCloudBackup(backupId: string): Promise<void> {
  if (!currentUid) {
    throw new Error("User must be signed in to restore cloud backups.");
  }
  
  const backupDocRef = doc(db, "users", currentUid, "backups", backupId);
  const backupSnap = await getDoc(backupDocRef);
  
  if (!backupSnap.exists()) {
    throw new Error("Backup document not found.");
  }
  
  const backup = backupSnap.data() as BackupRecord;
  const backupData = backup.data || {};
  
  // Overwrite the decrypted cache + encrypted localStorage + cloud. writeJSON
  // handles all three (memCache, ciphertext to disk, plaintext to Firestore).
  for (const key of SYNCED_KEYS) {
    const val = backupData[key] !== undefined ? backupData[key] : defaultForKey(key);
    writeJSON(key, val);
  }

  emitChange();
}
