'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { User } from '@supabase/supabase-js';
import type { BikeProfile, PressureRecommendation } from '@/lib/alerta-presion/types';
import { calculatePressure } from '@/lib/alerta-presion/calculate';
import { Loader2, Gauge, Thermometer, Droplets, Bike, AlertTriangle, TrendingDown, MapPin, Crosshair, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { BIKE_MODELS } from '@/lib/alerta-presion/bike-models';
import type { BikeModelSpec } from '@/lib/alerta-presion/bike-models';
import { Map, Marker, Popup, NavigationControl } from 'react-map-gl/mapbox';
import type { MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';

const DEFAULT_PROFILE: BikeProfile = {
  riderWeightKg: 75, bikeWeightKg: 20, bikeModel: 'Turbo Levo Carbono 2023',
  wheelFront: '27.5', wheelRear: '27.5', tireModelFront: '', tireModelRear: '',
  tireWidthFrontInch: 2.3, tireWidthRearInch: 2.3,
  initialPressureFrontBar: 1.8, initialPressureRearBar: 2.0,
  tubeless: true, hasInsert: false, rimWidthMm: 30,
  ridingStyle: 'moderado' as const, riderExperience: 'intermedio' as const,
  terrainTypes: [] as string[], groundCondition: 'mixto' as const, casingType: 'estandar' as const,
};

const ELEVATION_PRESETS = [
  { label: 'Alta montaña', deltaTemp: -5, deltaHumidity: 10, icon: '🏔️' },
  { label: 'Bosque cerrado', deltaTemp: -3, deltaHumidity: 15, icon: '🌲' },
  { label: 'Solana / seco', deltaTemp: 4, deltaHumidity: -10, icon: '☀️' },
];

export default function AlertaPresionPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<BikeProfile>(DEFAULT_PROFILE);
  const [profileName, setProfileName] = useState('Mi perfil');
  const [savedProfiles, setSavedProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [error, setError] = useState('');
  const [profileLoadError, setProfileLoadError] = useState('');

  const [baseTemp, setBaseTemp] = useState<number | null>(null);
  const [baseHumidity, setBaseHumidity] = useState<number | null>(null);
  const [altitudeAdjusted, setAltitudeAdjusted] = useState(false);
  const [weatherSource, setWeatherSource] = useState('');
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [clickAltitude, setClickAltitude] = useState<number | null>(null);
  const [stationMarkers, setStationMarkers] = useState<any[]>([]);
  const [stationsLoading, setStationsLoading] = useState(false);

  const [adjustTemp, setAdjustTemp] = useState(0);
  const [adjustHumidity, setAdjustHumidity] = useState(0);
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [mapPoint, setMapPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [step, setStep] = useState(1);

  const effectiveTemp = baseTemp != null ? baseTemp + adjustTemp : 20;
  const effectiveHumidity = baseHumidity != null ? Math.max(10, Math.min(100, baseHumidity + adjustHumidity)) : 60;

  const getRecommendation = useCallback(() => {
    if (baseTemp == null || baseHumidity == null) return null;
    return calculatePressure({
      profile, temperatureC: effectiveTemp, humidityPct: effectiveHumidity,
      descent: { id: 'calc', name: '', trackName: '', distanceKm: 0, elevationLoss: 0, elevationGain: 0, midpoint: { lat: 0, lng: 0 } },
    });
  }, [profile, effectiveTemp, effectiveHumidity, baseTemp, baseHumidity]);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => { setUser(data.user); setAuthLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  const loadProfiles = useCallback(async () => {
    if (!user) return;
    try {
      setProfileLoadError('');
      const supabase = createClient();
      const { data: { user: freshUser }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !freshUser) { setProfileLoadError(userErr?.message || 'No autenticado'); setSavedProfiles([]); setProfileLoaded(true); return; }
      const { data, error } = await supabase.rpc('get_my_bike_profiles');
      if (error) { setProfileLoadError(`${error.message} (code: ${error.code})`); setSavedProfiles([]); }
      else if (data && data.length > 0) { setSavedProfiles(data); selectProfile(data[0]); }
      else { setSavedProfiles([]); setProfile({ ...DEFAULT_PROFILE }); setProfileName('Mi perfil'); setSelectedProfileId(null); }
      setProfileLoaded(true);
    } catch { setProfileLoaded(true); }
  }, [user]);

  const selectProfile = (p: any) => {
    setSelectedProfileId(p.id); setProfileName(p.profile_name || 'Mi perfil');
    setProfile({ riderWeightKg: p.rider_weight_kg, bikeWeightKg: p.bike_weight_kg, bikeModel: p.bike_model || '', wheelFront: p.wheel_front || '27.5', wheelRear: p.wheel_rear || '27.5', tireModelFront: p.tire_model_front || '', tireModelRear: p.tire_model_rear || '', tireWidthFrontInch: p.tire_width_front_inch || 2.3, tireWidthRearInch: p.tire_width_rear_inch || 2.3, initialPressureFrontBar: p.initial_pressure_front_bar || 1.8, initialPressureRearBar: p.initial_pressure_rear_bar || 2.0, tubeless: p.tubeless ?? true, rimWidthMm: p.rim_width_mm ?? 30, ridingStyle: p.riding_style || 'moderado', riderExperience: p.rider_experience || 'intermedio', terrainTypes: Array.isArray(p.terrain_types) ? p.terrain_types : [], groundCondition: p.ground_condition || 'mixto', casingType: p.casing_type || 'estandar' });
  };

  useEffect(() => { if (user) loadProfiles(); else { setProfileLoaded(true); setSavedProfiles([]); } }, [user, loadProfiles]);

  const fetchWeather = async (lat: number, lng: number, altitude?: number) => {
    setWeatherLoading(true); setError(''); setAltitudeAdjusted(false);
    setStationsLoading(true);
    fetch(`/api/alerta-presion/stations?lat=${lat}&lng=${lng}`).then(r => r.json()).then(d => { if (d.stations) setStationMarkers(d.stations); setStationsLoading(false); }).catch(() => setStationsLoading(false));
    try {
      const res = await fetch('/api/alerta-presion/calculate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, lat, lng, descent: { id: 'wx', name: '', trackName: '', distanceKm: 0, elevationLoss: 0, elevationGain: 0, midpoint: { lat, lng } } }),
      });
      const data = await res.json();
      if (data.weather) {
        let temp = data.weather.temperatureC ?? 20;
        let source = data.weather.stationName || 'Estación AEMET';
        if (altitude != null && data.weather.stationAltitude != null) {
          const altDiff = altitude - data.weather.stationAltitude;
          if (Math.abs(altDiff) > 50) {
            const lapseAdjust = -(altDiff * 0.65 / 100);
            temp = Math.round((temp + lapseAdjust) * 10) / 10;
            if (Math.abs(temp - (data.weather.temperatureC ?? 20)) >= 0.5) { setAltitudeAdjusted(true); source += ` (ajustado: ${data.weather.stationAltitude}m → ${Math.round(altitude)}m)`; }
          }
        }
        setBaseTemp(temp); setBaseHumidity(data.weather.humidityPct ?? 60); setWeatherSource(source);
        setWeatherLoaded(true); setMapPoint({ lat, lng }); setClickAltitude(altitude || null);
        setAdjustTemp(0); setAdjustHumidity(0); setSelectedPreset(null);
      } else { setError('No se pudieron obtener datos meteorológicos'); }
    } catch { setError('Error de conexión con AEMET'); }
    setWeatherLoading(false);
  };

  const applyPreset = (presetLabel: string) => {
    if (selectedPreset === presetLabel) { setSelectedPreset(null); setAdjustTemp(0); setAdjustHumidity(0); }
    else { const p = ELEVATION_PRESETS.find(x => x.label === presetLabel); if (p) { setSelectedPreset(presetLabel); setAdjustTemp(p.deltaTemp); setAdjustHumidity(p.deltaHumidity); } }
  };

  const handleSaveProfile = async () => {
    setSaving(true); setSaveStatus('idle');
    try {
      const supabase = createClient();
      const payload = { profile_name: profileName, rider_weight_kg: profile.riderWeightKg, bike_weight_kg: profile.bikeWeightKg, bike_model: profile.bikeModel, wheel_front: profile.wheelFront, wheel_rear: profile.wheelRear, tire_model_front: profile.tireModelFront, tire_model_rear: profile.tireModelRear, tire_width_front_inch: profile.tireWidthFrontInch, tire_width_rear_inch: profile.tireWidthRearInch, initial_pressure_front_bar: profile.initialPressureFrontBar, initial_pressure_rear_bar: profile.initialPressureRearBar, tubeless: profile.tubeless };
      const result = selectedProfileId
        ? await supabase.rpc('update_bike_profile', { p_id: selectedProfileId, ...Object.fromEntries(Object.entries(payload).map(([k, v]) => ['p_' + k, v])) })
        : await supabase.rpc('insert_bike_profile', { ...Object.fromEntries(Object.entries(payload).map(([k, v]) => ['p_' + k, v])) });
      if (result.error) setSaveStatus('error');
      else { setSaveStatus('saved'); if (result.data) setSelectedProfileId(Array.isArray(result.data) ? result.data[0]?.id : result.data.id); await loadProfiles(); }
    } catch { setSaveStatus('error'); }
    setSaving(false); setTimeout(() => setSaveStatus('idle'), 3000);
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm('¿Eliminar este perfil?')) return;
    try { const supabase = createClient(); await supabase.rpc('delete_bike_profile', { p_id: id }); if (selectedProfileId === id) { setProfile({ ...DEFAULT_PROFILE }); setProfileName('Mi perfil'); setSelectedProfileId(null); } await loadProfiles(); } catch {}
  };

  if (authLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>;

  const recommendation = weatherLoaded ? getRecommendation() : null;

  const Select = ({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: number[] }) => (
    <select value={value} onChange={e => onChange(Number(e.target.value))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  const stepClass = (i: number) => {
    if (step === i) return 'bg-orange-500/10 border-orange-500 text-orange-400';
    if (step > i) return 'bg-green-500/10 border-green-500/30 text-green-400';
    return 'bg-slate-900 border-white/10 text-slate-500 cursor-default';
  };
  const circleClass = (i: number) => {
    if (step === i) return 'bg-orange-500 text-white';
    if (step > i) return 'bg-green-500 text-white';
    return 'bg-slate-700 text-slate-400';
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* HEADER */}
      <div className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20"><Gauge className="text-white w-5 h-5" /></div>
            <div><h1 className="text-lg font-black text-white tracking-tight">Alerta Presión</h1><p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Ajusta temperatura y humedad a tu ruta</p></div>
          </div>
          {!user && <Link href="/auth" className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors">Iniciar sesión</Link>}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <style>{`.fade-in { animation: fi 0.35s ease-out both; } @keyframes fi { 0% { opacity:0; transform:translateY(10px); } 100% { opacity:1; transform:translateY(0); } }`}</style>

        {!user ? (
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-12 text-center">
            <Gauge className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Inicia sesión para usar Alerta Presión</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">Guarda tu perfil de bici y ajusta la presión según las condiciones reales de tu ruta.</p>
            <Link href="/auth" className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-colors">Iniciar sesión / Registrarse</Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* STEPPER */}
            <div className="flex items-center justify-center gap-3 mb-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3">
                  <button onClick={() => i <= step && setStep(i)} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${stepClass(i)}`}>
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${circleClass(i)}`}>{step > i ? '✓' : i}</span>
                    <span className="text-[10px] font-bold uppercase tracking-widest">{i === 1 ? 'Perfil' : i === 2 ? 'Zona' : 'Resultado'}</span>
                  </button>
                  {i < 3 && <div className="w-8 h-px bg-white/10" />}
                </div>
              ))}
            </div>

            {/* PASO 1: PERFIL */}
            {step === 1 && <div className="fade-in space-y-4">
              <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-6">
                  <Bike className="w-5 h-5 text-orange-500" />
                  <h2 className="text-base font-bold text-white">Perfil del ciclista</h2>
                </div>
                {profileLoadError && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400 mb-4">Error al cargar perfiles: {profileLoadError}</div>}
                {savedProfiles.length > 0 && (
                  <div className="p-4 bg-slate-800/40 border border-orange-500/15 rounded-xl mb-4">
                    <label className="text-[10px] text-orange-400 uppercase tracking-widest font-bold block mb-2">Tus perfiles guardados</label>
                    <div className="flex items-center gap-2">
                      <select value={selectedProfileId || ''} onChange={e => { const p = savedProfiles.find(sp => sp.id === e.target.value); if (p) selectProfile(p); }} className="flex-1 bg-slate-950 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">
                        {savedProfiles.map(p => <option key={p.id} value={p.id}>{p.profile_name || 'Sin nombre'}</option>)}
                      </select>
                      <button onClick={() => handleDeleteProfile(selectedProfileId!)} className="p-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-xs">🗑️</button>
                      <button onClick={() => { setProfile({ ...DEFAULT_PROFILE }); setProfileName('Mi perfil'); setSelectedProfileId(null); }} className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-xs">➕</button>
                    </div>
                  </div>
                )}
                {savedProfiles.length === 0 && profileLoaded && !profileLoadError && <div className="text-[11px] text-slate-500 bg-slate-800/20 rounded-lg px-4 py-3 mb-4">No tienes perfiles guardados. Configura y guarda tu perfil para usarlo después.</div>}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1"><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Nombre del perfil</label><input type="text" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Ej: Enduro con Turbo Levo" className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40" /></div>
                  {profileLoaded && <button onClick={handleSaveProfile} disabled={saving} className={`mt-5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${saveStatus === 'saved' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : selectedProfileId ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20' : 'bg-orange-500/10 text-orange-400 border border-orange-500/25 hover:bg-orange-500/20'}`}>{saving ? 'Guardando...' : saveStatus === 'saved' ? '✓ Guardado' : selectedProfileId ? 'Actualizar' : 'Guardar nuevo'}</button>}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Peso ciclista (kg)</label><Select value={profile.riderWeightKg} onChange={v => setProfile(p => ({ ...p, riderWeightKg: v }))} options={Array.from({ length: 33 }, (_, i) => 68 + i)} /></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Peso bicicleta (kg)</label><Select value={profile.bikeWeightKg} onChange={v => setProfile(p => ({ ...p, bikeWeightKg: v }))} options={Array.from({ length: 15 }, (_, i) => 11 + i)} /></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Modelo bicicleta</label>
                    <select value={profile.bikeModel} onChange={e => { const m = e.target.value; const spec = BIKE_MODELS.find(x => x.name === m); if (spec) setProfile({ ...profile, bikeModel: m, bikeWeightKg: spec.weightKg, wheelFront: spec.wheelFront, wheelRear: spec.wheelRear, tireWidthFrontInch: spec.tireWidthFrontInch, tireWidthRearInch: spec.tireWidthRearInch, tireModelFront: spec.tireModelFront, tireModelRear: spec.tireModelRear, tubeless: spec.tubeless }); else setProfile(p => ({ ...p, bikeModel: m })); }} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">
                      {BIKE_MODELS.map(m => <option key={m.name} value={m.name}>{m.name} ({m.year})</option>)}
                      <option value="">— Personalizado —</option>
                    </select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Rueda delantera</label><select value={profile.wheelFront} onChange={e => setProfile(p => ({ ...p, wheelFront: e.target.value as any }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"><option value="29">29"</option><option value="27.5">27.5"</option></select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Rueda trasera</label><select value={profile.wheelRear} onChange={e => setProfile(p => ({ ...p, wheelRear: e.target.value as any }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"><option value="29">29"</option><option value="27.5">27.5"</option></select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ancho neumático del. (")</label><select value={profile.tireWidthFrontInch} onChange={e => setProfile(p => ({ ...p, tireWidthFrontInch: Number(e.target.value) }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">{[2.0,2.1,2.2,2.3,2.4,2.5,2.6,2.7,2.8].map(v => <option key={v} value={v}>{v.toFixed(1)}"</option>)}</select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ancho neumático tras. (")</label><select value={profile.tireWidthRearInch} onChange={e => setProfile(p => ({ ...p, tireWidthRearInch: Number(e.target.value) }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">{[2.0,2.1,2.2,2.3,2.4,2.5,2.6,2.7,2.8].map(v => <option key={v} value={v}>{v.toFixed(1)}"</option>)}</select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Presión inicial del. (bar)</label><input type="number" step="0.1" min="0.5" max="4" value={profile.initialPressureFrontBar} onChange={e => setProfile(p => ({ ...p, initialPressureFrontBar: Number(e.target.value) }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40" /></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Presión inicial tras. (bar)</label><input type="number" step="0.1" min="0.5" max="4" value={profile.initialPressureRearBar} onChange={e => setProfile(p => ({ ...p, initialPressureRearBar: Number(e.target.value) }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40" /></div>
                  <div className="flex items-center gap-3 pt-6">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Tubeless</label>
                    <button onClick={() => setProfile(p => ({ ...p, tubeless: !p.tubeless }))} className={`w-12 h-6 rounded-full transition-colors ${profile.tubeless ? 'bg-orange-500' : 'bg-slate-700'}`}><div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${profile.tubeless ? 'translate-x-6' : 'translate-x-0.5'}`} /></button>
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold ml-4">Insert</label>
                    <button onClick={() => setProfile(p => ({ ...p, hasInsert: !p.hasInsert }))} className={`w-12 h-6 rounded-full transition-colors ${profile.hasInsert ? 'bg-orange-500' : 'bg-slate-700'}`}><div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${profile.hasInsert ? 'translate-x-6' : 'translate-x-0.5'}`} /></button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ancho llanta (mm int.)</label><select value={profile.rimWidthMm || 30} onChange={e => setProfile(p => ({ ...p, rimWidthMm: Number(e.target.value) }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">{[25,27,30,32,35,38,40].map(v => <option key={v} value={v}>{v}mm</option>)}</select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Tipo de terreno (elige varios)</label>
                    <div className="flex flex-wrap gap-1.5">
                      {[['mixto','Mixto'],['raices','Raíces'],['arcilloso','Arcilloso'],['duro','Duro'],['rocoso','Rocoso']].map(([val,label]) => {
                        const sel = profile.terrainTypes?.includes(val) || false;
                        return <button key={val} onClick={() => setProfile(p => ({ ...p, terrainTypes: sel ? (p.terrainTypes||[]).filter(v => v !== val) : [...(p.terrainTypes||[]), val] }))} className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${sel ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-950 border-white/10 text-slate-400 hover:border-orange-500/50'}`}>{sel && '✓ '}{label}</button>;
                      })}
                    </div>
                  </div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Condición del terreno</label><select value={profile.groundCondition || 'mixto'} onChange={e => setProfile(p => ({ ...p, groundCondition: e.target.value as any }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"><option value="humedo">Húmedo</option><option value="mixto">Mixto</option><option value="seco">Seco</option></select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Estilo de conducción</label><select value={profile.ridingStyle || 'moderado'} onChange={e => setProfile(p => ({ ...p, ridingStyle: e.target.value as any }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"><option value="conservador">Conservador</option><option value="moderado">Moderado</option><option value="agresivo">Agresivo</option></select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Experiencia del rider</label><select value={profile.riderExperience || 'intermedio'} onChange={e => setProfile(p => ({ ...p, riderExperience: e.target.value as any }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"><option value="principiante">Principiante</option><option value="intermedio">Intermedio</option><option value="avanzado">Avanzado</option><option value="experto">Experto</option></select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Tipo de carcasa</label><select value={profile.casingType || 'estandar'} onChange={e => setProfile(p => ({ ...p, casingType: e.target.value as any }))} className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"><option value="ligera">Ligera</option><option value="estandar">Estándar</option><option value="reforzada">Reforzada</option></select></div>
                </div>
                <div className="flex justify-end mt-6 pt-4 border-t border-white/5">
                  <button onClick={() => setStep(2)} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2">Siguiente <span>→</span></button>
                </div>
              </div>
            </div>}

            {/* PASO 2: MAPA + AJUSTES */}
            {step === 2 && <div className="fade-in space-y-4">
              <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5">
                <details open>
                  <summary className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white transition-colors list-none">
                    <Thermometer className="w-4 h-4 text-orange-500/70" />
                    <span className="text-xs font-bold uppercase tracking-widest">Seleccionar zona</span>
                    <span className="ml-auto text-[9px] text-slate-600">{weatherLoaded ? `${baseTemp}°C · ${baseHumidity}% HR` : 'Elige en el mapa'}</span>
                    <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                  </summary>
                  <div className="mt-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <p className="text-[10px] text-orange-400 uppercase tracking-widest font-bold flex items-center gap-2"><Crosshair className="w-3.5 h-3.5" /> Haz clic — datos AEMET con altitud</p>
                        <div className="relative w-full h-[450px] lg:h-[500px] rounded-xl overflow-hidden border border-white/5">
                          <Map mapStyle="mapbox://styles/mapbox/outdoors-v12" mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN} initialViewState={{ latitude:40.62, longitude:-0.125, zoom:11, pitch:50 }} onClick={(e: MapMouseEvent) => { const m=e.target; let alt; try{ alt=m.queryTerrainElevation?.(e.lngLat)??undefined; }catch{} fetchWeather(e.lngLat.lat, e.lngLat.lng, alt); }} style={{ width:'100%', height:'100%' }}>
                            <NavigationControl position="top-right" />
                            {mapPoint && <Marker latitude={mapPoint.lat} longitude={mapPoint.lng} color="#f97316" scale={0.9} />}
                            {stationMarkers.filter(s=>s.lat&&s.lng).map(st => (
                              <Marker key={st.code} latitude={st.lat} longitude={st.lng} scale={0.5}>
                                <div className="flex flex-col items-center cursor-pointer" onClick={(e)=>{e.stopPropagation();fetchWeather(st.lat,st.lng,st.altitudeM);}}>
                                  <div className={`px-1.5 py-0.5 rounded text-[8px] font-bold text-white whitespace-nowrap shadow-lg border ${st.temperatureC!=null?'bg-slate-950/90 border-orange-500/50':'bg-slate-950/70 border-white/10'}`}>{st.temperatureC!=null?`${st.temperatureC}°`:st.name?.substring(0,6)||'?'}</div>
                                  <div className="w-2 h-2 bg-orange-500 rounded-full mt-0.5 shadow-lg shadow-orange-500/50" />
                                </div>
                              </Marker>
                            ))}
                            {stationsLoading && <div className="absolute top-2 left-2 z-10 bg-slate-950/90 border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2 text-[10px] text-slate-300"><Loader2 className="w-3 h-3 animate-spin text-orange-400" /> Localizando estaciones...</div>}
                            {weatherLoading && <div className="absolute top-2 right-12 z-10 bg-slate-950/90 border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2 text-[10px] text-slate-300"><Loader2 className="w-3 h-3 animate-spin text-orange-400" /> Consultando AEMET...</div>}
                          </Map>
                        </div>
                        <p className="text-[9px] text-slate-600 leading-relaxed">{stationMarkers.length > 0 ? `Se muestran ${stationMarkers.length} estaciones.` : 'Haz clic en el mapa para obtener datos AEMET.'}{clickAltitude != null && <span className="block text-[8px] text-slate-500 mt-0.5">Altitud: {Math.round(clickAltitude)} m</span>}</p>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[10px] text-orange-400 uppercase tracking-widest font-bold flex items-center gap-2"><Gauge className="w-3.5 h-3.5" /> Ajusta según tu ruta</p>
                        {!weatherLoaded && !weatherLoading && <div className="text-[11px] text-slate-500 bg-slate-800/30 rounded-xl px-4 py-6 text-center">Haz clic en el mapa para obtener datos base.</div>}
                        {weatherLoading && <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/30 rounded-xl px-4 py-6"><Loader2 className="w-4 h-4 animate-spin" /> Consultando AEMET...</div>}
                        {weatherLoaded && <>
                          <div className="bg-slate-900/60 border border-white/5 rounded-xl p-5">
                            <div className="flex items-center justify-between mb-4"><span className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Datos</span><span className="text-xs text-slate-400 truncate max-w-[180px]">{weatherSource}</span></div>
                            <div className="grid grid-cols-2 gap-6">
                              <div className="text-center"><p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Temperatura</p><div className="flex items-baseline justify-center gap-2"><span className="text-5xl md:text-6xl font-black text-orange-500">{effectiveTemp}</span><span className="text-xl text-orange-500/70 font-black">°C</span></div>{adjustTemp!==0 && <p className="text-[9px] text-slate-500 mt-1">Base <span className="font-bold text-white">{baseTemp}°</span><span className={`ml-1 font-bold ${adjustTemp>0?'text-red-400':'text-blue-400'}`}>({adjustTemp>0?'+':''}{adjustTemp}°)</span></p>}</div>
                              <div className="text-center"><p className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Humedad</p><div className="flex items-baseline justify-center gap-2"><span className="text-5xl md:text-6xl font-black text-blue-400">{effectiveHumidity}</span><span className="text-xl text-blue-400/70 font-black">%</span></div>{adjustHumidity!==0 && <p className="text-[9px] text-slate-500 mt-1">Base <span className="font-bold text-white">{baseHumidity}%</span><span className={`ml-1 font-bold ${adjustHumidity>0?'text-blue-400':'text-yellow-400'}`}>({adjustHumidity>0?'+':''}{adjustHumidity}%)</span></p>}</div>
                            </div>
                            <div className="flex items-center justify-center gap-4 mt-4 pt-4 border-t border-white/5">
                              <p className="text-[9px] text-slate-500">Ajustar:</p>
                              <button onClick={()=>setAdjustTemp(a=>a-1)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-[10px] text-slate-300 transition-colors">Temp -1°</button>
                              <button onClick={()=>setAdjustTemp(a=>a+1)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-[10px] text-slate-300 transition-colors">Temp +1°</button>
                              <button onClick={()=>setAdjustHumidity(a=>a-5)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-[10px] text-slate-300 transition-colors">HR -5%</button>
                              <button onClick={()=>setAdjustHumidity(a=>a+5)} className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-[10px] text-slate-300 transition-colors">HR +5%</button>
                            </div>
                          </div>
                          <div><p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-2">Perfiles rápidos</p><div className="grid grid-cols-2 gap-2">{ELEVATION_PRESETS.map(p => <button key={p.label} onClick={()=>applyPreset(p.label)} className={`text-left px-3 py-2 rounded-xl border transition-all text-[10px] ${selectedPreset===p.label?'border-orange-500 bg-orange-500/10 text-white':'border-white/10 bg-slate-900/60 text-slate-400 hover:border-orange-500/50'}`}><span className="text-xs mr-1">{p.icon}</span><span className="font-bold">{p.label}</span><span className="block text-[8px] text-slate-500 mt-0.5">{p.deltaTemp>0?'+':''}{p.deltaTemp}°C · {p.deltaHumidity>0?'+':''}{p.deltaHumidity}% HR</span></button>)}</div></div>
                        </>}
                        {error && <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400">{error}</div>}
                      </div>
                    </div>
                  </div>
                </details>
              </div>
              <div className="flex items-center justify-between">
                <button onClick={() => setStep(1)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl text-[10px] font-bold transition-colors flex items-center gap-2"><span>←</span> Atrás</button>
                {weatherLoaded && <button onClick={() => setStep(3)} className="px-6 py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-orange-500/20 flex items-center gap-2">Ver resultado <span>→</span></button>}
              </div>
            </div>}

            {/* PASO 3: RESULTADO */}
            {step === 3 && recommendation && (() => {
              const r = recommendation;
              return <div className="fade-in space-y-6">
                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/30 border border-orange-500/30 rounded-3xl p-6 md:p-8 shadow-2xl shadow-orange-500/10 text-center">
                  <div className="flex items-center justify-center gap-2 text-orange-500 mb-4">
                    <TrendingDown className="w-5 h-5" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Presión recomendada</span>
                    <span className="text-[9px] text-slate-600 ml-2">({effectiveTemp}°C · {effectiveHumidity}% HR)</span>
                  </div>
                  <div className="relative mx-auto">
                    <div className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr] items-center gap-4 md:gap-6">
                      <div className="bg-slate-950/90 border border-orange-500/40 rounded-2xl px-6 py-5 text-center shadow-xl shadow-orange-500/10">
                        <p className="text-[9px] text-orange-400 uppercase tracking-widest font-bold mb-1">Trasera</p>
                        <p className="text-6xl md:text-7xl font-black text-orange-500 leading-none tracking-tight">{r.recommendedRearBar.toFixed(1)}</p>
                        <p className="text-sm md:text-base font-bold text-white mt-1">{Math.round(r.recommendedRearPsi)} PSI</p>
                        <p className="text-[8px] text-slate-600 mt-0.5">({r.currentRearBar.toFixed(1)} actual)</p>
                      </div>
                      <div className="relative"><img src="/102350-Cube-Stereo-Hybrid-ONE44-HPC-Race-800-blackline-2026-EBike-Fully-Mountainbike-00.jpg" alt="Cube e-MTB" className="w-full h-auto" style={{ mixBlendMode:'multiply' }} /></div>
                      <div className="bg-slate-950/90 border border-orange-500/40 rounded-2xl px-6 py-5 text-center shadow-xl shadow-orange-500/10">
                        <p className="text-[9px] text-orange-400 uppercase tracking-widest font-bold mb-1">Delantera</p>
                        <p className="text-6xl md:text-7xl font-black text-orange-500 leading-none tracking-tight">{r.recommendedFrontBar.toFixed(1)}</p>
                        <p className="text-sm md:text-base font-bold text-white mt-1">{Math.round(r.recommendedFrontPsi)} PSI</p>
                        <p className="text-[8px] text-slate-600 mt-0.5">({r.currentFrontBar.toFixed(1)} actual)</p>
                      </div>
                    </div>
                  </div>
                  <p className="mt-4 text-[11px] text-slate-500 leading-relaxed max-w-lg mx-auto">{r.reason}</p>
                </div>
                {weatherLoaded && (
                  <div className="border border-white/5 rounded-2xl p-4 bg-slate-900/30">
                    <div className="flex items-center gap-2 mb-3"><MapPin className="w-4 h-4 text-orange-400" /><span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Datos base</span><span className="text-[9px] text-slate-500 ml-auto">{weatherSource}</span>{altitudeAdjusted && <span className="text-[8px] bg-orange-500/15 text-orange-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Ajustado por altitud</span>}</div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div className="bg-slate-950/50 border border-white/5 rounded-xl p-4"><p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-2">Temp. base</p><p className="text-3xl md:text-4xl font-black text-white">{baseTemp}°C</p></div>
                      <div className="bg-slate-950/50 border border-white/5 rounded-xl p-4"><p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-2">Ajuste</p><p className={`text-3xl md:text-4xl font-black ${adjustTemp>=0?'text-red-400':'text-blue-400'}`}>{adjustTemp>0?'+':''}{adjustTemp}°C</p></div>
                      <div className="bg-slate-950/50 border border-white/5 rounded-xl p-4"><p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-2">Efectiva</p><p className="text-3xl md:text-4xl font-black text-orange-400">{effectiveTemp}°C</p></div>
                    </div>
                    {clickAltitude!=null && <div className="mt-2 flex items-center gap-1.5 text-[9px] text-slate-500 bg-slate-950/30 rounded-lg px-2.5 py-1.5"><span>🏔️</span><span>Altitud: <strong className="text-slate-300">{Math.round(clickAltitude)} m</strong></span>{altitudeAdjusted && <span className="text-blue-400 ml-auto">Ajuste por gradiente térmico</span>}</div>}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button onClick={() => setStep(2)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl text-[10px] font-bold transition-colors flex items-center gap-2"><span>←</span> Ajustar zona</button>
                  <button onClick={() => { setStep(1); setWeatherLoaded(false); setBaseTemp(null); setBaseHumidity(null); setMapPoint(null); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl text-[10px] font-bold transition-colors">Nuevo cálculo</button>
                </div>
              </div>;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
