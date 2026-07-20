import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${siteOrigin}/auth?error=${encodeURIComponent('invalid_code')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const msg = error.message?.toLowerCase().includes('session_not_found')
      ? 'session_not_found'
      : error.message;
    return NextResponse.redirect(`${siteOrigin}/auth?error=${encodeURIComponent(msg)}`);
  }

  try { await supabase.rpc('update_last_login') } catch {}

  return NextResponse.redirect(`${siteOrigin}${next}`);
}

/** Always redirects to the canonical domain, never to levo-eta or others */
const siteOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://gpxtour.vercel.app';
