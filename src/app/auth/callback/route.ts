import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { normalizeAuthNextPath } from '@/lib/auth/redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = normalizeAuthNextPath(searchParams.get('next'));
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');

  if (!code || providerError) {
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(providerError || 'invalid_code')}`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const msg = error.message?.toLowerCase().includes('session_not_found')
      ? 'session_not_found'
      : error.message;
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(msg)}`);
  }

  try { await supabase.rpc('update_last_login') } catch {}

  return NextResponse.redirect(`${origin}${next}`);
}
