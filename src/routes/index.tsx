import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarCheck,
  Check,
  Copy,
  Gift,
  Heart,
  History,
  Link2,
  MessageCircle,
  Play,
  Plus,
  Send,
  Share2,
  ShieldAlert,
  Sparkles,
  Star,
  Upload,
  UserPlus,
  Volume2,
  VolumeX,
  Wallet,
  X,
} from "lucide-react";

import { AdminGate } from "@/components/admin-gate";
import { LogOut } from "lucide-react";
import {
  CHECKIN_REWARD,
  REFERRAL_REWARD,
  POINTS_PER_TAKA,
  BOOST_PACKS,
  COINS_PER_TAKA,
  MIN_DEPOSIT,
  addComment,
  applyReferral,
  claimCheckIn,
  claimReward,
  isCheckedInToday,
  isVip,
  requestWithdraw,
  sendGift,
  submitDeposit,
  submitUpload,
  useStore,
  type AppSettings as CloudSettings,
  type BoostPack,
  type DepositKind,
  type DepositMethod,
  type GiftRecord,
  type Penalty,
  type Promo,
  type UploadedVideo,
  type VideoComment,
  type WithdrawMethod,
} from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { suggestGifts, type GiftSuggestion } from "@/lib/ai.functions";
import { bn } from "@/lib/format";

/** The slice of user data the sheets below read. */
type AppSettings = {
  comments: VideoComment[];
  gifts: GiftRecord[];
  referralCode: string;
  referrals: number;
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "WatchCoin — ভিডিও দেখে টাকা ইনকাম" },
      {
        name: "description",
        content:
          "শর্ট ভিডিও দেখুন, পয়েন্ট জমান এবং বিকাশ বা নগদে সর্বনিম্ন ৫০ টাকা উইথড্র করুন।",
      },
      { property: "og:title", content: "WatchCoin — ভিডিও দেখে টাকা ইনকাম" },
      {
        property: "og:description",
        content: "ভিডিও দেখে পয়েন্ট জমান, বিকাশ ও নগদে ক্যাশ আউট করুন।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomeScreen,
});

const MIN_WITHDRAW = 50;

const GIFTS = [
  { emoji: "🌹", name: "গোলাপ", label: "গোলাপ ফুল 🌹", cost: 10 },
  { emoji: "❤️", name: "লাভ", label: "ভালবাসা ❤️", cost: 30 },
  { emoji: "👑", name: "মুকুট", label: "রাজমুকুট 👑", cost: 100 },
];


type FeedItem =
  | {
      id: string;
      type: "video";
      url: string;
      user: string;
      caption: string;
      likes: number;
      sponsored?: BoostPack;
      promoLink?: string;
    }
  | {
      id: string;
      type: "forced_ad";
      title: string;
      duration: number;
      sponsor: string;
      mediaUrl?: string;
      link?: string;
    };

const VIDEO_POOL = [
  {
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "@nature_king",
    caption: "সুন্দর প্রকৃতির দৃশ্য! 🌿 #nature",
    likes: 1200,
  },
  {
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "@family_time",
    caption: "সুন্দর বিকেল ❤️ #vlog",
    likes: 3400,
  },
  {
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    user: "@fun_videos",
    caption: "মজার ভিডিও 😂 #funny",
    likes: 890,
  },
  {
    url: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
    user: "@green_vibes",
    caption: "সুন্দর প্রকৃতির দৃশ্য! 🌿 #nature",
    likes: 2100,
  },
  {
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    user: "@daily_moments",
    caption: "সুন্দর বিকেল ❤️ #vlog",
    likes: 1500,
  },
  {
    url: "https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/360/Big_Buck_Bunny_360_10s_1MB.mp4",
    user: "@bubble_gum",
    caption: "মজার ভিডিও 😂 #funny",
    likes: 760,
  },
];

const TOTAL_VIDEOS = 60;
const AD_DURATION = 10;

const VIDEO_QUEUE = Array.from(
  { length: Math.ceil(TOTAL_VIDEOS / VIDEO_POOL.length) },
  () => VIDEO_POOL,
)
  .flat()
  .slice(0, TOTAL_VIDEOS);

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Builds the feed: boosts on top, approved uploads, then one forced ad after every N videos
 * (VIP members see half as many ads). Forced ad slots rotate through approved advertiser ads. */
function buildFeed(
  settings: CloudSettings,
  uploads: UploadedVideo[],
  promos: Promo[],
  vip: boolean,
): FeedItem[] {
  const items: FeedItem[] = [];
  let videosSinceAd = 0;
  const frequency = vip ? settings.adFrequency * 2 : settings.adFrequency;

  const boosted: Omit<Extract<FeedItem, { type: "video" }>, "id" | "type">[] = promos
    .filter((p) => p.kind === "boost" && str(p.details["videoUrl"]))
    .sort((a, b) => (a.details["pack"] === "gold" ? 0 : 1) - (b.details["pack"] === "gold" ? 0 : 1))
    .map((p) => {
      const link = str(p.details["promoLink"]);
      return {
        url: str(p.details["videoUrl"]),
        user: p.user,
        caption: str(p.details["caption"]),
        likes: 0,
        sponsored: p.details["pack"] === "gold" ? ("gold" as const) : ("silver" as const),
        ...(link ? { promoLink: link } : {}),
      };
    });

  const ads = promos.filter((p) => p.kind === "ad" && str(p.details["mediaUrl"]));

  const approved = uploads
    .filter((upload) => upload.status === "approved")
    .map((upload) => ({
      url: upload.url,
      user: upload.user,
      caption: upload.caption,
      likes: 0,
    }));

  const queue = [...boosted, ...approved, ...VIDEO_QUEUE];
  let adCount = 0;

  queue.forEach((video, index) => {
    items.push({ id: `v-${index}`, type: "video", ...video });
    videosSinceAd += 1;

    if (videosSinceAd >= frequency) {
      const paid = ads.length > 0 ? ads[adCount % ads.length] : undefined;
      adCount += 1;
      const link = paid ? str(paid.details["link"]) : "";
      items.push({
        id: `ad-${index}`,
        type: "forced_ad",
        title: paid ? str(paid.details["title"]) || "বিজ্ঞাপন" : "স্পন্সরড এডভার্টাইজমেন্ট",
        duration: AD_DURATION,
        sponsor: paid ? paid.user : "WatchCoin Partner",
        ...(paid ? { mediaUrl: str(paid.details["mediaUrl"]) } : {}),
        ...(link ? { link } : {}),
      });
      videosSinceAd = 0;
    }
  });

  return items;
}

