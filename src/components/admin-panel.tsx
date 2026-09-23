import { useEffect, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  DollarSign,
  LogOut,
  Megaphone,
  MessageCircle,
  Settings,
  ShieldCheck,
  Trash2,
  Upload,
  Users,
  Video,
  XCircle,
} from "lucide-react";

import {
  MAX_AD_FREQUENCY,
  MIN_AD_FREQUENCY,
  deleteComment,
  saveAdFrequency,
  saveNotice,
  setRequestStatus,
  setUploadStatus,
  setUploadsEnabled,
  useAppSettings,
  type WithdrawRequest,
} from "@/lib/app-store";
import { bn, taka } from "@/lib/format";

export function AdminPanel({
  onExit,
  onLogout,
}: {
  onExit: () => void;
  onLogout: () => void;
}) {
  const settings = useAppSettings();
  const [toast, setToast] = useState<string | null>(null);
  const [freqDraft, setFreqDraft] = useState(String(settings.adFrequency));
  const [noticeDraft, setNoticeDraft] = useState(settings.notice);

  useEffect(() => {
    setFreqDraft(String(settings.adFrequency));
  }, [settings.adFrequency]);

  useEffect(() => {
    setNoticeDraft(settings.notice);
  }, [settings.notice]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2800);
  };

  const applyFrequency = () => {
    if (saveAdFrequency(Number(freqDraft))) {
      notify("এড ফ্রিকোয়েন্সি সেভ করা হয়েছে।");
    } else {
      notify(`সঠিক নম্বর দিন (${bn(MIN_AD_FREQUENCY)}–${bn(MAX_AD_FREQUENCY)}).`);
    }
  };

  const applyNotice = () => {
    saveNotice(noticeDraft);
    notify("ইউজার পেমেন্ট বার্তা আপডেট করা হয়েছে।");
  };

  const approve = (request: WithdrawRequest) => {
    setRequestStatus(request.id, "approved");
    notify(
      `${taka(request.amount)} পেমেন্ট সফলভাবে এপ্রুভ করা হয়েছে (${request.method})।`,
    );
  };

  const reject = (request: WithdrawRequest) => {
    setRequestStatus(request.id, "rejected");
    notify("উইথড্র রিকোয়েস্টটি রিজেক্ট করা হয়েছে।");
  };

  const pending = settings.requests.filter((r) => r.status === "pending");
  const approved = settings.requests.filter((r) => r.status === "approved");
  const pendingTotal = pending.reduce((sum, r) => sum + r.amount, 0);
  const paidTotal = approved.reduce((sum, r) => sum + r.amount, 0);
  const adsPerThousand = Math.floor(1000 / settings.adFrequency);
  const pendingUploads = settings.uploads.filter((u) => u.status === "pending");

  return (
    <div className="min-h-screen bg-background px-4 py-6 font-sans text-foreground sm:px-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="bg-brand-gradient grid size-9 shrink-0 place-items-center rounded-xl">
              <Settings className="size-4.5 text-brand-foreground" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-extrabold sm:text-lg">
                অ্যাপ এডমিন প্যানেল
              </h1>
              <p className="text-[11px] font-semibold text-muted-foreground">
                WatchCoin কন্ট্রোল সেন্টার
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-success/30 bg-success/15 px-3 py-1 text-[10px] font-bold text-success">
              <ShieldCheck className="size-3" />
              সিস্টেম এক্টিভ
            </span>
            <button
              type="button"
              onClick={onExit}
              className="flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1 text-[10px] font-bold text-secondary-foreground transition-colors hover:bg-muted"
            >
              <ArrowLeft className="size-3" />
              অ্যাপে ফিরে যান
            </button>
            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-3 py-1 text-[10px] font-bold text-destructive transition-colors hover:bg-destructive/20"
            >
              <LogOut className="size-3" />
              লগআউট
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <StatCard
            icon={<Users className="size-4" />}
            label="পেন্ডিং রিকোয়েস্ট"
            value={bn(pending.length) + " টি"}
            hint={`মোট ${taka(pendingTotal)}`}
            tone="warning"
          />
          <StatCard
            icon={<CheckCircle2 className="size-4" />}
            label="পরিশোধ করা হয়েছে"
            value={taka(paidTotal)}
            hint={`${bn(approved.length)} টি অনুমোদিত`}
            tone="success"
          />
          <StatCard
            icon={<Video className="size-4" />}
            label="পেন্ডিং ভিডিও"
            value={bn(pendingUploads.length) + " টি"}
            hint={`মোট ${bn(settings.uploads.length)} টি আপলোড`}
            tone="accent"
          />
          <StatCard
            icon={<MessageCircle className="size-4" />}
            label="কমেন্ট"
            value={bn(settings.comments.length) + " টি"}
            hint={`রেফারেল ${bn(settings.referrals)} জন`}
            tone="primary"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Panel
            icon={<Megaphone className="size-4" />}
            title="অ্যাডভার্টাইজমেন্ট কন্ট্রোল"
            tone="coin"
          >
            <label className="block text-xs font-semibold text-foreground">
              কতটি ভিডিও পরপর এড দেখাবে?
              <input
                type="number"
                inputMode="numeric"
                min={MIN_AD_FREQUENCY}
                max={MAX_AD_FREQUENCY}
                value={freqDraft}
                onChange={(event) => setFreqDraft(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-input bg-secondary px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {[10, 20, 50].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setFreqDraft(String(preset))}
                  className={`rounded-full border px-3 py-1 text-[10px] font-bold transition-colors ${
                    Number(freqDraft) === preset
                      ? "border-transparent bg-brand-gradient text-brand-foreground"
                      : "border-border bg-secondary text-secondary-foreground hover:bg-muted"
                  }`}
                >
                  প্রতি {bn(preset)} টি
                </button>
              ))}
            </div>

            <p className="text-[11px] font-medium leading-relaxed text-muted-foreground">
              বর্তমান সেটিং: প্রতি{" "}
              <strong className="text-foreground">
                {bn(settings.adFrequency)}টি
              </strong>{" "}
              ভিডিওর পর ১টি বাধ্যতামূলক এড আসবে (১,০০০ ভিডিওতে{" "}
              {bn(adsPerThousand)}টি এড)।
            </p>

            <button
              type="button"
              onClick={applyFrequency}
              disabled={freqDraft === String(settings.adFrequency)}
              className="bg-brand-gradient rounded-xl px-4 py-2 text-xs font-bold text-brand-foreground shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              সেভ করুন
            </button>
          </Panel>

          <Panel
            icon={<Settings className="size-4" />}
            title="ইউজার নোটিশ ও আপলোড কন্ট্রোল"
            tone="primary"
          >
            <label className="block text-xs font-semibold text-foreground">
              ইউজার অ্যাপের পেমেন্ট বার্তা:
              <textarea
                value={noticeDraft}
                onChange={(event) => setNoticeDraft(event.target.value)}
                rows={3}
                maxLength={300}
                className="mt-1.5 w-full resize-none rounded-xl border border-input bg-secondary px-3 py-2 text-sm leading-relaxed text-foreground outline-none focus:border-ring"
              />
            </label>
            <button
              type="button"
              onClick={applyNotice}
              disabled={noticeDraft.trim() === settings.notice}
              className="bg-brand-gradient w-fit rounded-xl px-4 py-2 text-xs font-bold text-brand-foreground shadow-lg transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              সেভ করুন
            </button>

            <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary px-3 py-2.5">
              <span className="text-xs font-semibold text-foreground">
                ইউজার ভিডিও আপলোড চালু
              </span>
              <button
                type="button"
                onClick={() => {
                  setUploadsEnabled(!settings.uploadsEnabled);
                  notify(
                    settings.uploadsEnabled
                      ? "ইউজার আপলোড বন্ধ করা হয়েছে।"
                      : "ইউজার আপলোড চালু করা হয়েছে।",
                  );
                }}
                className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                  settings.uploadsEnabled
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {settings.uploadsEnabled ? "চালু" : "বন্ধ"}
              </button>
            </div>
          </Panel>
        </div>

        <Panel
          icon={<Upload className="size-4" />}
          title="ইউজার আপলোড করা ভিডিও (অনুমোদন দরকার)"
          tone="accent"
        >
          {settings.uploads.length === 0 ? (
            <p className="py-6 text-center text-xs font-semibold text-muted-foreground">
              এখনো কোনো ভিডিও আপলোড হয়নি।
            </p>
          ) : (
            <ul className="space-y-2">
              {settings.uploads.map((upload) => (
                <li
                  key={upload.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">
                      {upload.user} · {upload.caption || "ক্যাপশন নেই"}
                    </p>
                    <p className="truncate text-[10px] font-medium text-muted-foreground">
                      {upload.url}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                        upload.status === "approved"
                          ? "border-success/30 bg-success/15 text-success"
                          : upload.status === "rejected"
                            ? "border-destructive/30 bg-destructive/15 text-destructive"
                            : "border-warning/30 bg-warning/15 text-warning"
                      }`}
                    >
                      {upload.status}
                    </span>
                    {upload.status !== "approved" && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadStatus(upload.id, "approved");
                          notify("ভিডিওটি অনুমোদন করা হয়েছে, এখন ফিডে দেখাবে।");
                        }}
                        className="rounded-lg bg-success px-2.5 py-1 text-[10px] font-bold text-success-foreground"
                      >
                        অনুমোদন
                      </button>
                    )}
                    {upload.status !== "rejected" && (
                      <button
                        type="button"
                        onClick={() => {
                          setUploadStatus(upload.id, "rejected");
                          notify("ভিডিওটি রিজেক্ট করা হয়েছে।");
                        }}
                        className="rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive"
                      >
                        রিজেক্ট
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel
          icon={<MessageCircle className="size-4" />}
          title="কমেন্ট মডারেশন"
          tone="primary"
        >
          {settings.comments.length === 0 ? (
            <p className="py-6 text-center text-xs font-semibold text-muted-foreground">
              এখনো কোনো কমেন্ট নেই।
            </p>
          ) : (
            <ul className="space-y-2">
              {settings.comments
                .slice()
                .reverse()
                .map((comment) => (
                  <li
                    key={comment.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-border bg-secondary px-3 py-2"
                  >
                    <p className="min-w-0 text-xs text-foreground">
                      <span className="font-bold text-accent">
                        {comment.user}
                      </span>{" "}
                      {comment.text}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        deleteComment(comment.id);
                        notify("কমেন্ট মুছে ফেলা হয়েছে।");
                      }}
                      aria-label="Delete comment"
                      className="shrink-0 rounded-lg border border-destructive/40 bg-destructive/10 p-1.5 text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </Panel>

        <Panel
          icon={<DollarSign className="size-4" />}
          title="পেন্ডিং বিকাশ/নগদ উইথড্র রিকোয়েস্ট (৫০+ টাকা)"
          tone="success"
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-3 py-2 font-semibold">ইউজার</th>
                  <th className="px-3 py-2 font-semibold">মেথড</th>
                  <th className="px-3 py-2 font-semibold">নম্বর</th>
                  <th className="px-3 py-2 font-semibold">পরিমাণ</th>
                  <th className="px-3 py-2 font-semibold">স্ট্যাটাস</th>
                  <th className="px-3 py-2 text-right font-semibold">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody>
                {settings.requests.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-3 py-8 text-center font-semibold text-muted-foreground"
                    >
                      কোনো উইথড্র রিকোয়েস্ট নেই।
                    </td>
                  </tr>
                )}
                {settings.requests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="px-3 py-3 font-semibold text-foreground">
                      {request.user}
                    </td>
                    <td className="px-3 py-3">
                      <span className="rounded-md border border-border bg-secondary px-2 py-0.5 text-[10px] font-bold text-foreground">
                        {request.method}
                      </span>
                    </td>
                    <td className="px-3 py-3 font-mono text-coin">
                      {request.phone}
                    </td>
                    <td className="px-3 py-3 font-bold text-success">
                      {taka(request.amount)}
                    </td>
                    <td className="px-3 py-3">
                      <StatusPill status={request.status} />
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex justify-end gap-2">
                        {request.status === "pending" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => approve(request)}
                              className="flex items-center gap-1 rounded-lg bg-success px-3 py-1 text-[10px] font-bold text-success-foreground transition-transform active:scale-95 hover:brightness-110"
                            >
                              <CheckCircle2 className="size-3" />
                              পেমেন্ট সম্পন্ন করুন
                            </button>
                            <button
                              type="button"
                              onClick={() => reject(request)}
                              className="flex items-center gap-1 rounded-lg border border-destructive/40 bg-destructive/10 px-2.5 py-1 text-[10px] font-bold text-destructive transition-transform active:scale-95 hover:bg-destructive/20"
                            >
                              <XCircle className="size-3" />
                              রিজেক্ট
                            </button>
                          </>
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground">
                            {request.status === "approved"
                              ? "পরিশোধ করা হয়েছে"
                              : "রিজেক্ট করা হয়েছে"}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      {toast && (
        <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-6">
          <p className="bg-brand-gradient rounded-full px-4 py-2 text-xs font-bold text-brand-foreground shadow-xl">
            {toast}
          </p>
        </div>
      )}
    </div>
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

function Panel({
  icon,
  title,
  tone,
  children,
}: {
  icon: ReactNode;
  title: string;
  tone: PanelTone;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-5">
      <h3
        className={`flex items-center gap-2 text-sm font-extrabold ${PANEL_TONE[tone]}`}
      >
        <span className="shrink-0">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

function StatCard({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: PanelTone;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <span className={`shrink-0 ${PANEL_TONE[tone]}`}>{icon}</span>
        {label}
      </p>
      <p className="mt-2 truncate text-xl font-extrabold text-foreground">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">
        {hint}
      </p>
    </div>
  );
}

function StatusPill({ status }: { status: WithdrawRequest["status"] }) {
  const styles: Record<WithdrawRequest["status"], string> = {
    pending: "border-warning/30 bg-warning/15 text-warning",
    approved: "border-success/30 bg-success/15 text-success",
    rejected: "border-destructive/30 bg-destructive/15 text-destructive",
  };
  const labels: Record<WithdrawRequest["status"], string> = {
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
  };
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
