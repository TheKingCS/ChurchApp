import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { SettingsData } from "@/lib/types";

export async function GET() {
  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  return NextResponse.json(settings);
}

export async function PUT(req: NextRequest) {
  const body: SettingsData = await req.json();

  const settings = await prisma.settings.upsert({
    where: { id: "singleton" },
    update: {
      churchName: body.churchName?.trim() || null,
      logoUrl: body.logoUrl || null,
      accentColor: body.accentColor || "#3b82f6",
    },
    create: {
      id: "singleton",
      churchName: body.churchName?.trim() || null,
      logoUrl: body.logoUrl || null,
      accentColor: body.accentColor || "#3b82f6",
    },
  });

  return NextResponse.json(settings);
}
