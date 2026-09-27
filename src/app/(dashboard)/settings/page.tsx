"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { User, Lock, Globe, Languages, Trash2, ArrowRight, ShieldAlert, LogOut, CheckCircle2, Layers, Info, HelpCircle, Database, CloudUpload, Clock, RotateCcw, RefreshCw, MessageSquare, Pencil } from "lucide-react";
import { toast } from "sonner";
import CurrencyPickerSheet from "@/components/modals/CurrencyPickerSheet";
import LanguagePickerSheet from "@/components/modals/LanguagePickerSheet";
import EditProfileModal from "@/components/modals/EditProfileModal";
import ProfilePhotoViewerModal from "@/components/modals/ProfilePhotoViewerModal";
import { auth } from "@/config/firebase";
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import {
  clearFinancialData,
  createCloudBackup,
  listCloudBackups,
  deleteCloudBackup,
  restoreCloudBackup,
  getCurrentUid,
  BackupRecord
} from "@/core/store/dataStore";
import {
  readSessionProfile,
  saveUserProfile,
  useSessionProfile,
  writeSessionProfile,
} from "@/core/store/userProfile";
import { sanitizeAvatarUrl, sanitizeDisplayName } from "@/core/utils/avatar";
import { getLanguage } from "@/core/utils/languages";
import { useTranslation } from "@/i18n/i18nContext";

