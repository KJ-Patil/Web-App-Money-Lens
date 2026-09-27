"use client";

import React, { useState, useEffect } from "react";
import { Lock, ShieldCheck, AlertCircle, ArrowLeft, Mail, Eye, EyeOff, Info } from "lucide-react";
import { auth } from "@/config/firebase";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { clearLocalCache, unlockDataStore, flushPendingWrites, hasUnsyncedWrites } from "@/core/store/dataStore";
import { useTranslation } from "@/i18n/i18nContext";

/**
 * PIN hashing. A raw SHA-256 of a 4–6 digit PIN is instantly reversible — the
 * whole keyspace (≤1M) can be hashed in milliseconds. Instead we derive the
 * stored hash with PBKDF2-HMAC-SHA256 using a per-PIN random salt and many
 * iterations, so each brute-force guess is deliberately expensive and two users
 * with the same PIN never share a hash.
 *
 * Stored format: `v2$<iterations>$<saltHex>$<hashHex>`. Legacy unsalted hashes
 * (bare hex, no `v2$` prefix) are still accepted on verify and transparently
 * upgraded to this format the next time the correct PIN is entered.
 */
const PIN_ITERATIONS = 200_000;
const enc = new TextEncoder();

const toHex = (buf: ArrayBuffer | Uint8Array): string =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const fromHex = (hex: string): Uint8Array<ArrayBuffer> => {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};

/** Slow, salted PBKDF2-HMAC-SHA256 derivation → hex. */
async function pbkdf2(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return toHex(bits);
}

/** Build a storable, salted PIN record for a fresh PIN. */
async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pin, salt, PIN_ITERATIONS);
  return `v2$${PIN_ITERATIONS}$${toHex(salt)}$${hash}`;
}

/** Legacy unsalted SHA-256, kept only to verify & upgrade pre-existing PINs. */
async function legacySha256(pin: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", enc.encode(pin)));
}

/** True if `pin` matches a stored record (new salted format or legacy hash). */
async function pinMatches(pin: string, stored: string): Promise<boolean> {
  if (stored.startsWith("v2$")) {
    const [, iter, saltHex, expected] = stored.split("$");
    return (await pbkdf2(pin, fromHex(saltHex), Number(iter) || PIN_ITERATIONS)) === expected;
  }
  return (await legacySha256(pin)) === stored;
}

/** A PIN is 4–6 digits. */
const isValidPin = (p: string) => /^\d{4,6}$/.test(p);

/**
 * The lock screen supports four flows, all built from labelled PIN fields:
 *  - setup:  no PIN yet          → New PIN + Confirm
 *  - verify: unlock on return    → single PIN
 *  - change: change an existing  → Old PIN + New PIN + Confirm  (Settings ▸ Reset PIN)
 *  - forgot: recover a lost PIN  → email, then New PIN + Confirm
 *
 * The PIN is device-local (a salted PBKDF2 hash in localStorage); the "forgot" email
 * check is validated against the REAL signed-in Firebase user's email — never a
 * hardcoded value — so only the account owner can reset it.
 */
type Mode = "setup" | "verify" | "change" | "forgot";

