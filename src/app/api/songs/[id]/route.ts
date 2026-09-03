import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SongInput } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const song = await prisma.song.findUnique({ where: { id } });
  if (!song) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ id: song.id, title: song.title, slides: JSON.parse(song.slides) });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body: SongInput = await req.json();

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body.slides || body.slides.length === 0) {
    return NextResponse.json({ error: "At least one slide is required" }, { status: 400 });
  }

  const existing = await prisma.song.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const song = await prisma.song.update({
    where: { id },
    data: { title: body.title.trim(), slides: JSON.stringify(body.slides) },
  });

  return NextResponse.json({ id: song.id, title: song.title, slides: body.slides });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const existing = await prisma.song.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.song.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
