/**
 * Cloud-backed app store. Public data (settings, comments, approved uploads,
 * accepted promotions) loads for everyone; wallet + personal history load for
 * the signed-in user. Coin/point changes go through database functions only.
 */
import { useEffect, useState, useSyncExternalStore } from "react";

import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_AD_FREQUENCY = 20;
export const MIN_AD_FREQUENCY = 1;
export const MAX_AD_FREQUENCY = 100;
export const DEFAULT_NOTICE = "পেমেন্ট পেতে কোনো সমস্যা হলে সাপোর্ট গ্রুপে যোগাযোগ করুন।";
export const DEFAULT_DEPOSIT_NOTICE =
  "শুধু Send Money করুন। টাকা পাঠানোর পর সঠিক TrxID দিয়ে রিকোয়েস্ট দিন। এডমিন যাচাই করে কয়েন যোগ করবে।";
export const DEFAULT_VIP_BENEFITS =
  "👑 নামের পাশে VIP ব্যাজ\n📺 অর্ধেক বিজ্ঞাপন দেখবেন\n🪙 ভিডিও দেখে দ্বিগুণ পয়েন্ট";
export const DEFAULT_RULES = [
  "১. একাধিক অ্যাকাউন্ট খোলা যাবে না।",
  "২. ভুয়া বা অন্যের TrxID দেওয়া যাবে না।",
  "৩. কমেন্টে গালি, স্প্যাম বা অশ্লীল কথা লেখা যাবে না।",
  "৪. অন্যের ভিডিও নিজের নামে আপলোড করা যাবে না।",
  "৫. অটো-ক্লিক বা কোনো চিটিং অ্যাপ ব্যবহার করা যাবে না।",
  "নিয়ম ভাঙলে এডমিন জরিমানা করতে পারে অথবা আইডি ব্লক করতে পারে।",
].join("\n");

export const CHECKIN_REWARD = 10;
export const REFERRAL_REWARD = 50;
export const MAX_WATCH_SECONDS = 600;
export const MAX_WATCH_REWARD = 1000;
export const COINS_PER_TAKA = 5;
export const MIN_DEPOSIT = 10;
export const POINTS_PER_TAKA = 100;

export type WithdrawMethod = "bKash" | "Nagad";
export type ReqStatus = "pending" | "approved" | "rejected";
export type UploadStatus = ReqStatus;
export type WithdrawStatus = ReqStatus;
export type DepositMethod = "bKash" | "Nagad" | "Rocket";
export type DepositKind = "coins" | "boost" | "ad" | "vip";
export type BoostPack = "silver" | "gold";

export const BOOST_PACKS: Record<BoostPack, { label: string; taka: number; views: number; featured: boolean }> = {
  silver: { label: "সিলভার প্যাক", taka: 50, views: 1000, featured: false },
  gold: { label: "গোল্ড প্যাক", taka: 150, views: 3000, featured: true },
};

export interface VideoComment {
  id: string;
  videoId: string;
  user: string;
  text: string;
  createdAt: number;
}
export interface UploadedVideo {
  id: string;
  user: string;
  caption: string;
  url: string;
  status: UploadStatus;
  createdAt: number;
}
export interface GiftRecord {
  id: string;
  gift: string;
  emoji: string;
  coins: number;
  creator: string;
  sender: string;
  createdAt: number;
}
export interface WithdrawRequest {
  id: string;
  user: string;
  phone: string;
  method: string;
  amount: number;
  status: WithdrawStatus;
  createdAt: number;
}
export interface DepositRequest {
  id: string;
  user: string;
  amount: number;
  method: DepositMethod;
  trxId: string;
  status: ReqStatus;
  kind: DepositKind;
  details: Record<string, unknown>;
  createdAt: number;
}
export interface Promo {
  id: string;
  kind: "boost" | "ad";
  user: string;
  details: Record<string, unknown>;
}
export interface Profile {
  id: string;
  username: string;
  coins: number;
  points: number;
  vipUntil: number | null;
  blocked: boolean;
  blockReason: string;
  referralCode: string;
  referrals: number;
  lastCheckIn: string;
  checkInStreak: number;
}
export interface Penalty {
  id: string;
  amount: number;
  reason: string;
  createdAt: number;
}

export interface AppSettings {
  adFrequency: number;
  notice: string;
  adUnitId: string;
  watchSeconds: number;
  watchReward: number;
  uploadsEnabled: boolean;
  numbers: Record<DepositMethod, string>;
  depositNotice: string;
  vipPrice: number;
  vipDays: number;
  vipBenefits: string;
  adPricePerDay: number;
  rules: string;
}

interface State {
  ready: boolean;
  authReady: boolean;
  userId: string | null;
  email: string;
  settings: AppSettings;
  comments: VideoComment[];
  uploads: UploadedVideo[];
  promos: Promo[];
  vipNames: string[];
  profile: Profile | null;
  deposits: DepositRequest[];
  gifts: GiftRecord[];
  withdrawals: WithdrawRequest[];
  penalties: Penalty[];
}

