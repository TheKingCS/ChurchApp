import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/session-cookie";

// Present and Control stay public (no login) — a TV browser or a phone on
// the church network should be able to open a service link directly.
// Everything else that manages data requires a signed-in session; the
// presence check here is a fast redirect, the real ownership check happens
// against the database in each page/route.
function isPublicPath(pathname: string): boolean {
  if (pathname === "/login" || pathname === "/signup") return true;
  if (pathname.startsWith("/api/auth/")) return true;
  if (/^\/service\/[^/]+\/(present|control)$/.test(pathname)) return true;
  if (/^\/api\/services\/[^/]+\/playback$/.test(pathname)) return true;
  if (pathname.startsWith("/uploads/")) return true;
  return false;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublicPath(pathname)) return NextResponse.next();

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (!hasSession) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
