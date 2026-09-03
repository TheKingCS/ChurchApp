"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Service, ServiceItem } from "@prisma/client";
import { formatServiceDate } from "@/lib/format";

type ServiceWithItems = Service & { items: ServiceItem[] };

export default function Dashboard({
  services,
  churchName,
}: {
  services: ServiceWithItems[];
  churchName?: string | null;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      setLoggingOut(false);
    }
  }

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/services/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      router.refresh();
    } catch {
      alert("Could not delete this service. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleDuplicate(service: ServiceWithItems) {
    setDuplicatingId(service.id);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${service.title} (Copy)`,
          items: service.items.map((item) => ({
            type: item.type,
            title: item.title,
            body: item.body,
            mediaUrl: item.mediaUrl,
            loop: item.loop,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to duplicate");
      const created = await res.json();
      router.push(`/service/${created.id}/edit`);
    } catch {
      alert("Could not duplicate this service. Please try again.");
      setDuplicatingId(null);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-8 relative">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center text-neutral-50">
            COS
          </h1>
          <p className="text-center text-xs uppercase tracking-widest text-neutral-600 mt-1">
            Church Order of Service
          </p>
          {churchName && (
            <p className="text-center text-sm text-neutral-500 mt-1">{churchName}</p>
          )}
          <div className="absolute right-6 top-8 flex items-center gap-1">
            <button
              onClick={() => router.push("/settings")}
              title="Settings"
              className="w-10 h-10 rounded-full text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 flex items-center justify-center cursor-pointer"
            >
              <GearIcon />
            </button>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              title="Log out"
              className="w-10 h-10 rounded-full text-neutral-400 hover:text-neutral-100 hover:bg-neutral-900 flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <LogoutIcon />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          <button
            onClick={() => router.push("/service/new")}
            className="group aspect-square rounded-2xl border-2 border-dashed border-neutral-700 hover:border-blue-500 hover:bg-neutral-900 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer"
          >
            <span className="text-5xl font-light text-neutral-600 group-hover:text-blue-500 transition-colors leading-none">
              +
            </span>
            <span className="text-sm text-neutral-500 group-hover:text-blue-400 transition-colors">
              New Service
            </span>
          </button>

          {services.map((service) => {
            return (
              <div
                key={service.id}
                className="group relative aspect-square rounded-2xl border border-neutral-800 bg-neutral-900 hover:border-neutral-600 transition-colors flex flex-col overflow-hidden"
              >
                <button
                  onClick={() => router.push(`/service/${service.id}/present`)}
                  className="flex-1 flex flex-col p-4 text-left w-full cursor-pointer"
                >
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-sm text-neutral-600">
                      {service.items.length === 0
                        ? "Empty"
                        : `${service.items.length} item${service.items.length === 1 ? "" : "s"}`}
                    </span>
                  </div>
                  <div className="mt-2">
                    <h2 className="font-semibold text-neutral-50 truncate">
                      {service.title}
                    </h2>
                    <p className="text-xs text-neutral-500 truncate">
                      {formatServiceDate(service.serviceDate)}
                    </p>
                  </div>
                </button>

                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => router.push(`/service/${service.id}/edit`)}
                    title="Edit"
                    className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-sm cursor-pointer"
                  >
                    ✏️
                  </button>
                  <button
                    onClick={() => router.push(`/service/${service.id}/control`)}
                    title="Remote control"
                    className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-sm cursor-pointer"
                  >
                    📱
                  </button>
                  <button
                    onClick={() => handleDuplicate(service)}
                    disabled={duplicatingId === service.id}
                    title="Duplicate"
                    className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-sm cursor-pointer disabled:opacity-50"
                  >
                    📋
                  </button>
                  <button
                    onClick={() => handleDelete(service.id, service.title)}
                    disabled={deletingId === service.id}
                    title="Delete"
                    className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-red-900 flex items-center justify-center text-sm cursor-pointer disabled:opacity-50"
                  >
                    🗑️
                  </button>
                </div>

                <button
                  onClick={() => router.push(`/service/${service.id}/present`)}
                  title="Present on TV"
                  className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-sm cursor-pointer"
                >
                  ▶️
                </button>
              </div>
            );
          })}
        </div>

        {services.length === 0 && (
          <p className="text-center text-neutral-600 mt-10">
            No services yet. Tap the + tile to plan your first order of service.
          </p>
        )}
      </main>
    </div>
  );
}

function GearIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}
