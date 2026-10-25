import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth/constants';

export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) {
    return NextResponse.next();
  }

  const loginUrl = new URL('/login', request.url);
  const requested = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  if (requested && requested !== '/') {
    loginUrl.searchParams.set('next', requested);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    '/((?!api|login|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
