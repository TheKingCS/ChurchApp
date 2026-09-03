export type ItemType = "notes" | "image" | "audio" | "song";

export interface ServiceItemInput {
  id?: string;
  type: ItemType;
  title?: string | null;
  body?: string | null;
  mediaUrl?: string | null;
}

export interface ServiceInput {
  title: string;
  items: ServiceItemInput[];
}
