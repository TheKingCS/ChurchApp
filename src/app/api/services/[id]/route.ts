import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromRequest } from "@/lib/auth";
import type { ServiceInput } from "@/lib/types";
import { unlink } from "fs/promises";
import path from "path";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const service = await prisma.service.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  });

  if (!service || service.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(service);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body: ServiceInput = await req.json();

  if (!body.title || !body.title.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Optimistic concurrency: if the editor loaded this service and someone
  // else has saved changes since, refuse to silently clobber their edit.
  if (body.baseUpdatedAt && existing.updatedAt.toISOString() !== body.baseUpdatedAt) {
    return NextResponse.json(
      {
        error: "conflict",
        message:
          "This service was updated by someone else while you were editing. Reload to see the latest version before saving.",
      },
      { status: 409 }
    );
  }

  // Replace items wholesale: delete old, create new, in a transaction.
  const service = await prisma.$transaction(async (tx) => {
    await tx.serviceItem.deleteMany({ where: { serviceId: id } });
    return tx.service.update({
      where: { id },
      data: {
        title: body.title.trim(),
        items: {
          create: (body.items ?? []).map((item, index) => ({
            order: index,
            type: item.type,
            title: item.title ?? null,
            body: item.body ?? null,
            mediaUrl: item.mediaUrl ?? null,
            imageUrl: item.imageUrl ?? null,
            loop: item.loop ?? false,
          })),
        },
      },
      include: { items: { orderBy: { order: "asc" } } },
    });
  });

  return NextResponse.json(service);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const existing = await prisma.service.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!existing || existing.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.service.delete({ where: { id } });

  // Best-effort cleanup of uploaded media files that were only used by this service.
  for (const item of existing.items) {
    for (const url of [item.mediaUrl, item.imageUrl]) {
      if (url && url.startsWith("/uploads/")) {
        const filepath = path.join(process.cwd(), "public", url);
        unlink(filepath).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
