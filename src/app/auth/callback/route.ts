import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  getPostAuthDestination,
  normalizeAuthExchangeError,
  normalizeAuthNextPath,
} from '@/lib/auth/redirect';

function privateRedirect(url: string) {
  const response = NextResponse.redirect(url);
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const requestedNext = searchParams.get('next');
  const next = normalizeAuthNextPath(requestedNext);
  // Supabase may return either the human-readable description, an OAuth error
  // code, or (for some providers) an error reason. Keep the most useful value
  // so the auth screen can show an actionable diagnosis instead of `invalid_code`.
  const providerError = searchParams.get('error_description')
    ?? searchParams.get('error_code')
    ?? searchParams.get('error_reason')
    ?? searchParams.get('error');

  if (!code || providerError) {
    const params = new URLSearchParams({
      error: providerError || 'invalid_code',
      next,
    });
    return privateRedirect(`${origin}/auth?${params.toString()}`);
  }

  const supabase = await createClient();
  const { data: authData, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    const params = new URLSearchParams({
      error: normalizeAuthExchangeError(error.message),
      next,
    });
    return privateRedirect(`${origin}/auth?${params.toString()}`);
  }

  try { await supabase.rpc('update_last_login') } catch {}

  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarding_completed_at')
    .eq('user_id', authData.user.id)
    .maybeSingle();

  const destination = getPostAuthDestination(
    requestedNext,
    profile?.onboarding_completed_at,
    authData.user.app_metadata.provider,
  );
  return privateRedirect(`${origin}${destination}`);
}
