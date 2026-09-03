import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Presenter from "@/components/Presenter";

export default async function PresentPage({
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

  return <Presenter service={service} />;
}
