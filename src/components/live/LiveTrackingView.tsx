'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BatteryCharging, Bike, Clock3, MapPin, Mountain, Radio, Route, ShieldCheck,
  Signal, SignalZero,
} from 'lucide-react';
import LivePositionMap from './LivePositionMap';

interface LiveSessionPublic {
  title: string;
  status: 'active' | 'ended';
  started_at: string;
  ended_at: string | null;
  latitude: number | null;
  longitude: number | null;
  elevation_m: number | null;
  distance_m: number;
  battery_percent: number | null;
  updated_at: string;
}

function elapsedLabel(startedAt: string, endedAt: string | null, now: number): string {
  const seconds = Math.max(0, (Date.parse(endedAt ?? new Date(now).toISOString()) - Date.parse(startedAt)) / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export default function LiveTrackingView({ token }: { token: string }) {
  const [session, setSession] = useState<LiveSessionPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch(`/api/live/${encodeURIComponent(token)}`, { cache: 'no-store' });
      if (!response.ok) {
        setError(response.status === 404 ? 'Este enlace no existe o ha dejado de estar disponible.' : 'No hemos podido actualizar la posición.');
        setLoading(false);
        return;
      }
      setSession(await response.json() as LiveSessionPublic);
      setRefreshedAt(Date.now());
      setError('');
    } catch {
      setError('Sin conexión. Se muestra la última posición recibida.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => { void refresh(); }, 0);
    const interval = window.setInterval(() => { void refresh(); }, 15_000);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
    };
  }, [refresh]);

  const signalAgeSeconds = useMemo(() => (
    session ? Math.max(0, (refreshedAt - Date.parse(session.updated_at)) / 1000) : 0
  ), [refreshedAt, session]);
  const stale = signalAgeSeconds > 120;

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
        <Radio className="h-8 w-8 animate-pulse text-orange-400" />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
        <div>
          <SignalZero className="mx-auto h-10 w-10 text-slate-600" />
          <h1 className="mt-4 text-2xl font-black">Seguimiento no disponible</h1>
          <p className="mt-2 max-w-sm text-sm text-slate-400">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 pb-10 text-white">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 md:py-10">
        <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-400">
              <Bike className="h-4 w-4" /> E-nduro Live
            </p>
            <h1 className="mt-2 text-3xl font-black">{session.title}</h1>
            <p className="mt-1 text-xs text-slate-500">En marcha desde {new Intl.DateTimeFormat('es-ES', { timeStyle: 'short' }).format(new Date(session.started_at))}</p>
          </div>
          <span className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-black uppercase tracking-wider ${
            session.status === 'ended'
              ? 'bg-slate-800 text-slate-400'
              : stale ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-400'
          }`}>
            {session.status === 'ended' ? <SignalZero className="h-3.5 w-3.5" /> : <Signal className="h-3.5 w-3.5" />}
            {session.status === 'ended' ? 'Salida terminada' : stale ? 'Señal antigua' : 'En directo'}
          </span>
        </header>

        <section className="h-[420px] overflow-hidden rounded-3xl border border-white/10 sm:h-[520px]">
          {session.latitude != null && session.longitude != null ? (
            <LivePositionMap latitude={session.latitude} longitude={session.longitude} />
          ) : (
            <div className="grid h-full place-items-center bg-slate-900 text-center">
              <div>
                <MapPin className="mx-auto h-8 w-8 animate-pulse text-slate-500" />
                <p className="mt-3 text-sm font-bold text-slate-400">Esperando la primera posición GPS…</p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="flex items-center gap-2 text-[9px] uppercase text-slate-500"><Route className="h-4 w-4" /> Distancia</p>
            <p className="mt-2 text-xl font-black">{(session.distance_m / 1000).toFixed(1)} km</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="flex items-center gap-2 text-[9px] uppercase text-slate-500"><Clock3 className="h-4 w-4" /> Tiempo</p>
            <p className="mt-2 text-xl font-black">{elapsedLabel(session.started_at, session.ended_at, refreshedAt)}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="flex items-center gap-2 text-[9px] uppercase text-slate-500"><Mountain className="h-4 w-4" /> Altitud</p>
            <p className="mt-2 text-xl font-black">{session.elevation_m == null ? '—' : `${Math.round(session.elevation_m)} m`}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="flex items-center gap-2 text-[9px] uppercase text-slate-500"><BatteryCharging className="h-4 w-4" /> Batería</p>
            <p className="mt-2 text-xl font-black">{session.battery_percent == null ? '—' : `${session.battery_percent}%`}</p>
          </div>
        </section>

        <div className={`mt-4 flex items-start gap-3 rounded-2xl border p-4 ${
          stale && session.status === 'active' ? 'border-amber-500/25 bg-amber-500/5' : 'border-white/10 bg-slate-900/40'
        }`}>
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-orange-400" />
          <div>
            <p className="text-sm font-black">Última actualización</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Hace {signalAgeSeconds < 60 ? `${Math.round(signalAgeSeconds)} s` : `${Math.round(signalAgeSeconds / 60)} min`}.
              Esta página muestra la última posición recibida, no garantiza cobertura continua ni sustituye a los servicios de emergencia.
            </p>
            {error && <p className="mt-2 text-xs text-amber-300">{error}</p>}
          </div>
        </div>
      </div>
    </main>
  );
}
