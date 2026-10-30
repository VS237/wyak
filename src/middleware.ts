// src/middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  // 1. Menu Access: Requires Name + Phone (Guest Cookie)
  if (path.startsWith('/menu')) {
    const guestCookie = request.cookies.get('wyak_guest_name');
    if (!guestCookie) {
      return NextResponse.redirect(
        new URL('/customer?error=guest_required', request.url)
      );
    }
  }

  // 2. Strict Role-Based Staff Protection (/kitchen, /manager, /admin)
  const isStaffRoute =
    path.startsWith('/kitchen') ||
    path.startsWith('/manager') ||
    path.startsWith('/admin');

  if (isStaffRoute) {
    // A. Unauthenticated users are sent to login
    if (!user) {
      return NextResponse.redirect(
        new URL('/login?error=unauthorized', request.url)
      );
    }

    // B. Fetch profile role from Supabase
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = profile?.role; // e.g. 'kitchen', 'manager', 'admin'

    // C. Enforce strict route matching per staff role
    if (path.startsWith('/kitchen') && userRole !== 'kitchen') {
      return NextResponse.redirect(
        new URL(`/${userRole || 'login'}?error=unauthorized`, request.url)
      );
    }

    if (path.startsWith('/manager') && userRole !== 'manager') {
      return NextResponse.redirect(
        new URL(`/${userRole || 'login'}?error=unauthorized`, request.url)
      );
    }

    if (path.startsWith('/admin') && userRole !== 'admin') {
      return NextResponse.redirect(
        new URL(`/${userRole || 'login'}?error=unauthorized`, request.url)
      );
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/menu/:path*', '/kitchen/:path*', '/manager/:path*', '/admin/:path*'],
};