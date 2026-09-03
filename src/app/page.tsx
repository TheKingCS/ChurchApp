import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const services = await prisma.service.findMany({
    where: { userId: user.id },
    orderBy: { serviceDate: "desc" },
    include: { items: true },
  });

  return <Dashboard services={services} churchName={user.churchName} />;
}
