"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MailCheck,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { auth } from "@/config/firebase";
import { resolveSessionProfile, writeSessionProfile } from "@/core/store/userProfile";
import { useTranslation } from "@/i18n/i18nContext";
import type { User } from "firebase/auth";
import {
  sendPasswordResetEmail,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  updatePassword,
} from "firebase/auth";

/** Firebase's own minimum for `updatePassword`. */
const MIN_PASSWORD_LENGTH = 6;

type Method = "email" | "phone";

/**
 * Account recovery for both sign-in identities offered on /login.
 *
 *  - Email accounts get the standard Firebase reset link.
 *  - Mobile accounts have no password at all — the OTP *is* the credential — so
 *    "recovery" there means re-verifying the number. Once verified, an account
 *    that also carries a password provider can set a new one on the spot (the
 *    OTP counts as the recent re-authentication `updatePassword` demands).
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const [method, setMethod] = useState<Method>("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // ─── Email reset ───
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  // Prefill from a previous "Remember me" sign-in, same as the login screen.
  useEffect(() => {
    const remembered = localStorage.getItem("remembered_email");
    if (remembered) setEmail(remembered);
  }, []);

  // ─── Mobile (OTP) recovery ───
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
  const [hasPassword, setHasPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  const switchMethod = (next: Method) => {
    setMethod(next);
    setError("");
  };

  /**
   * Cache the profile and hand off to the lock screen, exactly as /login does —
   * the PIN also derives the key that decrypts local financial data.
   */
  const enterApp = async (user: User) => {
    writeSessionProfile(await resolveSessionProfile(user, user.phoneNumber || "Phone User"));
    router.push("/pin-lock");
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError(t("forgotPassword.enterEmail"));
      return;
    }
    setError("");
    setLoading(true);

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setEmailSent(true);
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code ?? "";
      // Never confirm or deny that an address is registered: reporting
      // "no such user" would turn this form into an account enumerator.
      if (code === "auth/user-not-found") {
        setEmailSent(true);
      } else {
        setError(err instanceof Error ? err.message : t("forgotPassword.resetFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    // Firebase requires E.164 format, e.g. +919876543210
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      setError(t("login.invalidPhone"));
      return;
    }
    setError("");
    setLoading(true);

    try {
      // Lazily create an invisible reCAPTCHA verifier (required for phone auth)
      if (!recaptchaRef.current) {
        recaptchaRef.current = new RecaptchaVerifier(auth, "recaptcha-container", {
          size: "invisible",
        });
      }
      confirmationRef.current = await signInWithPhoneNumber(auth, phone, recaptchaRef.current);
      setOtpSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("login.otpFailed"));
      // Reset the verifier so the user can retry cleanly
      recaptchaRef.current?.clear();
      recaptchaRef.current = null;
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmationRef.current) {
      setError(t("login.requestOtpFirst"));
      return;
    }
    if (otp.trim().length < 6) {
      setError(t("login.enterOtpCode"));
      return;
    }
    setError("");
    setLoading(true);

    try {
      const result = await confirmationRef.current.confirm(otp.trim());
      setVerifiedUser(result.user);
      setHasPassword(result.user.providerData.some((p) => p.providerId === "password"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("login.invalidOtp"));
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifiedUser) return;
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(t("forgotPassword.passwordTooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t("forgotPassword.passwordMismatch"));
      return;
    }
    setError("");
    setLoading(true);

    try {
      await updatePassword(verifiedUser, newPassword);
      await enterApp(verifiedUser);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("forgotPassword.updateFailed"));
      setLoading(false);
    }
  };

  const resetPhoneFlow = () => {
    setOtpSent(false);
    setPhone("");
    setOtp("");
    setVerifiedUser(null);
    setHasPassword(false);
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    confirmationRef.current = null;
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  };

  const spinner = (
    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
  );

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center px-4 py-6 bg-background-subtle">
      <div className="w-full max-w-md space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            {t("forgotPassword.title")}
          </h2>
          <p className="text-sm font-medium text-foreground-muted">
            {t("forgotPassword.subtitle")}
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-error-light text-error font-medium">
              {error}
            </div>
          )}

          {/* Method switch. Hidden once a flow is under way so a pending OTP or
              reset can't be thrown away by tapping the other tab. */}
          {!emailSent && !otpSent && (
            <div className="flex p-1 gap-1 rounded-xl bg-background-subtle border border-border">
              {(["email", "phone"] as Method[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchMethod(m)}
                  disabled={loading}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    method === m
                      ? "bg-card text-foreground shadow-sm"
                      : "text-foreground-muted hover:text-foreground"
                  }`}
                >
                  {m === "email" ? <Mail className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                  {m === "email"
                    ? t("forgotPassword.methodEmail")
                    : t("forgotPassword.methodMobile")}
                </button>
              ))}
            </div>
          )}

          {/* ─── Email: send a reset link ─── */}
          {method === "email" &&
            (emailSent ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-success-light text-success">
                  <MailCheck className="w-7 h-7" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-foreground">
                    {t("forgotPassword.emailSentTitle")}
                  </h3>
                  <p className="text-sm text-foreground-muted">
                    {t("forgotPassword.emailSentBody", { email: email.trim() })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailSent(false)}
                  className="text-sm font-bold text-link hover:text-link-hover"
                >
                  {t("forgotPassword.resendLink")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSendResetEmail} className="space-y-4">
                <p className="text-sm text-foreground-muted">{t("forgotPassword.emailIntro")}</p>
                <div className="space-y-1">
                  <label
                    htmlFor="reset-email"
                    className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider"
                  >
                    {t("login.emailAddress")}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                      <Mail className="h-4 w-4" />
                    </span>
                    <input
                      id="reset-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="input-base pl-10 w-full"
                      placeholder="name@example.com"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                  {loading ? spinner : t("forgotPassword.sendResetLink")}
                </button>
              </form>
            ))}

          {/* ─── Mobile: re-verify by OTP ─── */}
          {method === "phone" && (
            <div className="space-y-4">
              {otpSent && (
                <button
                  type="button"
                  onClick={resetPhoneFlow}
                  className="flex items-center gap-1 text-sm font-semibold text-foreground-muted hover:text-foreground"
                  disabled={loading}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {t("common.back")}
                </button>
              )}

              {!otpSent && (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <p className="text-sm text-foreground-muted">
                    {t("forgotPassword.mobileIntro")}
                  </p>
                  <div className="space-y-1">
                    <label
                      htmlFor="reset-phone"
                      className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider"
                    >
                      {t("login.mobileNumber")}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                        <Phone className="h-4 w-4" />
                      </span>
                      <input
                        id="reset-phone"
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input-base pl-10 w-full"
                        placeholder="+919876543210"
                        required
                        disabled={loading}
                      />
                    </div>
                    <p className="text-xs text-foreground-muted">{t("login.countryCodeHint")}</p>
                  </div>
                  <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                    {loading ? spinner : t("login.sendOtp")}
                  </button>
                </form>
              )}

              {otpSent && !verifiedUser && (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-1">
                    <label
                      htmlFor="reset-otp"
                      className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider"
                    >
                      {t("login.verificationCode")}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                        <CheckCircle2 className="h-4 w-4" />
                      </span>
                      <input
                        id="reset-otp"
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        className="input-base pl-10 w-full tracking-[0.5em]"
                        placeholder="••••••"
                        required
                        disabled={loading}
                      />
                    </div>
                    <p className="text-xs text-foreground-muted">{t("login.sentTo", { phone })}</p>
                  </div>
                  <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                    {loading ? spinner : t("forgotPassword.verifyBtn")}
                  </button>
                </form>
              )}

              {/* Verified, and the account also carries a password → set a new one. */}
              {verifiedUser && hasPassword && (
                <form onSubmit={handleUpdatePassword} className="space-y-4">
                  <p className="text-sm text-foreground-muted">
                    {t("forgotPassword.setNewIntro")}
                  </p>
                  <div className="space-y-1">
                    <label
                      htmlFor="new-password"
                      className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider"
                    >
                      {t("forgotPassword.newPasswordLabel")}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                        <Lock className="h-4 w-4" />
                      </span>
                      <input
                        id="new-password"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="input-base pl-10 pr-10 w-full"
                        placeholder="••••••••"
                        required
                        disabled={loading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-icon-muted hover:text-icon-active"
                        disabled={loading}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label
                      htmlFor="confirm-password"
                      className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider"
                    >
                      {t("forgotPassword.confirmPasswordLabel")}
                    </label>
                    <div className="relative">
                      <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                        <Lock className="h-4 w-4" />
                      </span>
                      <input
                        id="confirm-password"
                        type={showPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="input-base pl-10 w-full"
                        placeholder="••••••••"
                        required
                        disabled={loading}
                      />
                    </div>
                    <p className="text-xs text-foreground-muted">
                      {t("forgotPassword.passwordHint", { min: MIN_PASSWORD_LENGTH })}
                    </p>
                  </div>
                  <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                    {loading ? spinner : t("forgotPassword.updatePasswordBtn")}
                  </button>
                </form>
              )}

              {/* Verified, but the account is passwordless — the OTP was the whole
                  credential, so there is nothing to reset. */}
              {verifiedUser && !hasPassword && (
                <div className="space-y-4 text-center">
                  <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-2xl bg-success-light text-success">
                    <ShieldCheck className="w-7 h-7" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-foreground">
                      {t("forgotPassword.noPasswordTitle")}
                    </h3>
                    <p className="text-sm text-foreground-muted">
                      {t("forgotPassword.noPasswordBody")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoading(true);
                      void enterApp(verifiedUser);
                    }}
                    className="btn-primary w-full"
                    disabled={loading}
                  >
                    {loading ? spinner : t("forgotPassword.continueBtn")}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Invisible reCAPTCHA target required by Firebase phone auth */}
          <div id="recaptcha-container" />
        </div>

        {/* Footer Link */}
        <p className="text-center text-sm text-foreground-muted">
          <Link
            href="/login"
            className="inline-flex items-center gap-1 text-link hover:text-link-hover font-semibold"
          >
            <ArrowLeft className="h-4 w-4" />
            {t("forgotPassword.backToSignIn")}
          </Link>
        </p>
      </div>
    </main>
  );
}
