import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const PROTECTED_ROUTES = [
  '/account',
] as const;

export function isProtectedRoute(pathname: string): boolean {
  return (PROTECTED_ROUTES as readonly string[]).some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

export async function requireAuth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/auth');
  }
  return user;
}
