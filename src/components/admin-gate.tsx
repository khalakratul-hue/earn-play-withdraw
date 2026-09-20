import { useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

import { AdminPanel } from "@/components/admin-panel";

const ADMIN_PASSWORD = "k.h.a.l.e.k";
const SESSION_KEY = "watchcoin.admin";

function readSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

/** Password-gated admin area, reachable only through the #admin hash. */
export function AdminGate({ onExit }: { onExit: () => void }) {
  const [authed, setAuthed] = useState(readSession);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const logout = () => {
    try {
      window.sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
    setAuthed(false);
    setPassword("");
  };

  if (authed) {
    return <AdminPanel onExit={onExit} onLogout={logout} />;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-5 py-10 font-sans text-foreground">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (password === ADMIN_PASSWORD) {
            try {
              window.sessionStorage.setItem(SESSION_KEY, "1");
            } catch {
              // ignore
            }
            setAuthed(true);
            setError(null);
          } else {
            setError("ভুল পাসওয়ার্ড। আবার চেষ্টা করুন।");
          }
        }}
        className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-center gap-3">
          <span className="bg-brand-gradient grid size-10 place-items-center rounded-2xl">
            <Lock className="size-5 text-brand-foreground" />
          </span>
          <div>
            <h1 className="text-base font-extrabold text-card-foreground">
              এডমিন লগইন
            </h1>
            <p className="text-[11px] font-semibold text-muted-foreground">
              শুধুমাত্র অনুমোদিত এডমিনের জন্য
            </p>
          </div>
        </div>

        <label className="block text-xs font-semibold text-card-foreground">
          পাসওয়ার্ড
          <input
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="••••••••"
            className="mt-1.5 w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </label>

        {error && (
          <p className="text-xs font-bold text-destructive">{error}</p>
        )}

        <button
          type="submit"
          className="bg-brand-gradient w-full rounded-xl py-3 text-sm font-extrabold text-brand-foreground shadow-lg transition-transform active:scale-[0.98]"
        >
          লগইন করুন
        </button>

        <button
          type="button"
          onClick={onExit}
          className="flex w-full items-center justify-center gap-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground"
        >
          <ShieldCheck className="size-3.5" />
          অ্যাপে ফিরে যান
        </button>
      </form>
    </main>
  );
}