export default function SettingsPage() {
  const [activeCurrency, setActiveCurrency] = useState("INR");
  const [isCurrencySheetOpen, setIsCurrencySheetOpen] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState("en");
  const [isLanguageSheetOpen, setIsLanguageSheetOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  // Stages: 0 = confirm, 1 = final confirm, 2 = done, 3 = email verification
  const [clearStage, setClearStage] = useState<0 | 1 | 2 | 3>(0);

  // Live view of the signed-in profile. Subscribed rather than copied into local
  // state at mount, so an edit (or the rehydrate that runs at login) is reflected
  // straight away instead of only after a page reload.
  const session = useSessionProfile();
  const userName = session.name || "Guest";
  const userEmail = session.email ?? "";
  const userAvatar = session.avatarUrl;
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const [isPhotoViewerOpen, setIsPhotoViewerOpen] = useState(false);

  // Identity re-verification for the destructive wipe — real Firebase
  // re-authentication (no fake on-screen code, no email backend needed).
  const [emailVerifyEnabled, setEmailVerifyEnabled] = useState(false);
  const [reauthPassword, setReauthPassword] = useState("");
  const [reauthMethod, setReauthMethod] = useState<"password" | "google" | "unsupported">("password");
  const [reauthLoading, setReauthLoading] = useState(false);
  const [codeError, setCodeError] = useState("");
  const [fbUser, setFbUser] = useState<FirebaseUser | null>(null);

  const { t } = useTranslation();

  // Backup & Recovery state
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [backupActionLoading, setBackupActionLoading] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<BackupRecord | null>(null);
  const [backupModalType, setBackupModalType] = useState<"restore" | "delete" | null>(null);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const uid = getCurrentUid();

  const loadBackups = async () => {
    setLoadingBackups(true);
    try {
      const list = await listCloudBackups();
      setBackups(list);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingBackups(false);
    }
  };

  useEffect(() => {
    if (uid) {
      loadBackups();
    }
  }, [uid]);

  // Track the Firebase user so we know which re-auth method to offer.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setFbUser(u));
    return () => unsub();
  }, []);

  const handleCreateBackup = async () => {
    setBackupActionLoading(true);
    setActionMessage(null);
    try {
      await createCloudBackup();
      await loadBackups();
      setActionMessage({ text: t("settings.backupSuccess"), type: "success" });
    } catch (err) {
      console.error(err);
      setActionMessage({ text: t("settings.backupFailed"), type: "error" });
    } finally {
      setBackupActionLoading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedBackup) return;
    setBackupActionLoading(true);
    setActionMessage(null);
    setBackupModalType(null);
    try {
      await restoreCloudBackup(selectedBackup.id);
      setActionMessage({ text: t("settings.restoreSuccess"), type: "success" });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err) {
      console.error(err);
      setActionMessage({ text: "Failed to restore backup.", type: "error" });
      setBackupActionLoading(false);
    }
  };

  const handleDeleteBackup = async () => {
    if (!selectedBackup) return;
    setBackupActionLoading(true);
    setActionMessage(null);
    setBackupModalType(null);
    try {
      await deleteCloudBackup(selectedBackup.id);
      await loadBackups();
      setActionMessage({ text: t("settings.deleteBackupSuccess"), type: "success" });
    } catch (err) {
      console.error(err);
      setActionMessage({ text: "Failed to delete backup.", type: "error" });
    } finally {
      setBackupActionLoading(false);
      setTimeout(() => setActionMessage(null), 4000);
    }
  };

  const formatBackupDate = (isoStr: string) => {
    try {
      const d = new Date(isoStr);
      return d.toLocaleString(activeLanguage === "hi" ? "hi-IN" : "en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    } catch {
      return isoStr;
    }
  };

  // Mask the email like r****a@example.com for display
  const maskEmail = (email: string) => {
    const [name, domain] = email.split("@");
    if (!domain || name.length < 2) return email;
    return `${name[0]}${"*".repeat(Math.max(1, name.length - 2))}${name[name.length - 1]}@${domain}`;
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cur = localStorage.getItem("active_currency");
      if (cur) setActiveCurrency(cur);

      const lang = localStorage.getItem("active_language");
      if (lang) setActiveLanguage(lang);
      // The profile is not loaded here — `useSessionProfile` subscribes to it.
    }
  }, []);

  const handleCurrencySelect = (code: string) => {
    setActiveCurrency(code);
    setIsCurrencySheetOpen(false);
  };

  const handleLanguageSelect = (code: string) => {
    setActiveLanguage(code);
    setIsLanguageSheetOpen(false);
  };

  // Reset the local app PIN: open the lock screen in "change" mode, which asks
  // for the current PIN before letting the user set a new one (Old → New →
  // Confirm). If no PIN exists yet, the lock screen falls back to first-time
  // setup. The PIN is device-local (localStorage), so this never touches
  // Firebase or the user's cloud data.
  const resetPin = () => {
    window.location.href = "/pin-lock?action=change";
  };

  /**
   * Write the profile to all three places it needs to live:
   *
   *  1. React state — instant feedback.
   *  2. `user_session` in localStorage — the fast local cache every screen reads.
   *  3. The user's Firestore document — the only durable copy. Signing out wipes
   *     localStorage on purpose (shared devices), so without step 3 the name and
   *     photo would be gone at the next login.
   *
   * The name is mirrored to Firebase Auth too so it follows the account into
   * anything that reads `displayName`; the photo is not, because Auth's
   * `photoURL` cannot hold a data URL.
   */
  const persistProfile = async (name: string, avatar: string | null) => {
    const safeName = sanitizeDisplayName(name);
    const safeAvatar = sanitizeAvatarUrl(avatar);

    // Updating the session cache re-renders every subscriber, this page included
    // — no separate copy in local state to keep in sync.
    writeSessionProfile({
      email: readSessionProfile().email,
      name: safeName,
      avatarUrl: safeAvatar,
    });

    const user = auth.currentUser ?? fbUser;
    if (user) {
      // Best-effort: a failed Auth sync must not lose the edit.
      void updateProfile(user, { displayName: safeName }).catch(() => {});
    }

    return saveUserProfile({ name: safeName, avatarUrl: safeAvatar });
  };

  const handleSaveProfile = async (name: string, avatar: string | null) => {
    const synced = await persistProfile(name, avatar);
    if (synced) {
      toast.success("Profile updated.");
    } else {
      // Be honest: the change is live on this device but won't survive a logout
      // until it reaches the cloud.
      toast.warning("Profile saved on this device — could not sync to your account.");
    }
  };

  // Clear just the photo, keeping the name. Stored as an explicit null so the
  // provider's photo isn't re-seeded at the next login.
  const handleRemovePhoto = async () => {
    const synced = await persistProfile(userName, null);
    if (synced) {
      toast.success("Profile photo removed.");
    } else {
      toast.warning("Photo removed on this device — could not sync to your account.");
    }
  };

  const [resettingPassword, setResettingPassword] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const handleSendPasswordReset = async () => {
    if (!userEmail || resettingPassword) return;
    setResettingPassword(true);
    try {
      await sendPasswordResetEmail(auth, userEmail);
      toast.success("Password reset link sent to your email!");
    } catch (err) {
      toast.error("Failed to send password reset email.");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    setSigningOut(true);
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      localStorage.removeItem("user_session");
      localStorage.removeItem("user_pin");
      toast.success(t("common.signOut") || "Signed out successfully.");
      window.location.href = "/login";
    }
  };

  // Actually wipe the data and show the success stage
  const purgeData = () => {
    clearFinancialData(); // Push empty state to Firestore to clear remote data
    localStorage.clear();
    // Keep currency preference just in case, or truly purge everything.
    localStorage.setItem("active_currency", "INR");
    setClearStage(2);

    // Reload after showing success
    setTimeout(() => {
      window.location.href = "/login";
    }, 2000);
  };

  const handleClearData = () => {
    if (clearStage === 0) {
      if (emailVerifyEnabled) {
        // Pick the real re-auth method from the signed-in user's provider.
        const user = auth.currentUser ?? fbUser;
        const providers = user?.providerData.map((p) => p.providerId) ?? [];
        setReauthMethod(
          providers.includes("password")
            ? "password"
            : providers.includes("google.com")
              ? "google"
              : "unsupported"
        );
        setReauthPassword("");
        setCodeError("");
        setClearStage(3);
      } else {
        setClearStage(1);
      }
    } else if (clearStage === 1) {
      purgeData();
    }
  };

  // Re-authenticate the user against Firebase, then purge. This genuinely
  // proves the account owner is present (no fake code, no email backend).
  const handleReauthAndPurge = async () => {
    const user = auth.currentUser ?? fbUser;
    if (!user) {
      setCodeError("You must be signed in to verify your identity.");
      return;
    }

    setReauthLoading(true);
    setCodeError("");
    try {
      if (reauthMethod === "google") {
        await reauthenticateWithPopup(user, new GoogleAuthProvider());
      } else {
        if (!user.email) {
          setCodeError("No email on this account to verify against.");
          setReauthLoading(false);
          return;
        }
        const credential = EmailAuthProvider.credential(user.email, reauthPassword);
        await reauthenticateWithCredential(user, credential);
      }
      purgeData();
    } catch {
      setCodeError("Verification failed. Please check your credentials and try again.");
      setReauthLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-8 md:p-8 max-w-4xl mx-auto w-full">
      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
          {t('settings.systemConfiguration')}
        </h1>
        <p className="text-sm font-medium text-foreground-muted">
          {t('settings.managePreferences')}
        </p>
      </div>

      {/* User Profile Module */}
      <section className="clay-card rounded-3xl p-6 md:p-7 flex flex-col sm:flex-row items-center gap-6">
        <button
          type="button"
          onClick={() => (userAvatar ? setIsPhotoViewerOpen(true) : setIsEditProfileOpen(true))}
          className="group relative w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 text-primary flex items-center justify-center border-4 border-white dark:border-white/10 shadow-clay-sm shrink-0 overflow-hidden cursor-pointer"
          title={userAvatar ? "View profile photo" : "Add profile photo"}
        >
          {userAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={userAvatar} alt={userName} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
          ) : (
            <User className="w-10 h-10" />
          )}
          <span className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Pencil className="w-5 h-5 text-white" />
          </span>
        </button>
        <div className="flex-1 text-center sm:text-left space-y-1">
          <h2 className="text-xl font-black text-foreground">{userName}</h2>
          <p className="text-sm font-semibold text-foreground-secondary">{userEmail || t('settings.noEmailOnFile')}</p>
        </div>
        <div className="flex flex-col gap-2.5 w-full sm:w-auto">
          <button
            onClick={() => setIsEditProfileOpen(true)}
            className="clay-surface-sm hover:scale-102 active:scale-95 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-foreground"
          >
            <Pencil className="w-4 h-4 text-primary" />
            Edit Profile
          </button>
          {userAvatar && (
            <button
              onClick={handleRemovePhoto}
              className="clay-surface-sm hover:scale-102 active:scale-95 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-rose-500"
            >
              <Trash2 className="w-4 h-4" />
              Remove Photo
            </button>
          )}
          <button
            onClick={resetPin}
            className="clay-surface-sm hover:scale-102 active:scale-95 text-xs font-bold py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer text-foreground"
          >
            <Lock className="w-4 h-4 text-primary" />
            {t('settings.resetPin')}
          </button>
        </div>
      </section>

      {/* Mounted only while open. The modal seeds its fields from these props via
          useState, which runs once per mount — keeping it permanently mounted
          would freeze it on the placeholder profile ("Guest", no photo) that
          exists before the session loads, and saving would write that back. */}
      {isEditProfileOpen && (
        <EditProfileModal
          isOpen={isEditProfileOpen}
          onClose={() => setIsEditProfileOpen(false)}
          initialName={userName}
          initialAvatar={userAvatar}
          onSave={handleSaveProfile}
        />
      )}

      {userAvatar && (
        <ProfilePhotoViewerModal
          isOpen={isPhotoViewerOpen}
          onClose={() => setIsPhotoViewerOpen(false)}
          avatar={userAvatar}
          name={userName}
          onDelete={handleRemovePhoto}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Preference Matrices */}
        <section className="space-y-4">
          <h3 className="text-xs font-black text-foreground-secondary uppercase tracking-widest pl-2">
            {t('settings.localPreferences')}
          </h3>
          <div className="clay-card rounded-3xl overflow-hidden divide-y divide-border/40">
            
            <button 
              onClick={() => setIsCurrencySheetOpen(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-500/5 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl clay-surface-sm flex items-center justify-center text-primary">
                  <Globe className="w-5 h-5 stroke-[2.2px]" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground block">{t('settings.globalCurrency')}</span>
                  <span className="text-[10px] font-semibold text-foreground-muted block">{t('settings.usedForLedger')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-primary">{activeCurrency}</span>
                <ArrowRight className="w-4 h-4 text-icon-muted" />
              </div>
            </button>

            <button
              onClick={() => setIsLanguageSheetOpen(true)}
              className="w-full flex items-center justify-between p-4 hover:bg-slate-500/5 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl clay-surface-sm flex items-center justify-center text-primary">
                  <Languages className="w-5 h-5 stroke-[2.2px]" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground block">{t('settings.language')}</span>
                  <span className="text-[10px] font-semibold text-foreground-muted block">{t('settings.appDisplayLanguage')}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-primary">{getLanguage(activeLanguage).nativeName}</span>
                <ArrowRight className="w-4 h-4 text-icon-muted" />
              </div>
            </button>

            <Link
              href="/settings/categories"
              className="w-full flex items-center justify-between p-4 hover:bg-slate-500/5 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl clay-surface-sm flex items-center justify-center text-primary">
                  <Layers className="w-5 h-5 stroke-[2.2px]" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground block">{t('settings.categoryManager')}</span>
                  <span className="text-[10px] font-semibold text-foreground-muted block">{t('settings.addArchiveTags')}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-icon-muted" />
            </Link>

            <Link
              href="/settings/sms-gateway"
              className="w-full flex items-center justify-between p-4 hover:bg-slate-500/5 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl clay-surface-sm flex items-center justify-center text-primary">
                  <MessageSquare className="w-5 h-5 stroke-[2.2px]" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground block">SMS Gateway</span>
                  <span className="text-[10px] font-semibold text-foreground-muted block">Fast2SMS credentials for reminders</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-icon-muted" />
            </Link>

            <Link
              href="/settings/about"
              className="w-full flex items-center justify-between p-4 hover:bg-slate-500/5 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl clay-surface-sm flex items-center justify-center text-primary">
                  <Info className="w-5 h-5 stroke-[2.2px]" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground block">{t('settings.aboutUs')}</span>
                  <span className="text-[10px] font-semibold text-foreground-muted block">{t('settings.aboutDescription')}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-icon-muted" />
            </Link>

            <Link
              href="/help"
              className="w-full flex items-center justify-between p-4 hover:bg-slate-500/5 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl clay-surface-sm flex items-center justify-center text-primary">
                  <HelpCircle className="w-5 h-5 stroke-[2.2px]" />
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground block">{t('nav.helpSupport')}</span>
                  <span className="text-[10px] font-semibold text-foreground-muted block">{t('settings.helpDescription')}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-icon-muted" />
            </Link>

          </div>
        </section>

        {/* Security & Access */}
        <section className="space-y-4">
          <h3 className="text-xs font-black text-foreground-secondary uppercase tracking-widest pl-2">
            {t('settings.accessControls')}
          </h3>
          <div className="clay-card rounded-3xl overflow-hidden divide-y divide-border/40">
            
            {fbUser?.providerData.some(p => p.providerId === 'password') && (
              <button 
                onClick={handleSendPasswordReset}
                disabled={resettingPassword}
                className="w-full flex items-center justify-between p-4 hover:bg-slate-500/5 transition-colors text-left group cursor-pointer disabled:opacity-60"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl clay-surface-sm flex items-center justify-center text-primary">
                    {resettingPassword ? <RefreshCw className="w-5 h-5 animate-spin text-primary" /> : <Lock className="w-5 h-5 stroke-[2.2px]" />}
                  </div>
                  <div>
                    <span className="font-bold text-sm text-foreground block">
                      {resettingPassword ? "Sending reset link…" : "Reset Password"}
                    </span>
                    <span className="text-[10px] font-semibold text-foreground-muted block">
                      Send a password reset link to {maskEmail(userEmail)}
                    </span>
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-icon-muted" />
              </button>
            )}

            <button
              onClick={handleSignOutEverywhere}
              disabled={signingOut}
              className="w-full flex items-center justify-between p-4 hover:bg-rose-500/10 transition-colors text-left group cursor-pointer disabled:opacity-60"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl clay-surface-sm flex items-center justify-center text-icon-default group-hover:text-rose-500 transition-colors">
                  {signingOut ? <RefreshCw className="w-5 h-5 animate-spin text-rose-500" /> : <LogOut className="w-5 h-5 stroke-[2.2px]" />}
                </div>
                <div>
                  <span className="font-bold text-sm text-foreground block group-hover:text-rose-500 transition-colors">
                    {signingOut ? "Signing out…" : t('settings.signOutEverywhere')}
                  </span>
                  <span className="text-[10px] font-semibold text-foreground-muted block">
                    Terminate active session and lock device
                  </span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-icon-muted group-hover:text-rose-500 transition-colors" />
            </button>

          </div>
        </section>
      </div>

      {/* Backup & Recovery */}
      <section className="clay-card rounded-3xl p-6 md:p-7 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl clay-surface-sm text-primary flex items-center justify-center">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-black text-foreground text-lg">
                {t('settings.backupAndRecovery')}
              </h3>
              <p className="text-xs font-semibold text-foreground-muted">
                {t('settings.backupDescription')}
              </p>
            </div>
          </div>

          {uid && (
            <button
              onClick={handleCreateBackup}
              disabled={backupActionLoading || loadingBackups}
              className="clay-btn-brand text-white text-xs font-black py-2.5 px-4 rounded-2xl flex items-center justify-center gap-2 w-full sm:w-auto self-start sm:self-center disabled:opacity-50 transition-all active:scale-95 cursor-pointer"
            >
              {backupActionLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {t('settings.creatingBackup')}
                </>
              ) : (
                <>
                  <CloudUpload className="w-4 h-4" />
                  {t('settings.backupNow')}
                </>
              )}
            </button>
          )}
        </div>

        {actionMessage && (
          <div
            className={`p-3.5 rounded-2xl border text-xs font-bold flex items-center gap-2 animate-in fade-in duration-200 ${
              actionMessage.type === "success"
                ? "clay-surface-sm border-success/30 text-success"
                : "clay-surface-sm border-error/30 text-error"
            }`}
          >
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <ShieldAlert className="w-4 h-4 shrink-0" />
            )}
            {actionMessage.text}
          </div>
        )}

        {!uid ? (
          <div className="clay-surface-sm rounded-2xl p-4 text-center">
            <ShieldAlert className="w-8 h-8 text-foreground-muted mx-auto mb-2" />
            <p className="text-xs font-bold text-foreground">Cloud Backups Disabled</p>
            <p className="text-[11px] font-semibold text-foreground-muted mt-1 max-w-md mx-auto">
              Please sign in to a cloud account to enable automated and manual ledger backups to Firebase.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground-secondary uppercase tracking-widest pl-1">
              Cloud Backups List
            </h4>
            
            {loadingBackups ? (
              <div className="space-y-2 py-4">
                <div className="h-10 bg-secondary/50 rounded-2xl animate-pulse w-full" />
                <div className="h-10 bg-secondary/50 rounded-2xl animate-pulse w-full" />
              </div>
            ) : backups.length === 0 ? (
              <p className="text-xs font-semibold text-foreground-muted text-center py-6 clay-surface-sm rounded-2xl">
                {t('settings.noBackups')}
              </p>
            ) : (
              <div className="clay-surface-sm rounded-2xl divide-y divide-border/40 overflow-hidden">
                {backups.map((backup) => (
                  <div key={backup.id} className="flex items-center justify-between p-3.5 hover:bg-secondary/35 transition-colors">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-foreground-muted shrink-0" />
                      <div>
                        <span className="font-bold text-sm text-foreground block">
                          {formatBackupDate(backup.createdAt)}
                        </span>
                        <span className="text-[10px] font-semibold text-foreground-muted block">
                          {backup.label}
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedBackup(backup);
                          setBackupModalType("restore");
                        }}
                        disabled={backupActionLoading}
                        className="clay-surface-sm text-primary hover:text-primary-hover px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        {t('settings.restore')}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedBackup(backup);
                          setBackupModalType("delete");
                        }}
                        disabled={backupActionLoading}
                        className="clay-surface-sm text-error hover:text-error/80 px-3 py-1.5 rounded-xl font-black text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('common.delete') || "Delete"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* Core Data Purging Actions */}
      <section className="clay-card bg-gradient-to-br from-rose-500/10 via-rose-500/5 to-card border border-rose-500/20 rounded-3xl p-6 md:p-7 mt-4 flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-1">
            <h3 className="text-error font-extrabold flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              {t('settings.dangerZone')}
            </h3>
            <p className="text-xs font-semibold text-error/80 max-w-sm">
              {t('settings.dangerDescription')}
            </p>
          </div>
          <button
            onClick={() => {
              setClearStage(0);
              setIsClearModalOpen(true);
            }}
            className="clay-btn-danger font-black px-6 py-3 rounded-2xl w-full sm:w-auto shrink-0 cursor-pointer active:scale-95 transition-all"
          >
            {t('settings.clearAllData')}
          </button>
        </div>

        {/* Account verification opt-in */}
        <label className="clay-surface-sm p-3.5 rounded-2xl flex items-center gap-3 border border-rose-500/20 cursor-pointer transition-all hover:border-rose-500/30">
          <input
            type="checkbox"
            checked={emailVerifyEnabled}
            onChange={(e) => setEmailVerifyEnabled(e.target.checked)}
            className="w-4 h-4 accent-rose-500 cursor-pointer shrink-0"
          />
          <span className="text-xs font-semibold text-rose-500/90 dark:text-rose-400">
            {t('settings.requireEmailVerification', { email: maskEmail(userEmail) })}
          </span>
        </label>
      </section>

      <CurrencyPickerSheet
        isOpen={isCurrencySheetOpen}
        onClose={() => setIsCurrencySheetOpen(false)}
        activeCurrencyCode={activeCurrency}
        onSelect={handleCurrencySelect}
      />

      <LanguagePickerSheet
        isOpen={isLanguageSheetOpen}
        onClose={() => setIsLanguageSheetOpen(false)}
        activeLanguageCode={activeLanguage}
        onSelect={handleLanguageSelect}
      />

      {/* Clear Data Multi-stage Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full clay-card max-w-sm rounded-3xl p-6 md:p-7 space-y-6 text-center animate-in zoom-in-95 duration-300">
            
            {clearStage === 0 && (
              <>
                <div className="w-16 h-16 rounded-2xl clay-surface-sm text-error flex items-center justify-center mx-auto mb-4">
                  <ShieldAlert className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-foreground">{t('settings.areYouSure')}</h3>
                  <p className="text-xs font-semibold text-foreground-muted">
                    {t('settings.wipeWarning')}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setIsClearModalOpen(false)} className="clay-surface-sm font-bold text-foreground hover:bg-secondary/60 py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer">
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleClearData} className="clay-btn-danger font-black py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer">
                    {t('settings.yesWipeIt')}
                  </button>
                </div>
              </>
            )}

            {clearStage === 1 && (
              <>
                <div className="w-16 h-16 rounded-2xl clay-surface-sm text-error flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-error">{t('settings.finalConfirmation')}</h3>
                  <p className="text-xs font-bold text-foreground-muted">
                    {t('settings.deleteNowWarning')}
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setIsClearModalOpen(false)} className="clay-surface-sm font-bold text-foreground hover:bg-secondary/60 py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer">
                    {t('settings.abort')}
                  </button>
                  <button onClick={handleClearData} className="clay-btn-danger font-black py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                    {t('settings.deleteNow')}
                  </button>
                </div>
              </>
            )}

            {clearStage === 3 && (
              <>
                <div className="w-16 h-16 rounded-2xl clay-surface-sm text-error flex items-center justify-center mx-auto mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-foreground">{t('settings.verifyItsYou')}</h3>
                  <p className="text-xs font-semibold text-foreground-muted">
                    {reauthMethod === "google" ? (
                      <>Confirm your identity with Google to permanently delete everything.</>
                    ) : reauthMethod === "unsupported" ? (
                      <>Re-authentication isn&apos;t available for your sign-in method. Continue to the final confirmation.</>
                    ) : (
                      <>
                        Re-enter the password for{" "}
                        <span className="font-bold text-foreground">{maskEmail(userEmail)}</span> to permanently delete everything.
                      </>
                    )}
                  </p>
                </div>

                {reauthMethod === "password" && (
                  <input
                    type="password"
                    value={reauthPassword}
                    onChange={(e) => {
                      setReauthPassword(e.target.value);
                      setCodeError("");
                    }}
                    placeholder="Your password"
                    autoFocus
                    className="clay-inset w-full text-center font-bold py-2.5 px-4 rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                  />
                )}

                {codeError && (
                  <p className="text-xs font-bold text-error">{codeError}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <button
                    onClick={() => setIsClearModalOpen(false)}
                    disabled={reauthLoading}
                    className="clay-surface-sm font-bold text-foreground hover:bg-secondary/60 py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  {reauthMethod === "unsupported" ? (
                    <button
                      onClick={() => setClearStage(1)}
                      className="clay-btn-danger font-black py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      onClick={handleReauthAndPurge}
                      disabled={reauthLoading || (reauthMethod === "password" && !reauthPassword)}
                      className="clay-btn-danger font-black py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {reauthLoading
                        ? "Verifying…"
                        : reauthMethod === "google"
                          ? "Confirm with Google"
                          : t('settings.verifyAndDelete')}
                    </button>
                  )}
                </div>
              </>
            )}

            {clearStage === 2 && (
              <div className="py-6 space-y-4">
                <div className="w-16 h-16 rounded-2xl clay-surface-sm text-success flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-black text-foreground">{t('settings.wipeComplete')}</h3>
                <p className="text-xs font-bold text-foreground-muted">
                  {t('settings.restartingApp')}
                </p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* Backup Action Confirmation Modals */}
      {backupModalType && selectedBackup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="w-full clay-card max-w-sm rounded-3xl p-6 md:p-7 space-y-6 text-center animate-in zoom-in-95 duration-300">
            {backupModalType === "restore" && (
              <>
                <div className="w-16 h-16 rounded-2xl clay-surface-sm text-primary flex items-center justify-center mx-auto mb-4">
                  <RotateCcw className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-foreground">{t('settings.confirmRestore')}</h3>
                  <p className="text-xs font-semibold text-foreground-muted">
                    {t('settings.restoreWarning')}
                  </p>
                  <p className="text-[11px] font-extrabold text-primary clay-surface-sm py-2 px-3 rounded-xl">
                    Target: {formatBackupDate(selectedBackup.createdAt)} ({selectedBackup.label})
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setBackupModalType(null); setSelectedBackup(null); }} className="clay-surface-sm font-bold text-foreground hover:bg-secondary/60 py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer">
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleRestoreBackup} className="clay-btn-brand text-white font-black py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer">
                    {t('settings.restore')}
                  </button>
                </div>
              </>
            )}

            {backupModalType === "delete" && (
              <>
                <div className="w-16 h-16 rounded-2xl clay-surface-sm text-error flex items-center justify-center mx-auto mb-4">
                  <Trash2 className="w-8 h-8" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-error">{t('settings.deleteBackup') || "Delete Backup"}</h3>
                  <p className="text-xs font-semibold text-foreground-muted">
                    {t('settings.deleteBackupWarning') || "This will permanently delete this backup snapshot. This cannot be undone. Are you sure?"}
                  </p>
                  <p className="text-[11px] font-extrabold text-error clay-surface-sm py-2 px-3 rounded-xl">
                    Target: {formatBackupDate(selectedBackup.createdAt)} ({selectedBackup.label})
                  </p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => { setBackupModalType(null); setSelectedBackup(null); }} className="clay-surface-sm font-bold text-foreground hover:bg-secondary/60 py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer">
                    {t('common.cancel')}
                  </button>
                  <button onClick={handleDeleteBackup} className="clay-btn-danger font-black py-2.5 px-4 rounded-xl flex-1 active:scale-95 transition-all cursor-pointer">
                    {t('common.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
