'use client';

import { useRef, useState } from 'react';
import {
  BatteryCharging, Bike, CalendarDays, Check, Clock3, FileUp, Mountain,
  Route, Upload, X,
} from 'lucide-react';
import { parseActivityGpx, type ActivityGpxPreview } from '@/lib/activities/import-gpx';
import { saveActivity } from '@/lib/activities/storage';
import { syncActivity } from '@/lib/activities/sync';
import type {
  ActivityPrivacy, AssistMode, RideActivity, SportType,
} from '@/lib/activities/types';
import { matchCompetitiveSegments } from '@/lib/segments/matcher';

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round(seconds % 3600 / 60);
  return hours > 0 ? `${hours} h ${minutes} min` : `${minutes} min`;
}

export default function ActivityGpxImporter({
  onImported,
}: {
  onImported: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<ActivityGpxPreview | null>(null);
  const [title, setTitle] = useState('');
  const [sportType, setSportType] = useState<SportType>('ebike');
  const [privacy, setPrivacy] = useState<ActivityPrivacy>('private');
  const [batteryStart, setBatteryStart] = useState(100);
  const [batteryEnd, setBatteryEnd] = useState(40);
  const [batteryCapacityWh, setBatteryCapacityWh] = useState(700);
  const [assistMode, setAssistMode] = useState<AssistMode>('trail');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const close = () => {
    setPreview(null);
    setError('');
    setSaving(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const chooseFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const parsed = parseActivityGpx(await file.text(), file.name);
      setPreview(parsed);
      setTitle(parsed.name);
      setSportType(parsed.sportHint ?? 'ebike');
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'No hemos podido leer este GPX.');
      event.target.value = '';
    }
  };

  const importActivity = async () => {
    if (!preview || saving) return;
    setSaving(true);
    const normalizedBatteryEnd = Math.min(batteryStart, batteryEnd);
    const energyUsedWh = sportType === 'ebike'
      ? batteryCapacityWh * (batteryStart - normalizedBatteryEnd) / 100
      : null;
    const activity: RideActivity = {
      id: crypto.randomUUID(),
      title: title.trim() || preview.name,
      sportType,
      startedAt: preview.startedAt,
      endedAt: preview.endedAt,
      durationSeconds: preview.durationSeconds,
      movingSeconds: preview.movingSeconds,
      distanceM: preview.distanceM,
      elevationGainM: preview.elevationGainM,
      averageSpeedKmh: preview.averageSpeedKmh,
      maxSpeedKmh: preview.maxSpeedKmh,
      batteryStart: sportType === 'ebike' ? batteryStart : null,
      batteryEnd: sportType === 'ebike' ? normalizedBatteryEnd : null,
      batteryCapacityWh: sportType === 'ebike' ? batteryCapacityWh : null,
      assistMode: sportType === 'ebike' ? assistMode : null,
      energyUsedWh,
      points: preview.points,
      weatherSamples: [],
      segmentEfforts: matchCompetitiveSegments(preview.points),
      privacy,
      syncStatus: 'local',
    };
    saveActivity(activity);
    const result = await syncActivity(activity);
    close();
    onImported(result === 'synced'
      ? 'Actividad GPX importada y sincronizada.'
      : 'Actividad GPX importada en este dispositivo. Inicia sesión y sincroniza para guardarla en la nube.');
  };

  return (
    <>
      <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-xs font-black text-slate-300 hover:border-orange-500/30 hover:text-orange-300">
        <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Importar</span> GPX
        <input
          ref={inputRef}
          type="file"
          accept=".gpx,application/gpx+xml"
          onChange={chooseFile}
          className="sr-only"
        />
      </label>
      {error && !preview && (
        <div role="alert" className="fixed inset-x-4 top-24 z-50 mx-auto flex max-w-lg items-start gap-3 rounded-2xl border border-red-500/30 bg-slate-900 p-4 text-xs text-red-200 shadow-2xl">
          <FileUp className="h-5 w-5 shrink-0" />
          <p className="min-w-0 flex-1">{error}</p>
          <button onClick={() => setError('')} aria-label="Cerrar error" className="rounded-lg p-1 text-slate-500 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {preview && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/90 p-4 backdrop-blur-sm">
          <div role="dialog" aria-modal="true" aria-labelledby="gpx-import-title" className="mx-auto my-4 max-w-2xl rounded-3xl border border-white/10 bg-slate-900 p-5 shadow-2xl sm:my-10 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-orange-400">Historial externo</p>
                <h2 id="gpx-import-title" className="mt-1 text-2xl font-black">Importar actividad GPX</h2>
                <p className="mt-1 text-xs text-slate-400">Revisa los datos antes de añadirlos a tu historial.</p>
              </div>
              <button onClick={close} aria-label="Cerrar importación" className="rounded-lg p-2 text-slate-500 hover:bg-white/5 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                [Route, 'Distancia', `${(preview.distanceM / 1000).toFixed(1)} km`],
                [Mountain, 'Desnivel', `${Math.round(preview.elevationGainM)} m`],
                [Clock3, 'Duración', formatDuration(preview.durationSeconds)],
                [CalendarDays, 'Fecha', new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(preview.startedAt))],
              ].map(([Icon, label, value]) => {
                const PreviewIcon = Icon as typeof Route;
                return (
                  <div key={String(label)} className="rounded-xl bg-slate-950/70 p-3">
                    <p className="flex items-center gap-1.5 text-[9px] uppercase text-slate-500"><PreviewIcon className="h-3.5 w-3.5" /> {String(label)}</p>
                    <p className="mt-1 text-sm font-black">{String(value)}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-xs font-bold text-slate-300">
                Nombre
                <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-orange-500" />
              </label>

              <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-950 p-1.5">
                {(['ebike', 'mtb'] as SportType[]).map((sport) => (
                  <button key={sport} type="button" onClick={() => setSportType(sport)}
                    className={`flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-black uppercase ${sportType === sport ? 'bg-orange-500 text-white' : 'text-slate-500'}`}>
                    <Bike className="h-4 w-4" /> {sport === 'ebike' ? 'E-bike' : 'MTB'}
                  </button>
                ))}
              </div>

              {sportType === 'ebike' && (
                <section className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-emerald-400">
                    <BatteryCharging className="h-4 w-4" /> Lectura real de batería
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <label className="text-xs font-bold text-slate-400">Inicio %
                      <input type="number" min="1" max="100" value={batteryStart}
                        onChange={(event) => setBatteryStart(Math.min(100, Math.max(1, Number(event.target.value))))}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white" />
                    </label>
                    <label className="text-xs font-bold text-slate-400">Final %
                      <input type="number" min="0" max={batteryStart} value={batteryEnd}
                        onChange={(event) => setBatteryEnd(Math.min(batteryStart, Math.max(0, Number(event.target.value))))}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white" />
                    </label>
                    <label className="text-xs font-bold text-slate-400">Capacidad
                      <select value={batteryCapacityWh} onChange={(event) => setBatteryCapacityWh(Number(event.target.value))}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 text-white">
                        {[500, 625, 700, 750, 900].map((capacity) => <option key={capacity} value={capacity}>{capacity} Wh</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-400">Asistencia
                      <select value={assistMode} onChange={(event) => setAssistMode(event.target.value as AssistMode)}
                        className="mt-1.5 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2.5 uppercase text-white">
                        {(['eco', 'trail', 'turbo', 'smart'] as AssistMode[]).map((mode) => <option key={mode} value={mode}>{mode}</option>)}
                      </select>
                    </label>
                  </div>
                </section>
              )}

              <fieldset>
                <legend className="text-[10px] font-black uppercase tracking-widest text-slate-500">Visibilidad</legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    ['private', 'Solo yo'],
                    ['followers', 'Seguidores'],
                    ['public', 'Comunidad'],
                  ] as const).map(([value, label]) => (
                    <button key={value} type="button" onClick={() => setPrivacy(value)}
                      aria-pressed={privacy === value}
                      className={`min-h-11 rounded-xl border px-3 py-3 text-xs font-black ${privacy === value ? 'border-orange-500 bg-orange-500/10 text-orange-300' : 'border-white/10 text-slate-500'}`}>
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              <button onClick={() => { void importActivity(); }} disabled={saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-xs font-black uppercase disabled:opacity-50">
                {saving ? <Upload className="h-4 w-4 animate-pulse" /> : <Check className="h-4 w-4" />}
                {saving ? 'Importando…' : 'Añadir al historial'}
              </button>
              <button onClick={close} className="rounded-xl border border-white/10 px-5 py-3.5 text-xs font-black text-slate-400">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
