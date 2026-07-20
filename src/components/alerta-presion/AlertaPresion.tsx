'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { User } from '@supabase/supabase-js';
import type { BikeProfile, PressureRecommendation } from '@/lib/alerta-presion/types';
import { Loader2, AlertTriangle, Bike, Thermometer, Droplets, Gauge, ArrowRight } from 'lucide-react';
import Link from 'next/link';

/* ─── Default profile ─── */
const DEFAULT_PROFILE = {
  riderWeightKg: 75,
  bikeWeightKg: 14,
  bikeModel: '',
  wheelType: '29' as const,
  tireModelFront: '',
  tireModelRear: '',
  tireWidthFrontMm: 60,
  tireWidthRearMm: 60,
  initialPressureFrontBar: 1.8,
  initialPressureRearBar: 2.0,
  tubeless: true,
};

/* ─── Track info for pressure calculation ─── */
interface TrackInfo {
  id: string;
  name: string;
  sector: string;
  difficulty: 'rojo' | 'negro' | 'doble-negro';
  lat: number;
  lng: number;
}

/* ─── Main component ─── */
export default function AlertaPresionPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<BikeProfile>(DEFAULT_PROFILE);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  const [selectedDifficulty, setSelectedDifficulty] = useState<'rojo' | 'negro' | 'doble-negro' | null>(null);
  const [selectedTrack, setSelectedTrack] = useState<TrackInfo | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [recommendation, setRecommendation] = useState<PressureRecommendation | null>(null);
  const [calcWeather, setCalcWeather] = useState<{ temperatureC: number; humidityPct: number; stationName?: string } | null>(null);
  const [error, setError] = useState('');

  // Auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load profile
  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/alerta-presion/profile');
      const data = await res.json();
      if (data.profile) {
        setProfile({
          riderWeightKg: data.profile.rider_weight_kg,
          bikeWeightKg: data.profile.bike_weight_kg,
          bikeModel: data.profile.bike_model || '',
          wheelType: data.profile.wheel_type || '29',
          tireModelFront: data.profile.tire_model_front || '',
          tireModelRear: data.profile.tire_model_rear || '',
          tireWidthFrontMm: data.profile.tire_width_front_mm || 60,
          tireWidthRearMm: data.profile.tire_width_rear_mm || 60,
          initialPressureFrontBar: data.profile.initial_pressure_front_bar || 1.8,
          initialPressureRearBar: data.profile.initial_pressure_rear_bar || 2.0,
          tubeless: data.profile.tubeless ?? true,
        });
      }
      setProfileLoaded(true);
    } catch {
      setProfileLoaded(true);
    }
  }, [user]);

  useEffect(() => { if (user) loadProfile(); else setProfileLoaded(true); }, [user, loadProfile]);

  // Save profile
  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/alerta-presion/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rider_weight_kg: profile.riderWeightKg,
          bike_weight_kg: profile.bikeWeightKg,
          bike_model: profile.bikeModel,
          wheel_type: profile.wheelType,
          tire_model_front: profile.tireModelFront,
          tire_model_rear: profile.tireModelRear,
          tire_width_front_mm: profile.tireWidthFrontMm,
          tire_width_rear_mm: profile.tireWidthRearMm,
          initial_pressure_front_bar: profile.initialPressureFrontBar,
          initial_pressure_rear_bar: profile.initialPressureRearBar,
          tubeless: profile.tubeless,
        }),
      });
      if (res.ok) setSaveStatus('saved');
      else setSaveStatus('error');
    } catch {
      setSaveStatus('error');
    }
    setSaving(false);
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  // Tracks for calculation (hardcoded technical descents from the forfait data)
  const technicalTracks: TrackInfo[] = [
    { id: 'real-01', name: 'Garumba Gigante', sector: 'Bergantes', difficulty: 'rojo', lat: 40.62, lng: -0.125 },
    { id: 'real-02', name: 'Vuelta Garumba', sector: 'Bergantes', difficulty: 'rojo', lat: 40.63, lng: -0.13 },
    { id: 'real-03', name: 'Santets Gegants', sector: 'Bergantes', difficulty: 'rojo', lat: 40.61, lng: -0.115 },
    { id: 'real-04', name: 'Left Dark Side', sector: 'Bergantes', difficulty: 'negro', lat: 40.64, lng: -0.14 },
    { id: 'real-21', name: 'Coronel Perdido', sector: 'El Riu de les Corces', difficulty: 'negro', lat: 40.58, lng: -0.08 },
    { id: 'real-22', name: 'Rico Perdido', sector: 'El Riu de les Corces', difficulty: 'doble-negro', lat: 40.57, lng: -0.09 },
    { id: 'real-23', name: 'Todo Perdido', sector: 'El Riu de les Corces', difficulty: 'doble-negro', lat: 40.56, lng: -0.07 },
    { id: 'real-24', name: 'Tercer Plato Perdido', sector: 'El Riu de les Corces', difficulty: 'doble-negro', lat: 40.59, lng: -0.085 },
  ];

  // Calculate pressure
  const handleCalculate = async () => {
    if (!selectedTrack) return;
    setCalculating(true);
    setError('');
    setRecommendation(null);
    try {
      const res = await fetch('/api/alerta-presion/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          lat: selectedTrack.lat,
          lng: selectedTrack.lng,
          difficulty: selectedTrack.difficulty,
          sector: selectedTrack.sector,
          trackName: selectedTrack.name,
        }),
      });
      const data = await res.json();
      if (data.recommendation) {
        setRecommendation(data.recommendation);
        setCalcWeather(data.weather);
      } else {
        setError(data.error || 'Error al calcular');
      }
    } catch {
      setError('Error de conexión');
    }
    setCalculating(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* HEADER */}
      <div className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Gauge className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Alerta Presión</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Presión recomendada para descensos técnicos</p>
            </div>
          </div>
          {!user && (
            <Link href="/auth"
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors"
            >
              Iniciar sesión
            </Link>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        {!user ? (
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl p-12 text-center">
            <Gauge className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Inicia sesión para usar Alerta Presión</h2>
            <p className="text-slate-400 text-sm mb-6 max-w-md mx-auto">
              Guarda tu perfil de bici y calcula la presión óptima para cada descenso técnico según el tiempo real.
            </p>
            <Link href="/auth"
              className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-colors"
            >
              Iniciar sesión / Registrarse
            </Link>
          </div>
        ) : (
          <>
            {/* ─── QUADRANT 1: Perfil del ciclista ─── */}
            <section className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Bike className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-bold text-white">Perfil del ciclista</h2>
                {profileLoaded && (
                  <button onClick={handleSaveProfile} disabled={saving}
                    className={`ml-auto px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      saveStatus === 'saved' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-orange-500/10 text-orange-400 border border-orange-500/25 hover:bg-orange-500/20'
                    }`}
                  >
                    {saving ? 'Guardando...' : saveStatus === 'saved' ? '✓ Guardado' : 'Guardar'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Peso ciclista */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Peso ciclista (kg)</label>
                  <input type="number" step="0.5" min="30" max="200" value={profile.riderWeightKg}
                    onChange={e => setProfile(p => ({ ...p, riderWeightKg: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {/* Peso bici */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Peso bicicleta (kg)</label>
                  <input type="number" step="0.1" min="5" max="30" value={profile.bikeWeightKg}
                    onChange={e => setProfile(p => ({ ...p, bikeWeightKg: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {/* Modelo bici */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Modelo bicicleta</label>
                  <input type="text" placeholder="Ej: Trek Slash 9.8" value={profile.bikeModel}
                    onChange={e => setProfile(p => ({ ...p, bikeModel: e.target.value }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {/* Tipo ruedas */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Tipo ruedas</label>
                  <select value={profile.wheelType}
                    onChange={e => setProfile(p => ({ ...p, wheelType: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  >
                    <option value="29">29"</option>
                    <option value="27.5">27.5"</option>
                    <option value="29-front-27.5-rear">29" delante / 27.5" detrás</option>
                    <option value="26">26"</option>
                  </select>
                </div>
                {/* Ancho neumático delantero */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ancho neumático del. (mm)</label>
                  <input type="number" step="2.5" min="40" max="80" value={profile.tireWidthFrontMm}
                    onChange={e => setProfile(p => ({ ...p, tireWidthFrontMm: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {/* Ancho neumático trasero */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ancho neumático tras. (mm)</label>
                  <input type="number" step="2.5" min="40" max="80" value={profile.tireWidthRearMm}
                    onChange={e => setProfile(p => ({ ...p, tireWidthRearMm: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {/* Presión inicial delantera */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Presión inicial del. (bar)</label>
                  <input type="number" step="0.1" min="0.5" max="4" value={profile.initialPressureFrontBar}
                    onChange={e => setProfile(p => ({ ...p, initialPressureFrontBar: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {/* Presión inicial trasera */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Presión inicial tras. (bar)</label>
                  <input type="number" step="0.1" min="0.5" max="4" value={profile.initialPressureRearBar}
                    onChange={e => setProfile(p => ({ ...p, initialPressureRearBar: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {/* Tubeless */}
                <div className="flex items-center gap-3">
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Tubeless</label>
                  <button onClick={() => setProfile(p => ({ ...p, tubeless: !p.tubeless }))}
                    className={`w-12 h-6 rounded-full transition-colors ${profile.tubeless ? 'bg-orange-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${profile.tubeless ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </section>

            {/* ─── QUADRANT 2: Selección de descenso y cálculo ─── */}
            <section className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-bold text-white">Calculadora de presión para descensos técnicos</h2>
              </div>

              {/* Selector de dificultad */}
              <div className="flex flex-wrap gap-2 mb-4">
                {(['rojo', 'negro', 'doble-negro'] as const).map(d => (
                  <button key={d} onClick={() => { setSelectedDifficulty(d); setSelectedTrack(null); setRecommendation(null); }}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                      selectedDifficulty === d
                        ? d === 'rojo' ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : d === 'negro' ? 'bg-slate-700/30 text-slate-200 border border-slate-600/30'
                        : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                        : 'text-slate-500 border border-white/5 hover:text-slate-300'
                    }`}
                  >{d === 'doble-negro' ? 'Doble Negro' : d === 'negro' ? 'Negro' : 'Rojo'}</button>
                ))}
              </div>

              {/* Lista de tracks filtrados */}
              {selectedDifficulty && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-6">
                  {technicalTracks.filter(t => t.difficulty === selectedDifficulty).map(t => (
                    <button key={t.id} onClick={() => { setSelectedTrack(t); setRecommendation(null); }}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                        selectedTrack?.id === t.id
                          ? 'bg-orange-500/10 border border-orange-500/30'
                          : 'bg-slate-950/50 border border-white/5 hover:bg-slate-800/50'
                      }`}
                    >
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                        t.difficulty === 'rojo' ? 'bg-red-500' : t.difficulty === 'negro' ? 'bg-slate-200' : 'bg-orange-500'
                      }`} />
                      <div className="min-w-0">
                        <span className="text-[11px] font-bold text-white block truncate">{t.name}</span>
                        <span className="text-[9px] text-slate-500">{t.sector}</span>
                      </div>
                    </button>
                  ))}
                  {technicalTracks.filter(t => t.difficulty === selectedDifficulty).length === 0 && (
                    <p className="text-xs text-slate-500 col-span-2 py-4 text-center">No hay descensos con esta dificultad</p>
                  )}
                </div>
              )}

              {/* Botón calcular */}
              {selectedTrack && (
                <button onClick={handleCalculate} disabled={calculating}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                >
                  {calculating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Calculando...</>
                  ) : (
                    <><Gauge className="w-4 h-4" /> Calcular presión para {selectedTrack.name}</>
                  )}
                </button>
              )}

              {error && (
                <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                  {error}
                </div>
              )}

              {/* ─── RESULTADO ─── */}
              {recommendation && (
                <div className="mt-6 space-y-4 animate-in fade-in duration-300">
                  {/* Condiciones ambientales */}
                  {calcWeather && (
                    <div className="flex flex-wrap items-center gap-4 p-3 bg-slate-950/50 border border-white/5 rounded-xl text-[10px] text-slate-400">
                      <span className="flex items-center gap-1"><Thermometer className="w-3.5 h-3.5 text-orange-400" /> {calcWeather.temperatureC}°C</span>
                      <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-blue-400" /> {calcWeather.humidityPct}% HR</span>
                      {calcWeather.stationName && <span className="text-slate-600">Estación: {calcWeather.stationName}</span>}
                    </div>
                  )}

                  {/* Presiones: grandes números */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* RUEDA DELANTERA */}
                    <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-6 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Rueda Delantera</p>
                      <div className="flex items-end justify-center gap-6 my-4">
                        <div>
                          <p className="text-[9px] text-slate-600 mb-1">Actual</p>
                          <p className="text-3xl font-black text-slate-500">{recommendation.currentFrontBar.toFixed(1)}</p>
                          <p className="text-[10px] text-slate-600">bar ({recommendation.currentFrontPsi} PSI)</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-orange-500 mb-2" />
                        <div>
                          <p className="text-[9px] text-orange-400 mb-1">Recomendada</p>
                          <p className="text-5xl font-black text-orange-500">{recommendation.recommendedFrontBar.toFixed(1)}</p>
                          <p className="text-xs text-slate-400">bar ({recommendation.recommendedFrontPsi} PSI)</p>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {recommendation.recommendedFrontBar < recommendation.currentFrontBar ? '⬇️ Reducir' : '⬆️ Aumentar'} presión
                      </div>
                    </div>

                    {/* RUEDA TRASERA */}
                    <div className="bg-slate-950/60 border border-white/5 rounded-2xl p-6 text-center">
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Rueda Trasera</p>
                      <div className="flex items-end justify-center gap-6 my-4">
                        <div>
                          <p className="text-[9px] text-slate-600 mb-1">Actual</p>
                          <p className="text-3xl font-black text-slate-500">{recommendation.currentRearBar.toFixed(1)}</p>
                          <p className="text-[10px] text-slate-600">bar ({recommendation.currentRearPsi} PSI)</p>
                        </div>
                        <ArrowRight className="w-5 h-5 text-orange-500 mb-2" />
                        <div>
                          <p className="text-[9px] text-orange-400 mb-1">Recomendada</p>
                          <p className="text-5xl font-black text-orange-500">{recommendation.recommendedRearBar.toFixed(1)}</p>
                          <p className="text-xs text-slate-400">bar ({recommendation.recommendedRearPsi} PSI)</p>
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {recommendation.recommendedRearBar < recommendation.currentRearBar ? '⬇️ Reducir' : '⬆️ Aumentar'} presión
                      </div>
                    </div>
                  </div>

                  {/* Razón del cálculo */}
                  <div className="p-3 bg-slate-950/50 border border-white/5 rounded-xl">
                    <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold mb-1">Factores considerados</p>
                    <p className="text-[11px] text-slate-300">{recommendation.reason}</p>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
