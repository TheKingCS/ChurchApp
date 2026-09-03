"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Service, ServiceItem } from "@prisma/client";

type ServiceWithItems = Service & { items: ServiceItem[] };

const TYPE_ICON: Record<string, string> = {
  notes: "📝",
  image: "🖼️",
  audio: "🎵",
  song: "🎤",
};

export default function Control({ service }: { service: ServiceWithItems }) {
  const router = useRouter();
  const items = service.items;
  const [index, setIndex] = useState(0);
  const lastUpdatedAtRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/services/${service.id}/playback`);
        const data = await res.json();
        if (cancelled) return;
        if (data.updatedAt !== lastUpdatedAtRef.current) {
          lastUpdatedAtRef.current = data.updatedAt;
          setIndex(data.currentIndex ?? 0);
        }
      } catch {
        // ignore transient network errors
      }
    }
    poll();
    const interval = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [service.id]);

  async function goTo(next: number) {
    const clamped = Math.max(0, Math.min(items.length - 1, next));
    setIndex(clamped);
    try {
      const res = await fetch(`/api/services/${service.id}/playback`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentIndex: clamped }),
      });
      const data = await res.json();
      lastUpdatedAtRef.current = data.updatedAt;
    } catch {
      // will resync on next poll
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-6 py-5 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-neutral-500 hover:text-neutral-200 cursor-pointer"
          >
            ← Back
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-neutral-100 truncate">
              {service.title}
            </h1>
            <p className="text-xs text-neutral-500">Remote control</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-6 py-6 flex flex-col gap-6">
        <p className="text-xs text-neutral-600 text-center">
          Open the presentation on the TV&rsquo;s browser first (tap ▶ on the dashboard tile),
          then use this page to drive the slides.
        </p>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => goTo(index - 1)}
            disabled={index <= 0}
            className="w-16 h-16 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 text-2xl cursor-pointer"
          >
            ◀
          </button>
          <div className="text-center min-w-[4rem]">
            <p className="text-2xl font-semibold text-neutral-100">{index + 1}</p>
            <p className="text-xs text-neutral-500">of {items.length}</p>
          </div>
          <button
            onClick={() => goTo(index + 1)}
            disabled={index >= items.length - 1}
            className="w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-500 disabled:opacity-30 text-2xl cursor-pointer"
          >
            ▶
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <button
              key={item.id}
              onClick={() => goTo(i)}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left cursor-pointer transition-colors ${
                i === index
                  ? "border-blue-500 bg-blue-950/40"
                  : "border-neutral-800 bg-neutral-900 hover:border-neutral-600"
              }`}
            >
              <span className="text-xl">{TYPE_ICON[item.type] ?? "•"}</span>
              <span className="flex-1 min-w-0 truncate text-sm text-neutral-200">
                {item.title || item.type}
              </span>
              {i === index && <span className="text-xs text-blue-400">Live</span>}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
