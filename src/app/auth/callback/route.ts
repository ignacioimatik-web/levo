import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPostAuthDestination, normalizeAuthNextPath } from '@/lib/auth/redirect';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next');
  const next = normalizeAuthNextPath(requestedNext);
  const providerError = searchParams.get('error_description') ?? searchParams.get('error');

  if (!code || providerError) {
    const params = new URLSearchParams({
      error: providerError || 'invalid_code',
      next,
    });
    return NextResponse.redirect(`${origin}/auth?${params.toString()}`);
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const msg = error.message?.toLowerCase().includes('session_not_found')
      ? 'session_not_found'
      : error.message;
    return NextResponse.redirect(`${origin}/auth?error=${encodeURIComponent(msg)}`);
  }

  try { await supabase.rpc('update_last_login') } catch {}

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  const destination = getPostAuthDestination(requestedNext, profile?.onboarding_completed_at);
  return NextResponse.redirect(`${origin}${destination}`);
}
