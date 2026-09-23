"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessageSquare, Save, Eye, EyeOff, Info, ExternalLink, Wallet } from "lucide-react";
import { toast } from "sonner";
import {
  useSmsGateway,
  setSmsGateway,
  type SmsGatewayConfig,
} from "@/core/store/dataStore";

const FAST2SMS_PRICING_URL = "https://www.fast2sms.com/bulk-sms-pricing";

/**
 * Fast2SMS's published recharge tiers — the more credit you buy, the cheaper
 * each SMS. Reproduced for guidance only, so the page is honest that it cannot
 * sell anything: credit is bought from Fast2SMS with the user's own account.
 *
 * Rates are Fast2SMS's and can change at any time, which is why every render
 * dates them and links out to the live page rather than presenting them as
 * current fact. Refresh RATES_CHECKED_ON whenever these are re-verified.
 */
const RATES_CHECKED_ON = "July 2026";

const RECHARGE_TIERS: { recharge: string; perSms: string }[] = [
  { recharge: "₹100 – ₹3,999", perSms: "₹0.25" },
  { recharge: "₹4,000 – ₹7,999", perSms: "₹0.21" },
  { recharge: "₹8,000 – ₹13,999", perSms: "₹0.19" },
  { recharge: "₹14,000 – ₹59,999", perSms: "₹0.17" },
  { recharge: "₹60,000 – ₹1,29,999", perSms: "₹0.15" },
  { recharge: "₹1,30,000 – ₹5,99,999", perSms: "₹0.13" },
  { recharge: "₹6,00,000+", perSms: "₹0.11" },
];

