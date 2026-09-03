import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { decodeGoogleIdToken, exchangeGoogleCode, isGoogleConfigured } from "@/lib/google-auth";

const STATE_COOKIE = "google_oauth_state";

export async function GET(req: NextRequest) {
  const loginUrl = new URL("/login", req.nextUrl.origin);

  if (!isGoogleConfigured()) {
    loginUrl.searchParams.set("error", "google_not_configured");
    return NextResponse.redirect(loginUrl);
  }

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const cookieState = req.cookies.get(STATE_COOKIE)?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    loginUrl.searchParams.set("error", "google_state_mismatch");
    return NextResponse.redirect(loginUrl);
  }

  try {
    const redirectUri = new URL("/api/auth/google/callback", req.nextUrl.origin).toString();
    const tokenRes = await exchangeGoogleCode(code, redirectUri);
    const claims = decodeGoogleIdToken(tokenRes.id_token);

    if (!claims.email_verified) {
      loginUrl.searchParams.set("error", "google_email_unverified");
      return NextResponse.redirect(loginUrl);
    }

    const email = claims.email.toLowerCase();

    let user = await prisma.user.findUnique({ where: { googleId: claims.sub } });
    if (!user) {
      // Same email already has a password account — link Google to it
      // instead of creating a duplicate.
      const existing = await prisma.user.findUnique({ where: { email } });
      user = existing
        ? await prisma.user.update({
            where: { id: existing.id },
            data: { googleId: claims.sub, name: existing.name ?? claims.name ?? null },
          })
        : await prisma.user.create({
            data: {
              email,
              googleId: claims.sub,
              name: claims.name ?? null,
              settings: { create: {} },
            },
          });
    }

    const { token, expiresAt } = await createSession(user.id);
    const res = NextResponse.redirect(new URL("/", req.nextUrl.origin));
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    res.cookies.delete(STATE_COOKIE);
    return res;
  } catch {
    loginUrl.searchParams.set("error", "google_failed");
    return NextResponse.redirect(loginUrl);
  }
}
