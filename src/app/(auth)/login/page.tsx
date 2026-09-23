"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, CheckCircle2, Phone, ArrowLeft } from "lucide-react";
import { auth } from "@/config/firebase";
import { resolveSessionProfile, writeSessionProfile } from "@/core/store/userProfile";
import { useTranslation } from "@/i18n/i18nContext";
import type { User } from "firebase/auth";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Prefill the email from a previous "Remember me" sign-in.
  useEffect(() => {
    const remembered = localStorage.getItem("remembered_email");
    if (remembered) {
      setEmail(remembered);
      setRememberMe(true);
    }
  }, []);

  // Phone (mobile number) sign-in state
  const [usePhone, setUsePhone] = useState(false);
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);

  /**
   * Shared tail of every sign-in path. Signing out wipes `user_session` from
   * this device, so the name and photo the user set in Settings have to be
   * rehydrated from their cloud profile here — otherwise each login would reset
   * them to the provider defaults. `fallbackName` is only used when neither the
   * cloud profile nor the provider has a name.
   */
  const finishSignIn = async (user: User, fallbackName: string) => {
    writeSessionProfile(await resolveSessionProfile(user, fallbackName));
    // Always go through the lock screen: it sets up a PIN if none exists (the
    // PIN also derives the key that decrypts local financial data) or verifies
    // the existing one.
    router.push("/pin-lock");
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    // Firebase requires E.164 format, e.g. +919876543210
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
      setError("Enter a valid number in international format, e.g. +919876543210");
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
      confirmationRef.current = await signInWithPhoneNumber(
        auth,
        phone,
        recaptchaRef.current
      );
      setOtpSent(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send OTP.";
      setError(message);
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
      setError("Please request an OTP first.");
      return;
    }
    if (otp.trim().length < 6) {
      setError("Enter the 6-digit code sent to your phone.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const result = await confirmationRef.current.confirm(otp.trim());
      await finishSignIn(result.user, result.user.phoneNumber || "Phone User");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Invalid or expired code.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const resetPhoneFlow = () => {
    setUsePhone(false);
    setOtpSent(false);
    setPhone("");
    setOtp("");
    setError("");
    confirmationRef.current = null;
    recaptchaRef.current?.clear();
    recaptchaRef.current = null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // "Remember me" → persist the session across browser restarts;
      // otherwise only keep it until the tab/window is closed.
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      // Sign in against Firebase Authentication
      const result = await signInWithEmailAndPassword(auth, email, password);

      // Remember (or forget) the email for next time.
      if (rememberMe) {
        localStorage.setItem("remembered_email", email);
      } else {
        localStorage.removeItem("remembered_email");
      }

      // The email local-part is only the last resort: the saved profile name,
      // then the Firebase Auth display name, both come first.
      await finishSignIn(result.user, email.split("@")[0]);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('login.loginFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      // Honour the "Remember me" choice for Google sign-in too.
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      // Open the Google sign-in popup via Firebase Authentication
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // Google's name and photo are only the seed for a brand-new account; a
      // profile the user has since edited (including a removed photo) wins.
      await finishSignIn(result.user, "Google User");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('login.googleFailed');
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-6 bg-background-subtle">
      <div className="w-full max-w-md space-y-5">
        {/* Header */}
        <div className="text-center space-y-1">
          <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
            {t('login.welcomeBack')}
          </h2>
          <p className="text-sm font-medium text-foreground-muted">
            {t('login.accessLedger')}
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-error-light text-error font-medium">
              {error}
            </div>
          )}

          {!usePhone ? (
          <>
          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email Field */}
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                {t('login.emailAddress')}
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="email"
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

            {/* Password Field */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label htmlFor="password" className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                  {t('login.password')}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-semibold text-link hover:text-link-hover"
                >
                  {t('login.forgotPassword')}
                </Link>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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

            {/* Remember Me */}
            <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 accent-primary cursor-pointer"
              />
              <span className="text-xs font-semibold text-foreground-secondary">
                {t('login.rememberMe')}
              </span>
            </label>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary w-full mt-2"
              disabled={loading}
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                t('login.signIn')
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-border"></div>
            <span className="flex-shrink mx-4 text-xs font-semibold text-foreground-muted uppercase tracking-wider bg-card">
              {t('login.orConnectWith')}
            </span>
            <div className="flex-grow border-t border-border"></div>
          </div>

          {/* Google SSO Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="btn-secondary w-full flex items-center justify-center gap-3 bg-background hover:bg-background-subtle border border-border"
            disabled={loading}
          >
            {/* Google G Symbol Vector */}
            <svg className="h-5 w-5" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285f4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34a853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#fbbc05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#ea4335"
              />
            </svg>
            {t('login.continueWithGoogle')}
          </button>

          {/* Phone (mobile number) Login */}
          <button
            type="button"
            onClick={() => {
              setError("");
              setUsePhone(true);
            }}
            className="btn-secondary w-full flex items-center justify-center gap-3 bg-background hover:bg-background-subtle border border-border"
            disabled={loading}
          >
            <Phone className="h-5 w-5 text-icon-active" />
            {t('login.continueWithPhone')}
          </button>
          </>
          ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={resetPhoneFlow}
              className="flex items-center gap-1 text-sm font-semibold text-foreground-muted hover:text-foreground"
              disabled={loading}
            >
              <ArrowLeft className="h-4 w-4" />
              {t('common.back')}
            </button>

            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="phone" className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    {t('login.mobileNumber')}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                      <Phone className="h-4 w-4" />
                    </span>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="input-base pl-10 w-full"
                      placeholder="+919876543210"
                      required
                      disabled={loading}
                    />
                  </div>
                  <p className="text-xs text-foreground-muted">
                    {t('login.countryCodeHint')}
                  </p>
                </div>
                <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    t('login.sendOtp')
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="space-y-1">
                  <label htmlFor="otp" className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                    {t('login.verificationCode')}
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                      <CheckCircle2 className="h-4 w-4" />
                    </span>
                    <input
                      id="otp"
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
                  <p className="text-xs text-foreground-muted">
                    {t('login.sentTo', { phone })}
                  </p>
                </div>
                <button type="submit" className="btn-primary w-full mt-2" disabled={loading}>
                  {loading ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  ) : (
                    t('login.verifyAndSignIn')
                  )}
                </button>
              </form>
            )}

            {/* Phone accounts have no password, but the number itself can be
                the thing they've lost access to — offer recovery either way. */}
            <Link
              href="/forgot-password"
              className="block text-center text-sm font-semibold text-link hover:text-link-hover"
            >
              {t('login.recoverAccount')}
            </Link>
          </div>
          )}

          {/* Invisible reCAPTCHA target required by Firebase phone auth */}
          <div id="recaptcha-container" />
        </div>

        {/* Footer Link */}
        <p className="text-center text-sm text-foreground-muted">
          {t('login.newToMoneyLens')}{" "}
          <Link href="/register" className="text-link hover:text-link-hover font-semibold">
            {t('login.createAccount')}
          </Link>
        </p>
      </div>
    </main>
  );
}
