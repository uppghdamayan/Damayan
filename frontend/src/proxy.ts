import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export default async function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { data: { session } } = await supabase.auth.getSession();
  const pathname = new URL(request.url).pathname;

  const isLoginRoute          = pathname === '/login' || pathname === '/';
  const isChangePasswordRoute = pathname === '/change-password';
  const isAdminRoute          = pathname.startsWith('/admin');
  const isDashboardRoute      = pathname.startsWith('/dashboard');
  const isProtected           = isAdminRoute || isDashboardRoute || isChangePasswordRoute;

  // Unauthenticated: redirect to login
  if (!session && isProtected) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Authenticated on login/root: redirect to appropriate workspace
  if (session && isLoginRoute) {
    // Default redirect for authenticated users — login page handles role-based routing
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Authenticated on /change-password: allow through (page-level guard handles redirect-if-not-needed)

  return response;
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/dashboard/:path*', '/change-password'],
};
