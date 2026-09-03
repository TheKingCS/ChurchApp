"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { SettingsData } from "@/lib/types";

export default function SettingsForm({
  initialSettings,
}: {
  initialSettings: SettingsData;
}) {
  const router = useRouter();
  const [churchName, setChurchName] = useState(initialSettings.churchName ?? "");
  const [logoUrl, setLogoUrl] = useState<string | null>(initialSettings.logoUrl ?? null);
  const [accentColor, setAccentColor] = useState(initialSettings.accentColor);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setLogoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ churchName, logoUrl, accentColor }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSaved(true);
      router.refresh();
    } catch {
      setError("Something went wrong saving settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-6 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-neutral-500 hover:text-neutral-200 cursor-pointer"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-neutral-100">Settings</h1>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        <p className="text-sm text-neutral-500">
          Branding shown on the Presenter screen: your church&rsquo;s logo appears in the
          corner of every slide, and the accent color tints headings and buttons.
        </p>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Church name</label>
          <input
            value={churchName}
            onChange={(e) => setChurchName(e.target.value)}
            placeholder="Grace Community Church"
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Logo (optional)</label>
          <input
            type="file"
            accept="image/*"
            onChange={handleLogoChange}
            className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-neutral-200 hover:file:bg-neutral-700"
          />
          {uploading && <p className="text-xs text-neutral-500 mt-1">Uploading…</p>}
          {logoUrl && !uploading && (
            <div className="mt-3 flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Logo preview"
                className="max-h-16 max-w-[180px] object-contain rounded bg-neutral-900 p-2"
              />
              <button
                onClick={() => setLogoUrl(null)}
                className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Accent color</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-14 h-10 rounded-lg bg-neutral-900 border border-neutral-700 cursor-pointer"
            />
            <span className="text-sm text-neutral-400 font-mono">{accentColor}</span>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && <span className="text-sm text-green-500">Saved ✓</span>}
        </div>
      </main>
    </div>
  );
}
