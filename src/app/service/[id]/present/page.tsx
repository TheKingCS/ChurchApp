import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Presenter from "@/components/Presenter";

export default async function PresentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [service, settings] = await Promise.all([
    prisma.service.findUnique({
      where: { id },
      include: { items: { orderBy: { order: "asc" } } },
    }),
    prisma.settings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    }),
  ]);

  if (!service) notFound();

  return <Presenter service={service} settings={settings} />;
}
