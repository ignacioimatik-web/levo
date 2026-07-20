'use client';

import { useMemo, useState } from 'react';
import { Bike, Check, CloudSun, Gauge, Loader2, MapPin, Thermometer, Waves } from 'lucide-react';
import { createClient } from '@/lib/supabase/browser';
import { recommendTirePressure, type PressureDifficulty } from '@/lib/tire-pressure';

type Profile = {
  userId: string | null;
  riderWeightKg: number | null;
  bikeWeightKg: number | null;
  bikeName: string;
  wheelSize: string;
  frontTireModel: string;
  rearTireModel: string;
  frontTirePressureBar: number | null;
  rearTirePressureBar: number | null;
};

const inputClass = 'mt-2 min-h-11 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-base text-white outline-none focus:border-orange-500 sm:text-sm';

export default function PressureAlertClient({ initialProfile }: { initialProfile: Profile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [difficulty, setDifficulty] = useState<PressureDifficulty>('rojo');
  const [temperatureC, setTemperatureC] = useState<number | null>(null);
  const [humidityPct, setHumidityPct] = useState<number | null>(null);
  const [windKmh, setWindKmh] = useState<number | null>(null);
  const [stationName, setStationName] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [weatherStatus, setWeatherStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const recommendation = useMemo(() => recommendTirePressure({
    riderWeightKg: profile.riderWeightKg ?? 75,
    bikeWeightKg: profile.bikeWeightKg ?? 24,
    wheelSize: profile.wheelSize,
    currentFrontBar: profile.frontTirePressureBar ?? 1.3,
    currentRearBar: profile.rearTirePressureBar ?? 1.5,
    temperatureC,
    humidityPct,
    difficulty,
  }), [profile, temperatureC, humidityPct, difficulty]);

  const update = <K extends keyof Profile>(key: K, value: Profile[K]) => setProfile((current) => ({ ...current, [key]: value }));

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!profile.userId) {
      setStatus('error');
      return;
    }
    const supabase = createClient();
    if (!supabase) return setStatus('error');
    setStatus('saving');
    const { error } = await supabase.from('profiles').upsert({
      user_id: profile.userId,
      bike_name: profile.bikeName.trim() || null,
      rider_weight_kg: profile.riderWeightKg,
      bike_weight_kg: profile.bikeWeightKg,
      wheel_size: profile.wheelSize.trim() || null,
      front_tire_model: profile.frontTireModel.trim() || null,
      rear_tire_model: profile.rearTireModel.trim() || null,
      front_tire_pressure_bar: profile.frontTirePressureBar,
      rear_tire_pressure_bar: profile.rearTirePressureBar,
    }, { onConflict: 'user_id' });
    setStatus(error ? 'error' : 'saved');
    if (!error) window.setTimeout(() => setStatus('idle'), 2_000);
  };

  const readWeather = () => {
    if (!navigator.geolocation) return setWeatherStatus('error');
    setWeatherStatus('loading');
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch(`/api/forfait/weather?lat=${coords.latitude.toFixed(4)}&lng=${coords.longitude.toFixed(4)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || data.error) throw new Error('weather');
        setTemperatureC(typeof data.temperatureC === 'number' ? data.temperatureC : null);
        setHumidityPct(typeof data.humidityPct === 'number' ? data.humidityPct : null);
        setWindKmh(typeof data.windKmh === 'number' ? data.windKmh : null);
        setStationName(data.stationName ?? null);
        setWeatherStatus('ready');
      } catch { setWeatherStatus('error'); }
    }, () => setWeatherStatus('error'), { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 });
  };

  return (
    <main className="min-h-screen px-4 pb-28 pt-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-8 flex items-start gap-4">
          <div className="rounded-2xl bg-orange-500 p-3 text-white shadow-lg shadow-orange-950/30"><Gauge className="h-7 w-7" /></div>
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-orange-400">Ajuste de descenso</p><h1 className="mt-1 text-3xl font-black text-white sm:text-4xl">Alerta presión</h1><p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">Guarda tu configuración y pide una recomendación contextual para una bajada técnica usando peso, rueda y observación AEMET reciente.</p></div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr]">
          <form onSubmit={saveProfile} className="glass-card rounded-3xl p-5 sm:p-7">
            <div className="mb-5 flex items-center gap-2"><Bike className="h-5 w-5 text-orange-400" /><h2 className="font-black text-white">Tu configuración</h2></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold text-slate-400">Peso ciclista (kg)<input className={inputClass} type="number" min="30" max="250" step="0.1" value={profile.riderWeightKg ?? ''} onChange={e => update('riderWeightKg', e.target.value ? Number(e.target.value) : null)} required /></label>
              <label className="text-xs font-bold text-slate-400">Peso bicicleta (kg)<input className={inputClass} type="number" min="5" max="60" step="0.1" value={profile.bikeWeightKg ?? ''} onChange={e => update('bikeWeightKg', e.target.value ? Number(e.target.value) : null)} required /></label>
              <label className="text-xs font-bold text-slate-400 sm:col-span-2">Modelo de bici<input className={inputClass} value={profile.bikeName} onChange={e => update('bikeName', e.target.value)} placeholder="Ej. Turbo Levo" /></label>
              <label className="text-xs font-bold text-slate-400">Tipo de rueda<select className={inputClass} value={profile.wheelSize} onChange={e => update('wheelSize', e.target.value)}><option>29</option><option>27.5</option><option>26</option><option>29 delante / 27.5 detrás</option></select></label>
              <label className="text-xs font-bold text-slate-400">Presión inicial delantera (bar)<input className={inputClass} type="number" min="0.5" max="5" step="0.05" value={profile.frontTirePressureBar ?? ''} onChange={e => update('frontTirePressureBar', e.target.value ? Number(e.target.value) : null)} required /></label>
              <label className="text-xs font-bold text-slate-400">Neumático delantero<input className={inputClass} value={profile.frontTireModel} onChange={e => update('frontTireModel', e.target.value)} placeholder="Modelo y carcasa" /></label>
              <label className="text-xs font-bold text-slate-400">Presión inicial trasera (bar)<input className={inputClass} type="number" min="0.5" max="5" step="0.05" value={profile.rearTirePressureBar ?? ''} onChange={e => update('rearTirePressureBar', e.target.value ? Number(e.target.value) : null)} required /></label>
              <label className="text-xs font-bold text-slate-400 sm:col-span-2">Neumático trasero<input className={inputClass} value={profile.rearTireModel} onChange={e => update('rearTireModel', e.target.value)} placeholder="Modelo y carcasa" /></label>
            </div>
            {status === 'error' && <p role="alert" className="mt-4 text-xs text-amber-300">{profile.userId ? 'No hemos podido guardar la configuración.' : 'Inicia sesión para guardar tu perfil. Puedes probar el cálculo con estos valores de referencia.'}</p>}
            <button disabled={status === 'saving'} className="mt-6 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-xs font-black uppercase text-white disabled:opacity-50">{status === 'saving' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{status === 'saved' ? 'Configuración guardada' : 'Guardar configuración'}</button>
          </form>

          <section className="rounded-3xl border border-orange-500/25 bg-gradient-to-br from-orange-500/10 via-slate-900/80 to-slate-950 p-5 sm:p-7">
            <div className="flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-widest text-orange-400">Cálculo en el momento</p><h2 className="mt-1 text-xl font-black text-white">Descenso técnico</h2></div><CloudSun className="h-7 w-7 text-orange-400" /></div>
            <label className="mt-6 block text-xs font-bold text-slate-400">Dificultad<select className={inputClass} value={difficulty} onChange={e => setDifficulty(e.target.value as PressureDifficulty)}><option value="rojo">Difícil · roja</option><option value="negro">Experto · negra</option><option value="doble-negro">Enduro · doble negra</option></select></label>
            <button onClick={readWeather} disabled={weatherStatus === 'loading'} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-xs font-black uppercase text-orange-300 hover:bg-orange-500/20 disabled:opacity-50">{weatherStatus === 'loading' ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}{weatherStatus === 'ready' ? 'Actualizar meteo AEMET' : 'Leer meteo de mi ubicación'}</button>
            {weatherStatus === 'error' && <p className="mt-3 text-xs text-amber-300">No se pudo leer la estación ahora. Puedes calcular con la última configuración y repetir cuando haya cobertura.</p>}
            <div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><Thermometer className="mx-auto h-4 w-4 text-orange-400" /><strong className="mt-2 block text-lg text-white">{temperatureC == null ? '—' : `${temperatureC.toFixed(1)}°`}</strong><span className="text-[10px] text-slate-500">temperatura</span></div><div className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><Waves className="mx-auto h-4 w-4 text-blue-400" /><strong className="mt-2 block text-lg text-white">{humidityPct == null ? '—' : `${Math.round(humidityPct)}%`}</strong><span className="text-[10px] text-slate-500">humedad</span></div><div className="rounded-xl border border-white/10 bg-slate-950/60 p-3"><CloudSun className="mx-auto h-4 w-4 text-slate-400" /><strong className="mt-2 block text-lg text-white">{windKmh == null ? '—' : `${Math.round(windKmh)}`}</strong><span className="text-[10px] text-slate-500">viento km/h</span></div></div>
            {stationName && <p className="mt-3 text-center text-[11px] text-slate-500">Estación AEMET: {stationName}</p>}
            <div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-2xl border border-white/10 bg-slate-950/70 p-4"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Delantera</span><strong className="mt-2 block text-4xl font-black text-orange-400">{recommendation.frontBar.toFixed(2)} <small className="text-base">bar</small></strong><p className="mt-2 text-[11px] text-slate-500">Ahora: {profile.frontTirePressureBar?.toFixed(2) ?? '—'} bar</p></div><div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 p-4"><span className="text-[10px] font-black uppercase tracking-widest text-orange-300">Trasera</span><strong className="mt-2 block text-4xl font-black text-orange-300">{recommendation.rearBar.toFixed(2)} <small className="text-base">bar</small></strong><p className="mt-2 text-[11px] text-slate-500">Ahora: {profile.rearTirePressureBar?.toFixed(2) ?? '—'} bar</p></div></div>
            <p className="mt-4 text-xs leading-relaxed text-slate-400">{recommendation.note} Confianza {recommendation.confidence}; peso total considerado {recommendation.totalWeightKg} kg.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
