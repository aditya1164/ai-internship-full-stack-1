import { NextRequest, NextResponse } from "next/server";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("token")?.value;

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isProtectedPage = pathname.startsWith("/dashboard") || pathname.startsWith("/apps");
  const isProtectedApi = pathname.startsWith("/api/apps") || pathname.startsWith("/api/notifications");

  // Redirect to login if accessing protected page without token
  if (isProtectedPage && !token) {
    const loginUrl = new NextUrl("/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  // Block protected APIs if without token
  if (isProtectedApi && !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect to dashboard if accessing auth pages while logged in
  if (isAuthPage && token) {
    const dashboardUrl = new NextUrl("/dashboard", req.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

class NextUrl extends URL {
  constructor(path: string, base: string) {
    super(path, base);
  }
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/apps/:path*",
    "/login",
    "/register",
    "/api/apps/:path*",
    "/api/notifications/:path*",
  ],
};
