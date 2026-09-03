import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import type { SettingsData } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const settings = await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: SettingsData = await req.json();

  const settings = await prisma.settings.upsert({
    where: { userId: user.id },
    update: {
      churchName: body.churchName?.trim() || null,
      logoUrl: body.logoUrl || null,
      accentColor: body.accentColor || "#3b82f6",
    },
    create: {
      userId: user.id,
      churchName: body.churchName?.trim() || null,
      logoUrl: body.logoUrl || null,
      accentColor: body.accentColor || "#3b82f6",
    },
  });

  return NextResponse.json(settings);
}
