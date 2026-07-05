"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

/**
 * v7 #6: form-filler browser extensions (LastPass, Dashlane, etc.) inject
 * attributes like `fdprocessedid` onto inputs/buttons before React finishes
 * hydrating, which trips a hydration-mismatch warning that has nothing to do
 * with our own code. `suppressHydrationWarning` on the affected elements
 * silences that specific false-positive without hiding real hydration bugs
 * elsewhere in the app. If you see the same warning on a different page,
 * try disabling browser extensions and reloading before assuming it's a
 * real app bug.
 */
export default function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGuest() {
    setLoading(true);
    const res = await fetch("/api/auth/guest", { method: "POST" });
    const data = await res.json();
    if (data.token) {
      await signIn("credentials", { email: data.email, password: data.token, redirect: false });
      router.push("/home");
    }
    setLoading(false);
  }

  async function handleEmailAuth(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    if (mode === "register") {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (!data.success) { setError(data.error); setLoading(false); return; }
    }
    const res = await signIn("credentials", { email, password, redirect: false });
    if (res?.error) { setError("Invalid credentials"); setLoading(false); return; }
    router.push("/home");
    setLoading(false);
  }

  async function handleGoogle() {
    await signIn("google", { callbackUrl: "/home" });
  }

  return (
    <div className="card-military space-y-4">
      {/* Mode Toggle */}
      <div className="flex border border-military-steel">
        <button suppressHydrationWarning onClick={() => setMode("login")} className={`flex-1 py-2 text-sm uppercase tracking-wider transition-colors ${mode === "login" ? "bg-military-green text-white" : "text-military-steel"}`}>Login</button>
        <button suppressHydrationWarning onClick={() => setMode("register")} className={`flex-1 py-2 text-sm uppercase tracking-wider transition-colors ${mode === "register" ? "bg-military-green text-white" : "text-military-steel"}`}>Register</button>
      </div>

      <form onSubmit={handleEmailAuth} className="space-y-3">
        {mode === "register" && (
          <input
            suppressHydrationWarning
            type="text"
            placeholder="Display Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-military-darker border border-military-steel px-3 py-2 text-sm focus:outline-none focus:border-military-tan"
          />
        )}
        <input
          suppressHydrationWarning
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full bg-military-darker border border-military-steel px-3 py-2 text-sm focus:outline-none focus:border-military-tan"
        />
        <input
          suppressHydrationWarning
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full bg-military-darker border border-military-steel px-3 py-2 text-sm focus:outline-none focus:border-military-tan"
        />
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button suppressHydrationWarning type="submit" disabled={loading} className="btn-military w-full py-3">
          {loading ? "..." : mode === "login" ? "Login" : "Create Account"}
        </button>
      </form>

      <div className="flex items-center gap-2 text-military-steel text-xs">
        <div className="flex-1 h-px bg-military-steel" />
        <span>OR</span>
        <div className="flex-1 h-px bg-military-steel" />
      </div>

      <button suppressHydrationWarning onClick={handleGoogle} className="w-full border border-military-steel py-3 text-sm uppercase tracking-wider hover:bg-military-dark transition-colors flex items-center justify-center gap-2">
        <span>🔵</span> Continue with Google
      </button>

      <button suppressHydrationWarning onClick={handleGuest} disabled={loading} className="w-full border border-military-steel py-2 text-xs text-military-steel uppercase tracking-wider hover:text-white transition-colors">
        Play as Guest
      </button>
    </div>
  );
}
