import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildGoogleAuthUrl, isGoogleConfigured } from "@/lib/google-auth";

const STATE_COOKIE = "google_oauth_state";

export async function GET(req: NextRequest) {
  if (!isGoogleConfigured()) {
    return NextResponse.json({ error: "Google Sign-In is not configured" }, { status: 501 });
  }

  const state = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/google/callback", req.nextUrl.origin).toString();
  const url = buildGoogleAuthUrl(redirectUri, state);

  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
