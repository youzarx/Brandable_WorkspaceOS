import { NextResponse, type NextRequest } from 'next/server';
import { AUTH_CONFIG } from '@platform/config';

export function middleware(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const hasRefreshCookie = request.cookies.has(AUTH_CONFIG.COOKIE_NAME);

  // Check if pathname matches protected dashboard route (e.g. /[orgSlug]/dashboard)
  const isDashboardRoute = pathname.includes('/dashboard');
  const isAuthRoute = pathname === '/login' || pathname === '/register';

  if (isDashboardRoute && !hasRefreshCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && hasRefreshCookie) {
    // If user already has valid auth cookie and visits login, redirect to root
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (.png, .svg, etc)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
