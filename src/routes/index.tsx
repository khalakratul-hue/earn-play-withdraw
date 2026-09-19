import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Heart,
  MessageCircle,
  Share2,
  Wallet,
  Volume2,
  VolumeX,
  ShieldAlert,
  Star,
  X,
  Check,
} from "lucide-react";

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
  component: WatchEarnApp,
});

const POINTS_PER_TAKA = 100;
const MIN_WITHDRAW = 50;

type FeedItem =
  | {
      id: string;
      type: "video";
      url: string;
      user: string;
      caption: string;
      likes: number;
    }
  | {
      id: string;
      type: "forced_ad";
      title: string;
      duration: number;
      sponsor: string;
    };

const FEED: FeedItem[] = [
  {
    id: "v1",
    type: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-tree-with-yellow-flowers-1173-large.mp4",
    user: "@nature_king",
    caption: "সুন্দর প্রকৃতির দৃশ্য! 🌿 #nature",
    likes: 1200,
  },
  {
    id: "v2",
    type: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-mother-with-her-little-daughter-eating-apples-40149-large.mp4",
    user: "@family_time",
    caption: "সুন্দর বিকেল ❤️ #vlog",
    likes: 3400,
  },
  {
    id: "ad1",
    type: "forced_ad",
    title: "স্পন্সরড এডভার্টাইজমেন্ট",
    duration: 10,
    sponsor: "Custom Sponsor",
  },
  {
    id: "v3",
    type: "video",
    url: "https://assets.mixkit.co/videos/preview/mixkit-a-girl-blowing-a-bubble-gum-bubble-41537-large.mp4",
    user: "@fun_videos",
    caption: "মজার ভিডিও 😂 #funny",
    likes: 890,
  },
];

function bn(n: number | string) {
  const digits = "০১২৩৪৫৬৭৮৯".split("");
  return String(n).replace(/\d/g, (d) => digits[Number(d)] ?? d);
}

