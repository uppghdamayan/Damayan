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

  const isAuthRoute = pathname === '/login' || pathname === '/';
  const isProtectedRoute = pathname.startsWith('/admin') || pathname.startsWith('/dashboard');

  if (!session && (isProtectedRoute || pathname === '/')) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (session && isAuthRoute) {
    // We don't have the user role here efficiently, so we redirect to a central entry or assume admin/dashboard. 
    // Ideally we redirect to /dashboard and let dashboard decide, or /admin/accounts
    return NextResponse.redirect(new URL('/admin/accounts', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/', '/login', '/admin/:path*', '/dashboard/:path*'],
};
