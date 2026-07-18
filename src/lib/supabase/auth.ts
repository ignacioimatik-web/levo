import { createClient } from './browser';

const AUTH_UNAVAILABLE = new Error(
  'El acceso a la cuenta no está disponible en este entorno. Puedes seguir explorando y planificando rutas como invitado.',
);

function getRedirectTo(path: string, next?: string): string {
  if (typeof window === 'undefined') return path;
  const url = `${window.location.origin}${path}`;
  if (next) return `${url}?next=${encodeURIComponent(next)}`;
  return url;
}

export async function signInWithGoogle(next?: string) {
  const supabase = createClient();
  if (!supabase) return { error: AUTH_UNAVAILABLE };
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
  if (!supabase) return { error: AUTH_UNAVAILABLE };
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: getRedirectTo('/auth/callback', next),
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
      emailRedirectTo: getRedirectTo('/auth/callback', next),
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