/** Renders the admin area only for the #admin hash, otherwise the user app. */
function HomeScreen() {
  const [hash, setHash] = useState("");

  useEffect(() => {
    const sync = () => setHash(window.location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  if (hash === "#admin") {
    return (
      <AdminGate
        onExit={() => {
          window.location.hash = "";
          setHash("");
        }}
      />
    );
  }

  return <WatchEarnApp />;
}

type Sheet =
  | "none"
  | "withdraw"
  | "recharge"
  | "deposit"
  | "boost"
  | "ad"
  | "vip"
  | "upload"
  | "referral"
  | "history"
  | "earnings"
  | "rules";

function WatchEarnApp() {
  const store = useStore();
  if (!store.authReady) {
    return (
      <main className="grid min-h-dvh place-items-center bg-background text-sm font-bold text-foreground">
        লোড হচ্ছে...
      </main>
    );
  }
  if (!store.userId) return <AuthScreen />;
  if (store.profile?.blocked) {
    return <BlockedScreen reason={store.profile.blockReason} rules={store.settings.rules} />;
  }
  return <SignedInApp />;
}

function SignedInApp() {
  const store = useStore();
  const settings = store.settings;
  const profile = store.profile;
  const vip = isVip(profile);
  const points = profile?.points ?? 0;
  const balance = points / POINTS_PER_TAKA;
  const coins = profile?.coins ?? 0;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [rewarded, setRewarded] = useState<Record<string, boolean>>({});
  const [adLocked, setAdLocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [giftFor, setGiftFor] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet>("none");
  const feed = useMemo(
    () => buildFeed(settings, store.uploads, store.promos, vip),
    [settings, store.uploads, store.promos, vip],
  );
  const view: AppSettings = {
    comments: store.comments,
    gifts: store.gifts,
    referralCode: profile?.referralCode ?? "",
    referrals: profile?.referrals ?? 0,
  };
  const vipNames = useMemo(() => new Set(store.vipNames), [store.vipNames]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const award = useCallback(
    (key: string, kind: "watch" | "ad") => {
      if (rewarded[key]) return;
      setRewarded((r) => ({ ...r, [key]: true }));
      void claimReward(key, kind).then((amt) => {
        if (amt > 0) notify(`+${bn(amt)} পয়েন্ট${vip ? " (VIP ×২)" : ""}`);
      });
    },
    [rewarded, notify, vip],
  );

  // রেফারেল লিংক দিয়ে অ্যাপ খুললে একবার বোনাস
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (!ref || !profile) return;
    const key = `watchcoin.ref.done`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
    void applyReferral(ref).then((ok) => {
      if (ok) notify(`রেফারেল বোনাস +${bn(REFERRAL_REWARD)} পয়েন্ট যোগ হয়েছে।`);
    });
  }, [profile, notify]);

  // কোন আইটেমটি স্ক্রিনে আছে তা ট্র্যাক করা
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset["index"]);
            setCurrentIndex(idx);
          }
        });
      },
      { root, threshold: [0.61] },
    );
    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [feed.length]);

  const current = feed[currentIndex];
  useEffect(() => {
    setAdLocked(current?.type === "forced_ad" && !rewarded[current.id]);
  }, [current, rewarded]);

  const checkedIn = isCheckedInToday(profile);

  const doCheckIn = async () => {
    if (checkedIn) {
      notify("আজকের চেক-ইন আগেই নেওয়া হয়েছে। কাল আবার আসুন।");
      return;
    }
    const streak = await claimCheckIn();
    if (streak <= 0) {
      notify("আজকের চেক-ইন আগেই নেওয়া হয়েছে। কাল আবার আসুন।");
      return;
    }
    notify(`ডেইলি চেক-ইন +${bn(CHECKIN_REWARD)} পয়েন্ট · স্ট্রিক ${bn(streak)} দিন`);
  };

  const share = async (item: Extract<FeedItem, { type: "video" }>) => {
    const url = `${window.location.origin}/?ref=${view.referralCode}`;
    const text = `${item.user} এর ভিডিও দেখুন — WatchCoin`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "WatchCoin", text, url });
        notify("শেয়ার করা হয়েছে!");
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      notify("লিংক কপি হয়েছে, বন্ধুদের পাঠিয়ে দিন।");
    } catch {
      notify("শেয়ার করা যায়নি, আবার চেষ্টা করুন।");
    }
  };

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-between overflow-x-hidden bg-background text-foreground">
      <div className="relative flex h-dvh min-h-0 w-full max-w-md flex-none flex-col overflow-hidden bg-background shadow-2xl">
        {/* হেডার: পয়েন্ট, ব্যালেন্স, কয়েন */}
        <header className="absolute inset-x-0 top-0 z-30 flex flex-col gap-2 bg-gradient-to-b from-black/90 to-transparent px-3 pb-8 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/60 px-3 py-1.5 backdrop-blur">
              <Star className="size-3.5 text-coin" />
              <span className="text-xs font-bold text-white">
                {bn(points)} পয়েন্ট
              </span>
              <span className="text-white/40">|</span>
              <span className={`text-xs font-extrabold ${balance < 0 ? "text-destructive" : "text-coin"}`}>
                ৳{bn(balance.toFixed(2))}
              </span>
            </div>
            <button
              onClick={() => setSheet("withdraw")}
              className="bg-brand-gradient flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-brand-foreground shadow-lg transition-transform active:scale-95"
            >
              <Wallet className="size-3.5" />
              উইথড্র (৳{bn(MIN_WITHDRAW)})
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <div className="flex items-center gap-1.5 rounded-full border border-coin/40 bg-black/60 px-3 py-1 text-xs font-extrabold text-coin backdrop-blur">
                🪙 {bn(coins)}
              </div>
              <button
                onClick={() => setSheet("vip")}
                className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold ${
                  vip ? "bg-coin text-coin-foreground" : "border border-coin/50 bg-black/60 text-coin"
                }`}
              >
                👑 {vip ? "VIP" : "VIP নিন"}
              </button>
              <button
                onClick={() => setSheet("rules")}
                className="rounded-full border border-white/20 bg-black/60 px-2.5 py-1 text-[10px] font-bold text-white"
              >
                📜 নিয়ম
              </button>
            </div>
            <button
              onClick={() => setSheet("recharge")}
              className="flex shrink-0 items-center gap-1 rounded-full bg-coin px-3 py-1 text-xs font-extrabold text-coin-foreground shadow-lg transition-transform active:scale-95"
            >
              <Plus className="size-3.5" />
              রিচার্জ
            </button>
          </div>
        </header>

        {/* ফিড */}
        <div
          ref={scrollRef}
          className={`h-full w-full snap-y snap-mandatory ${
            adLocked ? "overflow-hidden" : "overflow-y-scroll"
          } [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {feed.map((item, index) => (
            <div
              key={item.id}
              data-index={index}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className="relative h-full w-full snap-start snap-always"
            >
              {item.type === "forced_ad" ? (
                <ForcedAdCard
                  ad={item}
                  active={currentIndex === index}
                  done={Boolean(rewarded[item.id])}
                  onComplete={() => award(item.id, "ad")}
                />
              ) : (
                <VideoFeedCard
                  video={{ ...item, user: vipNames.has(item.user) ? `${item.user} 👑` : item.user }}
                  active={currentIndex === index}
                  muted={muted}
                  commentCount={
                    store.comments.filter((c) => c.videoId === item.id).length
                  }
                  onToggleMute={() => setMuted((m) => !m)}
                  onGift={() => setGiftFor(item.user)}
                  onComments={() => setCommentsFor(item.id)}
                  onShare={() => void share(item)}
                  watchSeconds={settings.watchSeconds}
                  done={Boolean(rewarded[item.id])}
                  onWatched={() => award(item.id, "watch")}
                />
              )}
            </div>
          ))}
        </div>

        {/* নিচের মেনু */}
        <nav className="absolute inset-x-0 bottom-0 z-30 flex items-stretch justify-between gap-1 border-t border-white/10 bg-black/85 px-2 py-2 backdrop-blur">
          <TabButton
            icon={<CalendarCheck className="size-4" />}
            label={checkedIn ? "চেক-ইন ✓" : "চেক-ইন"}
            highlight={!checkedIn}
            onClick={() => void doCheckIn()}
          />
          <TabButton
            icon={<Upload className="size-4" />}
            label="আপলোড"
            onClick={() => setSheet("upload")}
          />
          <TabButton
            icon={<UserPlus className="size-4" />}
            label="রেফার"
            onClick={() => setSheet("referral")}
          />
          <TabButton
            icon={<History className="size-4" />}
            label="ইতিহাস"
            onClick={() => setSheet("history")}
          />
          <TabButton
            icon={<BarChart3 className="size-4" />}
            label="আয়"
            onClick={() => setSheet("earnings")}
          />
          <TabButton
            icon={<LogOut className="size-4" />}
            label="লগআউট"
            onClick={() => void supabase.auth.signOut()}
          />
        </nav>

        {adLocked && (
          <div className="pointer-events-none absolute inset-x-0 bottom-20 z-30 flex justify-center">
            <p className="rounded-full bg-black/80 px-4 py-2 text-[11px] font-bold text-white backdrop-blur">
              বিজ্ঞাপন শেষ হওয়া পর্যন্ত স্ক্রল বন্ধ
            </p>
          </div>
        )}

        {toast && (
          <div className="absolute inset-x-0 top-24 z-50 flex justify-center px-6">
            <p className="bg-brand-gradient rounded-full px-4 py-2 text-center text-xs font-bold text-brand-foreground shadow-xl">
              {toast}
            </p>
          </div>
        )}

        {commentsFor && (
          <CommentsSheet
            videoId={commentsFor}
            settings={view}
            onClose={() => setCommentsFor(null)}
          />
        )}

        {giftFor && (
          <GiftModal
            creator={giftFor}
            coins={coins}
            onClose={() => setGiftFor(null)}
            onSend={(gift) => {
              const creator = giftFor;
              setGiftFor(null);
              if (coins < gift.cost) {
                notify("আপনার পর্যাপ্ত কয়েন নেই! বিকাশ/নগদ দিয়ে কয়েন রিচার্জ করুন।");
                setSheet("recharge");
                return;
              }
              void sendGift(gift.name, gift.emoji, gift.cost, creator).then((ok) => {
                notify(
                  ok
                    ? `অভিনন্দন! আপনি ক্রিয়েটরকে একটি ${gift.label} পাঠিয়েছেন।`
                    : "গিফট পাঠানো যায়নি, আবার চেষ্টা করুন।",
                );
              });
            }}
          />
        )}

        {sheet === "recharge" && (
          <RechargeModal onClose={() => setSheet("none")} onPick={(m) => setSheet(m)} />
        )}

        {(sheet === "deposit" || sheet === "boost" || sheet === "ad" || sheet === "vip") && (
          <DepositSheet
            mode={sheet}
            onClose={() => setSheet("none")}
            onCopied={notify}
            onSubmitted={(msg) => {
              setSheet("none");
              notify(msg);
            }}
          />
        )}

        {sheet === "rules" && (
          <RulesSheet rules={settings.rules} penalties={store.penalties} onClose={() => setSheet("none")} />
        )}

        {sheet === "upload" && (
          <UploadSheet
            enabled={settings.uploadsEnabled}
            onClose={() => setSheet("none")}
            onSubmit={(caption, url) => {
              setSheet("none");
              void submitUpload(caption, url).then((ok) =>
                notify(ok ? "ভিডিও পাঠানো হয়েছে, এডমিন অনুমোদন দিলে ফিডে আসবে।" : "পাঠানো যায়নি, আবার চেষ্টা করুন।"),
              );
            }}
          />
        )}

        {sheet === "referral" && (
          <ReferralSheet settings={view} onClose={() => setSheet("none")} onCopied={notify} />
        )}

        {sheet === "history" && (
          <HistorySheet settings={view} onClose={() => setSheet("none")} />
        )}

        {sheet === "earnings" && (
          <EarningsSheet settings={view} onClose={() => setSheet("none")} />
        )}

        {sheet === "withdraw" && (
          <WithdrawModal
            balance={balance}
            notice={settings.notice}
            onClose={() => setSheet("none")}
            onSubmit={(amount, method, account) => {
              setSheet("none");
              void requestWithdraw(account, method, amount).then((ok) =>
                notify(
                  ok
                    ? `৳${bn(amount)} উইথড্র রিকোয়েস্ট পাঠানো হয়েছে (${method}: ${account})`
                    : "উইথড্র রিকোয়েস্ট পাঠানো যায়নি।",
                ),
              );
            }}
          />
        )}
      </div>
    </main>
  );
}