export default function SmsGatewayPage() {
  // Subscribed, not snapshotted: on a fresh device the key arrives from the
  // cloud after this page has already mounted.
  const stored = useSmsGateway();

  // Held as a draft: edits only reach the store on Save.
  const [config, setConfig] = useState<SmsGatewayConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    /*
     * Track the store until the user starts editing. Adopting only the first
     * non-null read is not enough: a fresh device reads an empty config, and
     * the real key only lands when the cloud snapshot arrives afterwards. Once
     * `dirty`, the draft wins — a late sync must not overwrite what someone is
     * still typing.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored && !dirty) setConfig(stored);
  }, [stored, dirty]);

  /** Mark edited so the effect above stops overwriting the draft. */
  const editConfig = (patch: Partial<SmsGatewayConfig>) => {
    setDirty(true);
    setConfig((c) => c && { ...c, ...patch });
  };

  // Locked or not yet hydrated — render nothing rather than an empty form whose
  // Save would wipe the stored key.
  if (!config) return null;

  const handleSave = () => {
    setSmsGateway(config);
    setDirty(false);
    toast.success("SMS gateway settings saved.");
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <header className="flex justify-between items-center bg-card border border-border p-4 rounded-2xl shadow-sm">
        <Link
          href="/settings"
          className="flex items-center gap-2 text-xs font-bold text-foreground-secondary hover:text-primary transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Settings
        </Link>
        <button onClick={handleSave} className="btn-primary flex items-center gap-2 py-2 px-4 text-xs">
          <Save className="w-4 h-4" />
          Save
        </button>
      </header>

      <div className="space-y-1">
        <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl flex items-center gap-2">
          <MessageSquare className="w-7 h-7 text-primary" />
          SMS Gateway
        </h1>
        <p className="text-sm font-medium text-foreground-muted">
          Connect your Fast2SMS account for ledger reminders.
        </p>
      </div>

      {/* Sending is not wired up — say so plainly rather than implying it works. */}
      <div className="flex gap-3 bg-warning-light border border-warning/30 rounded-2xl p-4">
        <Info className="w-5 h-5 text-warning shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-bold text-foreground">Not sending yet</p>
          <p className="text-xs font-medium text-foreground-secondary">
            This key is saved but not yet connected to a send path — reminders are still simulated.
            Delivering real SMS needs a server route that holds the key, because any key the browser
            can read can be copied by anyone who opens DevTools.
          </p>
        </div>
      </div>

      {/* Enable toggle */}
      <section className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between">
        <div>
          <span className="font-bold text-sm text-foreground block">Enable SMS reminders</span>
          <span className="text-[10px] font-semibold text-foreground-muted">
            Use SMS alongside WhatsApp once a send path exists.
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={config.enabled}
          onClick={() => editConfig({ enabled: !config.enabled })}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
            config.enabled ? "bg-primary" : "bg-secondary border border-border"
          }`}
        >
          <span
            className={`absolute top-1 w-5 h-5 rounded-full bg-card shadow transition-transform ${
              config.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </section>

      {/* Credentials */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-1">
        <label className="text-xs font-bold text-foreground-secondary uppercase tracking-wider">
          Fast2SMS API Key
        </label>
        <div className="relative">
          <input
            type={revealed ? "text" : "password"}
            value={config.apiKey}
            onChange={(e) => editConfig({ apiKey: e.target.value })}
            placeholder="Your Fast2SMS authorization key"
            autoComplete="off"
            spellCheck={false}
            className="input-base w-full pr-10"
          />
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-icon-muted hover:text-icon-active rounded-lg transition-colors"
            title={revealed ? "Hide" : "Reveal"}
          >
            {revealed ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] font-semibold text-foreground-muted pt-1">
          Fast2SMS Dashboard → Dev API → Authorization Key.
        </p>
      </section>

      {/* What this route can and cannot do */}
      <section className="bg-background-subtle border border-border rounded-2xl p-4 space-y-2">
        <p className="text-xs font-bold text-foreground">Uses the Quick route</p>
        <ul className="text-[11px] font-medium text-foreground-secondary space-y-1 list-disc pl-4">
          <li>No DLT registration, sender ID, or pre-approved templates needed.</li>
          <li>Fast2SMS reviews each message before it goes out, so delivery is not instant.</li>
          <li>Messages arrive from a shared number, not a branded sender name.</li>
          <li>Customers on the DND registry will not receive them — use WhatsApp for those.</li>
        </ul>
      </section>

      {/* Recharge — the app cannot sell credit, so this points at Fast2SMS. */}
      <section className="bg-card border border-border rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-primary" />
          <p className="text-xs font-bold text-foreground">Buying SMS credit</p>
        </div>

        <p className="text-[11px] font-medium text-foreground-secondary">
          Credit is bought from Fast2SMS with your own account — DhanBook never handles the
          payment. The more you recharge at once, the lower the per-SMS rate. Minimum recharge is
          ₹100.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="text-foreground-muted">
                <th className="text-left font-bold uppercase tracking-wider py-1.5 pr-3">Recharge</th>
                <th className="text-right font-bold uppercase tracking-wider py-1.5">Per SMS</th>
              </tr>
            </thead>
            <tbody>
              {RECHARGE_TIERS.map((tier) => (
                <tr key={tier.recharge} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-medium text-foreground-secondary whitespace-nowrap">
                    {tier.recharge}
                  </td>
                  <td className="py-1.5 text-right font-bold text-foreground tabular-nums">
                    {tier.perSms}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-[10px] font-semibold text-foreground-muted">
          Fast2SMS&apos;s published bulk rates as of {RATES_CHECKED_ON}, shown as a guide — they set
          the prices and can change them. Quick-route rates are not published separately. Check the
          live page before you recharge.
        </p>

        <a
          href={FAST2SMS_PRICING_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-full gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-white font-bold text-xs rounded-xl shadow-sm transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <ExternalLink className="w-4 h-4" />
          View pricing &amp; recharge on Fast2SMS
        </a>
      </section>

      <p className="text-[10px] font-semibold text-foreground-muted px-1">
        Your key is encrypted on this device and synced only to your own account, the same as your
        financial data.
      </p>
    </div>
  );
}
