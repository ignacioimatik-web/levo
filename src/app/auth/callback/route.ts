import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${siteOrigin}/auth?error=${encodeURIComponent('Código de autenticación no válido')}`);
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error.message);
      const msg = error.message?.toLowerCase().includes('session_not_found')
        ? 'session_not_found'
        : error.message;
      return NextResponse.redirect(`${siteOrigin}/auth?error=${encodeURIComponent(msg)}`);
    }

    // Success – redirect to the page the user was trying to reach
    return NextResponse.redirect(`${siteOrigin}${next}`);
  } catch (err: any) {
    console.error('Auth callback unexpected error:', err?.message ?? err);
    return NextResponse.redirect(`${siteOrigin}/auth?error=${encodeURIComponent('Error inesperado al iniciar sesión')}`);
  }
}

const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://gpxtour.vercel.app';