function TabButton({
  icon,
  label,
  onClick,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1 text-[10px] font-bold transition-colors active:scale-95 ${
        highlight ? "text-coin" : "text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function ForcedAdCard({
  ad,
  active,
  done,
  onComplete,
}: {
  ad: Extract<FeedItem, { type: "forced_ad" }>;
  active: boolean;
  done: boolean;
  onComplete: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(ad.duration);

  useEffect(() => {
    if (!active || done || timeLeft <= 0) return;
    const timer = window.setInterval(() => setTimeLeft((t) => t - 1), 1000);
    return () => window.clearInterval(timer);
  }, [active, done, timeLeft]);

  useEffect(() => {
    if (active && timeLeft <= 0 && !done) onComplete();
  }, [active, timeLeft, done, onComplete]);

  const finished = done || timeLeft <= 0;
  const progress = ((ad.duration - Math.max(timeLeft, 0)) / ad.duration) * 100;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-6 bg-gradient-to-b from-card to-background px-8 text-center">
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-foreground/80">
        Sponsored Ad
      </span>
      {ad.mediaUrl ? (
        /\.(mp4|webm|mov|m4v)(\?|$)/i.test(ad.mediaUrl) ? (
          <video
            src={ad.mediaUrl}
            autoPlay={active}
            muted
            playsInline
            loop
            className="max-h-[45%] w-full rounded-2xl object-contain"
          />
        ) : (
          <img src={ad.mediaUrl} alt={ad.title} className="max-h-[45%] w-full rounded-2xl object-contain" />
        )
      ) : (
        <div className="bg-brand-gradient flex size-20 items-center justify-center rounded-3xl shadow-2xl">
          <ShieldAlert className="size-9 text-brand-foreground" />
        </div>
      )}
      <h2 className="text-xl font-extrabold text-foreground">{ad.title}</h2>
      {!ad.mediaUrl && (
        <p className="max-w-xs text-sm font-medium leading-relaxed text-foreground/85">
          বিজ্ঞাপনটি সম্পূর্ণ না দেখলে পরবর্তী ভিডিও দেখা বা পয়েন্ট অর্জন করা
          সম্ভব নয়।
        </p>
      )}
      <p className="text-[11px] font-semibold text-foreground/70">
        স্পন্সর: {ad.sponsor}
      </p>
      {ad.link && (
        <a
          href={ad.link}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full bg-coin px-4 py-1.5 text-xs font-extrabold text-coin-foreground"
        >
          🔗 বিস্তারিত দেখুন
        </a>
      )}

      <div className="w-full max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="bg-brand-gradient h-full transition-all duration-1000 ease-linear"
            style={{ width: `${finished ? 100 : progress}%` }}
          />
        </div>
      </div>

      {finished ? (
        <p className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-bold text-success">
          <Check className="size-4" /> বিজ্ঞাপন সম্পন্ন হয়েছে! (+৫ পয়েন্ট)
        </p>
      ) : (
        <p className="text-sm font-bold text-foreground">
          অপেক্ষা করুন: {bn(timeLeft)} সেকেন্ড...
        </p>
      )}
    </div>
  );
}

function VideoFeedCard({
  video,
  active,
  muted,
  commentCount,
  onToggleMute,
  onGift,
  onComments,
  onShare,
  watchSeconds,
  done,
  onWatched,
}: {
  video: Extract<FeedItem, { type: "video" }>;
  active: boolean;
  muted: boolean;
  commentCount: number;
  onToggleMute: () => void;
  onGift: () => void;
  onComments: () => void;
  onShare: () => void;
  watchSeconds: number;
  done: boolean;
  onWatched: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [watched, setWatched] = useState(0);
  const lastTime = useRef<number | null>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      setPaused(false);
      void el.play().catch(() => setPaused(true));
    } else {
      el.pause();
      el.currentTime = 0;
      lastTime.current = null;
      setWatched(0);
    }
  }, [active]);

  const togglePlay = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      void el.play().catch(() => {});
      setPaused(false);
    } else {
      el.pause();
      setPaused(true);
    }
  };

  // Count only real playback time (pause / seek do not add time).
  const onTime = () => {
    const el = ref.current;
    if (!el || !active || el.paused) return;
    const prev = lastTime.current;
    lastTime.current = el.currentTime;
    if (prev === null) return;
    const delta = el.currentTime - prev;
    if (delta <= 0 || delta > 1.5) return;
    setWatched((w) => {
      const next = w + delta;
      if (!done && !firedRef.current && next >= watchSeconds) {
        firedRef.current = true;
        onWatched();
      }
      return next;
    });
  };

  const progress = done ? 1 : Math.min(1, watched / Math.max(1, watchSeconds));

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={ref}
        src={video.url}
        playsInline
        muted={muted}
        preload="auto"
        onTimeUpdate={onTime}
        onPause={() => {
          lastTime.current = null;
        }}
        onEnded={() => setPaused(true)}
        onClick={togglePlay}
        className="h-full w-full cursor-pointer object-cover"
      />
      {paused && (
        <button
          type="button"
          aria-label="Play"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 z-10 grid size-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-black/50 text-white backdrop-blur"
        >
          <Play className="ml-1 size-10 fill-current" />
        </button>
      )}
      <div className="absolute inset-x-0 top-0 z-20 h-1 bg-white/15">
        <div
          className="h-full bg-coin transition-[width] duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-gradient-to-t from-black/90 to-transparent" />

      <div className="absolute bottom-32 right-3 z-20 flex flex-col items-center gap-5">
        <button
          onClick={onGift}
          className="flex flex-col items-center gap-1 text-coin transition-transform active:scale-90"
        >
          <span className="bg-brand-gradient grid size-11 place-items-center rounded-full shadow-lg ring-2 ring-coin/50">
            <Gift className="size-5 text-brand-foreground" />
          </span>
          <span className="text-[10px] font-bold">গিফট দিন</span>
        </button>
        <button
          onClick={() => setLiked((l) => !l)}
          className="flex flex-col items-center gap-1 text-white transition-transform active:scale-90"
        >
          <Heart
            className={`size-7 ${liked ? "fill-primary text-primary" : ""}`}
          />
          <span className="text-[10px] font-bold">
            {bn(video.likes + (liked ? 1 : 0))}
          </span>
        </button>
        <button
          onClick={onComments}
          className="flex flex-col items-center gap-1 text-white transition-transform active:scale-90"
        >
          <MessageCircle className="size-7" />
          <span className="text-[10px] font-bold">{bn(commentCount)}</span>
        </button>
        <button
          onClick={onShare}
          className="flex flex-col items-center gap-1 text-white transition-transform active:scale-90"
        >
          <Share2 className="size-7" />
          <span className="text-[10px] font-bold">শেয়ার</span>
        </button>
        <button
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="rounded-full border border-white/25 bg-black/60 p-2 text-white backdrop-blur"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-16 z-20 px-4 pr-20">
        {video.sponsored && (
          <p className="mb-1 inline-flex items-center gap-1 rounded-full bg-coin px-2 py-0.5 text-[10px] font-extrabold text-coin-foreground">
            {video.sponsored === "gold" ? "⭐ ফিচার্ড প্রোফাইল · স্পনসর্ড" : "🚀 স্পনসর্ড"}
          </p>
        )}
        <p className="text-sm font-extrabold text-white">{video.user}</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-white/90">
          {video.caption}
        </p>
        {video.promoLink && (
          <a
            href={video.promoLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block max-w-full truncate text-[11px] font-bold text-coin underline"
          >
            🔗 {video.promoLink}
          </a>
        )}
        <p className="mt-2 text-[10px] font-bold text-coin">
          সম্পূর্ণ ভিডিও দেখলে +১ পয়েন্ট
        </p>
      </div>
    </div>
  );
}

function SheetShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm">
      <div className="max-h-[85%] w-full overflow-y-auto rounded-t-3xl border-t border-border bg-card p-5">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h3 className="font-display text-sm font-extrabold text-card-foreground">
              {title}
            </h3>
            {subtitle && (
              <p className="mt-0.5 text-[11px] font-semibold text-foreground/70">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function CommentsSheet({
  videoId,
  settings,
  onClose,
}: {
  videoId: string;
  settings: AppSettings;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const comments = settings.comments.filter((c) => c.videoId === videoId);

  return (
    <SheetShell
      title="কমেন্ট"
      subtitle={`${bn(comments.length)} টি কমেন্ট`}
      onClose={onClose}
    >
      <ul className="space-y-3">
        {comments.length === 0 && (
          <li className="py-6 text-center text-xs font-semibold text-foreground/70">
            এখনো কোনো কমেন্ট নেই — প্রথম কমেন্টটি আপনি করুন।
          </li>
        )}
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-2">
            <span className="bg-brand-gradient grid size-8 shrink-0 place-items-center rounded-full text-[11px] font-extrabold text-brand-foreground">
              {comment.user.slice(1, 3)}
            </span>
            <div className="min-w-0 rounded-2xl bg-secondary px-3 py-2">
              <p className="text-[11px] font-bold text-accent">{comment.user}</p>
              <p className="text-xs font-medium text-foreground">
                {comment.text}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim().length === 0) return;
          addComment(videoId, text);
          setText("");
        }}
        className="sticky bottom-0 mt-4 flex gap-2 bg-card pt-2"
      >
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="কমেন্ট লিখুন..."
          className="flex-1 rounded-full border border-input bg-secondary px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/50 focus:border-ring"
        />
        <button
          type="submit"
          aria-label="Send comment"
          className="bg-brand-gradient grid size-11 shrink-0 place-items-center rounded-full text-brand-foreground shadow-lg active:scale-95"
        >
          <Send className="size-4" />
        </button>
      </form>
    </SheetShell>
  );
}

function UploadSheet({
  enabled,
  onClose,
  onSubmit,
}: {
  enabled: boolean;
  onClose: () => void;
  onSubmit: (caption: string, url: string) => void;
}) {
  const [caption, setCaption] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <SheetShell
      title="নিজের ভিডিও আপলোড করুন"
      subtitle="এডমিন অনুমোদন দিলে ভিডিওটি সবার ফিডে দেখাবে"
      onClose={onClose}
    >
      {!enabled ? (
        <p className="rounded-xl border border-warning/30 bg-warning/10 px-3 py-3 text-xs font-bold text-warning">
          এডমিন আপাতত ভিডিও আপলোড বন্ধ রেখেছে।
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (url.trim().length === 0) {
              setError("ভিডিও ফাইল সিলেক্ট করুন অথবা ভিডিও লিংক দিন।");
              return;
            }
            onSubmit(caption, url.trim());
          }}
          className="space-y-3"
        >
          <label className="block text-xs font-bold text-card-foreground">
            ভিডিও ফাইল
            <input
              type="file"
              accept="video/*"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setUrl(URL.createObjectURL(file));
                  setError(null);
                }
              }}
              className="mt-1.5 w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-xs text-foreground"
            />
          </label>

          <label className="block text-xs font-bold text-card-foreground">
            অথবা ভিডিও লিংক
            <input
              value={url.startsWith("blob:") ? "" : url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://..."
              className="mt-1.5 w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/50 focus:border-ring"
            />
          </label>

          <label className="block text-xs font-bold text-card-foreground">
            ক্যাপশন
            <input
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              maxLength={160}
              placeholder="আপনার ভিডিও সম্পর্কে লিখুন"
              className="mt-1.5 w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/50 focus:border-ring"
            />
          </label>

          {error && (
            <p className="text-xs font-bold text-destructive">{error}</p>
          )}

          <button
            type="submit"
            className="bg-brand-gradient w-full rounded-xl py-3 text-sm font-extrabold text-brand-foreground shadow-lg active:scale-[0.98]"
          >
            অনুমোদনের জন্য পাঠান
          </button>
        </form>
      )}
    </SheetShell>
  );
}

