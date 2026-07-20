import { createClient } from './browser';

function getRedirectTo(path: string, next?: string): string {
  const base = process.env.NEXT_PUBLIC_SITE_URL
    || (typeof window !== 'undefined' ? window.location.origin : '')
    || 'https://gpxtour.vercel.app';
  const url = `${base}${path}`;
  if (next) return `${url}?next=${encodeURIComponent(next)}`;
  return url;
}

export async function signInWithGoogle(next?: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getRedirectTo('/auth/callback', next),
    },
  });
  return { error };
}

export async function signInWithApple(next?: string) {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: getRedirectTo('/auth/callback', next),
    },
  });
  return { error };
}

export async function signOut() {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentSession() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export async function getCurrentUser() {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}