const DEFAULT_SETTINGS: AppSettings = {
  adFrequency: DEFAULT_AD_FREQUENCY,
  notice: DEFAULT_NOTICE,
  adUnitId: "ca-app-pub-xxxxxxxx~yyyyyyyy",
  watchSeconds: 10,
  watchReward: 1,
  uploadsEnabled: true,
  numbers: { bKash: "01XXXXXXXXX", Nagad: "01XXXXXXXXX", Rocket: "01XXXXXXXXX" },
  depositNotice: DEFAULT_DEPOSIT_NOTICE,
  vipPrice: 50,
  vipDays: 30,
  vipBenefits: DEFAULT_VIP_BENEFITS,
  adPricePerDay: 100,
  rules: DEFAULT_RULES,
};

const INITIAL: State = {
  ready: false,
  authReady: false,
  userId: null,
  email: "",
  settings: DEFAULT_SETTINGS,
  comments: [],
  uploads: [],
  promos: [],
  vipNames: [],
  profile: null,
  deposits: [],
  gifts: [],
  withdrawals: [],
  penalties: [],
};

let state: State = INITIAL;
const listeners = new Set<() => void>();
function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  for (const l of listeners) l();
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

const ts = (v: string | null | undefined) => (v ? Date.parse(v) : 0);
const asStatus = (v: string): ReqStatus => (v === "approved" || v === "rejected" ? v : "pending");
const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

export function mapSettings(row: Record<string, unknown> | null): AppSettings {
  if (!row) return DEFAULT_SETTINGS;
  const nums = obj(row["pay_numbers"]);
  const str = (k: string, fb: string) => (typeof row[k] === "string" && (row[k] as string).trim() ? (row[k] as string) : fb);
  const num = (k: string, fb: number) => (typeof row[k] === "number" ? (row[k] as number) : fb);
  return {
    adFrequency: num("ad_frequency", DEFAULT_AD_FREQUENCY),
    notice: str("notice", DEFAULT_NOTICE),
    adUnitId: str("ad_unit_id", DEFAULT_SETTINGS.adUnitId),
    watchSeconds: num("watch_seconds", 10),
    watchReward: num("watch_reward", 1),
    uploadsEnabled: row["uploads_enabled"] !== false,
    numbers: {
      bKash: typeof nums["bKash"] === "string" ? nums["bKash"] : "01XXXXXXXXX",
      Nagad: typeof nums["Nagad"] === "string" ? nums["Nagad"] : "01XXXXXXXXX",
      Rocket: typeof nums["Rocket"] === "string" ? nums["Rocket"] : "01XXXXXXXXX",
    },
    depositNotice: str("deposit_notice", DEFAULT_DEPOSIT_NOTICE),
    vipPrice: num("vip_price", 50),
    vipDays: num("vip_days", 30),
    vipBenefits: str("vip_benefits", DEFAULT_VIP_BENEFITS),
    adPricePerDay: num("ad_price_per_day", 100),
    rules: str("rules", DEFAULT_RULES),
  };
}

export async function loadPublic() {
  const [s, c, u, p, v] = await Promise.all([
    supabase.from("app_settings").select("*").eq("id", 1).maybeSingle(),
    supabase.from("comments").select("*").order("created_at", { ascending: true }).limit(1000),
    supabase.from("uploads").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.rpc("feed_promos"),
    supabase.rpc("vip_usernames"),
  ]);
  set({
    ready: true,
    settings: mapSettings((s.data as Record<string, unknown> | null) ?? null),
    comments: (c.data ?? []).map((r) => ({
      id: r.id,
      videoId: r.video_id,
      user: r.username,
      text: r.text,
      createdAt: ts(r.created_at),
    })),
    uploads: (u.data ?? []).map((r) => ({
      id: r.id,
      user: r.username,
      caption: r.caption,
      url: r.url,
      status: asStatus(r.status),
      createdAt: ts(r.created_at),
    })),
    promos: (p.data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind === "ad" ? "ad" : "boost",
      user: r.username,
      details: obj(r.details),
    })),
    vipNames: (v.data ?? []) as string[],
  });
}

async function loadUser(userId: string, email: string) {
  const fallbackName = "@" + (email.split("@")[0] || "user").slice(0, 20);
  const { data: prof } = await supabase.rpc("ensure_profile", { _username: fallbackName });
  const [d, g, w, pen] = await Promise.all([
    supabase.from("deposits").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("gifts").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("penalties").select("*").order("created_at", { ascending: false }).limit(100),
  ]);
  const row = prof as Record<string, unknown> | null;
  set({
    profile: row
      ? {
          id: String(row["id"]),
          username: String(row["username"] ?? fallbackName),
          coins: Number(row["coins"]) || 0,
          points: Number(row["points"]) || 0,
          vipUntil: row["vip_until"] ? ts(String(row["vip_until"])) : null,
          blocked: row["blocked"] === true,
          blockReason: String(row["block_reason"] ?? ""),
          referralCode: String(row["referral_code"] ?? ""),
          referrals: Number(row["referrals"]) || 0,
          lastCheckIn: String(row["last_checkin"] ?? ""),
          checkInStreak: Number(row["checkin_streak"]) || 0,
        }
      : null,
    deposits: (d.data ?? []).map((r) => ({
      id: r.id,
      user: r.username,
      amount: r.amount,
      method: r.method as DepositMethod,
      trxId: r.trx_id,
      status: asStatus(r.status),
      kind: r.kind as DepositKind,
      details: obj(r.details),
      createdAt: ts(r.created_at),
    })),
    gifts: (g.data ?? []).map((r) => ({
      id: r.id,
      gift: r.gift,
      emoji: r.emoji,
      coins: r.coins,
      creator: r.creator,
      sender: "@আপনি",
      createdAt: ts(r.created_at),
    })),
    withdrawals: (w.data ?? []).map((r) => ({
      id: r.id,
      user: r.username,
      phone: r.phone,
      method: r.method,
      amount: r.amount,
      status: asStatus(r.status),
      createdAt: ts(r.created_at),
    })),
    penalties: (pen.data ?? []).map((r) => ({
      id: r.id,
      amount: r.amount,
      reason: r.reason,
      createdAt: ts(r.created_at),
    })),
  });
  void userId;
}