function ReferralSheet({
  settings,
  onClose,
  onCopied,
}: {
  settings: AppSettings;
  onClose: () => void;
  onCopied: (message: string) => void;
}) {
  const link =
    typeof window === "undefined"
      ? ""
      : `${window.location.origin}/?ref=${settings.referralCode}`;

  return (
    <SheetShell
      title="বন্ধুকে রেফার করুন"
      subtitle={`প্রতি রেফারে ${bn(REFERRAL_REWARD)} পয়েন্ট বোনাস`}
      onClose={onClose}
    >
      <div className="space-y-3">
        <div className="rounded-2xl border border-coin/30 bg-secondary px-4 py-3">
          <p className="text-[11px] font-semibold text-foreground/70">
            আপনার রেফারেল কোড
          </p>
          <p className="mt-1 font-display text-lg font-extrabold text-coin">
            {settings.referralCode}
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-2xl border border-border bg-secondary px-3 py-2.5">
          <Link2 className="size-4 shrink-0 text-accent" />
          <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
            {link}
          </p>
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                onCopied("রেফারেল লিংক কপি হয়েছে।");
              } catch {
                onCopied("কপি করা যায়নি, লিংকটি হাতে লিখে নিন।");
              }
            }}
            aria-label="Copy referral link"
            className="grid size-8 shrink-0 place-items-center rounded-full bg-coin text-coin-foreground"
          >
            <Copy className="size-4" />
          </button>
        </div>

        <button
          onClick={async () => {
            try {
              if (navigator.share) {
                await navigator.share({
                  title: "WatchCoin",
                  text: "ভিডিও দেখে টাকা ইনকাম করুন",
                  url: link,
                });
                return;
              }
              await navigator.clipboard.writeText(link);
              onCopied("লিংক কপি হয়েছে।");
            } catch {
              onCopied("শেয়ার করা যায়নি।");
            }
          }}
          className="bg-brand-gradient w-full rounded-xl py-3 text-sm font-extrabold text-brand-foreground shadow-lg active:scale-[0.98]"
        >
          বন্ধুদের কাছে শেয়ার করুন
        </button>

        <p className="text-center text-xs font-bold text-success">
          এখন পর্যন্ত {bn(settings.referrals)} জন আপনার লিংকে জয়েন করেছে
        </p>
      </div>
    </SheetShell>
  );
}

function HistorySheet({
  settings,
  onClose,
}: {
  settings: AppSettings;
  onClose: () => void;
}) {
  const totalCoins = settings.gifts.reduce((sum, g) => sum + g.coins, 0);
  return (
    <SheetShell
      title="গিফট লেনদেনের ইতিহাস"
      subtitle={`${bn(settings.gifts.length)} টি গিফট · মোট ${bn(totalCoins)} কয়েন খরচ`}
      onClose={onClose}
    >
      {settings.gifts.length === 0 ? (
        <p className="py-8 text-center text-xs font-semibold text-foreground/70">
          এখনো কোনো গিফট পাঠানো হয়নি।
        </p>
      ) : (
        <ul className="space-y-2">
          {settings.gifts.map((record) => (
            <li
              key={record.id}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-secondary px-3 py-2.5"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="text-2xl">{record.emoji}</span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-extrabold text-foreground">
                    {record.gift} → {record.creator}
                  </p>
                  <p className="text-[10px] font-semibold text-foreground/70">
                    {new Date(record.createdAt).toLocaleString("bn-BD")}
                  </p>
                </div>
              </div>
              <span className="shrink-0 text-xs font-extrabold text-coin">
                -{bn(record.coins)} কয়েন
              </span>
            </li>
          ))}
        </ul>
      )}
    </SheetShell>
  );
}

function EarningsSheet({
  settings,
  onClose,
}: {
  settings: AppSettings;
  onClose: () => void;
}) {
  const totalCoins = settings.gifts.reduce((sum, g) => sum + g.coins, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(Date.now() - (6 - i) * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    const coins = settings.gifts
      .filter((g) => new Date(g.createdAt).toISOString().slice(0, 10) === key)
      .reduce((sum, g) => sum + g.coins, 0);
    return { key, coins, label: date.toLocaleDateString("bn-BD", { weekday: "short" }) };
  });
  const max = Math.max(1, ...days.map((d) => d.coins));

  const byCreator = new Map<string, number>();
  for (const gift of settings.gifts) {
    byCreator.set(gift.creator, (byCreator.get(gift.creator) ?? 0) + gift.coins);
  }

  return (
    <SheetShell
      title="ক্রিয়েটর আয় ড্যাশবোর্ড"
      subtitle="গিফট থেকে আয়ের হিসাব (১০ কয়েন = ৳১)"
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-2">
        <Metric label="মোট গিফট" value={`${bn(settings.gifts.length)} টি`} />
        <Metric label="মোট কয়েন" value={bn(totalCoins)} />
        <Metric label="আয়" value={`৳${bn((totalCoins / 10).toFixed(2))}`} />
      </div>

      <p className="mt-5 text-xs font-extrabold text-card-foreground">
        গত ৭ দিনের আয়
      </p>
      <div className="mt-2 flex h-32 items-end gap-2">
        {days.map((day) => (
          <div key={day.key} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] font-bold text-coin">
              {day.coins > 0 ? bn(day.coins) : ""}
            </span>
            <div
              className="bg-brand-gradient w-full rounded-t-md"
              style={{ height: `${Math.max(4, (day.coins / max) * 100)}%` }}
            />
            <span className="text-[9px] font-semibold text-foreground/70">
              {day.label}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-5 text-xs font-extrabold text-card-foreground">
        ক্রিয়েটর অনুযায়ী আয়
      </p>
      {byCreator.size === 0 ? (
        <p className="py-4 text-center text-xs font-semibold text-foreground/70">
          এখনো কোনো গিফট আয় নেই।
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {[...byCreator.entries()]
            .sort((a, b) => b[1] - a[1])
            .map(([creator, coins]) => (
              <li
                key={creator}
                className="flex items-center justify-between rounded-xl border border-border bg-secondary px-3 py-2 text-xs"
              >
                <span className="font-bold text-foreground">{creator}</span>
                <span className="font-extrabold text-success">
                  ৳{bn((coins / 10).toFixed(2))}
                </span>
              </li>
            ))}
        </ul>
      )}
    </SheetShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-secondary p-3 text-center">
      <p className="text-[10px] font-semibold text-foreground/70">{label}</p>
      <p className="mt-1 text-sm font-extrabold text-foreground">{value}</p>
    </div>
  );
}

function WithdrawModal({
  balance,
  notice,
  onClose,
  onSubmit,
}: {
  balance: number;
  notice: string;
  onClose: () => void;
  onSubmit: (amount: number, method: WithdrawMethod, account: string) => void;
}) {
  const [method, setMethod] = useState<"bkash" | "nagad">("bkash");
  const [account, setAccount] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!/^01[3-9]\d{8}$/.test(account.trim())) {
      setError("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।");
      return;
    }
    if (!Number.isFinite(value) || value < MIN_WITHDRAW) {
      setError(`সর্বনিম্ন ৳${bn(MIN_WITHDRAW)} উইথড্র করতে পারবেন।`);
      return;
    }
    if (value > balance) {
      setError("আপনার ওয়ালেটে পর্যাপ্ত ব্যালেন্স নেই।");
      return;
    }
    onSubmit(value, method === "bkash" ? "bKash" : "Nagad", account.trim());
  };

  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/75 backdrop-blur-sm sm:items-center sm:justify-center">
      <form
        onSubmit={submit}
        className="max-h-[90%] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl"
      >
        {notice && (
          <p className="mb-3 rounded-xl border border-warning/30 bg-warning/10 px-3 py-2 text-[11px] font-semibold leading-relaxed text-warning">
            {notice}
          </p>
        )}
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-card-foreground">
            টাকা ক্যাশ আউট করুন
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-xs font-semibold text-foreground/75">
          বর্তমান ব্যালেন্স: ৳{bn(balance.toFixed(2))}
        </p>

        <p className="mt-5 text-xs font-bold text-card-foreground">
          পেমেন্ট মেথড সিলেক্ট করুন
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(["bkash", "nagad"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMethod(m)}
              className={`rounded-xl border py-2.5 text-xs font-bold transition-colors ${
                method === m
                  ? "bg-brand-gradient border-transparent text-brand-foreground"
                  : "border-border bg-secondary text-secondary-foreground"
              }`}
            >
              {m === "bkash" ? "bKash (বিকাশ)" : "Nagad (নগদ)"}
            </button>
          ))}
        </div>

        <label className="mt-4 block text-xs font-bold text-card-foreground">
          আপনার পার্সোনাল নম্বর
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            inputMode="numeric"
            maxLength={11}
            placeholder="01XXXXXXXXX"
            className="mt-1.5 w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/50 focus:border-ring"
          />
        </label>

        <label className="mt-3 block text-xs font-bold text-card-foreground">
          টাকার পরিমাণ (সর্বনিম্ন ৳{bn(MIN_WITHDRAW)})
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="50"
            className="mt-1.5 w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-foreground/50 focus:border-ring"
          />
        </label>

        {error && (
          <p className="mt-3 text-xs font-bold text-destructive">{error}</p>
        )}

        <button
          type="submit"
          className="bg-brand-gradient mt-5 w-full rounded-xl py-3 text-sm font-extrabold text-brand-foreground shadow-lg transition-transform active:scale-[0.98]"
        >
          উইথড্র রিকোয়েস্ট পাঠান
        </button>
        <p className="mt-2 text-center text-[10px] font-semibold text-foreground/70">
          {bn(POINTS_PER_TAKA)} পয়েন্ট = ৳{bn(1)} · রিকোয়েস্ট এডমিন রিভিউ করবে
        </p>
      </form>
    </div>
  );
}

