import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const state = await prisma.playbackState.upsert({
    where: { serviceId: id },
    update: {},
    create: { serviceId: id, currentIndex: 0, isPlaying: false },
  });
  return NextResponse.json(state);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();

  const data: { currentIndex?: number; isPlaying?: boolean } = {};
  if (typeof body.currentIndex === "number") data.currentIndex = body.currentIndex;
  if (typeof body.isPlaying === "boolean") data.isPlaying = body.isPlaying;

  const state = await prisma.playbackState.upsert({
    where: { serviceId: id },
    update: data,
    create: {
      serviceId: id,
      currentIndex: data.currentIndex ?? 0,
      isPlaying: data.isPlaying ?? false,
    },
  });

  return NextResponse.json(state);
}
