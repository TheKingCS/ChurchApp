import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import ServiceBuilder from "@/components/ServiceBuilder";
import type { ItemType } from "@/lib/types";

export default async function EditServicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const service = await prisma.service.findUnique({
    where: { id },
    include: { items: { orderBy: { order: "asc" } } },
  });

  if (!service || service.userId !== user.id) notFound();

  return (
    <ServiceBuilder
      serviceId={service.id}
      initialTitle={service.title}
      initialItems={service.items.map((item) => ({
        id: item.id,
        type: item.type as ItemType,
        title: item.title,
        body: item.body,
        mediaUrl: item.mediaUrl,
        loop: item.loop,
      }))}
      initialUpdatedAt={service.updatedAt.toISOString()}
    />
  );
}