/** A single labelled PIN input with a show/hide toggle. */
function PinField({
  id,
  label,
  placeholder,
  value,
  onChange,
  autoFocus,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-1 text-left">
      <label htmlFor={id} className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={6}
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
          className="input-base pr-10 w-full tracking-widest"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute inset-y-0 right-0 pr-3 flex items-center text-icon-muted hover:text-icon-active"
          tabIndex={-1}
          aria-label={show ? "Hide PIN" : "Show PIN"}
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

export default function PinLockPage() {
  const { t } = useTranslation();

  const [mode, setMode] = useState<Mode>("verify");
  const [forgotVerified, setForgotVerified] = useState(false);
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [verifyPin, setVerifyPin] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Decide the initial flow from the stored PIN + an optional ?action=change
  // intent passed by Settings ▸ Reset Application PIN.
  useEffect(() => {
    const storedHash = localStorage.getItem("pin_hash");
    const action = new URLSearchParams(window.location.search).get("action");
    if (!storedHash) setMode("setup");
    else if (action === "change") setMode("change");
    else setMode("verify");
  }, []);

  // Capture the signed-in user's email so the forgot-PIN flow can verify the
  // owner without any hardcoded address.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setAccountEmail(u?.email ?? null));
    return unsub;
  }, []);

  const goHome = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => {
      window.location.href = "/home";
    }, 800);
  };

  const saveNewPin = async (pin: string, msg: string) => {
    localStorage.setItem("pin_hash", await hashPin(pin));
    // Derive the encryption key from this PIN and load/migrate the local data.
    await unlockDataStore(pin);
    goHome(msg);
  };

  /** Shared validation for the New + Confirm pair. Returns true if OK. */
  const newPairValid = (): boolean => {
    if (!isValidPin(newPin)) {
      setError(t("pinLock.errPinLength"));
      return false;
    }
    if (newPin !== confirmPin) {
      setError(t("pinLock.errPinsNoMatch"));
      return false;
    }
    return true;
  };

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPairValid()) await saveNewPin(newPin, t("pinLock.successSet"));
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const stored = localStorage.getItem("pin_hash");
    if (stored && (await pinMatches(verifyPin, stored))) {
      // Transparently upgrade a legacy unsalted hash to the salted format.
      if (!stored.startsWith("v2$")) {
        localStorage.setItem("pin_hash", await hashPin(verifyPin));
      }
      // Decrypt the local data into memory for this session.
      await unlockDataStore(verifyPin);
      goHome(t("pinLock.successGranted"));
    } else {
      setError(t("pinLock.errInvalidPin"));
      setVerifyPin("");
    }
  };

  const handleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const stored = localStorage.getItem("pin_hash");
    if (!stored || !(await pinMatches(oldPin, stored))) {
      setError(t("pinLock.errIncorrectOld"));
      return;
    }
    // saveNewPin writes the new PIN in the salted v2 format, upgrading any legacy hash.
    if (newPairValid()) await saveNewPin(newPin, t("pinLock.successReset"));
  };

  const handleForgotEmail = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!accountEmail) {
      setError(t("pinLock.errNoEmail"));
      return;
    }
    if (emailInput.trim().toLowerCase() === accountEmail.toLowerCase()) {
      setForgotVerified(true);
    } else {
      setError(t("pinLock.errEmailNoMatch"));
    }
  };

  const handleForgotReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (newPairValid()) await saveNewPin(newPin, t("pinLock.successReset"));
  };

  const startForgot = () => {
    setError("");
    setSuccess("");
    setOldPin("");
    setNewPin("");
    setConfirmPin("");
    setEmailInput("");
    setForgotVerified(false);
    setMode("forgot");
  };

  const handleSwitchAccount = async () => {
    // Don't discard local data that never reached the cloud (see handleLogout).
    const allSaved = await flushPendingWrites();
    if (!allSaved && hasUnsyncedWrites()) {
      const proceed = window.confirm(
        "Some changes haven't been saved to the cloud yet (you may be offline). " +
          "If you switch accounts now they will be lost. Continue anyway?"
      );
      if (!proceed) return;
    }
    try {
      await signOut(auth);
    } catch {
      /* offline — still clear locally and leave */
    }
    clearLocalCache();
    window.location.href = "/login";
  };

  // Title + subtitle for the current flow.
  const heading = (): { title: string; subtitle: string } => {
    if (mode === "setup") return { title: t("pinLock.setTitle"), subtitle: t("pinLock.setSubtitle") };
    if (mode === "verify") return { title: t("pinLock.enterTitle"), subtitle: t("pinLock.enterSubtitle") };
    if (mode === "change") return { title: t("pinLock.changeTitle"), subtitle: t("pinLock.changeSubtitle") };
    // forgot
    return forgotVerified
      ? { title: t("pinLock.setNewTitle"), subtitle: t("pinLock.setNewSubtitle") }
      : { title: t("pinLock.forgotTitle"), subtitle: t("pinLock.forgotSubtitle") };
  };

  const { title, subtitle } = heading();
  const showForgotLink = mode === "verify" || mode === "change";
  const showHint = mode !== "verify" && !(mode === "forgot" && !forgotVerified);

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-8 bg-background-subtle">
      <div className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-sm p-8 flex flex-col items-center text-center space-y-6">

        {/* Icon */}
        <div
          className={`flex items-center justify-center w-16 h-16 rounded-2xl border shadow-sm transition-all duration-300 ${
            success ? "bg-success-light text-success border-success" : "bg-primary-lighter text-primary border-transparent"
          }`}
        >
          {success ? <ShieldCheck className="w-8 h-8 animate-pulse" /> : <Lock className="w-8 h-8" />}
        </div>

        {/* Title + subtitle */}
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight">{title}</h1>
          <p className="text-sm font-medium text-foreground-muted">{subtitle}</p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="flex items-center gap-2 p-3 w-full text-xs rounded-xl bg-error-light text-error font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 w-full text-xs rounded-xl bg-success-light text-success font-medium">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ─── Forms per flow ─── */}
        {mode === "verify" && (
          <form onSubmit={handleVerify} className="w-full space-y-4">
            <PinField
              id="verify-pin"
              label={t("pinLock.pinFieldLabel")}
              placeholder={t("pinLock.enterPinPlaceholder")}
              value={verifyPin}
              onChange={setVerifyPin}
              autoFocus
            />
            <button type="submit" className="btn-primary w-full">{t("pinLock.unlockBtn")}</button>
          </form>
        )}

        {mode === "setup" && (
          <form onSubmit={handleSetup} className="w-full space-y-4">
            <PinField id="new-pin" label={t("pinLock.newPinLabel")} placeholder={t("pinLock.newPinPlaceholder")} value={newPin} onChange={setNewPin} autoFocus />
            <PinField id="confirm-pin" label={t("pinLock.confirmPinLabel")} placeholder={t("pinLock.confirmPinPlaceholder")} value={confirmPin} onChange={setConfirmPin} />
            {showHint && <Hint text={t("pinLock.hint")} />}
            <button type="submit" className="btn-primary w-full">{t("pinLock.setBtn")}</button>
          </form>
        )}

        {mode === "change" && (
          <form onSubmit={handleChange} className="w-full space-y-4">
            <PinField id="old-pin" label={t("pinLock.oldPinLabel")} placeholder={t("pinLock.oldPinPlaceholder")} value={oldPin} onChange={setOldPin} autoFocus />
            <PinField id="new-pin" label={t("pinLock.newPinLabel")} placeholder={t("pinLock.newPinPlaceholder")} value={newPin} onChange={setNewPin} />
            <PinField id="confirm-pin" label={t("pinLock.confirmPinLabel")} placeholder={t("pinLock.confirmPinPlaceholder")} value={confirmPin} onChange={setConfirmPin} />
            {showHint && <Hint text={t("pinLock.hint")} />}
            <button type="submit" className="btn-primary w-full">{t("pinLock.updateBtn")}</button>
          </form>
        )}

        {mode === "forgot" && !forgotVerified && (
          <form onSubmit={handleForgotEmail} className="w-full space-y-4">
            <div className="space-y-1 text-left">
              <label htmlFor="pin-email" className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                {t("pinLock.emailLabel")}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="pin-email"
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="input-base pl-10 w-full"
                  placeholder={t("pinLock.emailPlaceholder")}
                  required
                  autoFocus
                />
              </div>
            </div>
            <button type="submit" className="btn-primary w-full">{t("pinLock.continueBtn")}</button>
          </form>
        )}

        {mode === "forgot" && forgotVerified && (
          <form onSubmit={handleForgotReset} className="w-full space-y-4">
            <PinField id="new-pin" label={t("pinLock.newPinLabel")} placeholder={t("pinLock.newPinPlaceholder")} value={newPin} onChange={setNewPin} autoFocus />
            <PinField id="confirm-pin" label={t("pinLock.confirmPinLabel")} placeholder={t("pinLock.confirmPinPlaceholder")} value={confirmPin} onChange={setConfirmPin} />
            <Hint text={t("pinLock.hint")} />
            <button type="submit" className="btn-primary w-full">{t("pinLock.resetBtn")}</button>
          </form>
        )}

        {/* Footer actions */}
        <div className="flex flex-col items-center gap-3">
          {showForgotLink && (
            <button
              type="button"
              onClick={startForgot}
              className="text-sm font-bold text-link hover:text-link-hover transition-colors cursor-pointer"
            >
              {t("pinLock.forgotLink")}
            </button>
          )}

          {mode === "forgot" ? (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-foreground-muted hover:text-foreground transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              {t("pinLock.backBtn")}
            </button>
          ) : (
            mode === "verify" && (
              <button
                type="button"
                onClick={handleSwitchAccount}
                className="text-xs font-bold uppercase tracking-wider text-foreground-muted hover:text-primary transition-colors cursor-pointer"
              >
                {t("pinLock.switchAccount")}
              </button>
            )
          )}
        </div>
      </div>
    </main>
  );
}

/** Info pill used under the PIN fields. */
function Hint({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 p-3 w-full text-xs rounded-xl bg-secondary text-foreground-secondary font-medium">
      <Info className="w-4 h-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
