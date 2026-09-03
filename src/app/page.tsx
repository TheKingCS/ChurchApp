import { prisma } from "@/lib/prisma";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const services = await prisma.service.findMany({
    orderBy: { serviceDate: "desc" },
    include: { items: true },
  });

  return <Dashboard services={services} />;
}
