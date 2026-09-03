import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Control from "@/components/Control";

export default async function ControlPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const service = await prisma.service.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  });

  if (!service) notFound();

  return <Control service={service} />;
}
