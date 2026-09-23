"use client";

import React, { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Mail, Lock, Camera, Check } from "lucide-react";
import { auth, db } from "@/config/firebase";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { fileToAvatarDataUrl, sanitizeAvatarUrl, sanitizeDisplayName } from "@/core/utils/avatar";

export default function RegisterPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarBlob, setAvatarBlob] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Downscale the chosen photo to a small JPEG data URL. A `blob:` URL would be
  // useless here — it dies with the document, so it could never be saved to the
  // account or survive the redirect into the app.
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Allow re-selecting the same file after an error.
    e.target.value = "";
    if (!file) return;

    setError("");
    setUploading(true);
    setUploadProgress(40);

    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setUploadProgress(100);
      setAvatarBlob(dataUrl);
    } catch (err) {
      setUploadProgress(0);
      setError(err instanceof Error ? err.message : "Could not process that image.");
    } finally {
      setUploading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError("Please fill in all fields.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      // Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );
      const safeName = sanitizeDisplayName(name);
      const safeAvatar = sanitizeAvatarUrl(avatarBlob);

      // Save the display name on the Firebase user profile
      await updateProfile(userCredential.user, { displayName: safeName });

      // Save the user's profile into the Firestore database (collection: "users").
      // The name and photo go here — not just into localStorage — because signing
      // out clears local storage; this is the copy that survives to the next login.
      await setDoc(doc(db, "users", userCredential.user.uid), {
        uid: userCredential.user.uid,
        name: safeName,
        avatarUrl: safeAvatar,
        email,
        createdAt: serverTimestamp(),
      });

      localStorage.setItem(
        "user_session",
        JSON.stringify({ email, name: safeName, avatarUrl: safeAvatar })
      );
      // Automatically route to configure a secure locking PIN on first signup
      router.push("/pin-lock");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Registration failed.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 pt-24 pb-12 bg-background-subtle">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-extrabold tracking-tight text-foreground">
            Create Account
          </h2>
          <p className="text-sm font-medium text-foreground-muted">
            Start managing your wealth with MoneyLens.
          </p>
        </div>

        {/* Card Form */}
        <div className="bg-card border border-border rounded-2xl shadow-sm p-8 space-y-6">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-error-light text-error font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Profile Picture Stream Selector */}
            <div className="flex flex-col items-center justify-center gap-2 mb-4">
              <div 
                onClick={triggerFileInput}
                className="group relative flex items-center justify-center w-24 h-24 rounded-full border-2 border-dashed border-border hover:border-primary bg-background cursor-pointer overflow-hidden transition-all duration-200"
              >
                {avatarBlob ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img 
                    src={avatarBlob} 
                    alt="Profile Avatar Preview" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center text-icon-muted group-hover:text-primary">
                    <Camera className="w-8 h-8" />
                  </div>
                )}
                
                {/* Upload Hover Overlay */}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-white text-xs font-semibold">Change Photo</span>
                </div>

                {/* Simulated Streaming Blob Progress */}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center text-white px-2">
                    <span className="text-[10px] font-bold">{uploadProgress}%</span>
                    <div className="w-full bg-white/20 h-1.5 rounded-full overflow-hidden mt-1">
                      <div 
                        className="bg-primary h-full transition-all duration-150" 
                        style={{ width: `${uploadProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
                Profile Avatar Picture
              </span>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>

            {/* Full Name */}
            <div className="space-y-1">
              <label htmlFor="name" className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                  <User className="h-4 w-4" />
                </span>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-base pl-10 w-full"
                  placeholder="John Doe"
                  required
                  disabled={loading || uploading}
                />
              </div>
            </div>

            {/* Email Address */}
            <div className="space-y-1">
              <label htmlFor="email" className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                Email Address
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
                  placeholder="john@example.com"
                  required
                  disabled={loading || uploading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label htmlFor="password" className="text-xs font-semibold text-foreground-secondary uppercase tracking-wider">
                Create Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-icon-muted">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-base pl-10 w-full"
                  placeholder="••••••••"
                  required
                  disabled={loading || uploading}
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="btn-primary w-full mt-4"
              disabled={loading || uploading}
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              ) : (
                "Create Account"
              )}
            </button>
          </form>
        </div>

        {/* Footer Link */}
        <p className="text-center text-sm text-foreground-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-link hover:text-link-hover font-semibold">
            Sign In
          </Link>
        </p>
      </div>
    </main>
  );
}
