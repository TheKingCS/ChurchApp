import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Presenter from "@/components/Presenter";

export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Public route (no login) — a TV or phone opens this by link — so the
  // service is looked up by id alone, and branding is that of whichever
  // church owns the service, not the viewer.
  const service = await prisma.service.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  });

  if (!service) notFound();

  const settings = await prisma.settings.upsert({
    where: { userId: service.userId },
    update: {},
    create: { userId: service.userId },
  });

  return <Presenter service={service} settings={settings} />;
}
