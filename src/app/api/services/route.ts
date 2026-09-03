import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import type { ServiceInput } from "@/lib/types";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const services = await prisma.service.findMany({
    where: { userId: user.id },
    orderBy: { serviceDate: "desc" },
    include: { items: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json(services);
}

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: ServiceInput = await req.json();

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const service = await prisma.service.create({
    data: {
      userId: user.id,
      title: body.title.trim(),
      items: {
        create: (body.items ?? []).map((item, index) => ({
          order: index,
          type: item.type,
          title: item.title ?? null,
          body: item.body ?? null,
          mediaUrl: item.mediaUrl ?? null,
          loop: item.loop ?? false,
        })),
      },
    },
    include: { items: { orderBy: { order: "asc" } } },
  });

  return NextResponse.json(service, { status: 201 });
}
