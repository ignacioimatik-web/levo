'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BatteryCharging, Bike, CalendarDays, Cloud, CloudOff, Download,
  Flame, MapPin, Plus, RefreshCw, Route, Trash2, TrendingUp, Undo2, X,
} from 'lucide-react';
import { downloadActivityGpx } from '@/lib/activities/gpx';
import {
  ACTIVITIES_CHANGED_EVENT, deleteActivity, getActivities, getPendingActivityDeletes,
  queueActivityDelete, removePendingActivityDelete, saveActivity,
} from '@/lib/activities/storage';
import {
  flushPendingActivityDeletes, pullActivities, syncActivity,
} from '@/lib/activities/sync';
import type { RideActivity } from '@/lib/activities/types';
import ActivityGpxImporter from './ActivityGpxImporter';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function SyncBadge({ status }: { status: RideActivity['syncStatus'] }) {
  const synced = status === 'synced';
  return (
    <span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${
      synced ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-700/60 text-slate-400'
    }`}>
      {synced ? <Cloud className="h-3 w-3" /> : <CloudOff className="h-3 w-3" />}
      {synced ? 'Sincronizada' : status === 'syncing' ? 'Sincronizando' : 'En este dispositivo'}
    </span>
  );
}

export default function ActivityHistory() {
  const [activities, setActivities] = useState<RideActivity[]>([]);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [undoActivity, setUndoActivity] = useState<RideActivity | null>(null);
  const [deleteMessage, setDeleteMessage] = useState('');
  const undoTimerRef = useRef<number | null>(null);

  const refresh = useCallback(() => {
    setActivities(getActivities());
    setPendingDeleteCount(getPendingActivityDeletes().length);
  }, []);

  useEffect(() => {
    const initialRead = window.setTimeout(refresh, 0);
    void pullActivities().then(refresh);
    window.addEventListener(ACTIVITIES_CHANGED_EVENT, refresh);
    return () => {
      window.clearTimeout(initialRead);
      window.removeEventListener(ACTIVITIES_CHANGED_EVENT, refresh);
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    };
  }, [refresh]);

  const totals = useMemo(() => activities.reduce((acc, activity) => ({
    distanceM: acc.distanceM + activity.distanceM,
    elevationM: acc.elevationM + activity.elevationGainM,
    seconds: acc.seconds + activity.durationSeconds,
  }), { distanceM: 0, elevationM: 0, seconds: 0 }), [activities]);

  const syncAll = async () => {
    setSyncing(true);
    const deleteResult = await flushPendingActivityDeletes();
    await Promise.all(getActivities().filter((activity) => activity.syncStatus !== 'synced').map(syncActivity));
    refresh();
    setDeleteMessage(deleteResult.remaining > 0
      ? 'Quedan eliminaciones pendientes. Comprueba la conexión y que has iniciado sesión con la cuenta correcta.'
      : deleteResult.deleted > 0
        ? 'Las actividades pendientes también se han eliminado de la nube.'
        : '');
    setSyncing(false);
  };

  const remove = (activity: RideActivity) => {
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    if (activity.remoteId) queueActivityDelete(activity);
    deleteActivity(activity.id);
    setUndoActivity(activity);
    setDeleteMessage(activity.remoteId
      ? 'Salida retirada del dispositivo. Puede seguir visible en la Comunidad hasta confirmar la sincronización.'
      : 'Salida eliminada de este dispositivo.');
    undoTimerRef.current = window.setTimeout(() => {
      setUndoActivity(null);
      undoTimerRef.current = null;
      if (activity.remoteId) {
        void flushPendingActivityDeletes().then(({ remaining }) => {
          refresh();
          if (remaining > 0) {
            setDeleteMessage('Eliminación pendiente: la salida remota puede seguir visible hasta que inicies sesión y recuperes la conexión.');
          } else {
            setDeleteMessage('Salida eliminada definitivamente.');
          }
        });
      } else {
        setDeleteMessage('Salida eliminada definitivamente.');
      }
    }, 8_000);
  };

  const undoRemove = () => {
    if (!undoActivity) return;
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    saveActivity(undoActivity);
    removePendingActivityDelete(undoActivity.id);
    setUndoActivity(null);
    setDeleteMessage('Eliminación cancelada.');
    undoTimerRef.current = null;
  };

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-6 md:py-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-black uppercase tracking-[0.2em] text-orange-400">Tu diario de ruta</p>
            <h1 className="text-3xl font-black sm:text-4xl">Actividades</h1>
            <p className="mt-2 text-sm text-slate-400">Tus salidas viven primero en este dispositivo y después en tu nube.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <ActivityGpxImporter onImported={(message) => {
              setDeleteMessage(message);
              refresh();
            }} />
            <Link href="/mapa-personal" className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-black text-slate-300">
              <Flame className="h-4 w-4 text-orange-400" /> <span className="hidden sm:inline">Mapa</span>
            </Link>
            <Link href="/progreso" className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-black text-slate-300">
              <TrendingUp className="h-4 w-4 text-orange-400" /> <span className="hidden sm:inline">Progreso</span>
            </Link>
            {(activities.some((activity) => activity.syncStatus !== 'synced') || pendingDeleteCount > 0) && (
              <button onClick={syncAll} disabled={syncing}
                className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-black text-slate-300 disabled:opacity-50">
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {pendingDeleteCount > 0 ? `Pendiente (${pendingDeleteCount})` : 'Sincronizar'}
              </button>
            )}
            <Link href="/grabar" className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black uppercase">
              <Plus className="h-4 w-4" /> Nueva salida
            </Link>
          </div>
        </header>
        {deleteMessage && !undoActivity && (
          <p role="status" className={`mb-5 rounded-xl border px-4 py-3 text-xs ${
            pendingDeleteCount > 0
              ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
          }`}>
            {deleteMessage}
          </p>
        )}

        <section className="mb-7 grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Distancia</p>
            <p className="mt-2 text-xl font-black sm:text-3xl">{(totals.distanceM / 1000).toFixed(1)} <span className="text-xs text-slate-500">km</span></p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Desnivel +</p>
            <p className="mt-2 text-xl font-black sm:text-3xl">{Math.round(totals.elevationM)} <span className="text-xs text-slate-500">m</span></p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Tiempo</p>
            <p className="mt-2 text-xl font-black sm:text-3xl">{Math.round(totals.seconds / 3600 * 10) / 10} <span className="text-xs text-slate-500">h</span></p>
          </div>
        </section>

        {activities.length === 0 ? (
          <section className="rounded-3xl border border-dashed border-white/15 bg-slate-900/30 px-6 py-16 text-center">
            <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full bg-orange-500/10">
              <Bike className="h-8 w-8 text-orange-400" />
            </div>
            <h2 className="text-xl font-black">Aquí empezará tu historial</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Graba tu primera salida real o prueba el modo demo. No necesitas cuenta para empezar.</p>
            <Link href="/grabar" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-black uppercase">
              <MapPin className="h-4 w-4" /> Grabar primera salida
            </Link>
          </section>
        ) : (
          <section className="grid gap-4 md:grid-cols-2">
            {activities.map((activity) => (
              <article key={activity.id} className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60">
                <div className="h-2 bg-gradient-to-r from-orange-500 via-amber-400 to-emerald-400" />
                <div className="p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(activity.startedAt))}
                      </p>
                      <h2 className="mt-2 truncate text-lg font-black">
                        <Link href={`/actividades/${activity.id}`} className="hover:text-orange-400">
                          {activity.title}
                        </Link>
                      </h2>
                      <span className="mt-1 block text-[9px] font-bold uppercase tracking-widest text-slate-600">
                        {activity.privacy === 'public' ? 'Pública' : 'Privada'}
                      </span>
                    </div>
                    <SyncBadge status={activity.syncStatus} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 rounded-2xl bg-slate-950/70 p-3">
                    <div>
                      <p className="text-[9px] uppercase text-slate-600">Distancia</p>
                      <p className="mt-1 font-black">{(activity.distanceM / 1000).toFixed(2)} km</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-slate-600">Tiempo</p>
                      <p className="mt-1 font-black">{formatDuration(activity.durationSeconds)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase text-slate-600">Desnivel</p>
                      <p className="mt-1 font-black">{Math.round(activity.elevationGainM)} m</p>
                    </div>
                  </div>

                  {activity.sportType === 'ebike' && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                      <BatteryCharging className="h-4 w-4" />
                      <span className="font-bold">{activity.batteryStart}% → {activity.batteryEnd}%</span>
                      <span className="text-slate-600">·</span>
                      <span className="text-slate-400">{activity.assistMode}</span>
                    </div>
                  )}

                  <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4">
                    <Link href={`/actividades/${activity.id}`} className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-orange-400">
                      <Route className="h-4 w-4" /> Ver análisis
                    </Link>
                    <div className="flex gap-1">
                      <button onClick={() => downloadActivityGpx(activity)}
                        className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label={`Descargar GPX de ${activity.title}`}>
                        <Download className="h-4 w-4" />
                      </button>
                      <button onClick={() => remove(activity)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-500/10 hover:text-red-400" aria-label={`Eliminar ${activity.title}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
      {undoActivity && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-50 mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-white/15 bg-slate-900 p-3 shadow-2xl md:bottom-6"
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black">{undoActivity.title}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">{deleteMessage} Tienes 8 segundos para deshacer.</p>
          </div>
          <button
            onClick={undoRemove}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-orange-500 px-3 py-2.5 text-xs font-black"
          >
            <Undo2 className="h-4 w-4" /> Deshacer
          </button>
          <button
            onClick={() => setUndoActivity(null)}
            aria-label="Cerrar aviso"
            className="shrink-0 rounded-lg p-2 text-slate-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </main>
  );
}
