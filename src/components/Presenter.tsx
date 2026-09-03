"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Service, ServiceItem } from "@prisma/client";
import { formatServiceDate } from "@/lib/format";

type ServiceWithItems = Service & { items: ServiceItem[] };

export default function Presenter({ service }: { service: ServiceWithItems }) {
  const router = useRouter();
  const items = service.items;

  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(items.length - 1, next));
      setIndex(clamped);
      pushState(clamped);
    },
    [items.length, pushState]
  );

  // Poll for remote-control changes from another device.
  useEffect(() => {
    if (!started) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/services/${service.id}/playback`);
        const data = await res.json();
        if (data.updatedAt !== lastUpdatedAtRef.current) {
          lastUpdatedAtRef.current = data.updatedAt;
          setIndex((cur) => (cur !== data.currentIndex ? data.currentIndex : cur));
        }
      } catch {
        // ignore transient network errors
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [started, service.id]);

  useEffect(() => {
    if (!started) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        goTo(index + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
        router.push("/");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [started, index, goTo, router]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    el.play().catch(() => {});
  }, [index]);

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
      setIndex(Math.max(0, Math.min(items.length - 1, data.currentIndex ?? 0)));
    } catch {
      setIndex(0);
    }
    setStarted(true);
  }

  if (!started) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center px-6">
        <p className="text-neutral-500 uppercase tracking-widest text-sm">
          {formatServiceDate(service.serviceDate)}
        </p>
        <h1 className="text-4xl sm:text-5xl font-bold text-neutral-50">{service.title}</h1>
        <p className="text-neutral-500">{items.length} item{items.length === 1 ? "" : "s"}</p>
        <button
          onClick={handleStart}
          disabled={items.length === 0}
          className="mt-4 px-8 py-4 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-lg font-semibold disabled:opacity-40 cursor-pointer"
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
      <div className="flex-1 relative flex">
        <button
          aria-label="Previous"
          onClick={() => goTo(index - 1)}
          className="w-1/3 h-full cursor-pointer"
        />
        <div className="flex-1 flex items-center justify-center p-10">
          <Slide item={item} audioRef={audioRef} />
        </div>
        <button
          aria-label="Next"
          onClick={() => goTo(index + 1)}
          className="w-1/3 h-full cursor-pointer"
        />
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

function Slide({
  item,
  audioRef,
}: {
  item: ServiceItem;
  audioRef: React.RefObject<HTMLAudioElement | null>;
}) {
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
        <div className="flex flex-col items-center gap-6 text-center">
          <span className="text-7xl">🎵</span>
          {item.title && (
            <h2 className="text-3xl font-semibold text-neutral-100">{item.title}</h2>
          )}
          {item.mediaUrl && (
            <audio ref={audioRef} src={item.mediaUrl} controls autoPlay className="w-96" />
          )}
        </div>
      );
    case "song":
      return (
        <div className="flex flex-col items-center gap-6 text-center max-w-4xl">
          {item.title && (
            <h2 className="text-2xl font-semibold text-blue-400 uppercase tracking-wide">
              {item.title}
            </h2>
          )}
          <p className="whitespace-pre-wrap text-4xl sm:text-5xl leading-snug font-medium text-neutral-50">
            {item.body}
          </p>
          {item.mediaUrl && (
            <audio ref={audioRef} src={item.mediaUrl} autoPlay className="hidden" />
          )}
        </div>
      );
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
