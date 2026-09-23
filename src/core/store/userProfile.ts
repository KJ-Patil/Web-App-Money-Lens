"use client";

/**
 * Cloud-backed user profile (display name + avatar).
 *
 * The local `user_session` key is only a cache: signing out deliberately wipes
 * it (see `clearLocalCache` in dataStore) so nothing personal is left behind on
 * a shared device. The durable copy therefore lives in the user's own Firestore
 * document, `users/{uid}`, which firestore.rules restricts to that same signed-in
 * user. Signing back in rehydrates the session from it.
 *
 * This module deliberately does NOT go through dataStore: dataStore's keys are
 * PIN-encrypted and only readable after the lock screen, whereas the profile has
 * to be resolved *before* the lock screen in order to greet the user.
 *
 * The uid is always taken from `auth.currentUser` and never from a caller, a URL
 * or localStorage, so a client-side tamper cannot aim a read or write at another
 * account (the security rules would reject it anyway — this is the second lock).
 */

import { useSyncExternalStore } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { auth, db } from "@/config/firebase";
import { sanitizeAvatarUrl, sanitizeDisplayName } from "@/core/utils/avatar";

export interface UserProfile {
  name: string;
  /** `null` means "explicitly removed" — distinct from "never set". */
  avatarUrl: string | null;
}

/** What gets cached in localStorage under `user_session`. */
export interface SessionProfile extends UserProfile {
  email: string | null;
}

// ──────────────── LOCAL SESSION: A SUBSCRIBED STORE ────────────────
// Screens used to read `user_session` once, in a mount-time effect or a
// useState initializer, and never look again. Anything that changed the profile
// after that read — an edit on the Settings page, the rehydrate that runs at
// login — stayed invisible until a full page reload. Reading it through a
// subscription instead means every screen re-renders the moment it changes.

const SESSION_KEY = "user_session";
/** Same-tab change signal; the `storage` event only fires in *other* tabs. */
const SESSION_EVENT = "moneylens:session-profile";

/** Stable empty snapshot — must be a constant so React sees an unchanged ref. */
const EMPTY_SESSION: SessionProfile = { email: null, name: "", avatarUrl: null };

// useSyncExternalStore calls getSnapshot on every render and compares by
// reference, so a fresh object each time would loop forever. Cache the parsed
// result and reuse it until the raw string actually changes.
let cachedRaw: string | null = null;
let cachedSession: SessionProfile = EMPTY_SESSION;

/**
 * The cached session, validated on the way out. It lives in localStorage, so it
 * is parsed as untrusted input even though this app is what wrote it.
 */
export function readSessionProfile(): SessionProfile {
  if (typeof window === "undefined") return EMPTY_SESSION;

  const raw = localStorage.getItem(SESSION_KEY);
  if (raw === cachedRaw) return cachedSession;
  cachedRaw = raw;

  if (!raw) {
    cachedSession = EMPTY_SESSION;
    return cachedSession;
  }

  try {
    const parsed = JSON.parse(raw);
    cachedSession = {
      email: typeof parsed.email === "string" ? parsed.email : null,
      name: sanitizeDisplayName(parsed.name),
      avatarUrl: sanitizeAvatarUrl(parsed.avatarUrl),
    };
  } catch {
    cachedSession = EMPTY_SESSION;
  }
  return cachedSession;
}

/** Write the session cache and wake every subscriber in this tab. */
export function writeSessionProfile(session: SessionProfile): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    SESSION_KEY,
    JSON.stringify({
      email: session.email,
      name: sanitizeDisplayName(session.name),
      avatarUrl: sanitizeAvatarUrl(session.avatarUrl),
    })
  );
  // Invalidate before notifying so subscribers read the new value, not the cache.
  cachedRaw = null;
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function subscribeSessionProfile(onChange: () => void): () => void {
  // `storage` covers other tabs (including a sign-out elsewhere); the custom
  // event covers this one.
  window.addEventListener(SESSION_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(SESSION_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function getServerSessionProfile(): SessionProfile {
  return EMPTY_SESSION;
}

/**
 * Live view of the signed-in user's name, email and photo. Re-renders whenever
 * the profile changes — in this tab or another — so an edit shows up everywhere
 * immediately instead of after a reload.
 */
export function useSessionProfile(): SessionProfile {
  return useSyncExternalStore(
    subscribeSessionProfile,
    readSessionProfile,
    getServerSessionProfile
  );
}

/**
 * Persist the profile to `users/{uid}`. Merges, so it never clobbers the other
 * fields on that document (uid/email/createdAt written at registration).
 * Returns false if there is no signed-in user or the write failed — callers keep
 * their local copy either way, so a cloud failure degrades instead of losing the
 * edit.
 */
export async function saveUserProfile(profile: UserProfile): Promise<boolean> {
  const user = auth.currentUser;
  if (!user) return false;

  try {
    await setDoc(
      doc(db, "users", user.uid),
      {
        name: sanitizeDisplayName(profile.name),
        // Store null rather than omitting the field: "photo removed" must be
        // durable, otherwise the provider photo would be re-seeded at next login.
        avatarUrl: sanitizeAvatarUrl(profile.avatarUrl),
        profileUpdatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch {
    // Never surface the raw Firestore error — it can carry document paths.
    return false;
  }
}

/**
 * Read the saved profile for the signed-in user. Returns null when there is no
 * user, no document, or the read failed (offline) — callers then fall back to
 * the identity provider's values. Fields are re-validated on the way in: the
 * document is user-writable, so it is treated as untrusted input.
 */
export async function fetchUserProfile(): Promise<Partial<UserProfile> | null> {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return null;

    const data = snap.data();
    const result: Partial<UserProfile> = {};

    const name = sanitizeDisplayName(data.name);
    if (name) result.name = name;

    // Preserve the three-way distinction: a stored null means the user removed
    // their photo and must not be overridden by the provider's photo.
    if ("avatarUrl" in data) result.avatarUrl = sanitizeAvatarUrl(data.avatarUrl);

    return result;
  } catch {
    return null;
  }
}

/**
 * Build the session to cache locally after a successful sign-in: the saved
 * profile wins, then whatever the identity provider knows, then `fallbackName`
 * (e.g. the email local-part). Always resolves — a failed profile read must
 * never block login.
 */
export async function resolveSessionProfile(
  user: User,
  fallbackName: string
): Promise<SessionProfile> {
  const saved = await fetchUserProfile();

  return {
    email: user.email,
    name:
      saved?.name ||
      sanitizeDisplayName(user.displayName) ||
      sanitizeDisplayName(fallbackName) ||
      "Guest",
    avatarUrl:
      // `undefined` = never saved, so fall back to the provider photo.
      // `null` = deliberately removed, so keep it null.
      saved?.avatarUrl !== undefined
        ? saved.avatarUrl
        : sanitizeAvatarUrl(user.photoURL),
  };
}
