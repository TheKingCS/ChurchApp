"use client";

import { useEffect, useState } from "react";
import type { ServiceItemInput, Song, SongSlideInput } from "@/lib/types";

function emptySlide(): SongSlideInput {
  return { label: "", text: "", imageUrl: null };
}

const SECTION_LABEL_PATTERN =
  /^(verse\s*\d*|chorus|pre-?chorus|bridge|refrain|tag|intro|outro|ending|interlude)\s*:?$/i;

// Splits a pasted block of lyrics into slides at blank lines. If a block's
// first line looks like a section label (e.g. "Verse 1", "Chorus") it's
// pulled out as the slide's label instead of being shown as lyrics.
function splitLyricsIntoSlides(text: string): SongSlideInput[] {
  return text
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      const first = lines[0].trim();
      if (lines.length > 1 && SECTION_LABEL_PATTERN.test(first)) {
        return { label: first, text: lines.slice(1).join("\n").trim(), imageUrl: null };
      }
      return { label: null, text: block, imageUrl: null };
    });
}

export default function SongEditor({
  onCancel,
  onComplete,
}: {
  onCancel: () => void;
  onComplete: (items: ServiceItemInput[]) => void;
}) {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loadingSongs, setLoadingSongs] = useState(true);
  const [selectedSongId, setSelectedSongId] = useState<string>("new");
  const [title, setTitle] = useState("");
  const [slides, setSlides] = useState<SongSlideInput[]>([emptySlide()]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadingAudio, setUploadingAudio] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/songs");
        const data = await res.json();
        setSongs(data);
      } catch {
        // Song library is a convenience; failing to load it just means
        // starting from a blank song still works.
      } finally {
        setLoadingSongs(false);
      }
    })();
  }, []);

  function handleSelectSong(id: string) {
    setSelectedSongId(id);
    if (id === "new") {
      setTitle("");
      setSlides([emptySlide()]);
      setAudioUrl(null);
      return;
    }
    const song = songs.find((s) => s.id === id);
    if (song) {
      setTitle(song.title);
      setSlides(song.slides.map((s) => ({ ...s })));
      setAudioUrl(song.audioUrl ?? null);
    }
  }

  async function handleAudioChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAudio(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      setAudioUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingAudio(false);
    }
  }

  function handleSplitImport() {
    const parsed = splitLyricsIntoSlides(importText);
    if (parsed.length === 0) return;
    setSlides(parsed);
    setImportText("");
    setImportOpen(false);
  }

  function updateSlide(index: number, patch: Partial<SongSlideInput>) {
    setSlides((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  function addSlide() {
    setSlides((prev) => [...prev, emptySlide()]);
  }

  function removeSlide(index: number) {
    setSlides((prev) => prev.filter((_, i) => i !== index));
  }

  function moveSlide(index: number, direction: -1 | 1) {
    setSlides((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSlideImage(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIndex(index);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      updateSlide(index, { imageUrl: data.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingIndex(null);
    }
  }

  async function handleSave() {
    const cleanSlides = slides
      .map((s) => ({ ...s, text: s.text.trim(), label: s.label?.trim() || null }))
      .filter((s) => s.text.length > 0);

    if (!title.trim()) {
      setError("Please give this song a title.");
      return;
    }
    if (cleanSlides.length === 0) {
      setError("Add lyrics to at least one slide.");
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload = { title: title.trim(), slides: cleanSlides, audioUrl };
      const res = await fetch(
        selectedSongId === "new" ? "/api/songs" : `/api/songs/${selectedSongId}`,
        {
          method: selectedSongId === "new" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error("Save failed");

      const items: ServiceItemInput[] = cleanSlides.map((slide) => ({
        type: "song",
        title: slide.label ? `${title.trim()} — ${slide.label}` : title.trim(),
        body: slide.text,
        mediaUrl: slide.imageUrl ?? null,
      }));
      onComplete(items);
    } catch {
      setError("Something went wrong saving this song. Please try again.");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-30">
      <div className="w-full max-w-2xl rounded-xl border border-neutral-800 bg-neutral-950 p-6 flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-neutral-100">Add a Song</h3>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Start from</label>
          <select
            value={selectedSongId}
            onChange={(e) => handleSelectSong(e.target.value)}
            disabled={loadingSongs}
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500"
          >
            <option value="new">+ New song</option>
            {songs.map((song) => (
              <option key={song.id} value={song.id}>
                {song.title}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">Song title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Amazing Grace"
            className="w-full rounded-lg bg-neutral-900 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-neutral-400 mb-1">
            Practice track (optional)
          </label>
          <input
            type="file"
            accept="audio/*"
            onChange={handleAudioChange}
            className="block w-full text-sm text-neutral-300 file:mr-3 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-3 file:py-2 file:text-neutral-200 hover:file:bg-neutral-700"
          />
          {uploadingAudio && <p className="text-xs text-neutral-500 mt-1">Uploading…</p>}
          {audioUrl && !uploadingAudio && (
            <div className="mt-2 flex items-center gap-3">
              <audio src={audioUrl} controls className="h-8" />
              <button
                onClick={() => setAudioUrl(null)}
                className="text-xs text-red-400 hover:text-red-300 cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
          <p className="text-xs text-neutral-600 mt-1">
            For reference/rehearsal only — it isn&rsquo;t played during the presentation,
            since worship is usually sung live.
          </p>
        </div>

        <div className="rounded-lg border border-neutral-800 bg-neutral-900">
          <button
            onClick={() => setImportOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-neutral-300 hover:text-neutral-100 cursor-pointer"
          >
            <span>🎵 Import from audio + lyrics</span>
            <span className="text-neutral-500">{importOpen ? "▲" : "▼"}</span>
          </button>
          {importOpen && (
            <div className="px-4 pb-4 flex flex-col gap-3">
              <p className="text-xs text-neutral-500">
                Upload the track above, then paste the full lyrics here — I&rsquo;ll split
                it into slides at each blank line. Start a section with a label like
                &ldquo;Verse 1&rdquo; or &ldquo;Chorus&rdquo; on its own line to have it
                picked up automatically. This will replace the slides below.
              </p>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500 font-mono text-sm"
                placeholder={
                  "Verse 1\nAmazing grace, how sweet the sound\nThat saved a wretch like me\n\nChorus\nMy chains are gone\nI've been set free"
                }
              />
              <button
                onClick={handleSplitImport}
                disabled={!importText.trim()}
                className="self-start px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm text-neutral-200 disabled:opacity-50 cursor-pointer"
              >
                Split into Slides
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label className="text-sm text-neutral-400">
              Slides — one per verse, chorus, etc.
            </label>
          </div>

          {slides.map((slide, i) => (
            <div
              key={i}
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <input
                  value={slide.label ?? ""}
                  onChange={(e) => updateSlide(i, { label: e.target.value })}
                  placeholder={`Slide ${i + 1} label (e.g. Verse 1, Chorus)`}
                  className="flex-1 rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-1.5 text-sm text-neutral-100 focus:outline-none focus:border-blue-500"
                />
                <button
                  onClick={() => moveSlide(i, -1)}
                  disabled={i === 0}
                  className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 cursor-pointer text-sm shrink-0"
                  title="Move up"
                >
                  ↑
                </button>
                <button
                  onClick={() => moveSlide(i, 1)}
                  disabled={i === slides.length - 1}
                  className="w-7 h-7 rounded bg-neutral-800 hover:bg-neutral-700 disabled:opacity-30 cursor-pointer text-sm shrink-0"
                  title="Move down"
                >
                  ↓
                </button>
                <button
                  onClick={() => removeSlide(i)}
                  disabled={slides.length === 1}
                  className="w-7 h-7 rounded bg-neutral-800 hover:bg-red-900 disabled:opacity-30 cursor-pointer text-sm shrink-0"
                  title="Remove slide"
                >
                  ✕
                </button>
              </div>
              <textarea
                value={slide.text}
                onChange={(e) => updateSlide(i, { text: e.target.value })}
                rows={4}
                placeholder="Amazing grace, how sweet the sound…"
                className="w-full rounded-lg bg-neutral-950 border border-neutral-700 px-3 py-2 text-neutral-100 focus:outline-none focus:border-blue-500 font-mono text-sm"
              />
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleSlideImage(i, e)}
                  className="block text-xs text-neutral-300 file:mr-2 file:rounded-lg file:border-0 file:bg-neutral-800 file:px-2 file:py-1 file:text-neutral-200 hover:file:bg-neutral-700"
                />
                {uploadingIndex === i && (
                  <span className="text-xs text-neutral-500">Uploading…</span>
                )}
                {slide.imageUrl && uploadingIndex !== i && (
                  <span className="text-xs text-green-500">Picture added ✓</span>
                )}
              </div>
            </div>
          ))}

          <button
            onClick={addSlide}
            className="rounded-lg border-2 border-dashed border-neutral-700 hover:border-blue-500 hover:bg-neutral-900 py-3 text-sm text-neutral-500 hover:text-blue-400 cursor-pointer transition-colors"
          >
            + Add Slide
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-400 bg-red-950/50 border border-red-900 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-neutral-700 text-neutral-300 hover:bg-neutral-900 cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Save & Add to Service"}
          </button>
        </div>
      </div>
    </div>
  );
}
