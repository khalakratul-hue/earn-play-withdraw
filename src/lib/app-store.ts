import { useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "watchcoin.v1";
const CHANGE_EVENT = "watchcoin:change";

export const DEFAULT_AD_FREQUENCY = 20;
export const MIN_AD_FREQUENCY = 1;
export const MAX_AD_FREQUENCY = 100;

export const DEFAULT_NOTICE =
  "পেমেন্ট পেতে কোনো সমস্যা হলে সাপোর্ট গ্রুপে যোগাযোগ করুন।";

export const CHECKIN_REWARD = 10;
export const REFERRAL_REWARD = 50;

export type WithdrawMethod = "bKash" | "Nagad";
export type WithdrawStatus = "pending" | "approved" | "rejected";
export type UploadStatus = "pending" | "approved" | "rejected";

export interface WithdrawRequest {
  id: string;
  user: string;
  phone: string;
  method: WithdrawMethod;
  amount: number;
  status: WithdrawStatus;
  createdAt: number;
}

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

export interface AppSettings {
  adFrequency: number;
  notice: string;
  requests: WithdrawRequest[];
  comments: VideoComment[];
  uploads: UploadedVideo[];
  gifts: GiftRecord[];
  uploadsEnabled: boolean;
  referralCode: string;
  referrals: number;
  lastCheckIn: string;
  checkInStreak: number;
}

const SEED_REQUESTS: WithdrawRequest[] = [
  {
    id: "req-1001",
    user: "Karim Ahmed",
    phone: "01712345678",
    method: "bKash",
    amount: 50,
    status: "pending",
    createdAt: Date.parse("2026-09-19T03:05:00Z"),
  },
  {
    id: "req-1002",
    user: "Rahim Hossain",
    phone: "01987654321",
    method: "Nagad",
    amount: 100,
    status: "pending",
    createdAt: Date.parse("2026-09-19T03:40:00Z"),
  },
];

const SEED_COMMENTS: VideoComment[] = [
  {
    id: "c-1",
    videoId: "v-0",
    user: "@shanto",
    text: "দুর্দান্ত ভিডিও! আরো চাই।",
    createdAt: Date.parse("2026-09-19T05:00:00Z"),
  },
  {
    id: "c-2",
    videoId: "v-0",
    user: "@mitu",
    text: "খুব সুন্দর লাগলো।",
    createdAt: Date.parse("2026-09-19T05:30:00Z"),
  },
];

const DEFAULTS: AppSettings = {
  adFrequency: DEFAULT_AD_FREQUENCY,
  notice: DEFAULT_NOTICE,
  requests: SEED_REQUESTS,
  comments: SEED_COMMENTS,
  uploads: [],
  gifts: [],
  uploadsEnabled: true,
  referralCode: "WC-DEMO",
  referrals: 0,
  lastCheckIn: "",
  checkInStreak: 0,
};

function clampFrequency(value: unknown): number {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) return DEFAULT_AD_FREQUENCY;
  return Math.min(MAX_AD_FREQUENCY, Math.max(MIN_AD_FREQUENCY, parsed));
}

function normalizeRequest(value: unknown): WithdrawRequest | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw["id"] !== "string") return null;
  return {
    id: raw["id"],
    user: typeof raw["user"] === "string" ? raw["user"] : "—",
    phone: typeof raw["phone"] === "string" ? raw["phone"] : "",
    method: raw["method"] === "Nagad" ? "Nagad" : "bKash",
    amount: Number(raw["amount"]) || 0,
    status:
      raw["status"] === "approved"
        ? "approved"
        : raw["status"] === "rejected"
          ? "rejected"
          : "pending",
    createdAt: Number(raw["createdAt"]) || 0,
  };
}

function normalizeComment(value: unknown): VideoComment | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw["id"] !== "string" || typeof raw["text"] !== "string")
    return null;
  return {
    id: raw["id"],
    videoId: typeof raw["videoId"] === "string" ? raw["videoId"] : "",
    user: typeof raw["user"] === "string" ? raw["user"] : "@user",
    text: raw["text"],
    createdAt: Number(raw["createdAt"]) || 0,
  };
}

