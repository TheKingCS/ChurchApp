export type ItemType = "notes" | "image" | "audio" | "song" | "countdown" | "scripture";

export interface ServiceItemInput {
  id?: string;
  type: ItemType;
  title?: string | null;
  body?: string | null;
  mediaUrl?: string | null;
  imageUrl?: string | null;
  loop?: boolean;
}

export interface ServiceInput {
  title: string;
  items: ServiceItemInput[];
  baseUpdatedAt?: string;
}

export interface SongSlideInput {
  label?: string | null;
  text: string;
  imageUrl?: string | null;
}

export interface SongInput {
  title: string;
  slides: SongSlideInput[];
  audioUrl?: string | null;
}

export interface Song extends SongInput {
  id: string;
}

export interface CountdownBody {
  seconds: number;
  endMessage?: string;
}

export interface SettingsData {
  churchName?: string | null;
  logoUrl?: string | null;
  accentColor: string;
}
