'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithGoogle, signInWithApple, signInWithEmail, getCurrentUser } from '@/lib/supabase/auth';
import { Loader2, AlertCircle, XCircle, WifiOff, Ban, Mail, CheckCircle2, Apple } from 'lucide-react';
import {
  getAuthProviderAvailability,
} from '@/lib/supabase/provider-status';
import type { AuthProviderAvailability } from '@/lib/supabase/provider-status';
import { createClient } from '@/lib/supabase/browser';
import { getPostAuthDestination, normalizeAuthNextPath } from '@/lib/auth/redirect';

const ERROR_MESSAGES: Record<string, string> = {
  'Provider not enabled': 'El inicio de sesión con este proveedor no está activado. Contacta con el administrador.',
  'popup_closed_by_user': 'Inicio de sesión cancelado. Cierra la ventana e inténtalo de nuevo.',
  'user_cancelled': 'Has cancelado el inicio de sesión.',
  'network_error': 'Error de conexión. Comprueba tu conexión a internet y vuelve a intentarlo.',
  'invalid_code': 'El enlace de inicio de sesión no es válido o ha expirado. Vuelve a iniciar sesión.',
  'session_not_found': 'No se ha podido iniciar la sesión. Inténtalo de nuevo.',
  'auth_exchange_failed': 'No se ha podido completar el acceso. Vuelve a intentarlo desde este dispositivo.',
  'access_denied': 'El acceso fue rechazado o cancelado. Vuelve a intentarlo y acepta los permisos solicitados.',
  'unauthorized_client': 'El cliente OAuth no está autorizado en Supabase. Revisa el proveedor y sus credenciales.',
  'invalid_request': 'La solicitud OAuth no es válida. Revisa las URLs de retorno configuradas en Supabase y Google Cloud.',
  'provider_not_enabled': 'Este proveedor está desactivado en Supabase. Actívalo y guarda sus credenciales.',
  'redirect_uri_mismatch': 'Google ha rechazado la dirección de retorno. En Google Cloud debe estar autorizada esta URL: https://tofcpitggqibbqemsowi.supabase.co/auth/v1/callback',
  'invalid_client': 'Las credenciales OAuth de Google en Supabase no son válidas. Hay que revisar el Client ID y el secreto del proveedor.',
  'provider is not enabled': 'Este proveedor está desactivado en Supabase. Actívalo y guarda sus credenciales en Authentication → Providers.',
  'unsupported provider': 'Este proveedor está desactivado en Supabase. Actívalo y guarda sus credenciales en Authentication → Providers.',
};

function getErrorMessage(raw: string): string {
  for (const [key, msg] of Object.entries(ERROR_MESSAGES)) {
    if (raw.toLowerCase().includes(key.toLowerCase())) return msg;
  }
  return raw;
}

function ErrorIcon({ message }: { message: string }) {
  const lower = message.toLowerCase();
  if (lower.includes('conexión') || lower.includes('red')) return <WifiOff className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
  if (lower.includes('cancelado') || lower.includes('cerrar')) return <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
  if (lower.includes('proveedor') || lower.includes('activado')) return <Ban className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
  return <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />;
}

function AuthForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => {
    const urlError = searchParams.get('error');
    return urlError ? getErrorMessage(urlError) : null;
  });
  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [providers, setProviders] = useState<AuthProviderAvailability | null>(null);

  const next = normalizeAuthNextPath(searchParams.get('next'));
  const unavailableProviders = providers
    ? [!providers.google && 'Google', !providers.apple && 'Apple'].filter(Boolean)
    : [];

  useEffect(() => {
    let active = true;
    void getCurrentUser().then(async ({ user }) => {
      if (!active) return;
      if (!user) {
        setChecking(false);
        return;
      }

      const supabase = createClient();
      const { data: profile } = supabase
        ? await supabase
          .from('profiles')
          .select('onboarding_completed_at')
          .eq('user_id', user.id)
          .maybeSingle()
        : { data: null };

      if (active) {
        router.replace(getPostAuthDestination(next, profile?.onboarding_completed_at));
      }
    });
    return () => {
      active = false;
    };
  }, [next, router]);

  useEffect(() => {
    void getAuthProviderAvailability().then(setProviders);
  }, []);

  const handleGoogle = useCallback(async () => {
    setLoading('google');
    setError(null);
    const { error: err } = await signInWithGoogle(next);
    if (err) {
      setError(getErrorMessage(err.message));
      setLoading(null);
    }
  }, [next]);

  const handleApple = useCallback(async () => {
    setLoading('apple');
    setError(null);
    const { error: err } = await signInWithApple(next);
    if (err) {
      setError(getErrorMessage(err.message));
      setLoading(null);
    }
  }, [next]);

  const handleEmail = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setLoading('email');
    setError(null);
    const { error: err } = await signInWithEmail(email.trim(), next);
    if (err) setError(getErrorMessage(err.message));
    else setEmailSent(true);
    setLoading(null);
  }, [email, next]);

  if (checking) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 py-12">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="bg-slate-900/50 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white">Accede a tu cuenta</h1>
            <p className="text-sm text-slate-400 mt-2 leading-relaxed">
              Entra por email para sincronizar tus salidas en todos tus dispositivos.
            </p>
          </div>

          <div className="space-y-3">
            {emailSent ? (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-center">
                <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400" />
                <p className="mt-2 text-sm font-bold text-emerald-300">Revisa tu correo</p>
                <p className="mt-1 text-xs text-slate-400">Te hemos enviado un enlace seguro para entrar. No necesitas contraseña.</p>
              </div>
            ) : (
              <form onSubmit={handleEmail} className="space-y-2">
                <label htmlFor="email" className="sr-only">Correo electrónico</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="tu@email.com"
                    className="w-full rounded-xl border border-white/10 bg-slate-950 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-orange-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading !== null}
                  className="flex w-full items-center justify-center rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white hover:bg-orange-400 disabled:opacity-50"
                >
                  {loading === 'email' ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Continuar con email'}
                </button>
              </form>
            )}

            <div className="flex items-center gap-3 py-1">
              <span className="h-px flex-1 bg-white/10" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-600">o</span>
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <button
              onClick={handleGoogle}
              disabled={loading !== null || providers?.google === false}
              className="group relative w-full flex items-center justify-center gap-3 px-4 py-3 bg-white hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white text-slate-900 font-semibold rounded-xl transition-all duration-200 active:scale-[0.98]"
            >
              {loading === 'google' ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span>{providers?.google === false ? 'Google no configurado' : 'Continuar con Google'}</span>
            </button>

            <button
              onClick={handleApple}
              disabled={loading !== null || providers?.apple !== true}
              className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-slate-950 px-4 py-3 font-semibold text-white transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-55"
              title={providers?.apple === true ? 'Continuar con Apple' : 'Apple requiere credenciales de Apple Developer en Supabase'}
            >
              {loading === 'apple' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Apple className="h-5 w-5" />}
              <span>{providers?.apple === true ? 'Continuar con Apple' : 'Apple no configurado'}</span>
            </button>

            {unavailableProviders.length > 0 && (
              <p role="status" className="auth-provider-notice rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-[11px] leading-relaxed text-amber-200">
                El acceso por email está operativo.{' '}
                {unavailableProviders.join(' y ')}
                {unavailableProviders.length === 1
                  ? ' aparecerá disponible cuando se activen sus credenciales OAuth.'
                  : ' aparecerán disponibles cuando se activen sus credenciales OAuth.'}
              </p>
            )}
          </div>

          {error && (
            <div className="mt-4 flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg animate-in">
              <ErrorIcon message={error} />
              <p className="text-xs text-red-400 leading-relaxed">{error}</p>
            </div>
          )}

          <p className="mt-6 text-center text-[10px] text-slate-600 leading-relaxed">
            Al continuar aceptas las{' '}
            <a href="/seguridad" className="text-slate-400 hover:text-orange-500 underline underline-offset-2 transition-colors">
              condiciones de uso
            </a>{' '}
            y la{' '}
            <a href="/seguridad" className="text-slate-400 hover:text-orange-500 underline underline-offset-2 transition-colors">
              política de privacidad
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[calc(100vh-80px)]">
        <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
      </div>
    }>
      <AuthForm />
    </Suspense>
  );
}