function WatchEarnApp() {
  const [points, setPoints] = useState(0);
  const [balance, setBalance] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [muted, setMuted] = useState(true);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [rewarded, setRewarded] = useState<Record<string, boolean>>({});
  const [adLocked, setAdLocked] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  }, []);

  const award = useCallback(
    (id: string, amount: number) => {
      if (rewarded[id]) return;
      setRewarded((r) => ({ ...r, [id]: true }));
      setPoints((p) => p + amount);
      setBalance((b) => b + amount / POINTS_PER_TAKA);
    },
    [rewarded],
  );

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
  }, []);

  const current = FEED[currentIndex];
  useEffect(() => {
    if (current?.type === "forced_ad" && !rewarded[current.id]) {
      setAdLocked(true);
    } else {
      setAdLocked(false);
    }
  }, [current, rewarded]);

  const goNext = useCallback(() => {
    const el = itemRefs.current[currentIndex + 1];
    el?.scrollIntoView({ behavior: "smooth" });
  }, [currentIndex]);

  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-0 sm:p-6">
      <div className="relative h-screen w-full max-w-[430px] overflow-hidden bg-black sm:h-[860px] sm:rounded-[2.25rem] sm:border sm:border-border sm:shadow-2xl">
        {/* হেডার: পয়েন্ট, ব্যালেন্স, উইথড্র */}
        <header className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-2 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-4">
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface/80 px-3 py-1.5 backdrop-blur">
            <Star className="size-3.5 text-coin-glow" />
            <span className="text-xs font-bold text-surface-foreground">
              {bn(points)} পয়েন্ট
            </span>
            <span className="text-border">|</span>
            <span className="text-xs font-bold text-coin-glow">
              ৳{bn(balance.toFixed(2))}
            </span>
          </div>
          <button
            onClick={() => setShowWithdraw(true)}
            className="bg-brand-gradient flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold text-brand-foreground shadow-lg transition-transform active:scale-95"
          >
            <Wallet className="size-3.5" />
            উইথড্র (৳{bn(MIN_WITHDRAW)})
          </button>
        </header>

        {/* ফিড */}
        <div
          ref={scrollRef}
          className={`h-full w-full snap-y snap-mandatory ${
            adLocked ? "overflow-hidden" : "overflow-y-scroll"
          } [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`}
        >
          {FEED.map((item, index) => (
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
                  onComplete={() => {
                    award(item.id, 5);
                    notify("বিজ্ঞাপন সম্পন্ন! +৫ পয়েন্ট যোগ হয়েছে");
                  }}
                />
              ) : (
                <VideoFeedCard
                  video={item}
                  active={currentIndex === index}
                  muted={muted}
                  onToggleMute={() => setMuted((m) => !m)}
                  onEnded={() => {
                    award(item.id, 1);
                    notify("ভিডিও সম্পন্ন! +১ পয়েন্ট");
                    goNext();
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {adLocked && (
          <div className="pointer-events-none absolute inset-x-0 bottom-6 z-30 flex justify-center">
            <p className="rounded-full bg-black/70 px-4 py-2 text-[11px] font-semibold text-muted-foreground backdrop-blur">
              বিজ্ঞাপন শেষ হওয়া পর্যন্ত স্ক্রল বন্ধ
            </p>
          </div>
        )}

        {toast && (
          <div className="absolute inset-x-0 top-20 z-40 flex justify-center px-6">
            <p className="bg-brand-gradient rounded-full px-4 py-2 text-xs font-bold text-brand-foreground shadow-xl">
              {toast}
            </p>
          </div>
        )}

        {showWithdraw && (
          <WithdrawModal
            balance={balance}
            onClose={() => setShowWithdraw(false)}
            onSubmit={(amount, method, account) => {
              setBalance((b) => b - amount);
              setShowWithdraw(false);
              notify(
                `৳${bn(amount)} উইথড্র রিকোয়েস্ট পাঠানো হয়েছে (${method}: ${account})`,
              );
            }}
          />
        )}
      </div>
    </main>
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
      <span className="rounded-full border border-border bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Sponsored Ad
      </span>
      <div className="bg-brand-gradient flex size-20 items-center justify-center rounded-3xl shadow-2xl">
        <ShieldAlert className="size-9 text-brand-foreground" />
      </div>
      <h2 className="text-xl font-extrabold text-foreground">{ad.title}</h2>
      <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
        বিজ্ঞাপনটি সম্পূর্ণ না দেখলে পরবর্তী ভিডিও দেখা বা পয়েন্ট অর্জন করা
        সম্ভব নয়।
      </p>
      <p className="text-[11px] text-muted-foreground">
        স্পন্সর: {ad.sponsor}
      </p>

      <div className="w-full max-w-xs">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="bg-brand-gradient h-full transition-all duration-1000 ease-linear"
            style={{ width: `${finished ? 100 : progress}%` }}
          />
        </div>
      </div>

      {finished ? (
        <p className="flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-xs font-bold text-accent">
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
  onToggleMute,
  onEnded,
}: {
  video: Extract<FeedItem, { type: "video" }>;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onEnded: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [liked, setLiked] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (active) {
      void el.play().catch(() => {});
    } else {
      el.pause();
      el.currentTime = 0;
    }
  }, [active]);

  return (
    <div className="relative h-full w-full bg-black">
      <video
        ref={ref}
        src={video.url}
        playsInline
        muted={muted}
        preload="metadata"
        onEnded={onEnded}
        className="h-full w-full object-cover"
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/85 to-transparent" />

      <div className="absolute bottom-24 right-3 z-20 flex flex-col items-center gap-5">
        <button
          onClick={() => setLiked((l) => !l)}
          className="flex flex-col items-center gap-1 text-foreground transition-transform active:scale-90"
        >
          <Heart
            className={`size-7 ${liked ? "fill-primary text-primary" : ""}`}
          />
          <span className="text-[10px] font-semibold">
            {bn(video.likes + (liked ? 1 : 0))}
          </span>
        </button>
        <button className="flex flex-col items-center gap-1 text-foreground">
          <MessageCircle className="size-7" />
          <span className="text-[10px] font-semibold">{bn(128)}</span>
        </button>
        <button className="flex flex-col items-center gap-1 text-foreground">
          <Share2 className="size-7" />
          <span className="text-[10px] font-semibold">শেয়ার</span>
        </button>
        <button
          onClick={onToggleMute}
          className="rounded-full border border-border bg-surface/70 p-2 text-surface-foreground backdrop-blur"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>

      <div className="absolute inset-x-0 bottom-8 z-20 px-4 pr-20">
        <p className="text-sm font-extrabold text-foreground">{video.user}</p>
        <p className="mt-1 text-xs leading-relaxed text-foreground/85">
          {video.caption}
        </p>
        <p className="mt-2 text-[10px] font-semibold text-coin-glow">
          সম্পূর্ণ ভিডিও দেখলে +১ পয়েন্ট
        </p>
      </div>
    </div>
  );
}

function WithdrawModal({
  balance,
  onClose,
  onSubmit,
}: {
  balance: number;
  onClose: () => void;
  onSubmit: (amount: number, method: string, account: string) => void;
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
    <div className="absolute inset-0 z-50 flex items-end bg-black/70 backdrop-blur-sm sm:items-center sm:justify-center">
      <form
        onSubmit={submit}
        className="w-full rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-extrabold text-card-foreground">
            টাকা ক্যাশ আউট করুন
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          বর্তমান ব্যালেন্স: ৳{bn(balance.toFixed(2))}
        </p>

        <p className="mt-5 text-xs font-semibold text-card-foreground">
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

        <label className="mt-4 block text-xs font-semibold text-card-foreground">
          আপনার পার্সোনাল নম্বর
          <input
            value={account}
            onChange={(e) => setAccount(e.target.value)}
            inputMode="numeric"
            maxLength={11}
            placeholder="01XXXXXXXXX"
            className="mt-1.5 w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </label>

        <label className="mt-3 block text-xs font-semibold text-card-foreground">
          টাকার পরিমাণ (সর্বনিম্ন ৳{bn(MIN_WITHDRAW)})
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            placeholder="50"
            className="mt-1.5 w-full rounded-xl border border-input bg-secondary px-3 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring"
          />
        </label>

        {error && (
          <p className="mt-3 text-xs font-semibold text-destructive">{error}</p>
        )}

        <button
          type="submit"
          className="bg-brand-gradient mt-5 w-full rounded-xl py-3 text-sm font-extrabold text-brand-foreground shadow-lg transition-transform active:scale-[0.98]"
        >
          উইথড্র রিকোয়েস্ট পাঠান
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">
          {bn(POINTS_PER_TAKA)} পয়েন্ট = ৳{bn(1)} · রিকোয়েস্ট এডমিন রিভিউ করবে
        </p>
      </form>
    </div>
  );
}
