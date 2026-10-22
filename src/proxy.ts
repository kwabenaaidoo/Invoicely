import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only (cookie present). Real authorization happens in the data access layer
// (`requireUser` / `requireBusiness`) on every page, action and route handler.
const COOKIE = process.env.NODE_ENV === "production" ? "__Host-inv_session" : "inv_session";
const PROTECTED = ["/dashboard", "/invoices", "/clients", "/products", "/templates", "/analytics", "/developer", "/settings", "/print"];
const GUEST_ONLY = ["/login", "/signup", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(COOKIE);
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isProtected && !hasSession) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && GUEST_ONLY.includes(pathname)) return NextResponse.redirect(new URL("/dashboard", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|invoice/public).*)"],
};
