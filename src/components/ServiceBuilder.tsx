"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import type { ItemType, ServiceItemInput } from "@/lib/types";

type BuilderItem = ServiceItemInput & { key: string };

const TYPE_LABEL: Record<ItemType, string> = {
  notes: "Notes",
  image: "Picture",
  audio: "Audio / Music",
  song: "Song with Lyrics",
};

const TYPE_ICON: Record<ItemType, string> = {
  notes: "📝",
  image: "🖼️",
  audio: "🎵",
  song: "🎤",
};

function makeKey() {
  return Math.random().toString(36).slice(2);
}

export default function ServiceBuilder({
  serviceId,
  initialTitle,
  initialItems,
}: {
  serviceId?: string;
  initialTitle?: string;
  initialItems?: ServiceItemInput[];
}) {
  const router = useRouter();
  const isEditing = Boolean(serviceId);

  const [title, setTitle] = useState(initialTitle ?? "");
  const [items, setItems] = useState<BuilderItem[]>(
    (initialItems ?? []).map((item) => ({ ...item, key: item.id ?? makeKey() }))
  );
  const [addingType, setAddingType] = useState<ItemType | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addItem(item: ServiceItemInput) {
    setItems((prev) => [...prev, { ...item, key: makeKey() }]);
    setAddingType(null);
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }

  function moveItem(index: number, direction: -1 | 1) {
    setItems((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) {
      setError("Please give this service a title.");
      return;
    }
    if (items.length === 0) {
      setError("Add at least one item before saving.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        items: items.map(({ key, ...rest }) => {
          void key;
          return rest;
        }),
      };
      const res = await fetch(
        isEditing ? `/api/services/${serviceId}` : "/api/services",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Save failed");
      router.push("/");
      router.refresh();
    } catch {
      setError("Something went wrong saving this service. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      <header className="border-b border-neutral-800 bg-neutral-950/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-6 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-neutral-500 hover:text-neutral-200 cursor-pointer"
          >
            ← Back
          </button>
          <h1 className="text-xl font-semibold text-neutral-100">
            {isEditing ? "Edit Service" : "New Service"}
          </h1>
        </div>
      </header>

      <main className="flex-1 max-w-3xl w-full mx-auto px-6 py-8 flex flex-col gap-6">
        <div>
          <label className="block text-sm text-neutral-400 mb-1">Service title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sunday Morning Worship"
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-4 py-3 text-lg text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex flex-col gap-3">
          <h2 className="text-sm text-neutral-400">Order of service items</h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {items.map((item, index) => (
              <div
                key={item.key}
                className="group relative aspect-square rounded-2xl border border-neutral-800 bg-neutral-900 hover:border-neutral-600 transition-colors flex flex-col p-4"
              >
                <div className="flex-1 flex items-center justify-center text-4xl opacity-80">
                  {TYPE_ICON[item.type]}
                </div>
                <div>
                  <p className="text-sm font-medium text-neutral-100 truncate">
                    {item.title || TYPE_LABEL[item.type]}
                  </p>
                  <p className="text-xs text-neutral-500 truncate">
                    {item.type === "notes" || item.type === "song"
                      ? (item.body ?? "").slice(0, 40)
                      : item.mediaUrl}
                  </p>
                </div>

                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => moveItem(index, -1)}
                    disabled={index === 0}
                    className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 cursor-pointer text-sm"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveItem(index, 1)}
                    disabled={index === items.length - 1}
                    className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 cursor-pointer text-sm"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => removeItem(item.key)}
                    className="w-7 h-7 rounded-full bg-neutral-800 hover:bg-red-900 cursor-pointer text-sm"
                    title="Remove"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}

            <button
              onClick={() => setPickerOpen(true)}
              className="group aspect-square rounded-2xl border-2 border-dashed border-neutral-700 hover:border-blue-500 hover:bg-neutral-900 transition-colors flex flex-col items-center justify-center gap-2 cursor-pointer"
            >
              <span className="text-5xl font-light text-neutral-600 group-hover:text-blue-500 transition-colors leading-none">
                +
              </span>
              <span className="text-sm text-neutral-500 group-hover:text-blue-400 transition-colors">
                Add Item
              </span>
            </button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={() => router.push("/")}
            className="px-5 py-2.5 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Save Service"}
          </button>
        </div>
      </main>

      {pickerOpen && (
        <TypePickerModal
          onCancel={() => setPickerOpen(false)}
          onPick={(type) => {
            setPickerOpen(false);
            setAddingType(type);
          }}
        />
      )}

      {addingType && (
        <AddItemModal
          type={addingType}
          onCancel={() => setAddingType(null)}
          onAdd={addItem}
        />
      )}
    </div>
  );
}

function TypePickerModal({
  onCancel,
  onPick,
}: {
  onCancel: () => void;
  onPick: (type: ItemType) => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-20">
      <div className="w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-950 p-6 flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-neutral-100">Add to service</h3>
        <div className="grid grid-cols-2 gap-3">
          {(Object.keys(TYPE_LABEL) as ItemType[]).map((type) => (
            <button
              key={type}
              onClick={() => onPick(type)}
              className="flex flex-col items-center justify-center gap-1 rounded-xl border border-neutral-800 hover:border-blue-500 hover:bg-neutral-900 py-4 cursor-pointer transition-colors"
            >
              <span className="text-2xl">{TYPE_ICON[type]}</span>
              <span className="text-xs text-neutral-400">{TYPE_LABEL[type]}</span>
            </button>
          ))}
        </div>
        <div className="flex justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-900 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function AddItemModal({
  type,
  onCancel,
  onAdd,
}: {
  type: ItemType;
  onCancel: () => void;
  onAdd: (item: ServiceItemInput) => void;
}) {
  const [itemTitle, setItemTitle] = useState("");
  const [body, setBody] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const needsMedia = type === "image" || type === "audio";
  const needsBody = type === "notes" || type === "song";
  const mediaOptional = type === "song";

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setMediaUrl(data.url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function handleSubmit() {
    if (needsMedia && !mediaOptional && !mediaUrl) {
      setUploadError("Please upload a file.");
      return;
    }
    onAdd({
      type,
      title: itemTitle.trim() || null,
      body: needsBody ? body : null,
      mediaUrl,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-20">
      <div className="w-full max-w-lg rounded-xl border border-neutral-800 bg-neutral-950 p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-neutral-100">
          {TYPE_LABEL[type]}
        </h3>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Title {type === "song" ? "(song name)" : "(optional)"}
          </label>
          <input
            value={itemTitle}
            onChange={(e) => setItemTitle(e.target.value)}
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500"
            placeholder={type === "song" ? "Amazing Grace" : "Welcome"}
          />
        </div>

        {needsBody && (
          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              {type === "song" ? "Lyrics for the display" : "Notes text"}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500 font-mono text-sm"
              placeholder={
                type === "song"
                  ? "Verse 1\nAmazing grace, how sweet the sound…"
                  : "Announcements, prayer points, scripture…"
              }
            />
          </div>
        )}

        {(needsMedia || type === "song") && (
          <div>
            <label className="block text-sm text-neutral-400 mb-1">
              {type === "image"
                ? "Picture"
                : type === "audio"
                ? "Audio file"
                : "Backing track (optional)"}
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept={type === "image" ? "image/*" : "audio/*"}
              onChange={handleFileChange}
              className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-neutral-200 hover:file:bg-neutral-700"
            />
            {uploading && <p className="text-xs text-neutral-500 mt-1">Uploading…</p>}
            {mediaUrl && !uploading && (
              <p className="text-xs text-green-500 mt-1">Uploaded ✓</p>
            )}
            {uploadError && (
              <p className="text-xs text-red-400 mt-1">{uploadError}</p>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 cursor-pointer"
          >
            Add to service
          </button>
        </div>
      </div>
    </div>
  );
}
