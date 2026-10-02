"use client";

import React, { useState, useEffect } from "react";
import { Bell, CheckSquare, Trash2, ShieldCheck, AlertTriangle, XCircle, Info } from "lucide-react";

import { formatDate, formatTime } from "@/core/utils/dateFormat";
interface NotificationItem {
  id: string;
  text: string;
  type: "success" | "alert" | "error";
  read: boolean;
  date: string;
}

export default function NotificationsPage() {
  const [notes, setNotes] = useState<NotificationItem[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = localStorage.getItem("notifications");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
          return parsed.map((str: string, index: number) => {
            let type: "success" | "alert" | "error" = "alert";
            if (str.toLowerCase().includes("success") || str.toLowerCase().includes("info")) {
              type = "success";
            } else if (str.toLowerCase().includes("error") || str.toLowerCase().includes("breached")) {
              type = "error";
            }
            return {
              id: `stored-${index}`,
              text: str,
              type,
              read: false,
              date: new Date().toISOString(),
            };
          });
        }
        return parsed;
      } catch {
        return [];
      }
    }
    return [];
  });

  function loadNotifications() {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem("notifications");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0] === "string") {
          const mapped: NotificationItem[] = parsed.map((str: string, index: number) => {
            let type: "success" | "alert" | "error" = "alert";
            if (str.toLowerCase().includes("success") || str.toLowerCase().includes("info")) {
              type = "success";
            } else if (str.toLowerCase().includes("error") || str.toLowerCase().includes("breached")) {
              type = "error";
            }
            return {
              id: `stored-${index}`,
              text: str,
              type,
              read: false,
              date: new Date().toISOString(),
            };
          });
          setNotes(mapped);
          localStorage.setItem("notifications", JSON.stringify(mapped));
        } else {
          setNotes(parsed);
        }
      } catch (e) {
        setNotes([]);
      }
    } else {
      setNotes([]);
    }
  }

  useEffect(() => {
    window.addEventListener("datastore:change", loadNotifications);
    window.addEventListener("storage", loadNotifications);
    return () => {
      window.removeEventListener("datastore:change", loadNotifications);
      window.removeEventListener("storage", loadNotifications);
    };
  }, []);

  const handleMarkAllRead = () => {
    const updated = notes.map((n) => ({ ...n, read: true }));
    setNotes(updated);
    localStorage.setItem("notifications", JSON.stringify(updated));
  };

  const handleDeleteNotification = (id: string) => {
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    localStorage.setItem("notifications", JSON.stringify(updated));
  };

  const getAlertIcon = (type: "success" | "alert" | "error") => {
    switch (type) {
      case "success":
        return <ShieldCheck className="w-5 h-5 text-success animate-pulse" />;
      case "alert":
        return <AlertTriangle className="w-5 h-5 text-brand" />;
      case "error":
        return <XCircle className="w-5 h-5 text-error" />;
    }
  };

  const getAlertLabelColor = (type: "success" | "alert" | "error") => {
    switch (type) {
      case "success":
        return "text-success border-success-light bg-success-light/30";
      case "alert":
        return "text-brand border-warning-light bg-warning-light/30";
      case "error":
        return "text-error border-error-light bg-error-light/30";
    }
  };

  const getNotificationBorderColor = (n: NotificationItem) => {
    if (!n.read) return "border-l-4 border-l-primary border-border";
    return "border-border";
  };

  return (
    <div className="flex-1 flex flex-col p-6 space-y-6 md:p-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight sm:text-3xl">
            Notifications
          </h1>
          <p className="text-sm font-medium text-foreground-muted">
            Monitor and audit automated alert updates and thresholds logs.
          </p>
        </div>

        {notes.some((n) => !n.read) && (
          <button
            onClick={handleMarkAllRead}
            className="flex items-center gap-1.5 text-xs font-bold text-primary hover:text-primary-hover hover:underline bg-transparent border-0 cursor-pointer"
          >
            <CheckSquare className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      {/* ────────────────── ALERTS LIST VIEW ────────────────── */}
      <section className="space-y-4 flex-grow">
        {notes.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-12 text-center text-foreground-muted text-sm shadow-sm">
            No active notification logs to show.
          </div>
        ) : (
          <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden divide-y divide-border">
            {notes.map((n) => (
              <div
                key={n.id}
                className={`p-5 flex gap-4 transition-all ${
                  !n.read ? "bg-primary-lighter" : "bg-card hover:bg-secondary/20"
                } ${getNotificationBorderColor(n)}`}
              >
                {/* Alert Severity Bullet */}
                <div className="shrink-0 pt-0.5">
                  {getAlertIcon(n.type)}
                </div>

                {/* Content Details */}
                <div className="flex-grow space-y-2 min-w-0">
                  <div className="flex justify-between items-start gap-2">
                    <span className={`px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-full border ${getAlertLabelColor(n.type)}`}>
                      {n.type}
                    </span>
                    <span className="text-[10px] text-foreground-muted shrink-0 font-medium">
                      {formatDate(n.date, { month: "short", day: "numeric" })}{" "}
                      {formatTime(n.date, { hour: "2-digit", minute: "2-digit", hour12: true })}
                    </span>
                  </div>
                  
                  <p className="text-xs leading-relaxed font-bold text-foreground-secondary break-words">
                    {n.text}
                  </p>
                </div>

                {/* Row Delete Button */}
                <div className="shrink-0 flex items-center">
                  <button
                    onClick={() => handleDeleteNotification(n.id)}
                    className="p-1.5 rounded-lg text-icon-muted hover:text-error hover:bg-error-light transition-all cursor-pointer"
                    title="Remove Alert Log"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
