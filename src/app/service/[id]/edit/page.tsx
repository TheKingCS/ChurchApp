import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import ServiceBuilder from "@/components/ServiceBuilder";

export default async function EditServicePage({
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

  return (
    <ServiceBuilder
      serviceId={service.id}
      initialTitle={service.title}
      initialItems={service.items.map((item) => ({
        id: item.id,
        type: item.type as "notes" | "image" | "audio" | "song",
        title: item.title,
        body: item.body,
        mediaUrl: item.mediaUrl,
      }))}
    />
  );
}
