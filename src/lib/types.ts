export type ItemType = "notes" | "image" | "audio" | "song";

export interface ServiceItemInput {
  id?: string;
  type: ItemType;
  title?: string | null;
  body?: string | null;
  mediaUrl?: string | null;
  loop?: boolean;
}

export interface ServiceInput {
  title: string;
  items: ServiceItemInput[];
}

export interface SongSlideInput {
  label?: string | null;
  text: string;
  imageUrl?: string | null;
}

export interface SongInput {
  title: string;
  slides: SongSlideInput[];
}

export interface Song extends SongInput {
  id: string;
}
