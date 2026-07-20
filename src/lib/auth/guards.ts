import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { normalizeAuthNextPath } from '@/lib/auth/redirect';

export const PROTECTED_ROUTES = [
  '/account',
  '/onboarding',
] as const;

export function isProtectedRoute(pathname: string): boolean {
  return (PROTECTED_ROUTES as readonly string[]).some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function requireAuth(nextPath = '/account') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const next = normalizeAuthNextPath(nextPath);
    redirect(`/auth?next=${encodeURIComponent(next)}`);
  }
  return user;
}
