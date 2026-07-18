import { createClient } from './browser';
import { buildAuthCallbackUrl } from '@/lib/auth/redirect';

const AUTH_UNAVAILABLE = new Error(
  'El acceso a la cuenta no está disponible en este entorno. Puedes seguir explorando y planificando rutas como invitado.',
);

function getRedirectTo(next?: string): string {
  return buildAuthCallbackUrl(
    next,
    process.env.NEXT_PUBLIC_SITE_URL,
    typeof window === 'undefined' ? undefined : window.location.origin,
  );
}

export async function signInWithGoogle(next?: string) {
  const supabase = createClient();
  if (!supabase) return { error: AUTH_UNAVAILABLE };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getRedirectTo(next),
    },
  });
  return { error };
}

export async function signInWithEmail(email: string, next?: string) {
  const supabase = createClient();
  if (!supabase) return { error: AUTH_UNAVAILABLE };
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getRedirectTo(next),
    },
  });
  return { error };
}

export async function signOut() {
  const supabase = createClient();
  if (!supabase) return { error: AUTH_UNAVAILABLE };
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentSession() {
  const supabase = createClient();
  if (!supabase) return { session: null, error: AUTH_UNAVAILABLE };
  const { data, error } = await supabase.auth.getSession();
  return { session: data.session, error };
}

export async function getCurrentUser() {
  const supabase = createClient();
  if (!supabase) return { user: null, error: AUTH_UNAVAILABLE };
  const { data, error } = await supabase.auth.getUser();
  return { user: data.user, error };
}