type GiftOption = (typeof GIFTS)[number];

function GiftModal({
  creator,
  coins,
  onClose,
  onSend,
}: {
  creator: string;
  coins: number;
  onClose: () => void;
  onSend: (gift: GiftOption) => void;
}) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<GiftSuggestion[]>([]);
  const [aiError, setAiError] = useState<string | null>(null);

  const ask = async () => {
    if (message.trim().length === 0) return;
    setLoading(true);
    setAiError(null);
    try {
      const result = await suggestGifts({ data: { message } });
      setSuggestions(result);
      if (result.length === 0) {
        setAiError("সাজেশন পাওয়া যায়নি, আবার চেষ্টা করুন।");
      }
    } catch {
      setAiError("এআই সাজেশন এখন কাজ করছে না, পরে চেষ্টা করুন।");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SheetShell
      title="ক্রিয়েটরকে গিফট পাঠান"
      subtitle={`${creator} · আপনার আছে ${bn(coins)} কয়েন`}
      onClose={onClose}
    >
      <div className="grid grid-cols-3 gap-3 text-center">
        {GIFTS.map((gift) => {
          const affordable = coins >= gift.cost;
          const suggested = suggestions.some((s) => s.gift === gift.name);
          return (
            <button
              key={gift.name}
              onClick={() => onSend(gift)}
              className={`flex flex-col items-center rounded-2xl border bg-secondary p-3 transition-colors active:scale-95 ${
                suggested ? "border-coin ring-1 ring-coin/60" : "border-border"
              } ${affordable ? "hover:border-primary" : "opacity-60"}`}
            >
              <span className="text-3xl">{gift.emoji}</span>
              <span className="mt-1 text-xs font-extrabold text-foreground">
                {gift.name}
              </span>
              <span className="text-[10px] font-bold text-coin">
                {bn(gift.cost)} কয়েন
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 rounded-2xl border border-accent/30 bg-secondary p-3">
        <p className="flex items-center gap-1.5 text-xs font-extrabold text-accent">
          <Sparkles className="size-4" />
          এআই গিফট সাজেশন
        </p>
        <p className="mt-1 text-[11px] font-medium text-foreground/75">
          ভিডিওটি বা আপনার বার্তা লিখুন, এআই সেরা গিফট বেছে দেবে।
        </p>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={2}
          maxLength={500}
          placeholder="যেমন: গানটা দারুণ গেয়েছে, ওকে উৎসাহ দিতে চাই"
          className="mt-2 w-full resize-none rounded-xl border border-input bg-card px-3 py-2 text-xs text-foreground outline-none placeholder:text-foreground/50 focus:border-ring"
        />
        <button
          type="button"
          onClick={() => void ask()}
          disabled={loading || message.trim().length === 0}
          className="bg-brand-gradient mt-2 w-full rounded-xl py-2.5 text-xs font-extrabold text-brand-foreground shadow-lg active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? "সাজেশন তৈরি হচ্ছে..." : "সাজেশন দেখুন"}
        </button>

        {aiError && (
          <p className="mt-2 text-[11px] font-bold text-destructive">{aiError}</p>
        )}

        {suggestions.length > 0 && (
          <ul className="mt-3 space-y-2">
            {suggestions.map((suggestion, index) => {
              const gift = GIFTS.find((g) => g.name === suggestion.gift);
              return (
                <li
                  key={`${suggestion.gift}-${index}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-card px-3 py-2"
                >
                  <p className="min-w-0 text-[11px] font-medium text-foreground">
                    <span className="font-extrabold text-coin">
                      {gift?.emoji} {suggestion.gift}
                    </span>{" "}
                    {suggestion.reason}
                  </p>
                  {gift && (
                    <button
                      onClick={() => onSend(gift)}
                      className="shrink-0 rounded-full bg-coin px-3 py-1 text-[10px] font-extrabold text-coin-foreground"
                    >
                      পাঠান
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </SheetShell>
  );
}

function RechargeModal({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (mode: PayMode) => void;
}) {
  const options: { mode: PayMode; emoji: string; title: string; text: string; tone: string }[] = [
    { mode: "deposit", emoji: "🪙", title: "কয়েন ডিপোজিট", text: "সেন্ডমানি করে TrxID দিন, এডমিন এপ্রুভ করলে কয়েন যোগ হবে", tone: "border-coin/40 text-coin" },
    { mode: "vip", emoji: "👑", title: "VIP মেম্বারশিপ", text: "কম বিজ্ঞাপন, দ্বিগুণ পয়েন্ট, VIP ব্যাজ", tone: "border-coin/40 text-coin" },
    { mode: "boost", emoji: "🚀", title: "Reach Booster", text: "আপনার ভিডিও/পেজ সবার ফিডের উপরে দেখান", tone: "border-primary/40 text-primary" },
    { mode: "ad", emoji: "📢", title: "বিজ্ঞাপন দিন", text: "আপনার ব্যবসার ছবি বা ভিডিও বিজ্ঞাপন সবাইকে দেখান", tone: "border-accent/40 text-accent" },
  ];
  return (
    <SheetShell
      title="কয়েন, VIP ও বিজ্ঞাপন"
      subtitle="বিকাশ/নগদ/রকেটে সেন্ডমানি করুন"
      onClose={onClose}
    >
      <div className="space-y-3">
        {options.map((o) => (
          <button
            key={o.mode}
            onClick={() => onPick(o.mode)}
            className={`flex w-full items-center gap-3 rounded-2xl border bg-secondary p-4 text-left active:scale-95 ${o.tone}`}
          >
            <span className="text-3xl">{o.emoji}</span>
            <span>
              <span className="block text-sm font-extrabold">{o.title}</span>
              <span className="block text-[11px] font-semibold text-foreground/80">{o.text}</span>
            </span>
          </button>
        ))}
      </div>
    </SheetShell>
  );
}

const DEPOSIT_METHODS: DepositMethod[] = ["bKash", "Nagad", "Rocket"];

type PayMode = "deposit" | "boost" | "ad" | "vip";

const KIND_OF: Record<PayMode, DepositKind> = { deposit: "coins", boost: "boost", ad: "ad", vip: "vip" };

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

function DepositSheet({
  mode,
  onClose,
  onCopied,
  onSubmitted,
}: {
  mode: PayMode;
  onClose: () => void;
  onCopied: (msg: string) => void;
  onSubmitted: (msg: string) => void;
}) {
  const store = useStore();
  const s = store.settings;
  const [method, setMethod] = useState<DepositMethod>("bKash");
  const [pack, setPack] = useState<BoostPack>("silver");
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("3");
  const [trxId, setTrxId] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [caption, setCaption] = useState("");
  const [promoLink, setPromoLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const number = s.numbers[method];
  const dayCount = Math.max(1, Math.min(60, Math.round(Number(days)) || 1));

  const price =
    mode === "boost"
      ? BOOST_PACKS[pack].taka
      : mode === "vip"
        ? s.vipPrice
        : mode === "ad"
          ? s.adPricePerDay * dayCount
          : Math.round(Number(amount));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(number);
      onCopied(`${method} নাম্বার কপি হয়েছে: ${number}`);
    } catch {
      onCopied(number);
    }
  };

  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    const trx = trxId.trim().toUpperCase();
    if (mode === "deposit" && (!Number.isFinite(price) || price < MIN_DEPOSIT || price > 50000)) {
      setError(`সর্বনিম্ন ৳${bn(MIN_DEPOSIT)} দিন।`);
      return;
    }
    if (!/^[A-Z0-9]{6,20}$/.test(trx)) {
      setError("সঠিক Transaction ID (TrxID) দিন।");
      return;
    }
    if ((mode === "boost" || mode === "ad") && !isHttpUrl(videoUrl)) {
      setError(mode === "ad" ? "বিজ্ঞাপনের ছবি বা ভিডিওর সঠিক লিংক দিন (https://...)।" : "সঠিক ভিডিও লিংক দিন (https://...)।");
      return;
    }
    if (promoLink.trim() && !isHttpUrl(promoLink)) {
      setError("লিংক https:// দিয়ে শুরু করুন।");
      return;
    }
    const details: Record<string, string | number> = {};
    if (mode === "boost") {
      details["pack"] = pack;
      details["videoUrl"] = videoUrl.trim();
      details["caption"] = caption.trim().slice(0, 160);
      if (promoLink.trim()) details["promoLink"] = promoLink.trim().slice(0, 200);
    }
    if (mode === "ad") {
      details["mediaUrl"] = videoUrl.trim();
      details["title"] = caption.trim().slice(0, 80) || "বিজ্ঞাপন";
      details["days"] = dayCount;
      if (promoLink.trim()) details["link"] = promoLink.trim().slice(0, 200);
    }
    if (mode === "vip") details["days"] = s.vipDays;
    setBusy(true);
    const result = await submitDeposit({ kind: KIND_OF[mode], amount: price, method, trxId: trx, details });
    setBusy(false);
    if (result === "duplicate") {
      setError("এই TrxID আগেই ব্যবহার হয়েছে।");
      return;
    }
    if (result === "error") {
      setError("রিকোয়েস্ট পাঠানো যায়নি, আবার চেষ্টা করুন।");
      return;
    }
    onSubmitted(
      mode === "boost"
        ? "বুস্ট রিকোয়েস্ট পাঠানো হয়েছে, এডমিন যাচাই করলে ভিডিও উপরে দেখাবে।"
        : mode === "ad"
          ? "বিজ্ঞাপন রিকোয়েস্ট পাঠানো হয়েছে, এডমিন অনুমোদন দিলে ফিডে দেখাবে।"
          : mode === "vip"
            ? "VIP রিকোয়েস্ট পাঠানো হয়েছে, এডমিন যাচাই করলে চালু হবে।"
            : `৳${bn(price)} ডিপোজিট রিকোয়েস্ট পাঠানো হয়েছে।`,
    );
  };

  const field =
    "w-full rounded-xl border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground placeholder:text-muted-foreground";
  const mine = store.deposits.filter((d) => d.kind === KIND_OF[mode]).slice(0, 5);
  const title =
    mode === "boost" ? "🚀 Reach Booster" : mode === "ad" ? "📢 বিজ্ঞাপন দিন" : mode === "vip" ? "👑 VIP মেম্বারশিপ" : "🪙 কয়েন ডিপোজিট";
  const subtitle =
    mode === "boost"
      ? "ভিডিও প্রমোশন ও স্পনসরশিপ প্যাকেজ"
      : mode === "ad"
        ? `প্রতিদিন ৳${bn(s.adPricePerDay)} · ছবি বা ভিডিও বিজ্ঞাপন`
        : mode === "vip"
          ? "ঐচ্ছিক — না কিনলেও অ্যাপের সব কিছু ব্যবহার করা যাবে"
          : `৳১ = ${bn(COINS_PER_TAKA)} কয়েন`;

  return (
    <SheetShell title={title} subtitle={subtitle} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        {mode === "vip" && (
          <div className="rounded-2xl border border-coin/50 bg-coin/10 p-4">
            <p className="font-display text-2xl font-extrabold text-coin">
              ৳{bn(s.vipPrice)} <span className="text-sm text-foreground">/ {bn(s.vipDays)} দিন</span>
            </p>
            <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-relaxed text-foreground">
              {s.vipBenefits}
            </p>
            <p className="mt-2 text-[10px] font-semibold text-foreground/75">
              মেয়াদ শেষ হলে নিজে থেকে টাকা কাটবে না — চাইলে আবার কিনবেন।
            </p>
            {isVip(store.profile) && store.profile?.vipUntil && (
              <p className="mt-2 text-[11px] font-extrabold text-success">
                আপনার VIP চালু আছে: {new Date(store.profile.vipUntil).toLocaleDateString("bn-BD")} পর্যন্ত
              </p>
            )}
          </div>
        )}

        {mode === "boost" && (
          <div className="grid grid-cols-2 gap-2">
            {(Object.keys(BOOST_PACKS) as BoostPack[]).map((key) => {
              const p = BOOST_PACKS[key];
              return (
                <button
                  type="button"
                  key={key}
                  onClick={() => setPack(key)}
                  className={`rounded-2xl border p-3 text-left ${
                    pack === key ? "border-coin bg-coin/15" : "border-border bg-secondary"
                  }`}
                >
                  <span className="block text-xs font-extrabold text-coin">
                    {key === "gold" ? "🥇" : "🥈"} {p.label}
                  </span>
                  <span className="block text-lg font-extrabold text-foreground">৳{bn(p.taka)}</span>
                  <span className="block text-[10px] font-semibold text-foreground/80">
                    {bn(p.views.toLocaleString("en-US"))} ভিউ{p.featured ? " + প্রোফাইল ফিচার" : " · ফিডের সবার উপরে"}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex gap-2">
          {DEPOSIT_METHODS.map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMethod(m)}
              className={`flex-1 rounded-xl border py-2 text-xs font-extrabold ${
                method === m ? "border-primary bg-primary/20 text-foreground" : "border-border bg-secondary text-foreground/80"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="rounded-2xl border border-coin/40 bg-secondary p-3">
          <p className="text-[11px] font-semibold text-foreground/80">{method} সেন্ডমানি নাম্বার</p>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="font-mono text-lg font-extrabold text-coin">{number}</span>
            <button
              type="button"
              onClick={() => void copy()}
              className="flex items-center gap-1 rounded-full bg-coin px-3 py-1 text-xs font-extrabold text-coin-foreground"
            >
              <Copy className="size-3.5" /> কপি
            </button>
          </div>
          <p className="mt-2 whitespace-pre-line text-[11px] font-medium leading-relaxed text-foreground/85">
            {s.depositNotice}
          </p>
        </div>

        {mode === "deposit" && (
          <input className={field} inputMode="numeric" placeholder={`কত টাকা পাঠিয়েছেন (সর্বনিম্ন ${bn(MIN_DEPOSIT)})`} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        )}
        {mode === "ad" && (
          <label className="block text-xs font-bold text-foreground">
            কত দিন চলবে (১–৬০ দিন)
            <input className={`${field} mt-1`} inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} />
          </label>
        )}
        {mode !== "deposit" && (
          <p className="rounded-xl bg-secondary px-3 py-2 text-xs font-extrabold text-foreground">
            পাঠাতে হবে: <span className="text-coin">৳{bn(price)}</span>
          </p>
        )}
        <input className={`${field} font-mono uppercase`} placeholder="Transaction ID (TrxID)" value={trxId} onChange={(e) => setTrxId(e.target.value)} maxLength={20} />
        {(mode === "boost" || mode === "ad") && (
          <>
            <input className={field} placeholder={mode === "ad" ? "বিজ্ঞাপনের ছবি বা ভিডিও লিংক (https://...)" : "ভিডিও লিংক (https://...mp4)"} value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} maxLength={300} />
            <input className={field} placeholder={mode === "ad" ? "বিজ্ঞাপনের শিরোনাম" : "ক্যাপশন"} value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={mode === "ad" ? 80 : 160} />
            <input className={field} placeholder={mode === "ad" ? "আপনার পেজ / ওয়েবসাইট লিংক (ঐচ্ছিক)" : "ফেসবুক পেজ / ইউটিউব লিংক (ঐচ্ছিক)"} value={promoLink} onChange={(e) => setPromoLink(e.target.value)} maxLength={200} />
          </>
        )}
        {error && <p className="text-xs font-bold text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="bg-brand-gradient w-full rounded-xl py-3 text-sm font-extrabold text-brand-foreground disabled:opacity-50">
          {busy ? "পাঠানো হচ্ছে..." : "রিকোয়েস্ট সাবমিট করুন"}
        </button>
      </form>

      {mine.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-extrabold text-foreground">আমার রিকোয়েস্ট</p>
          {mine.map((d) => (
            <div key={d.id} className="flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-[11px] font-semibold text-foreground">
              <span>৳{bn(d.amount)} · {d.method} · <span className="font-mono">{d.trxId}</span></span>
              <span className={d.status === "approved" ? "text-success" : d.status === "rejected" ? "text-destructive" : "text-warning"}>
                {d.status === "approved" ? "এপ্রুভড" : d.status === "rejected" ? "বাতিল" : "অপেক্ষমাণ"}
              </span>
            </div>
          ))}
        </div>
      )}
    </SheetShell>
  );
}

function RulesSheet({ rules, penalties, onClose }: { rules: string; penalties: Penalty[]; onClose: () => void }) {
  return (
    <SheetShell title="📜 নিয়মাবলী" subtitle="নিয়ম ভাঙলে জরিমানা বা আইডি ব্লক হতে পারে" onClose={onClose}>
      <p className="whitespace-pre-line rounded-2xl bg-secondary p-4 text-xs font-semibold leading-relaxed text-foreground">
        {rules}
      </p>
      {penalties.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-xs font-extrabold text-destructive">আপনার জরিমানা</p>
          {penalties.map((p) => (
            <div key={p.id} className="flex justify-between gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[11px] font-semibold text-foreground">
              <span>{p.reason}</span>
              <span className="shrink-0 font-extrabold text-destructive">-৳{bn(p.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </SheetShell>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    if (!/^\S+@\S+\.\S+$/.test(email.trim()) || password.length < 6) {
      setMsg("সঠিক ইমেইল আর কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।");
      return;
    }
    setBusy(true);
    if (mode === "up") {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: window.location.origin + window.location.search },
      });
      setBusy(false);
      if (error) setMsg(error.message);
      else if (!data.session) setMsg("আপনার ইমেইলে একটি লিংক পাঠানো হয়েছে। লিংকে ক্লিক করে অ্যাকাউন্ট চালু করুন।");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      setBusy(false);
      if (error) setMsg("ইমেইল বা পাসওয়ার্ড ভুল।");
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (result.error) setMsg("Google দিয়ে লগইন করা যায়নি।");
  };

  const field =
    "w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring";

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-10 text-foreground">
      <div className="w-full max-w-sm space-y-4 rounded-3xl border border-border bg-card p-6 shadow-2xl">
        <div className="text-center">
          <p className="font-display text-2xl font-extrabold text-coin">🪙 WatchCoin</p>
          <p className="mt-1 text-xs font-semibold text-foreground/80">
            ভিডিও দেখুন, পয়েন্ট জমান, বিকাশ/নগদে টাকা তুলুন
          </p>
        </div>
        <button
          type="button"
          onClick={() => void google()}
          className="w-full rounded-xl border border-border bg-secondary py-2.5 text-sm font-extrabold text-foreground"
        >
          Google দিয়ে চালিয়ে যান
        </button>
        <p className="text-center text-[11px] font-semibold text-muted-foreground">অথবা ইমেইল দিয়ে</p>
        <form onSubmit={(e) => void submit(e)} className="space-y-3">
          <input className={field} type="email" autoComplete="email" placeholder="ইমেইল" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className={field} type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} placeholder="পাসওয়ার্ড" value={password} onChange={(e) => setPassword(e.target.value)} />
          {msg && <p className="text-xs font-bold text-warning">{msg}</p>}
          <button type="submit" disabled={busy} className="bg-brand-gradient w-full rounded-xl py-3 text-sm font-extrabold text-brand-foreground disabled:opacity-50">
            {mode === "in" ? "লগইন করুন" : "অ্যাকাউন্ট খুলুন"}
          </button>
        </form>
        <button
          type="button"
          onClick={() => {
            setMode(mode === "in" ? "up" : "in");
            setMsg(null);
          }}
          className="w-full text-center text-xs font-bold text-accent"
        >
          {mode === "in" ? "নতুন? অ্যাকাউন্ট খুলুন (১০০ কয়েন ফ্রি)" : "আগে থেকে অ্যাকাউন্ট আছে? লগইন করুন"}
        </button>
      </div>
    </main>
  );
}

function BlockedScreen({ reason, rules }: { reason: string; rules: string }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-5 py-10 text-foreground">
      <div className="w-full max-w-sm space-y-3 rounded-3xl border border-destructive/40 bg-card p-6">
        <p className="text-lg font-extrabold text-destructive">⛔ আপনার আইডি ব্লক করা হয়েছে</p>
        {reason && <p className="text-sm font-semibold text-foreground">কারণ: {reason}</p>}
        <p className="whitespace-pre-line rounded-xl bg-secondary p-3 text-[11px] font-semibold leading-relaxed text-foreground/85">
          {rules}
        </p>
        <button
          type="button"
          onClick={() => void supabase.auth.signOut()}
          className="w-full rounded-xl border border-border bg-secondary py-2.5 text-sm font-bold text-foreground"
        >
          লগআউট
        </button>
      </div>
    </main>
  );
}