function normalizeUpload(value: unknown): UploadedVideo | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw["id"] !== "string" || typeof raw["url"] !== "string")
    return null;
  return {
    id: raw["id"],
    user: typeof raw["user"] === "string" ? raw["user"] : "@me",
    caption: typeof raw["caption"] === "string" ? raw["caption"] : "",
    url: raw["url"],
    status:
      raw["status"] === "approved"
        ? "approved"
        : raw["status"] === "rejected"
          ? "rejected"
          : "pending",
    createdAt: Number(raw["createdAt"]) || 0,
  };
}

function normalizeGift(value: unknown): GiftRecord | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw["id"] !== "string") return null;
  return {
    id: raw["id"],
    gift: typeof raw["gift"] === "string" ? raw["gift"] : "গিফট",
    emoji: typeof raw["emoji"] === "string" ? raw["emoji"] : "🎁",
    coins: Number(raw["coins"]) || 0,
    creator: typeof raw["creator"] === "string" ? raw["creator"] : "@creator",
    sender: typeof raw["sender"] === "string" ? raw["sender"] : "@আপনি",
    createdAt: Number(raw["createdAt"]) || 0,
  };
}

function makeReferralCode(): string {
  return `WC-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function normalize(value: unknown): AppSettings {
  if (!value || typeof value !== "object") return DEFAULTS;
  const raw = value as Record<string, unknown>;
  const storedRequests = raw["requests"];
  const requests = Array.isArray(storedRequests)
    ? storedRequests
        .map(normalizeRequest)
        .filter((r): r is WithdrawRequest => r !== null)
    : SEED_REQUESTS;
  const storedComments = raw["comments"];
  const comments = Array.isArray(storedComments)
    ? storedComments
        .map(normalizeComment)
        .filter((c): c is VideoComment => c !== null)
    : SEED_COMMENTS;
  const storedUploads = raw["uploads"];
  const uploads = Array.isArray(storedUploads)
    ? storedUploads
        .map(normalizeUpload)
        .filter((u): u is UploadedVideo => u !== null)
    : [];
  const storedGifts = raw["gifts"];
  const gifts = Array.isArray(storedGifts)
    ? storedGifts.map(normalizeGift).filter((g): g is GiftRecord => g !== null)
    : [];
  return {
    adFrequency: clampFrequency(raw["adFrequency"]),
    notice: typeof raw["notice"] === "string" ? raw["notice"] : DEFAULT_NOTICE,
    requests,
    comments,
    uploads,
    gifts,
    uploadsEnabled: raw["uploadsEnabled"] !== false,
    referralCode:
      typeof raw["referralCode"] === "string" && raw["referralCode"].length > 0
        ? raw["referralCode"]
        : makeReferralCode(),
    referrals: Number(raw["referrals"]) || 0,
    lastCheckIn: typeof raw["lastCheckIn"] === "string" ? raw["lastCheckIn"] : "",
    checkInStreak: Number(raw["checkInStreak"]) || 0,
  };
}

function readStore(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS, referralCode: makeReferralCode() };
    return normalize(JSON.parse(raw));
  } catch {
    return DEFAULTS;
  }
}

let cache: AppSettings | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function getSnapshot(): AppSettings {
  if (cache === null) cache = readStore();
  return cache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function write(next: AppSettings) {
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage full or blocked — keep the in-memory value for this session.
  }
  emit();
}

function update(mutator: (current: AppSettings) => AppSettings) {
  write(mutator(getSnapshot()));
}

if (typeof window !== "undefined") {
  window.addEventListener(CHANGE_EVENT, () => {
    cache = null;
    emit();
  });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY) {
      cache = null;
      emit();
    }
  });
}

/** Settings + payouts, stable across server render and first client paint. */
export function useAppSettings(): AppSettings {
  const settings = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULTS);
  const hydrated = useHydrated();
  return hydrated ? settings : DEFAULTS;
}

function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setHydrated(true);
  }, []);
  return hydrated;
}

export function saveAdFrequency(value: number): boolean {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed) || parsed < MIN_AD_FREQUENCY) return false;
  update((current) => ({ ...current, adFrequency: clampFrequency(parsed) }));
  return true;
}

export function saveNotice(text: string) {
  const trimmed = text.trim();
  update((current) => ({
    ...current,
    notice: trimmed.length > 0 ? trimmed.slice(0, 300) : DEFAULT_NOTICE,
  }));
}

export function setRequestStatus(id: string, status: WithdrawStatus) {
  update((current) => ({
    ...current,
    requests: current.requests.map((request) =>
      request.id === id ? { ...request, status } : request,
    ),
  }));
}

export function submitWithdraw(input: {
  user: string;
  phone: string;
  method: WithdrawMethod;
  amount: number;
}) {
  const id = `req-${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  update((current) => ({
    ...current,
    requests: [
      {
        id,
        user: input.user,
        phone: input.phone,
        method: input.method,
        amount: input.amount,
        status: "pending",
        createdAt: Date.now(),
      },
      ...current.requests,
    ],
  }));
}

/** Adds a comment to a video and returns it. */
export function addComment(videoId: string, text: string, user = "@আপনি") {
  const trimmed = text.trim().slice(0, 240);
  if (trimmed.length === 0) return;
  update((current) => ({
    ...current,
    comments: [
      ...current.comments,
      {
        id: `c-${Date.now().toString(36)}`,
        videoId,
        user,
        text: trimmed,
        createdAt: Date.now(),
      },
    ],
  }));
}

export function deleteComment(id: string) {
  update((current) => ({
    ...current,
    comments: current.comments.filter((comment) => comment.id !== id),
  }));
}

export function submitUpload(input: { caption: string; url: string; user: string }) {
  update((current) => ({
    ...current,
    uploads: [
      {
        id: `up-${Date.now().toString(36)}`,
        user: input.user,
        caption: input.caption.trim().slice(0, 160),
        url: input.url,
        status: "pending",
        createdAt: Date.now(),
      },
      ...current.uploads,
    ],
  }));
}

export function setUploadStatus(id: string, status: UploadStatus) {
  update((current) => ({
    ...current,
    uploads: current.uploads.map((upload) =>
      upload.id === id ? { ...upload, status } : upload,
    ),
  }));
}

export function setUploadsEnabled(enabled: boolean) {
  update((current) => ({ ...current, uploadsEnabled: enabled }));
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isCheckedInToday(settings: AppSettings): boolean {
  return settings.lastCheckIn === today();
}

/** Daily check-in: awards points once per calendar day and keeps a streak. */
export function claimCheckIn(): { ok: boolean; reward: number; streak: number } {
  const current = getSnapshot();
  if (current.lastCheckIn === today()) {
    return { ok: false, reward: 0, streak: current.checkInStreak };
  }
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const streak = current.lastCheckIn === yesterday ? current.checkInStreak + 1 : 1;
  write({ ...current, lastCheckIn: today(), checkInStreak: streak });
  return { ok: true, reward: CHECKIN_REWARD, streak };
}

/** Records a successful referral (a friend opened the app with this code). */
export function addReferral(): number {
  const current = getSnapshot();
  const referrals = current.referrals + 1;
  write({ ...current, referrals });
  return referrals;
}

/** Records a sent gift for the history page and the creator dashboard. */
export function recordGift(input: {
  gift: string;
  emoji: string;
  coins: number;
  creator: string;
  sender?: string;
}) {
  update((current) => ({
    ...current,
    gifts: [
      {
        id: `g-${Date.now().toString(36)}`,
        gift: input.gift,
        emoji: input.emoji,
        coins: input.coins,
        creator: input.creator,
        sender: input.sender ?? "@আপনি",
        createdAt: Date.now(),
      },
      ...current.gifts,
    ],
  }));
}
