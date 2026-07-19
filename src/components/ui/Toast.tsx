"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";

/**
 * Tiny global toast system — no Context/Provider wiring needed. Any client
 * component calls showToast(...) directly; <ToastHost/> (mounted once in
 * the root layout) is the only thing that actually renders anything. This
 * is the system-wide "you don't have enough X" notification requested for
 * every purchase flow (character/weapon buy, perks, upgrades, skins, gacha,
 * PvP entry, ammo refill, trade) — a page that used to only show a quiet
 * inline error line (easy to miss, and several flows didn't show one at
 * all) now gets the same unmissable toast everywhere.
 */
interface ToastEntry {
  id: number;
  message: string;
  variant: "error" | "info";
}

let listeners: ((entry: ToastEntry) => void)[] = [];
let nextId = 1;

export function showToast(message: string, variant: "error" | "info" = "error") {
  const entry: ToastEntry = { id: nextId++, message, variant };
  listeners.forEach((fn) => fn(entry));
}

/** Convenience wrapper for the single most common case across this app —
 *  formats a consistent "not enough X" message from a currency + amount. */
export function showInsufficientFundsToast(currency: "coin" | "diamond" | "ticket" | "greenBanknote", needed: number, have: number) {
  const label: Record<string, string> = { coin: "Coin", diamond: "Diamond", ticket: "Ticket", greenBanknote: "Green Banknote" };
  showToast(`Not enough ${label[currency] ?? currency} — need ${needed.toLocaleString()}, you have ${Math.floor(have).toLocaleString()}.`, "error");
}

export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  useEffect(() => {
    const onEntry = (entry: ToastEntry) => {
      setToasts((prev) => [...prev, entry]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== entry.id)), 3200);
    };
    listeners.push(onEntry);
    return () => {
      listeners = listeners.filter((l) => l !== onEntry);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded border text-sm font-bold shadow-lg animate-[toast-in_0.25s_ease-out] ${
            t.variant === "error" ? "bg-red-950/95 border-red-500 text-red-100" : "bg-military-dark/95 border-military-tan text-military-tan"
          }`}
        >
          <Icon name={t.variant === "error" ? "warning" : "check"} size={18} />
          {t.message}
        </div>
      ))}
    </div>
  );
}
