/**
 * UPI utilities — deep-link generation, VPA validation, and QR code rendering.
 *
 * No payment gateway is involved: the app generates standard `upi://pay?…`
 * URIs that open whichever UPI app the user has installed (GPay, PhonePe,
 * Paytm, BHIM, etc.) with the amount and payee pre-filled.
 */

// ──────────────── VPA VALIDATION ────────────────

const VPA_RE = /^[a-zA-Z0-9._-]+@[a-zA-Z][a-zA-Z0-9]+$/;

export function isValidVpa(vpa: string): boolean {
  return VPA_RE.test(vpa);
}

export function validateVpa(vpa: string): string | null {
  if (!vpa.trim()) return "UPI ID is required";
  if (!vpa.includes("@")) return "UPI ID must contain @  (e.g. name@bank)";
  if (!VPA_RE.test(vpa)) return "Invalid UPI ID format";
  return null;
}

// ──────────────── DEEP LINK ────────────────

export interface UpiPayParams {
  /** Payee VPA (e.g. rahul@okaxis) */
  pa: string;
  /** Payee display name */
  pn: string;
  /** Amount in INR */
  am: number;
  /** Transaction note / description */
  tn?: string;
  /** Transaction reference (your app's internal id) */
  tr?: string;
}

export function buildUpiLink(params: UpiPayParams): string {
  const p = new URLSearchParams({
    pa: params.pa,
    pn: params.pn,
    am: params.am.toFixed(2),
    cu: "INR",
  });
  if (params.tn) p.set("tn", params.tn);
  if (params.tr) p.set("tr", params.tr);
  return `upi://pay?${p.toString()}`;
}

// ──────────────── QR CODE ────────────────

/**
 * Render a UPI pay link as a QR code data-URL (PNG base64).
 * Lazy-loads the `qrcode` package so the main bundle isn't bloated.
 */
export async function generateUpiQrDataUrl(
  params: UpiPayParams,
  size = 256
): Promise<string> {
  const QRCode = await import("qrcode");
  const link = buildUpiLink(params);
  return QRCode.toDataURL(link, { width: size, margin: 2 });
}

// ──────────────── DEVICE DETECTION ────────────────

export function isMobileDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}
