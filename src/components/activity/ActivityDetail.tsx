'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowLeft, ArrowUp, BarChart3, BatteryCharging, Bike, Check,
  Clock3, Download, Gauge, Globe2, LockKeyhole, Mountain, Pencil, RotateCcw,
  Route, Share2, Sparkles, TimerReset, Trophy, UploadCloud, X, Zap,
} from 'lucide-react';
import ActivityMap from './ActivityMap';
import ActivityElevationProfile from './ActivityElevationProfile';
import ActivityWeatherTimeline from './ActivityWeatherTimeline';
import { SegmentEffortsPanel } from '@/components/segments/SegmentEffortsPanel';
import { activityEditNotice, normalizeActivityTitle } from '@/lib/activities/edit';
import { downloadActivityGpx } from '@/lib/activities/gpx';
import { getActivity, saveActivity } from '@/lib/activities/storage';
import { syncActivity } from '@/lib/activities/sync';
import type { ActivityPrivacy, RideActivity } from '@/lib/activities/types';
import { analyzeActivityTrack } from '@/lib/activities/track-analysis';
import { plannedRouteFromActivity } from '@/lib/navigation/repeat';
import { savePlannedRoute } from '@/lib/navigation/storage';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remaining = seconds % 60;
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min ${remaining} s`;
}

function Stat({ icon: Icon, label, value, accent = false }: {
  icon: typeof Route;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className={`h-4 w-4 ${accent ? 'text-orange-400' : ''}`} />
        <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
      </div>
      <p className="mt-2 text-xl font-black tabular-nums sm:text-2xl">{value}</p>
    </div>
  );
}

export default function ActivityDetail({ activityId }: { activityId: string }) {
  const router = useRouter();
  const [activity, setActivity] = useState<RideActivity | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [shared, setShared] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [messageUrgent, setMessageUrgent] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editPrivacy, setEditPrivacy] = useState<ActivityPrivacy>('private');
  const [savingEdits, setSavingEdits] = useState(false);

  useEffect(() => {
    const read = window.setTimeout(() => {
      const storedActivity = getActivity(activityId);
      setActivity(storedActivity);
      if (storedActivity) {
        setEditTitle(storedActivity.title);
        setEditPrivacy(storedActivity.privacy);
      }
      setLoaded(true);
    }, 0);
    return () => window.clearTimeout(read);
  }, [activityId]);

  const trackAnalysis = useMemo(
    () => activity ? analyzeActivityTrack(activity.points) : null,
    [activity],
  );

  if (!loaded) {
    return <main className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-500">Cargando actividad…</main>;
  }

  if (!activity) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 px-6 text-center text-white">
        <div>
          <Route className="mx-auto h-10 w-10 text-slate-600" />
          <h1 className="mt-4 text-2xl font-black">Actividad no disponible</h1>
          <p className="mt-2 text-sm text-slate-400">Sincroniza el historial o vuelve al dispositivo donde se grabó.</p>
          <Link href="/actividades" className="mt-6 inline-flex rounded-xl bg-orange-500 px-5 py-3 text-xs font-black uppercase">Volver al historial</Link>
        </div>
      </main>
    );
  }

  const batteryUsed = activity.batteryStart != null && activity.batteryEnd != null
    ? Math.max(0, activity.batteryStart - activity.batteryEnd)
    : null;
  const whPerKm = activity.energyUsedWh != null && activity.distanceM > 0
    ? activity.energyUsedWh / (activity.distanceM / 1000)
    : null;
  const stoppedSeconds = Math.max(0, activity.durationSeconds - activity.movingSeconds);

  const sharePublicActivity = async (publicActivity: RideActivity) => {
    if (!publicActivity.remoteId) return;
    const url = `${window.location.origin}/actividad/${publicActivity.remoteId}`;
    const shareData = {
      title: publicActivity.title,
      text: `${publicActivity.title}: ${(publicActivity.distanceM / 1000).toFixed(1)} km y ${Math.round(publicActivity.elevationGainM)} m+ en E-nduro Ebiketracks`,
      url,
    };
    try {
      if (navigator.share) await navigator.share(shareData);
      else await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
      setShared(true);
      setMessageUrgent(false);
      setShareMessage('Enlace público listo para abrir desde cualquier dispositivo.');
      window.setTimeout(() => setShared(false), 2_000);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        setMessageUrgent(false);
        setShareMessage('No hemos podido abrir el menú de compartir.');
      }
    }
  };

  const publishAndShare = async () => {
    setPublishing(true);
    setShareMessage('');
    setMessageUrgent(false);
    const publicActivity: RideActivity = { ...activity, privacy: 'public', syncStatus: 'local' };
    saveActivity(publicActivity);
    setActivity(publicActivity);
    const result = await syncActivity(publicActivity);
    const updated = getActivity(activity.id) ?? publicActivity;
    setActivity(updated);
    setPublishing(false);
    if (result === 'synced' && updated.remoteId) {
      await sharePublicActivity(updated);
    } else {
      setShareMessage('La salida está marcada para la Comunidad. Inicia sesión y sincronízala para obtener su enlace público.');
    }
  };

  const canShare = activity.privacy === 'public' && Boolean(activity.remoteId);
  const openEditor = () => {
    setEditTitle(activity.title);
    setEditPrivacy(activity.privacy);
    setEditing(true);
  };
  const closeEditor = () => {
    setEditTitle(activity.title);
    setEditPrivacy(activity.privacy);
    setEditing(false);
  };
  const saveEdits = async () => {
    if (savingEdits) return;
    setSavingEdits(true);
    setShareMessage('');
    setMessageUrgent(false);
    const previousPrivacy = activity.privacy;
    const hadRemoteId = Boolean(activity.remoteId);
    const editedActivity: RideActivity = {
      ...activity,
      title: normalizeActivityTitle(editTitle, activity.title),
      privacy: editPrivacy,
      syncStatus: 'local',
    };
    saveActivity(editedActivity);
    setActivity(editedActivity);

    let result: 'synced' | 'local' | 'error' = 'error';
    try {
      result = await syncActivity(editedActivity);
    } catch {
      result = 'error';
    }
    const updated = getActivity(activity.id) ?? editedActivity;
    const notice = activityEditNotice({
      previousPrivacy,
      nextPrivacy: editPrivacy,
      result,
      hadRemoteId,
    });
    setActivity(updated);
    setEditTitle(updated.title);
    setEditPrivacy(updated.privacy);
    setShareMessage(notice.message);
    setMessageUrgent(notice.urgent);
    setSavingEdits(false);
    setEditing(false);
  };
  const repeatRoute = () => {
    if (activity.points.length < 2) {
      setShareMessage('Esta actividad no contiene suficientes puntos para repetir la ruta.');
      return;
    }
    const route = plannedRouteFromActivity(activity);
    savePlannedRoute(route);
    router.push(`/grabar?ruta=${encodeURIComponent(route.id)}`);
  };

  return (
    <main className="min-h-screen bg-slate-950 pb-28 text-white md:pb-16">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-10">
        <Link href="/actividades" className="mb-5 inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Todas las actividades
        </Link>

        <header className="mb-6 flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-orange-400">
              <Bike className="h-4 w-4" /> {activity.sportType === 'ebike' ? 'E-bike' : 'MTB'}
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">{activity.title}</h1>
            <p className="mt-2 text-sm text-slate-400">
              {new Intl.DateTimeFormat('es-ES', { dateStyle: 'full', timeStyle: 'short' }).format(new Date(activity.startedAt))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={openEditor} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-black">
              <Pencil className="h-4 w-4" /> Editar
            </button>
            <button onClick={repeatRoute} className="flex items-center gap-2 rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-xs font-black text-orange-300">
              <RotateCcw className="h-4 w-4" /> Repetir
            </button>
            <button onClick={() => downloadActivityGpx(activity)} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-black">
              <Download className="h-4 w-4" /> GPX
            </button>
            <button
              onClick={() => { void (canShare ? sharePublicActivity(activity) : publishAndShare()); }}
              disabled={publishing}
              className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black disabled:opacity-50"
            >
              {shared ? <Check className="h-4 w-4" /> : canShare ? <Share2 className="h-4 w-4" /> : <UploadCloud className="h-4 w-4" />}
              {publishing ? 'Publicando…' : shared ? 'Copiado' : canShare ? 'Compartir' : activity.privacy === 'public' ? 'Sincronizar' : 'Publicar'}
            </button>
          </div>
        </header>
        {editing && (
          <section className="mb-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4 sm:p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-black">Editar actividad</h2>
                <p className="mt-1 text-xs text-slate-400">El nombre y la privacidad se guardan también en Supabase al sincronizar.</p>
              </div>
              <button
                type="button"
                onClick={closeEditor}
                aria-label="Cerrar edición"
                className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              className="mt-5 grid gap-5 lg:grid-cols-[1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                void saveEdits();
              }}
            >
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Nombre de la salida</span>
                <input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  maxLength={120}
                  autoFocus
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm font-bold outline-none transition focus:border-orange-500"
                />
              </label>
              <fieldset>
                <legend className="text-[10px] font-black uppercase tracking-widest text-slate-500">Visibilidad</legend>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditPrivacy('private')}
                    aria-pressed={editPrivacy === 'private'}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black transition ${
                      editPrivacy === 'private'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                        : 'border-white/10 bg-slate-950 text-slate-400'
                    }`}
                  >
                    <LockKeyhole className="h-4 w-4" /> Solo yo
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditPrivacy('public')}
                    aria-pressed={editPrivacy === 'public'}
                    className={`flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-xs font-black transition ${
                      editPrivacy === 'public'
                        ? 'border-orange-500 bg-orange-500/10 text-orange-300'
                        : 'border-white/10 bg-slate-950 text-slate-400'
                    }`}
                  >
                    <Globe2 className="h-4 w-4" /> Comunidad
                  </button>
                </div>
              </fieldset>
              <p className="text-xs leading-relaxed text-slate-400 lg:col-span-2">
                Al elegir “Solo yo”, el enlace público deja de funcionar en cuanto el cambio se sincroniza. Si estás sin conexión, te avisaremos mientras siga pendiente.
              </p>
              <div className="flex flex-wrap gap-2 lg:col-span-2">
                <button
                  type="submit"
                  disabled={savingEdits}
                  className="rounded-xl bg-orange-500 px-5 py-3 text-xs font-black disabled:opacity-50"
                >
                  {savingEdits ? 'Guardando…' : 'Guardar cambios'}
                </button>
                <button type="button" onClick={closeEditor} className="rounded-xl border border-white/10 px-5 py-3 text-xs font-black text-slate-300">
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        )}
        {shareMessage && (
          <p
            role={messageUrgent ? 'alert' : 'status'}
            className={`mb-5 rounded-xl border px-4 py-3 text-xs ${
              messageUrgent
                ? 'border-red-500/30 bg-red-500/10 text-red-200'
                : 'border-orange-500/20 bg-orange-500/10 text-orange-200'
            }`}
          >
            {shareMessage}
          </p>
        )}

        <section className="mb-5 h-[360px] overflow-hidden rounded-3xl border border-white/10 sm:h-[460px]">
          <ActivityMap points={activity.points} />
        </section>

        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat icon={Route} label="Distancia" value={`${(activity.distanceM / 1000).toFixed(2)} km`} accent />
          <Stat icon={Clock3} label="Tiempo" value={formatDuration(activity.durationSeconds)} />
          <Stat icon={Gauge} label="Media" value={`${activity.averageSpeedKmh.toFixed(1)} km/h`} />
          <Stat icon={Zap} label="Máxima" value={`${activity.maxSpeedKmh.toFixed(1)} km/h`} />
          <Stat icon={Mountain} label="Desnivel +" value={`${Math.round(activity.elevationGainM)} m`} />
          <Stat icon={TimerReset} label="Parado" value={formatDuration(stoppedSeconds)} />
        </section>
        <ActivityWeatherTimeline samples={activity.weatherSamples ?? []} />
        <SegmentEffortsPanel
          efforts={activity.segmentEfforts ?? []}
          activityId={activity.id}
          sportType={activity.sportType}
        />

        {trackAnalysis && trackAnalysis.splits.length > 0 && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[.75fr_1.25fr]">
            <section className="rounded-3xl border border-blue-500/20 bg-blue-500/5 p-5">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-blue-300">
                <Mountain className="h-4 w-4" /> Lectura del terreno
              </p>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-950/60 p-3">
                  <p className="flex items-center gap-1.5 text-[9px] uppercase text-slate-500"><ArrowUp className="h-3.5 w-3.5 text-orange-400" /> Ascendiendo</p>
                  <p className="mt-1 text-xl font-black">{(trackAnalysis.terrain.climbingDistanceM / 1000).toFixed(1)} km</p>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-3">
                  <p className="flex items-center gap-1.5 text-[9px] uppercase text-slate-500"><ArrowDown className="h-3.5 w-3.5 text-blue-400" /> Descendiendo</p>
                  <p className="mt-1 text-xl font-black">{(trackAnalysis.terrain.descendingDistanceM / 1000).toFixed(1)} km</p>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-3">
                  <p className="text-[9px] uppercase text-slate-500">Pérdida vertical</p>
                  <p className="mt-1 text-xl font-black">{Math.round(trackAnalysis.terrain.elevationLossM)} m</p>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-3">
                  <p className="text-[9px] uppercase text-slate-500">Pendientes sostenidas</p>
                  <p className="mt-1 text-sm font-black">
                    {trackAnalysis.terrain.steepestClimbPercent == null
                      ? '—'
                      : `+${trackAnalysis.terrain.steepestClimbPercent.toFixed(0)}%`}
                    <span className="mx-1 text-slate-600">/</span>
                    {trackAnalysis.terrain.steepestDescentPercent == null
                      ? '—'
                      : `${trackAnalysis.terrain.steepestDescentPercent.toFixed(0)}%`}
                  </p>
                </div>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-slate-500">
                Las pendientes se calculan sobre ventanas de al menos 100 m para reducir picos falsos de altitud.
              </p>
            </section>

            <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                    <BarChart3 className="h-4 w-4 text-orange-400" /> Parciales
                  </p>
                  <p className="mt-1 text-[10px] text-slate-500">Cada kilómetro · tiempo en movimiento</p>
                </div>
                <span className="rounded-full bg-slate-950 px-2.5 py-1 text-[9px] font-black text-slate-500">
                  {trackAnalysis.splits.length}
                </span>
              </div>
              <div className="max-h-[390px] overflow-y-auto">
                <div className="grid grid-cols-[48px_1fr_1fr_1fr] gap-2 border-b border-white/5 px-4 py-2 text-[9px] font-black uppercase tracking-wider text-slate-600">
                  <span>Km</span><span>Tiempo</span><span>Velocidad</span><span>Desnivel</span>
                </div>
                {trackAnalysis.splits.map((split) => {
                  const fastest = split.index === trackAnalysis.fastestFullSplitIndex;
                  return (
                    <div key={split.index} className={`grid grid-cols-[48px_1fr_1fr_1fr] items-center gap-2 border-b border-white/5 px-4 py-3 text-xs last:border-0 ${fastest ? 'bg-orange-500/5' : ''}`}>
                      <span className={`flex items-center gap-1 font-black ${fastest ? 'text-orange-300' : ''}`}>
                        {fastest && <Trophy className="h-3 w-3" />}
                        {split.complete ? split.index : `${split.index}*`}
                      </span>
                      <span className="font-bold tabular-nums">{formatDuration(Math.round(split.movingSeconds))}</span>
                      <span className="font-black tabular-nums">{split.averageSpeedKmh.toFixed(1)} <small className="text-[9px] text-slate-600">km/h</small></span>
                      <span className="tabular-nums text-slate-400">+{Math.round(split.elevationGainM)} / −{Math.round(split.elevationLossM)} m</span>
                    </div>
                  );
                })}
              </div>
              {trackAnalysis.splits.some((split) => !split.complete) && (
                <p className="border-t border-white/5 px-4 py-2 text-[9px] text-slate-600">* Parcial final incompleto</p>
              )}
            </section>
          </div>
        )}

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <section className="overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <h2 className="font-black">Perfil de elevación</h2>
                <p className="mt-1 text-[10px] uppercase tracking-wider text-slate-500">{activity.points.length} puntos GPS</p>
              </div>
              <Mountain className="h-5 w-5 text-orange-400" />
            </div>
            <ActivityElevationProfile points={activity.points} />
          </section>

          <section className="rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-emerald-400">
              <BatteryCharging className="h-4 w-4" /> Análisis e-bike
            </p>
            {activity.sportType === 'ebike' ? (
              <div className="mt-5 space-y-4">
                <div className="flex items-end justify-between">
                  <span className="text-sm text-slate-400">Batería</span>
                  <strong className="text-2xl">{activity.batteryStart}% → {activity.batteryEnd}%</strong>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-emerald-400" style={{ width: `${activity.batteryEnd ?? 0}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-950/60 p-3">
                    <p className="text-[9px] uppercase text-slate-500">Consumida</p>
                    <p className="mt-1 font-black">{batteryUsed ?? '—'}%</p>
                  </div>
                  <div className="rounded-xl bg-slate-950/60 p-3">
                    <p className="text-[9px] uppercase text-slate-500">Eficiencia</p>
                    <p className="mt-1 font-black">{whPerKm == null ? '—' : `${whPerKm.toFixed(1)} Wh/km`}</p>
                  </div>
                </div>
                <p className="flex items-start gap-2 text-xs leading-relaxed text-slate-400">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                  Modo {activity.assistMode} con batería de {activity.batteryCapacityWh} Wh. La estimación se personalizará con más salidas.
                </p>
              </div>
            ) : (
              <p className="mt-5 text-sm text-slate-400">Actividad muscular, sin datos de batería.</p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
