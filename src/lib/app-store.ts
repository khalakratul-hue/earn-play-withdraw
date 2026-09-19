import { useEffect, useState, useSyncExternalStore } from "react";

const STORAGE_KEY = "watchcoin.v1";
const CHANGE_EVENT = "watchcoin:change";

export const DEFAULT_AD_FREQUENCY = 20;
export const MIN_AD_FREQUENCY = 1;
export const MAX_AD_FREQUENCY = 100;

export const DEFAULT_NOTICE =
  "পেমেন্ট পেতে কোনো সমস্যা হলে সাপোর্ট গ্রুপে যোগাযোগ করুন।";

export type WithdrawMethod = "bKash" | "Nagad";
export type WithdrawStatus = "pending" | "approved" | "rejected";

export interface WithdrawRequest {
  id: string;
  user: string;
  phone: string;
  method: WithdrawMethod;
  amount: number;
  status: WithdrawStatus;
  createdAt: number;
}

export interface AppSettings {
  adFrequency: number;
  notice: string;
  requests: WithdrawRequest[];
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

const DEFAULTS: AppSettings = {
  adFrequency: DEFAULT_AD_FREQUENCY,
  notice: DEFAULT_NOTICE,
  requests: SEED_REQUESTS,
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

function normalize(value: unknown): AppSettings {
  if (!value || typeof value !== "object") return DEFAULTS;
  const raw = value as Record<string, unknown>;
  const stored = raw["requests"];
  const requests = Array.isArray(stored)
    ? stored
        .map(normalizeRequest)
        .filter((r): r is WithdrawRequest => r !== null)
    : SEED_REQUESTS;
  return {
    adFrequency: clampFrequency(raw["adFrequency"]),
    notice: typeof raw["notice"] === "string" ? raw["notice"] : DEFAULT_NOTICE,
    requests,
  };
}

function readStore(): AppSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
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
