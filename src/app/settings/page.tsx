import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import SettingsForm from "@/components/SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const settings = await prisma.settings.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  return <SettingsForm initialSettings={settings} />;
}
