import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SongInput, SongSlideInput } from "@/lib/types";

export async function GET() {
  const songs = await prisma.song.findMany({ orderBy: { title: "asc" } });
  return NextResponse.json(
    songs.map((song) => ({
      id: song.id,
      title: song.title,
      slides: JSON.parse(song.slides) as SongSlideInput[],
    }))
  );
}

export async function POST(req: NextRequest) {
  const body: SongInput = await req.json();

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!body.slides || body.slides.length === 0) {
    return NextResponse.json({ error: "At least one slide is required" }, { status: 400 });
  }

  const song = await prisma.song.create({
    data: {
      title: body.title.trim(),
      slides: JSON.stringify(body.slides),
    },
  });

  return NextResponse.json(
    { id: song.id, title: song.title, slides: body.slides },
    { status: 201 }
  );
}
