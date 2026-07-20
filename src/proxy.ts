import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isProtectedRoute } from '@/lib/auth/guards';
import { normalizeAuthNextPath } from '@/lib/auth/redirect';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!isProtectedRoute(pathname)) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          Object.entries(headers ?? {}).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getClaims validates the signed JWT locally and avoids an extra Auth API
  // round-trip on every protected navigation (the recommended SSR pattern).
  const { data: claims } = await supabase.auth.getClaims();

  if (!claims) {
    const url = request.nextUrl.clone();
    const requestedPath = `${pathname}${request.nextUrl.search}`;
    url.pathname = '/auth';
    url.search = '';
    url.searchParams.set('next', normalizeAuthNextPath(requestedPath));
    const redirect = NextResponse.redirect(url);
    redirect.headers.set('Cache-Control', 'private, no-store');
    return redirect;
  }

  supabaseResponse.headers.set('Cache-Control', 'private, no-store');
  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
