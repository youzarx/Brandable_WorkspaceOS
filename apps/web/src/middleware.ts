import { NextResponse, type NextRequest } from 'next/server';

export function middleware(_request: NextRequest): NextResponse {
  // Next.js middleware passes requests through to allow client-side AuthProvider
  // to perform asynchronous authentication recovery via POST /api/v1/auth/refresh.
  // The refresh cookie is scoped to Path=/api/v1/auth, making backend API guards
  // the authoritative security boundary.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
