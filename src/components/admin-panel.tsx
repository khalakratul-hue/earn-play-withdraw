import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  Ban,
  BadgeDollarSign,
  CheckCircle2,
  Crown,
  DollarSign,
  Gavel,
  LogOut,
  Megaphone,
  MessageCircle,
  RefreshCw,
  ScrollText,
  Settings,
  Trash2,
  Upload,
  Users,
  Video,
  XCircle,
} from "lucide-react";

import {
  BOOST_PACKS,
  COINS_PER_TAKA,
  POINTS_PER_TAKA,
  mapSettings,
  refresh,
  type AppSettings,
  type DepositMethod,
} from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import {
  adminBlockUser,
  adminDeleteComment,
  adminFineUser,
  adminLoad,
  adminSaveSettings,
  adminSetDeposit,
  adminSetUpload,
  adminSetWithdraw,
} from "@/lib/admin.functions";
import { bn, taka } from "@/lib/format";

type AdminData = Awaited<ReturnType<typeof adminLoad>>;
type Status = "pending" | "approved" | "rejected";

const field =
  "mt-1 w-full rounded-xl border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-ring";
const saveBtn = "bg-brand-gradient rounded-xl px-4 py-2 text-xs font-extrabold text-brand-foreground disabled:opacity-40";

const KIND_LABEL: Record<string, string> = {
  coins: "🪙 কয়েন",
  boost: "🚀 বুস্ট",
  ad: "📢 বিজ্ঞাপন",
  vip: "👑 VIP",
};

