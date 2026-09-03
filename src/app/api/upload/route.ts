import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getUserFromRequest } from "@/lib/auth";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");

const ALLOWED_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/ogg",
  "audio/aac",
  "video/mp4",
  "video/quicktime",
]);

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported file type: ${file.type}` },
      { status: 400 }
    );
  }

  const MAX_BYTES = 100 * 1024 * 1024; // 100MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  await mkdir(UPLOAD_DIR, { recursive: true });

  const ext = path.extname(file.name) || "";
  const safeExt = /^\.[a-zA-Z0-9]{1,10}$/.test(ext) ? ext : "";
  const filename = `${randomUUID()}${safeExt}`;
  const filepath = path.join(UPLOAD_DIR, filename);

  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(filepath, bytes);

  return NextResponse.json({ url: `/uploads/${filename}` });
}
