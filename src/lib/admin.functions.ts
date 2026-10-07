import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const COINS_PER_TAKA = 5;

async function checkPassword(password: string) {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  const expected = process.env["ADMIN_PASSWORD"];
  if (!expected) throw new Error("ADMIN_PASSWORD is not set");
  const a = createHash("sha256").update(password, "utf8").digest();
  const b = createHash("sha256").update(expected, "utf8").digest();
  if (!timingSafeEqual(a, b)) throw new Error("Unauthorized");
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

const pw = z.string().min(1).max(100);
const status = z.enum(["pending", "approved", "rejected"]);

export const adminLogin = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: pw }).parse(d))
  .handler(async ({ data }) => {
    try {
      await checkPassword(data.password);
      return { ok: true };
    } catch {
      return { ok: false };
    }
  });

export const adminLoad = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: pw }).parse(d))
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const db = await admin();
    const [profiles, deposits, withdrawals, uploads, comments, penalties] = await Promise.all([
      db.from("profiles").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("deposits").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("withdrawals").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("uploads").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("comments").select("*").order("created_at", { ascending: false }).limit(500),
      db.from("penalties").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    return {
      profiles: profiles.data ?? [],
      deposits: deposits.data ?? [],
      withdrawals: withdrawals.data ?? [],
      uploads: uploads.data ?? [],
      comments: comments.data ?? [],
      penalties: penalties.data ?? [],
    };
  });

const settingsPatch = z
  .object({
    ad_frequency: z.number().int().min(1).max(100),
    notice: z.string().max(300),
    ad_unit_id: z.string().regex(/^ca-app-pub-\d{10,20}[/~]\d{6,12}$/),
    watch_seconds: z.number().int().min(1).max(600),
    watch_reward: z.number().int().min(1).max(1000),
    uploads_enabled: z.boolean(),
    pay_numbers: z.object({
      bKash: z.string().max(20),
      Nagad: z.string().max(20),
      Rocket: z.string().max(20),
    }),
    deposit_notice: z.string().max(500),
    vip_price: z.number().int().min(1).max(100000),
    vip_days: z.number().int().min(1).max(3650),
    vip_benefits: z.string().max(1000),
    ad_price_per_day: z.number().int().min(1).max(100000),
    rules: z.string().max(4000),
  })
  .partial();

export const adminSaveSettings = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: pw, patch: settingsPatch }).parse(d))
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const db = await admin();
    const patch = Object.fromEntries(Object.entries(data.patch).filter(([, v]) => v !== undefined)) as Record<string, never>;
    const { error } = await db.from("app_settings").update(patch).eq("id", 1);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const adminSetDeposit = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: pw, id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const db = await admin();
    const { data: dep } = await db.from("deposits").select("*").eq("id", data.id).single();
    if (!dep) throw new Error("Not found");
    if (dep.status !== "pending") return { ok: false };
    const { data: updated } = await db
      .from("deposits")
      .update({ status: data.status, decided_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("id");
    if (!updated || updated.length === 0) return { ok: false };
    if (data.status === "approved") {
      const { data: prof } = await db.from("profiles").select("coins, vip_until").eq("id", dep.user_id).single();
      if (prof) {
        if (dep.kind === "coins") {
          await db.from("profiles").update({ coins: prof.coins + dep.amount * COINS_PER_TAKA }).eq("id", dep.user_id);
        } else if (dep.kind === "vip") {
          const { data: s } = await db.from("app_settings").select("vip_days").eq("id", 1).single();
          const base = prof.vip_until && new Date(prof.vip_until) > new Date() ? new Date(prof.vip_until) : new Date();
          base.setDate(base.getDate() + (s?.vip_days ?? 30));
          await db.from("profiles").update({ vip_until: base.toISOString() }).eq("id", dep.user_id);
        }
      }
    }
    return { ok: true };
  });

export const adminSetWithdraw = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: pw, id: z.string().uuid(), status: z.enum(["approved", "rejected"]) }).parse(d),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const db = await admin();
    const { data: rows } = await db
      .from("withdrawals")
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("status", "pending")
      .select("*");
    const w = rows?.[0];
    if (w && data.status === "rejected") {
      const { data: prof } = await db.from("profiles").select("points").eq("id", w.user_id).single();
      if (prof) await db.from("profiles").update({ points: prof.points + w.amount * 100 }).eq("id", w.user_id);
    }
    return { ok: Boolean(w) };
  });

export const adminSetUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: pw, id: z.string().uuid(), status }).parse(d))
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const db = await admin();
    await db.from("uploads").update({ status: data.status }).eq("id", data.id);
    return { ok: true };
  });

export const adminDeleteComment = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ password: pw, id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const db = await admin();
    await db.from("comments").delete().eq("id", data.id);
    return { ok: true };
  });

export const adminBlockUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ password: pw, userId: z.string().uuid(), blocked: z.boolean(), reason: z.string().max(300) }).parse(d),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const db = await admin();
    await db
      .from("profiles")
      .update({ blocked: data.blocked, block_reason: data.blocked ? data.reason : "" })
      .eq("id", data.userId);
    return { ok: true };
  });

/** Fine in taka: deducted from the user's balance (100 points = ৳1); balance may go negative. */
export const adminFineUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        password: pw,
        userId: z.string().uuid(),
        amount: z.number().int().min(1).max(100000),
        reason: z.string().trim().min(1).max(300),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    await checkPassword(data.password);
    const db = await admin();
    const { data: prof } = await db.from("profiles").select("points").eq("id", data.userId).single();
    if (!prof) throw new Error("Not found");
    await db.from("profiles").update({ points: prof.points - data.amount * 100 }).eq("id", data.userId);
    await db.from("penalties").insert({ user_id: data.userId, amount: data.amount, reason: data.reason });
    return { ok: true };
  });
