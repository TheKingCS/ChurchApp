import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@prisma/client";
import { SESSION_COOKIE } from "@/lib/session-cookie";

export { SESSION_COOKIE };
const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = sessionExpiry();
  await prisma.session.create({ data: { id: token, userId, expiresAt } });
  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.delete({ where: { id: token } }).catch(() => {});
}

async function userFromToken(token: string | undefined): Promise<User | null> {
  if (!token) return null;
  const session = await prisma.session.findUnique({ where: { id: token }, include: { user: true } });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id: token } }).catch(() => {});
    return null;
  }
  return session.user;
}

/** For Server Components and Server Actions. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  return userFromToken(jar.get(SESSION_COOKIE)?.value);
}

/** For Route Handlers, which get their own request object instead of next/headers. */
export async function getUserFromRequest(req: NextRequest): Promise<User | null> {
  return userFromToken(req.cookies.get(SESSION_COOKIE)?.value);
}
