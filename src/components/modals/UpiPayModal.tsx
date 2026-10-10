"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  X,
  QrCode,
  Smartphone,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  ClipboardPaste,
} from "lucide-react";
import { toast } from "sonner";
import { formatAmount } from "@/core/utils/currencyManager";
import {
  buildUpiLink,
  generateUpiQrDataUrl,
  isMobileDevice,
  isValidVpa,
  type UpiPayParams,
} from "@/core/utils/upi";

type Step = "pay" | "confirm";

interface UpiPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  recipientName: string;
  /** Pre-filled UPI ID; editable when absent. */
  upiId?: string;
  amount: number;
  /** Note shown in the UPI payment screen. */
  note?: string;
  /** Called after the user confirms payment — caller should log the transaction. */
  onPaymentConfirmed: (upiRefId: string) => void;
}

export default function UpiPayModal({
  isOpen,
  onClose,
  recipientName,
  upiId: initialUpiId = "",
  amount,
  note,
  onPaymentConfirmed,
}: UpiPayModalProps) {
  const [step, setStep] = useState<Step>("pay");
  const [upiId, setUpiId] = useState(initialUpiId);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [upiRefId, setUpiRefId] = useState("");
  const isMobile = isMobileDevice();

  const payParams: UpiPayParams | null =
    isValidVpa(upiId)
      ? { pa: upiId, pn: recipientName, am: amount, tn: note }
      : null;

  const deepLink = payParams ? buildUpiLink(payParams) : "";

  const generateQr = useCallback(async () => {
    if (!payParams) return;
    setQrLoading(true);
    try {
      const url = await generateUpiQrDataUrl(payParams, 280);
      setQrDataUrl(url);
    } catch {
      toast.error("Failed to generate QR code");
    } finally {
      setQrLoading(false);
    }
  }, [upiId, amount]);

  useEffect(() => {
    if (isValidVpa(upiId)) void generateQr();
    else setQrDataUrl(null);
  }, [upiId, amount, generateQr]);

  const handleCopyLink = () => {
    if (!deepLink) return;
    navigator.clipboard.writeText(deepLink);
    toast.success("UPI link copied");
  };

  const handleConfirm = () => {
    onPaymentConfirmed(upiRefId.trim());
    toast.success("Payment recorded");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center p-0 md:p-4 animate-in fade-in duration-200">
      <div className="w-full bg-card border-t md:border border-border rounded-t-3xl md:rounded-2xl max-w-md shadow-2xl overflow-hidden animate-in slide-in-from-bottom md:zoom-in-95 duration-300">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex justify-between items-center bg-background-subtle">
          <h3 className="text-base font-black text-foreground flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-primary" />
            {step === "pay" ? "Pay via UPI" : "Confirm Payment"}
          </h3>
          <button
            onClick={onClose}
            className="text-icon-muted hover:text-icon-active p-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === "pay" && (
          <div className="p-6 space-y-5">
            {/* Amount display */}
            <div className="text-center space-y-1">
              <span className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider">
                Pay to {recipientName}
              </span>
              <div className="text-3xl font-black text-foreground tracking-tight">
                {formatAmount(amount, "INR")}
              </div>
              {note && (
                <p className="text-xs font-semibold text-foreground-secondary">
                  {note}
                </p>
              )}
            </div>

            {/* UPI ID input */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider">
                UPI ID (VPA)
              </label>
              <input
                type="text"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value.toLowerCase())}
                className="input-base w-full"
                placeholder="e.g. name@okaxis"
              />
              {upiId && !isValidVpa(upiId) && (
                <p className="text-[10px] font-semibold text-error">
                  Enter a valid UPI ID (e.g. name@okaxis)
                </p>
              )}
            </div>

            {/* QR Code (desktop) or Open App (mobile) */}
            {isValidVpa(upiId) && (
              <>
                {isMobile ? (
                  <a
                    href={deepLink}
                    className="btn-primary w-full flex items-center justify-center gap-2 text-center"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open UPI App to Pay
                  </a>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold text-foreground-secondary">
                      <QrCode className="w-4 h-4 text-primary" />
                      Scan with any UPI app
                    </div>
                    <div className="flex justify-center p-4 bg-white rounded-xl border border-border">
                      {qrLoading ? (
                        <Loader2 className="w-8 h-8 animate-spin text-primary" />
                      ) : qrDataUrl ? (
                        <img
                          src={qrDataUrl}
                          alt="UPI QR Code"
                          className="w-[280px] h-[280px]"
                        />
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Copy link */}
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-secondary hover:bg-border text-foreground-secondary text-xs font-bold transition-all cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy UPI Link
                </button>

                {/* Move to confirm step */}
                <button
                  onClick={() => setStep("confirm")}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-success text-success-foreground font-extrabold text-sm hover:brightness-110 transition-all cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  I&apos;ve Completed the Payment
                </button>
              </>
            )}
          </div>
        )}

        {step === "confirm" && (
          <div className="p-6 space-y-5">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-success-light text-success flex items-center justify-center mx-auto border border-success/15">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-foreground">
                Payment of {formatAmount(amount, "INR")} to {recipientName}
              </p>
            </div>

            {/* Optional UPI reference ID */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-foreground-secondary uppercase tracking-wider flex items-center gap-1">
                <ClipboardPaste className="w-3 h-3" />
                UPI Transaction Reference (Optional)
              </label>
              <input
                type="text"
                value={upiRefId}
                onChange={(e) => setUpiRefId(e.target.value)}
                className="input-base w-full"
                placeholder="e.g. 428301234567"
              />
              <p className="text-[10px] font-semibold text-foreground-muted">
                Paste the reference number from your UPI app for your records.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep("pay")}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button
                onClick={handleConfirm}
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                Confirm & Log
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
