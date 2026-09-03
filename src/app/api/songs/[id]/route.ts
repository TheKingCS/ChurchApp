import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import type { SongInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const song = await prisma.song.findUnique({ where: { id } });
  if (!song || song.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: song.id,
    title: song.title,
    slides: JSON.parse(song.slides),
    audioUrl: song.audioUrl,
  });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: SongInput = await req.json();

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body.slides || body.slides.length === 0) {
    return NextResponse.json({ error: "At least one slide is required" }, { status: 400 });
  }

  const existing = await prisma.song.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const song = await prisma.song.update({
    where: { id },
    data: {
      title: body.title.trim(),
      slides: JSON.stringify(body.slides),
      audioUrl: body.audioUrl ?? null,
    },
  });

  return NextResponse.json({
    id: song.id,
    title: song.title,
    slides: body.slides,
    audioUrl: song.audioUrl,
  });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.song.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.song.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
