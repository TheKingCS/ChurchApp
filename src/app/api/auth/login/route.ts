import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, verifyPassword, SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }
  if (!user.passwordHash) {
    return NextResponse.json(
      { error: "This account uses Google Sign-In. Use the Continue with Google button instead." },
      { status: 401 }
    );
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: "Incorrect email or password." }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  return res;
}