export function AdminPanel({
  password,
  onExit,
  onLogout,
}: {
  password: string;
  onExit: () => void;
  onLogout: () => void;
}) {
  const [data, setData] = useState<AdminData | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        adminLoad({ data: { password } }),
        supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
      ]);
      setData(d);
      const mapped = mapSettings((s.data as Record<string, unknown> | null) ?? null);
      setSettings(mapped);
      setDraft(mapped);
    } catch {
      onLogout();
    }
  }, [password, onLogout]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    try {
      await fn();
      notify(message);
    } catch {
      notify("সমস্যা হয়েছে, আবার চেষ্টা করুন।");
    }
    await load();
    void refresh();
  };

  const save = (patch: Record<string, unknown>, message = "সেভ করা হয়েছে।") =>
    run(() => adminSaveSettings({ data: { password, patch } }), message);

  if (!data || !settings || !draft) {
    return (
      <main className="grid min-h-screen place-items-center bg-background text-sm font-bold text-foreground">
        লোড হচ্ছে...
      </main>
    );
  }

  const set = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => setDraft({ ...draft, [key]: value });
  const pendingDeposits = data.deposits.filter((d) => d.status === "pending");
  const pendingWithdraws = data.withdrawals.filter((w) => w.status === "pending");
  const pendingUploads = data.uploads.filter((u) => u.status === "pending");
  const approvedIncome = data.deposits.filter((d) => d.status === "approved").reduce((s, d) => s + d.amount, 0);
  const users = data.profiles.filter(
    (p) => !search.trim() || p.username.toLowerCase().includes(search.trim().toLowerCase()) || p.referral_code.includes(search.trim().toUpperCase()),
  );

  return (
    <div className="min-h-screen bg-background px-4 py-6 font-sans text-foreground sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-brand-gradient grid size-9 shrink-0 place-items-center rounded-xl">
              <Settings className="size-4.5 text-brand-foreground" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold sm:text-lg">অ্যাপ এডমিন প্যানেল</h1>
              <p className="text-[11px] font-semibold text-muted-foreground">সব ইউজারের তথ্য — অনলাইন ডাটাবেস</p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={() => void load()} className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[10px] font-bold text-secondary-foreground">
              <RefreshCw className="size-3" /> রিফ্রেশ
            </button>
            <button type="button" onClick={onExit} className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[10px] font-bold text-secondary-foreground">
              <ArrowLeft className="size-3" /> অ্যাপে ফিরে যান
            </button>
            <button type="button" onClick={onLogout} className="flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[10px] font-bold text-destructive">
              <LogOut className="size-3" /> লগআউট
            </button>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard icon={<Users className="size-4" />} label="মোট ইউজার" value={bn(data.profiles.length)} hint={`${bn(data.profiles.filter((p) => p.blocked).length)} জন ব্লক`} tone="primary" />
          <StatCard icon={<BadgeDollarSign className="size-4" />} label="পেন্ডিং পেমেন্ট" value={bn(pendingDeposits.length) + " টি"} hint={`মোট আয় ${taka(approvedIncome)}`} tone="coin" />
          <StatCard icon={<DollarSign className="size-4" />} label="পেন্ডিং উইথড্র" value={bn(pendingWithdraws.length) + " টি"} hint={taka(pendingWithdraws.reduce((s, w) => s + w.amount, 0))} tone="warning" />
          <StatCard icon={<Video className="size-4" />} label="পেন্ডিং ভিডিও" value={bn(pendingUploads.length) + " টি"} hint={`${bn(data.comments.length)} কমেন্ট`} tone="accent" />
        </div>

        {/* Payments: coins, boost, ads, VIP */}
        <Panel icon={<BadgeDollarSign className="size-4" />} title="সব পেমেন্ট রিকোয়েস্ট (কয়েন / বুস্ট / বিজ্ঞাপন / VIP)" tone="coin">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="py-2">ইউজার</th>
                  <th>ধরন</th>
                  <th>টাকা</th>
                  <th>মেথড</th>
                  <th>TrxID</th>
                  <th>বিস্তারিত</th>
                  <th>স্ট্যাটাস</th>
                  <th className="text-right">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                {data.deposits.length === 0 && (
                  <tr><td colSpan={8} className="py-4 text-center text-muted-foreground">কোনো রিকোয়েস্ট নেই।</td></tr>
                )}
                {data.deposits.map((d) => {
                  const det = (d.details ?? {}) as Record<string, unknown>;
                  const media = String(det["mediaUrl"] ?? det["videoUrl"] ?? "");
                  return (
                    <tr key={d.id} className="border-t border-border align-top">
                      <td className="py-2 font-bold">{d.username}</td>
                      <td>{KIND_LABEL[d.kind] ?? d.kind}</td>
                      <td className="font-bold text-coin">{taka(d.amount)}</td>
                      <td>{d.method}</td>
                      <td className="font-mono">{d.trx_id}</td>
                      <td className="max-w-[200px] py-2 text-[10px] text-muted-foreground">
                        {d.kind === "coins" && `${bn(d.amount * COINS_PER_TAKA)} কয়েন`}
                        {d.kind === "boost" && BOOST_PACKS[det["pack"] === "gold" ? "gold" : "silver"].label}
                        {d.kind === "ad" && `${String(det["title"] ?? "")} · ${bn(Number(det["days"] ?? 1))} দিন`}
                        {d.kind === "vip" && `${bn(Number(det["days"] ?? settings.vipDays))} দিন`}
                        {media && (
                          <a href={media} target="_blank" rel="noopener noreferrer" className="block truncate text-accent underline">{media}</a>
                        )}
                      </td>
                      <td><StatusPill status={d.status as Status} /></td>
                      <td>
                        <div className="flex justify-end gap-1.5">
                          {d.status === "pending" ? (
                            <>
                              <button onClick={() => void run(() => adminSetDeposit({ data: { password, id: d.id, status: "approved" } }), "Accept করা হয়েছে।")} className="flex items-center gap-1 rounded-lg bg-success px-2.5 py-1 text-[10px] font-bold text-success-foreground">
                                <CheckCircle2 className="size-3" /> Accept
                              </button>
                              <button onClick={() => void run(() => adminSetDeposit({ data: { password, id: d.id, status: "rejected" } }), "Reject করা হয়েছে।")} className="flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-[10px] font-bold text-destructive-foreground">
                                <XCircle className="size-3" /> Reject
                              </button>
                            </>
                          ) : (
                            <span className="text-[10px] font-semibold text-muted-foreground">{d.status === "approved" ? "চালু/যোগ হয়েছে" : "বাতিল"}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        {/* Users: block + fine */}
        <Panel icon={<Users className="size-4" />} title="ইউজার ম্যানেজমেন্ট (ব্লক ও জরিমানা)" tone="primary">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="নাম বা রেফার কোড দিয়ে খুঁজুন" className={field} />
          <ul className="space-y-2">
            {users.length === 0 && <li className="py-4 text-center text-xs text-muted-foreground">কোনো ইউজার নেই।</li>}
            {users.map((p) => (
              <UserRow
                key={p.id}
                user={p}
                onBlock={(blocked, reason) => void run(() => adminBlockUser({ data: { password, userId: p.id, blocked, reason } }), blocked ? "আইডি ব্লক করা হয়েছে।" : "আইডি আনব্লক করা হয়েছে।")}
                onFine={(amount, reason) => void run(() => adminFineUser({ data: { password, userId: p.id, amount, reason } }), `৳${bn(amount)} জরিমানা করা হয়েছে।`)}
                penalties={data.penalties.filter((x) => x.user_id === p.id)}
              />
            ))}
          </ul>
        </Panel>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Panel icon={<Video className="size-4" />} title="Watch Time Reward" tone="coin">
            <label className="block text-xs font-semibold">
              Required Watch Time (Seconds)
              <input type="number" min={1} max={600} value={draft.watchSeconds} onChange={(e) => set("watchSeconds", Number(e.target.value))} className={field} />
            </label>
            <label className="block text-xs font-semibold">
              Reward Points/Coins
              <input type="number" min={1} max={1000} value={draft.watchReward} onChange={(e) => set("watchReward", Number(e.target.value))} className={field} />
            </label>
            <button
              className={saveBtn}
              onClick={() => {
                if (draft.watchSeconds < 1 || draft.watchSeconds > 600 || draft.watchReward < 1 || draft.watchReward > 1000) {
                  notify("Invalid: seconds 1-600, coins 1-1000");
                  return;
                }
                void save({ watch_seconds: Math.round(draft.watchSeconds), watch_reward: Math.round(draft.watchReward) }, `Saved: ${draft.watchSeconds}s = ${draft.watchReward} পয়েন্ট`);
              }}
            >
              Save
            </button>
            <p className="text-[11px] text-muted-foreground">
              Active: <b className="text-foreground">{settings.watchSeconds}s</b> = <b className="text-coin">{settings.watchReward} পয়েন্ট</b> (VIP পাবে দ্বিগুণ)
            </p>
          </Panel>

          <Panel icon={<Crown className="size-4" />} title="VIP মেম্বারশিপ সেটিং" tone="coin">
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-xs font-semibold">
                দাম (৳)
                <input type="number" min={1} value={draft.vipPrice} onChange={(e) => set("vipPrice", Number(e.target.value))} className={field} />
              </label>
              <label className="block text-xs font-semibold">
                মেয়াদ (দিন)
                <input type="number" min={1} value={draft.vipDays} onChange={(e) => set("vipDays", Number(e.target.value))} className={field} />
              </label>
            </div>
            <label className="block text-xs font-semibold">
              সুবিধার তালিকা (ইউজার কেনার আগে দেখবে)
              <textarea rows={3} maxLength={1000} value={draft.vipBenefits} onChange={(e) => set("vipBenefits", e.target.value)} className={field} />
            </label>
            <button
              className={saveBtn}
              onClick={() => {
                if (draft.vipPrice < 1 || draft.vipDays < 1) {
                  notify("সঠিক দাম ও মেয়াদ দিন।");
                  return;
                }
                void save({ vip_price: Math.round(draft.vipPrice), vip_days: Math.round(draft.vipDays), vip_benefits: draft.vipBenefits.trim() });
              }}
            >
              সেভ করুন
            </button>
            <p className="text-[11px] text-muted-foreground">VIP ইউজার: {bn(data.profiles.filter((p) => p.vip_until && Date.parse(p.vip_until) > Date.now()).length)} জন</p>
          </Panel>

          <Panel icon={<Megaphone className="size-4" />} title="বিজ্ঞাপন কন্ট্রোল" tone="accent">
            <label className="block text-xs font-semibold">
              কতটি ভিডিও পরপর বিজ্ঞাপন আসবে? (VIP-রা এর দ্বিগুণ পরে দেখবে)
              <input type="number" min={1} max={100} value={draft.adFrequency} onChange={(e) => set("adFrequency", Number(e.target.value))} className={field} />
            </label>
            <label className="block text-xs font-semibold">
              বিজ্ঞাপনদাতার দাম — প্রতিদিন (৳)
              <input type="number" min={1} value={draft.adPricePerDay} onChange={(e) => set("adPricePerDay", Number(e.target.value))} className={field} />
            </label>
            <button
              className={saveBtn}
              onClick={() => {
                if (draft.adFrequency < 1 || draft.adFrequency > 100 || draft.adPricePerDay < 1) {
                  notify("সঠিক নম্বর দিন (১–১০০)।");
                  return;
                }
                void save({ ad_frequency: Math.round(draft.adFrequency), ad_price_per_day: Math.round(draft.adPricePerDay) });
              }}
            >
              সেভ করুন
            </button>
            <label className="block text-xs font-semibold">
              AdMob আইডি
              <input value={draft.adUnitId} maxLength={60} onChange={(e) => set("adUnitId", e.target.value)} className={`${field} font-mono`} />
            </label>
            <button
              className={saveBtn}
              onClick={() => {
                if (!/^ca-app-pub-\d{10,20}[/~]\d{6,12}$/.test(draft.adUnitId.trim())) {
                  notify("সঠিক AdMob আইডি দিন (যেমন ca-app-pub-1234567890123456/1234567890)।");
                  return;
                }
                void save({ ad_unit_id: draft.adUnitId.trim() }, "অ্যাড আইডি আপডেট হয়েছে!");
              }}
            >
              আইডি সেভ করুন
            </button>
          </Panel>

          <Panel icon={<Settings className="size-4" />} title="ইউজার নোটিশ ও আপলোড" tone="primary">
            <label className="block text-xs font-semibold">
              উইথড্র পেজের বার্তা
              <textarea rows={3} maxLength={300} value={draft.notice} onChange={(e) => set("notice", e.target.value)} className={field} />
            </label>
            <button className={saveBtn} onClick={() => void save({ notice: draft.notice.trim() })}>সেভ করুন</button>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary px-3 py-2.5">
              <span className="text-xs font-semibold">ইউজার ভিডিও আপলোড চালু</span>
              <button
                type="button"
                onClick={() => void save({ uploads_enabled: !settings.uploadsEnabled }, settings.uploadsEnabled ? "আপলোড বন্ধ করা হয়েছে।" : "আপলোড চালু করা হয়েছে।")}
                className={`rounded-full px-3 py-1 text-[10px] font-bold ${settings.uploadsEnabled ? "bg-success text-success-foreground" : "bg-muted text-foreground"}`}
              >
                {settings.uploadsEnabled ? "চালু" : "বন্ধ"}
              </button>
            </div>
          </Panel>
        </div>

        <Panel icon={<ScrollText className="size-4" />} title="নিয়মাবলী (ইউজার অ্যাপে দেখাবে)" tone="warning">
          <textarea rows={8} maxLength={4000} value={draft.rules} onChange={(e) => set("rules", e.target.value)} className={field} />
          <button className={saveBtn} onClick={() => void save({ rules: draft.rules.trim() }, "নিয়মাবলী সেভ হয়েছে।")}>সেভ করুন</button>
        </Panel>

        <Panel icon={<BadgeDollarSign className="size-4" />} title="সেন্ডমানি নাম্বার ও নির্দেশনা" tone="coin">
          <div className="grid gap-3 sm:grid-cols-3">
            {(["bKash", "Nagad", "Rocket"] as DepositMethod[]).map((m) => (
              <label key={m} className="block text-xs font-bold">
                {m} নাম্বার
                <input value={draft.numbers[m]} maxLength={20} onChange={(e) => set("numbers", { ...draft.numbers, [m]: e.target.value })} className={`${field} font-mono`} />
              </label>
            ))}
          </div>
          <label className="block text-xs font-bold">
            ইউজারদের জন্য নির্দেশনা
            <textarea rows={3} maxLength={500} value={draft.depositNotice} onChange={(e) => set("depositNotice", e.target.value)} className={field} />
          </label>
          <button
            className={saveBtn}
            onClick={() =>
              void save(
                {
                  pay_numbers: {
                    bKash: draft.numbers.bKash.trim(),
                    Nagad: draft.numbers.Nagad.trim(),
                    Rocket: draft.numbers.Rocket.trim(),
                  },
                  deposit_notice: draft.depositNotice.trim(),
                },
                "সেন্ডমানি নাম্বার ও নিয়ম সেভ হয়েছে।",
              )
            }
          >
            সেভ করুন
          </button>
        </Panel>

        <Panel icon={<DollarSign className="size-4" />} title={`উইথড্র রিকোয়েস্ট (${bn(POINTS_PER_TAKA)} পয়েন্ট = ৳১)`} tone="success">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr><th className="py-2">ইউজার</th><th>মেথড</th><th>নম্বর</th><th>টাকা</th><th>স্ট্যাটাস</th><th className="text-right">অ্যাকশন</th></tr>
              </thead>
              <tbody>
                {data.withdrawals.length === 0 && <tr><td colSpan={6} className="py-4 text-center text-muted-foreground">কোনো উইথড্র রিকোয়েস্ট নেই।</td></tr>}
                {data.withdrawals.map((w) => (
                  <tr key={w.id} className="border-t border-border">
                    <td className="py-2 font-bold">{w.username}</td>
                    <td>{w.method}</td>
                    <td className="font-mono text-coin">{w.phone}</td>
                    <td className="font-bold text-success">{taka(w.amount)}</td>
                    <td><StatusPill status={w.status as Status} /></td>
                    <td>
                      <div className="flex justify-end gap-1.5">
                        {w.status === "pending" ? (
                          <>
                            <button onClick={() => void run(() => adminSetWithdraw({ data: { password, id: w.id, status: "approved" } }), "পেমেন্ট সম্পন্ন হিসেবে চিহ্নিত।")} className="rounded-lg bg-success px-2.5 py-1 text-[10px] font-bold text-success-foreground">পেমেন্ট সম্পন্ন</button>
                            <button onClick={() => void run(() => adminSetWithdraw({ data: { password, id: w.id, status: "rejected" } }), "রিজেক্ট — টাকা ইউজারের ব্যালেন্সে ফেরত গেছে।")} className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive">রিজেক্ট</button>
                          </>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">{w.status === "approved" ? "পরিশোধ করা হয়েছে" : "রিজেক্ট (ফেরত)"}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel icon={<Upload className="size-4" />} title="ইউজার আপলোড করা ভিডিও" tone="accent">
          {data.uploads.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">এখনো কোনো ভিডিও আপলোড হয়নি।</p>
          ) : (
            <ul className="space-y-2">
              {data.uploads.map((u) => (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{u.username} · {u.caption || "ক্যাপশন নেই"}</p>
                    <a href={u.url} target="_blank" rel="noopener noreferrer" className="block truncate text-[10px] text-accent underline">{u.url}</a>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusPill status={u.status as Status} />
                    {u.status !== "approved" && (
                      <button onClick={() => void run(() => adminSetUpload({ data: { password, id: u.id, status: "approved" } }), "ভিডিও অনুমোদন করা হয়েছে।")} className="rounded-lg bg-success px-2.5 py-1 text-[10px] font-bold text-success-foreground">অনুমোদন</button>
                    )}
                    {u.status !== "rejected" && (
                      <button onClick={() => void run(() => adminSetUpload({ data: { password, id: u.id, status: "rejected" } }), "ভিডিও রিজেক্ট করা হয়েছে।")} className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive">রিজেক্ট</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel icon={<MessageCircle className="size-4" />} title="কমেন্ট মডারেশন" tone="primary">
          {data.comments.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">এখনো কোনো কমেন্ট নেই।</p>
          ) : (
            <ul className="space-y-2">
              {data.comments.map((c) => (
                <li key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-secondary px-3 py-2">
                  <p className="min-w-0 text-xs"><span className="font-bold text-accent">{c.username}</span> {c.text}</p>
                  <button onClick={() => void run(() => adminDeleteComment({ data: { password, id: c.id } }), "কমেন্ট মুছে ফেলা হয়েছে।")} aria-label="Delete comment" className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/10 p-1.5 text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
          <p className="bg-brand-gradient rounded-full px-4 py-2 text-xs font-bold text-brand-foreground shadow-xl">{toast}</p>
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  penalties,
  onBlock,
  onFine,
}: {
  user: AdminData["profiles"][number];
  penalties: AdminData["penalties"];
  onBlock: (blocked: boolean, reason: string) => void;
  onFine: (amount: number, reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [fine, setFine] = useState("");
  const vip = user.vip_until && Date.parse(user.vip_until) > Date.now();
  const balance = user.points / POINTS_PER_TAKA;

  return (
    <li className={`rounded-xl border px-3 py-2.5 ${user.blocked ? "border-destructive/40 bg-destructive/10" : "border-border bg-secondary"}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 text-xs">
          <p className="font-extrabold">
            {user.username} {vip && <span className="text-coin">👑 VIP</span>} {user.blocked && <span className="text-destructive">⛔ ব্লক</span>}
          </p>
          <p className="text-[10px] text-muted-foreground">
            🪙 {bn(user.coins)} কয়েন · <span className={balance < 0 ? "text-destructive" : ""}>৳{bn(balance.toFixed(2))}</span> · কোড {user.referral_code} · রেফার {bn(user.referrals)}
          </p>
        </div>
        <button onClick={() => setOpen(!open)} className="rounded-lg border border-border bg-card px-2.5 py-1 text-[10px] font-bold">
          {open ? "বন্ধ" : "অ্যাকশন"}
        </button>
      </div>
      {open && (
        <div className="mt-3 space-y-2">
          <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder="কারণ (কোন নিয়ম ভেঙেছে)" className={field} />
          <div className="flex flex-wrap gap-2">
            {user.blocked ? (
              <button onClick={() => onBlock(false, "")} className="flex items-center gap-1 rounded-lg bg-success px-3 py-1.5 text-[10px] font-bold text-success-foreground">
                <CheckCircle2 className="size-3" /> আনব্লক
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!reason.trim()) return;
                  onBlock(true, reason.trim());
                }}
                disabled={!reason.trim()}
                className="flex items-center gap-1 rounded-lg bg-destructive px-3 py-1.5 text-[10px] font-bold text-destructive-foreground disabled:opacity-40"
              >
                <Ban className="size-3" /> আইডি ব্লক
              </button>
            )}
            <input value={fine} onChange={(e) => setFine(e.target.value.replace(/\D/g, ""))} inputMode="numeric" placeholder="জরিমানা ৳" className="w-24 rounded-xl border border-input bg-secondary px-3 py-1.5 text-xs" />
            <button
              onClick={() => {
                const amt = Number(fine);
                if (!amt || !reason.trim()) return;
                onFine(amt, reason.trim());
                setFine("");
              }}
              disabled={!Number(fine) || !reason.trim()}
              className="flex items-center gap-1 rounded-lg bg-warning px-3 py-1.5 text-[10px] font-bold text-warning-foreground disabled:opacity-40"
            >
              <Gavel className="size-3" /> জরিমানা করুন
            </button>
          </div>
          {user.blocked && user.block_reason && <p className="text-[10px] text-destructive">ব্লকের কারণ: {user.block_reason}</p>}
          {penalties.map((p) => (
            <p key={p.id} className="text-[10px] text-muted-foreground">⚖️ -৳{bn(p.amount)} · {p.reason}</p>
          ))}
        </div>
      )}
    </li>
  );
}

type PanelTone = "coin" | "primary" | "success" | "accent" | "warning";

const PANEL_TONE: Record<PanelTone, string> = {
  coin: "text-coin",
  primary: "text-primary",
  success: "text-success",
  accent: "text-accent",
  warning: "text-warning",
};

function Panel({ icon, title, tone, children }: { icon: ReactNode; title: string; tone: PanelTone; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-border bg-card p-5">
      <h3 className={`flex items-center gap-2 text-sm font-extrabold ${PANEL_TONE[tone]}`}>
        <span className="shrink-0">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function StatCard({ icon, label, value, hint, tone }: { icon: ReactNode; label: string; value: string; hint: string; tone: PanelTone }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <span className={`shrink-0 ${PANEL_TONE[tone]}`}>{icon}</span>
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-extrabold text-foreground">{value}</p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</p>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  const styles: Record<Status, string> = {
    pending: "border-warning/30 bg-warning/15 text-warning",
    approved: "border-success/30 bg-success/15 text-success",
    rejected: "border-destructive/30 bg-destructive/15 text-destructive",
  };
  const labels: Record<Status, string> = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${styles[status]}`}>{labels[status] ?? status}</span>;
}
