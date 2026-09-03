"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Service, ServiceItem } from "@prisma/client";
import { formatServiceDate } from "@/lib/format";
import type { CountdownBody, SettingsData } from "@/lib/types";
import { nextPresentableIndex } from "@/lib/navigation";

type ServiceWithItems = Service & { items: ServiceItem[] };

export default function Presenter({
  service,
  settings,
}: {
  service: ServiceWithItems;
  settings: SettingsData;
}) {
  const router = useRouter();
  const items = service.items;
  const accent = settings.accentColor || "#3b82f6";

  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);

  const lastUpdatedAtRef = useRef<string | null>(null);

  const pushState = useCallback(
    async (nextIndex: number) => {
      try {
        const res = await fetch(`/api/services/${service.id}/playback`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentIndex: nextIndex }),
        });
        const data = await res.json();
        lastUpdatedAtRef.current = data.updatedAt;
      } catch {
        // Non-fatal: remote control sync will simply lag until next poll.
      }
    },
    [service.id]
  );

  const goNext = useCallback(() => {
    const next = nextPresentableIndex(items, index + 1, 1);
    setIndex(next);
    pushState(next);
  }, [items, index, pushState]);

  const goPrev = useCallback(() => {
    const prev = nextPresentableIndex(items, index - 1, -1);
    setIndex(prev);
    pushState(prev);
  }, [items, index, pushState]);

  // Poll for remote-control changes from another device.
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/services/${service.id}/playback`);
        const data = await res.json();
        if (data.updatedAt !== lastUpdatedAtRef.current) {
          lastUpdatedAtRef.current = data.updatedAt;
          setIndex((cur) => {
            const target = nextPresentableIndex(items, data.currentIndex ?? 0, 1);
            return cur !== target ? target : cur;
          });
        }
      } catch {
        // ignore transient network errors
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [started, service.id, items]);

  useEffect(() => {
    if (!started) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, goNext, goPrev, router]);

  async function handleStart() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Fullscreen may be unavailable (e.g. some smart TV browsers); continue anyway.
    }
    try {
      const res = await fetch(`/api/services/${service.id}/playback`);
      const data = await res.json();
      lastUpdatedAtRef.current = data.updatedAt;
      setIndex(nextPresentableIndex(items, data.currentIndex ?? 0, 1));
    } catch {
      setIndex(nextPresentableIndex(items, 0, 1));
    }
    setStarted(true);
  }

  if (!started) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-6">
        {settings.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={settings.logoUrl} alt="" className="max-h-20 max-w-[200px] object-contain mb-2" />
        )}
        <p className="text-neutral-500 uppercase tracking-widest text-sm">
          {formatServiceDate(service.serviceDate)}
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-neutral-50">{service.title}</h1>
        <p className="text-neutral-500">{items.length} item{items.length === 1 ? "" : "s"}</p>
        <button
          onClick={handleStart}
          disabled={items.length === 0}
          style={{ backgroundColor: accent }}
          className="mt-4 px-8 py-4 rounded-full hover:opacity-90 text-white text-lg font-semibold disabled:opacity-40 cursor-pointer"
        >
          ▶ Start Presentation
        </button>
        <button
          onClick={() => router.push("/")}
          className="text-neutral-500 hover:text-neutral-300 cursor-pointer"
        >
          ← Back to dashboard
        </button>
        <p className="text-xs text-neutral-700 max-w-sm">
          Open this same page on the TV&rsquo;s browser, then use the remote control page
          from your phone to drive it, or use the arrow keys / click here directly.
        </p>
      </div>
    );
  }

  const item = items[index];

  return (
    <div className="fixed inset-0 bg-black flex flex-col select-none">
      {settings.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.logoUrl}
          alt=""
          className="absolute top-4 left-4 max-h-10 max-w-[140px] object-contain opacity-70 z-10"
        />
      )}

      <div className="flex-1 relative flex items-center justify-center p-10 pb-24">
        <Slide key={item.id} item={item} accent={accent} />

        <button
          aria-label="Previous"
          onClick={goPrev}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-neutral-900/50 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <ChevronIcon direction="left" />
        </button>
        <button
          aria-label="Next"
          onClick={goNext}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-neutral-900/50 hover:bg-neutral-800 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer transition-colors"
        >
          <ChevronIcon direction="right" />
        </button>
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-neutral-900/80 rounded-full px-4 py-2 text-sm text-neutral-400">
        <span>
          {index + 1} / {items.length}
        </span>
        <span className="text-neutral-700">•</span>
        <span className="truncate max-w-[40vw]">{item.title || item.type}</span>
      </div>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points={direction === "left" ? "15 18 9 12 15 6" : "9 18 15 12 9 6"} />
    </svg>
  );
}

// Picks a text size that keeps long verses from overflowing the screen —
// shorter references get the full dramatic size, longer ones step down.
function scriptureTextSizeClass(text: string): string {
  const len = text.length;
  if (len < 120) return "text-4xl sm:text-6xl";
  if (len < 250) return "text-3xl sm:text-5xl";
  if (len < 400) return "text-2xl sm:text-4xl";
  if (len < 600) return "text-xl sm:text-3xl";
  return "text-lg sm:text-2xl";
}

function Slide({ item, accent }: { item: ServiceItem; accent: string }) {
  switch (item.type) {
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.mediaUrl ?? ""}
          alt={item.title ?? "Slide"}
          className="max-h-full max-w-full object-contain"
        />
      );
    case "audio":
      return (
        <div className="flex flex-col items-center gap-6 text-center max-h-full">
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.imageUrl}
              alt=""
              className="max-h-[50vh] max-w-full object-contain rounded-lg"
            />
          ) : (
            <span className="text-7xl">🔊</span>
          )}
          {item.title && (
            <h2 className="text-3xl font-semibold text-neutral-100">{item.title}</h2>
          )}
          {item.mediaUrl && (
            <audio
              src={item.mediaUrl}
              controls
              autoPlay
              loop={item.loop}
              className="w-96"
            />
          )}
        </div>
      );
    case "song":
      // Deliberately no title/label heading here — the congregation should
      // just see the lyrics, not internal organizing labels like "Amazing
      // Grace — Verse 1" (those stay in the builder tiles and Control list).
      return (
        <div className="flex flex-col items-center gap-6 text-center max-w-4xl">
          {item.mediaUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.mediaUrl}
              alt=""
              className="max-h-[40vh] max-w-full object-contain rounded-lg"
            />
          )}
          <p className="whitespace-pre-wrap text-4xl sm:text-5xl leading-snug font-medium text-neutral-50">
            {item.body}
          </p>
        </div>
      );
    case "scripture":
      return (
        <div className="flex flex-col items-center justify-center gap-6 text-center max-w-5xl max-h-full overflow-y-auto px-4">
          <p
            className={`whitespace-pre-wrap leading-snug italic font-medium text-neutral-50 ${scriptureTextSizeClass(
              item.body ?? ""
            )}`}
          >
            {item.body}
          </p>
          {item.title && (
            <p
              style={{ color: accent }}
              className="text-lg sm:text-xl font-semibold uppercase tracking-wide shrink-0"
            >
              — {item.title}
            </p>
          )}
        </div>
      );
    case "countdown":
      return <CountdownSlide item={item} accent={accent} />;
    case "notes":
    default:
      return (
        <div className="flex flex-col items-center gap-6 text-center max-w-4xl">
          {item.title && (
            <h2 className="text-3xl font-semibold text-neutral-100">{item.title}</h2>
          )}
          <p className="whitespace-pre-wrap text-3xl sm:text-4xl leading-relaxed text-neutral-200">
            {item.body}
          </p>
        </div>
      );
  }
}

function CountdownSlide({ item, accent }: { item: ServiceItem; accent: string }) {
  const config: CountdownBody = (() => {
    try {
      return JSON.parse(item.body ?? "{}");
    } catch {
      return { seconds: 0 };
    }
  })();

  const [remaining, setRemaining] = useState(config.seconds ?? 0);

  useEffect(() => {
    const deadline = Date.now() + (config.seconds ?? 0) * 1000;
    const interval = setInterval(() => {
      setRemaining(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const done = remaining <= 0;

  return (
    <>
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
      )}
      {item.mediaUrl && (
        <audio src={item.mediaUrl} autoPlay loop={item.loop} className="hidden" />
      )}
      <div className="relative flex flex-col items-center gap-6 text-center">
        {item.title && (
          <h2 className="text-2xl font-semibold text-neutral-300 uppercase tracking-wide">
            {item.title}
          </h2>
        )}
        {done ? (
          <p style={{ color: accent }} className="text-6xl sm:text-7xl font-bold">
            {config.endMessage || "Time's up!"}
          </p>
        ) : (
          <p className="text-8xl sm:text-9xl font-bold text-neutral-50 tabular-nums">
            {minutes}:{String(seconds).padStart(2, "0")}
          </p>
        )}
      </div>
    </>
  );
}