export async function refresh() {
  await loadPublic();
  if (state.userId) await loadUser(state.userId, state.email);
}

let started = false;
function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  void loadPublic();
  supabase.auth.getSession().then(async ({ data }) => {
    const user = data.session?.user;
    set({ userId: user?.id ?? null, email: user?.email ?? "" });
    if (user) await loadUser(user.id, user.email ?? "");
    set({ authReady: true });
  });
  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
    const user = session?.user;
    if (!user) {
      set({ userId: null, email: "", profile: null, deposits: [], gifts: [], withdrawals: [], penalties: [], authReady: true });
      return;
    }
    set({ userId: user.id, email: user.email ?? "" });
    setTimeout(() => {
      void loadUser(user.id, user.email ?? "").then(() => set({ authReady: true }));
    }, 0);
  });
  window.addEventListener("focus", () => void refresh());
}

function useHydrated(): boolean {
  const [h, setH] = useState(false);
  useEffect(() => setH(true), []);
  return h;
}

export function useStore(): State {
  const s = useSyncExternalStore(subscribe, () => state, () => INITIAL);
  const hydrated = useHydrated();
  useEffect(() => start(), []);
  return hydrated ? s : INITIAL;
}

export function isVip(profile: Profile | null): boolean {
  return Boolean(profile?.vipUntil && profile.vipUntil > Date.now());
}

export function isCheckedInToday(profile: Profile | null): boolean {
  if (!profile?.lastCheckIn) return false;
  return profile.lastCheckIn === new Date().toISOString().slice(0, 10);
}

// ---------------- mutations ----------------

export async function addComment(videoId: string, text: string) {
  const t = text.trim().slice(0, 240);
  if (!t || !state.userId || !state.profile) return false;
  const { error } = await supabase
    .from("comments")
    .insert({ video_id: videoId, user_id: state.userId, username: state.profile.username, text: t });
  await loadPublic();
  return !error;
}

export async function submitUpload(caption: string, url: string) {
  if (!state.userId || !state.profile) return false;
  const { error } = await supabase.from("uploads").insert({
    user_id: state.userId,
    username: state.profile.username,
    caption: caption.trim().slice(0, 160),
    url: url.slice(0, 500),
  });
  await refresh();
  return !error;
}

export async function submitDeposit(input: {
  kind: DepositKind;
  amount: number;
  method: DepositMethod;
  trxId: string;
  details?: Record<string, string | number>;
}): Promise<"ok" | "duplicate" | "error"> {
  if (!state.userId || !state.profile) return "error";
  const { error } = await supabase.from("deposits").insert({
    user_id: state.userId,
    username: state.profile.username,
    kind: input.kind,
    amount: input.amount,
    method: input.method,
    trx_id: input.trxId,
    details: input.details ?? {},
  });
  await refresh();
  if (error) return error.code === "23505" ? "duplicate" : "error";
  return "ok";
}

export async function sendGift(gift: string, emoji: string, coins: number, creator: string) {
  const { data, error } = await supabase.rpc("send_gift", {
    _gift: gift,
    _emoji: emoji,
    _coins: coins,
    _creator: creator,
  });
  await refresh();
  return !error && data === true;
}

export async function claimCheckIn(): Promise<number> {
  const { data, error } = await supabase.rpc("daily_checkin");
  await refresh();
  if (error) return 0;
  return Number(data);
}

export async function claimReward(key: string, kind: "watch" | "ad"): Promise<number> {
  const { data, error } = await supabase.rpc("claim_reward", { _key: key, _kind: kind });
  if (!error && Number(data) > 0 && state.profile) {
    set({ profile: { ...state.profile, points: state.profile.points + Number(data) } });
  }
  return error ? 0 : Number(data);
}

export async function requestWithdraw(phone: string, method: WithdrawMethod, amount: number) {
  const { data, error } = await supabase.rpc("request_withdraw", {
    _phone: phone,
    _method: method,
    _amount: amount,
  });
  await refresh();
  return !error && data === true;
}

export async function applyReferral(code: string) {
  const { data } = await supabase.rpc("apply_referral", { _code: code });
  await refresh();
  return data === true;
}
