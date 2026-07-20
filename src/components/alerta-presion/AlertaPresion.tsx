'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { User } from '@supabase/supabase-js';
import type { BikeProfile, PressureRecommendation, DescentInfo } from '@/lib/alerta-presion/types';
import { loadTrackPoints, getCachedTrackPoints } from '@/lib/forfait/track-points-cache';
import { splitIntoSendas } from '@/lib/forfait/senda-utils';
import type { TrackMTB } from '@/lib/forfait/types';
import { Loader2, Gauge, Thermometer, Droplets, Bike, AlertTriangle, TrendingDown } from 'lucide-react';
import Link from 'next/link';
import { BIKE_MODELS } from '@/lib/alerta-presion/bike-models';
import type { BikeModelSpec } from '@/lib/alerta-presion/bike-models';

const DEFAULT_PROFILE: BikeProfile = {
  riderWeightKg: 75,
  bikeWeightKg: 20,
  bikeModel: 'Turbo Levo Carbono 2023',
  wheelFront: '27.5',
  wheelRear: '27.5',
  tireModelFront: '',
  tireModelRear: '',
  tireWidthFrontInch: 2.3,
  tireWidthRearInch: 2.3,
  initialPressureFrontBar: 1.8,
  initialPressureRearBar: 2.0,
  tubeless: true,
};

interface AvailableTrack {
  id: string;
  name: string;
  sector: string;
  gpxUrl: string;
}

export default function AlertaPresionPage() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<BikeProfile>(DEFAULT_PROFILE);
  const [profileLoaded, setProfileLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [allTracks, setAllTracks] = useState<AvailableTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [descents, setDescents] = useState<DescentInfo[]>([]);
  const [descentResults, setDescentResults] = useState<Map<string, { recommendation: PressureRecommendation; weather: any }>>(new Map());
  const [calculating, setCalculating] = useState(false);
  const [selectedOnlyCalc, setSelectedOnlyCalc] = useState(false);
  const [error, setError] = useState('');

  // Auth
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
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
          bikeModel: data.profile.bike_model || 'Turbo Levo Carbono 2023',
          wheelFront: data.profile.wheel_front || '27.5',
          wheelRear: data.profile.wheel_rear || '27.5',
          tireModelFront: data.profile.tire_model_front || '',
          tireModelRear: data.profile.tire_model_rear || '',
          tireWidthFrontInch: data.profile.tire_width_front_inch || 2.3,
          tireWidthRearInch: data.profile.tire_width_rear_inch || 2.3,
          initialPressureFrontBar: data.profile.initial_pressure_front_bar || 1.8,
          initialPressureRearBar: data.profile.initial_pressure_rear_bar || 2.0,
          tubeless: data.profile.tubeless ?? true,
        });
      }
      setProfileLoaded(true);
    } catch { setProfileLoaded(true); }
  }, [user]);
  useEffect(() => { if (user) loadProfile(); else setProfileLoaded(true); }, [user, loadProfile]);

  // Load tracks list
  useEffect(() => {
    fetch('/api/forfait/tracks-list').then(r => r.json()).then(data => {
      if (data.tracks) setAllTracks(data.tracks);
    }).catch(() => {});
  }, []);

  // Handle track selection → extract descents
  const handleTrackSelect = async (trackId: string) => {
    setSelectedTrackId(trackId);
    setDescents([]);
    setDescentResults(new Map());
    setError('');

    const track = allTracks.find(t => t.id === trackId);
    if (!track) return;

    // Load GPX and split into sendas
    try {
      const points = await loadTrackPoints(track.gpxUrl);
      if (!points || points.length < 2) { setError('El track no tiene datos GPX'); return; }

      // Build a minimal TrackMTB for splitIntoSendas
      const miniTrack: TrackMTB = {
        id: track.id,
        nombre: track.name,
        sector: track.sector,
        dificultad: 'rojo',
        estado: 'abierto',
        tipo: ['enduro'],
        distanciaKm: 0,
        desnivelPositivo: 0,
        desnivelNegativo: 0,
        nivelTecnico: 3,
        exigenciaFisica: 3,
        sentidoRecomendado: 'bidireccional',
        aptoEbike: true,
        aptoLluvia: false,
        tiempoEstimadoMin: 60,
        descripcion: '',
        advertencias: [],
        gpxUrl: track.gpxUrl,
        points: points,
        startPoint: { lat: points[0].lat, lng: points[0].lng },
        endPoint: { lat: points[points.length - 1].lat, lng: points[points.length - 1].lng },
        dataStatus: 'real',
      };

      const sendas = splitIntoSendas(miniTrack);
      const descentsList: DescentInfo[] = sendas
        .filter(s => s.name.startsWith('Descenso'))
        .map(s => ({
          id: s.id,
          name: s.name,
          trackName: s.trackName,
          distanceKm: s.distanceKm,
          elevationLoss: s.elevationLoss,
          elevationGain: s.elevationGain,
          midpoint: {
            lat: (s.bounds.minLat + s.bounds.maxLat) / 2,
            lng: (s.bounds.minLng + s.bounds.maxLng) / 2,
          },
        }));

      if (descentsList.length === 0) {
        // If no descents found, use the whole track as one
        const mid = Math.floor(points.length / 2);
        descentsList.push({
          id: `${track.id}-full`,
          name: track.name,
          trackName: track.name,
          distanceKm: 0,
          elevationLoss: 0,
          elevationGain: 0,
          midpoint: { lat: points[mid].lat, lng: points[mid].lng },
        });
      }

      setDescents(descentsList);
    } catch (e) {
      setError('Error al cargar los datos del track');
    }
  };

  // Calculate pressure for all descents
  const handleCalculateAll = async () => {
    if (descents.length === 0) return;
    setCalculating(true);
    setError('');
    setSelectedOnlyCalc(true);

    const results = new Map<string, { recommendation: PressureRecommendation; weather: any }>();

    for (const descent of descents) {
      try {
        const res = await fetch('/api/alerta-presion/calculate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profile,
            lat: descent.midpoint.lat,
            lng: descent.midpoint.lng,
            descent,
          }),
        });
        const data = await res.json();
        if (data.recommendation) {
          results.set(descent.id, { recommendation: data.recommendation, weather: data.weather });
        }
      } catch {}
    }

    setDescentResults(results);
    setCalculating(false);
  };

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
          wheel_front: profile.wheelFront,
          wheel_rear: profile.wheelRear,
          tire_model_front: profile.tireModelFront,
          tire_model_rear: profile.tireModelRear,
          tire_width_front_inch: profile.tireWidthFrontInch,
          tire_width_rear_inch: profile.tireWidthRearInch,
          initial_pressure_front_bar: profile.initialPressureFrontBar,
          initial_pressure_rear_bar: profile.initialPressureRearBar,
          tubeless: profile.tubeless,
        }),
      });
      setSaveStatus(res.ok ? 'saved' : 'error');
    } catch { setSaveStatus('error'); }
    setSaving(false);
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  const Select = ({ value, onChange, options }: { value: number; onChange: (v: number) => void; options: number[] }) => (
    <select value={value} onChange={e => onChange(Number(e.target.value))}
      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );

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
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Presión óptima para descensos técnicos</p>
            </div>
          </div>
          {!user && (
            <Link href="/auth"
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-bold transition-colors"
            >Iniciar sesión</Link>
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
            >Iniciar sesión / Registrarse</Link>
          </div>
        ) : (
          <>
            {/* ─── PERFIL ─── */}
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
                  >{saving ? 'Guardando...' : saveStatus === 'saved' ? '✓ Guardado' : 'Guardar'}</button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Peso ciclista */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Peso ciclista (kg)</label>
                  <Select value={profile.riderWeightKg} onChange={v => setProfile(p => ({ ...p, riderWeightKg: v }))}
                    options={Array.from({ length: 28 }, (_, i) => 68 + i)} />
                </div>
                {/* Peso bici */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Peso bicicleta (kg)</label>
                  <Select value={profile.bikeWeightKg} onChange={v => setProfile(p => ({ ...p, bikeWeightKg: v }))}
                    options={Array.from({ length: 15 }, (_, i) => 11 + i)} />
                </div>
                {/* Modelo bici */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Modelo bicicleta</label>
                  <select value={profile.bikeModel} onChange={e => {
                    const model = e.target.value;
                    const spec = BIKE_MODELS.find(m => m.name === model);
                    if (spec) {
                      setProfile({
                        ...profile,
                        bikeModel: model,
                        bikeWeightKg: spec.weightKg,
                        wheelFront: spec.wheelFront,
                        wheelRear: spec.wheelRear,
                        tireWidthFrontInch: spec.tireWidthFrontInch,
                        tireWidthRearInch: spec.tireWidthRearInch,
                        tireModelFront: spec.tireModelFront,
                        tireModelRear: spec.tireModelRear,
                        tubeless: spec.tubeless,
                      });
                    } else {
                      setProfile(p => ({ ...p, bikeModel: model }));
                    }
                  }}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
                  >
                    {BIKE_MODELS.map(m => (
                      <option key={m.name} value={m.name}>{m.name} ({m.year})</option>
                    ))}
                    <option value="">— Personalizado —</option>
                  </select>
                </div>
                {/* Rueda delantera */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Rueda delantera</label>
                  <select value={profile.wheelFront} onChange={e => setProfile(p => ({ ...p, wheelFront: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
                  >
                    <option value="29">29"</option>
                    <option value="27.5">27.5"</option>
                    <option value="26">26"</option>
                  </select>
                </div>
                {/* Rueda trasera */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Rueda trasera</label>
                  <select value={profile.wheelRear} onChange={e => setProfile(p => ({ ...p, wheelRear: e.target.value as any }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
                  >
                    <option value="29">29"</option>
                    <option value="27.5">27.5"</option>
                    <option value="26">26"</option>
                  </select>
                </div>
                {/* Ancho neumático del. (pulgadas) */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ancho neumático del. (")</label>
                  <select value={profile.tireWidthFrontInch} onChange={e => setProfile(p => ({ ...p, tireWidthFrontInch: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
                  >
                    {[2.1, 2.2, 2.3, 2.4, 2.5].map(v => <option key={v} value={v}>{v.toFixed(1)}"</option>)}
                  </select>
                </div>
                {/* Ancho neumático tras. (pulgadas) */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ancho neumático tras. (")</label>
                  <select value={profile.tireWidthRearInch} onChange={e => setProfile(p => ({ ...p, tireWidthRearInch: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
                  >
                    {[2.1, 2.2, 2.3, 2.4, 2.5].map(v => <option key={v} value={v}>{v.toFixed(1)}"</option>)}
                  </select>
                </div>
                {/* Presión inicial del. */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Presión inicial del. (bar)</label>
                  <input type="number" step="0.1" min="0.5" max="4" value={profile.initialPressureFrontBar}
                    onChange={e => setProfile(p => ({ ...p, initialPressureFrontBar: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {/* Presión inicial tras. */}
                <div>
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Presión inicial tras. (bar)</label>
                  <input type="number" step="0.1" min="0.5" max="4" value={profile.initialPressureRearBar}
                    onChange={e => setProfile(p => ({ ...p, initialPressureRearBar: Number(e.target.value) }))}
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {/* Tubeless */}
                <div className="flex items-center gap-3 pt-6">
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Tubeless</label>
                  <button onClick={() => setProfile(p => ({ ...p, tubeless: !p.tubeless }))}
                    className={`w-12 h-6 rounded-full transition-colors ${profile.tubeless ? 'bg-orange-500' : 'bg-slate-700'}`}
                  >
                    <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${profile.tubeless ? 'translate-x-6' : 'translate-x-0.5'}`} />
                  </button>
                </div>
              </div>
            </section>

            {/* ─── SELECCIÓN DE RUTA ─── */}
            <section className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-bold text-white">Calculadora de presión para descensos</h2>
              </div>

              {/* Selector de ruta */}
              <div className="mb-4">
                <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Elige una ruta</label>
                <select value={selectedTrackId || ''} onChange={e => handleTrackSelect(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
                >
                  <option value="">Selecciona una ruta...</option>
                  {allTracks.filter(t => t.sector).sort((a, b) => a.sector.localeCompare(b.sector)).map(t => (
                    <option key={t.id} value={t.id}>{t.name} — {t.sector}</option>
                  ))}
                </select>
              </div>

              {/* Descensos detectados */}
              {descents.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-[11px] text-slate-400 font-bold">
                    {descents.length} descenso{descents.length !== 1 ? 's' : ''} detectado{descents.length !== 1 ? 's' : ''}
                  </p>
                  {descents.map(d => (
                    <div key={d.id} className="flex items-center justify-between px-3 py-2 bg-slate-950/50 border border-white/5 rounded-lg">
                      <div>
                        <span className="text-xs font-bold text-white">{d.name}</span>
                        <span className="text-[10px] text-slate-500 ml-2">{d.distanceKm.toFixed(1)} km · -{d.elevationLoss}m</span>
                      </div>
                      {descentResults.has(d.id) && (
                        <span className="text-[10px] text-orange-400 font-bold">
                          {descentResults.get(d.id)!.recommendation.recommendedFrontBar.toFixed(1)} bar
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">{error}</div>
              )}

              {/* Botón calcular */}
              {descents.length > 0 && (
                <button onClick={handleCalculateAll} disabled={calculating}
                  className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                >
                  {calculating ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Calculando presión con AEMET...</>
                  ) : (
                    <><Gauge className="w-4 h-4" /> Calcular presión para {descents.length} descenso{descents.length !== 1 ? 's' : ''}</>
                  )}
                </button>
              )}

              {/* ─── RESULTADOS ─── */}
              {selectedOnlyCalc && descentResults.size > 0 && (() => {
                // Compute average of all descent recommendations
                const values = Array.from(descentResults.values());
                const avgFrontBar = values.reduce((s, v) => s + v.recommendation.recommendedFrontBar, 0) / values.length;
                const avgRearBar  = values.reduce((s, v) => s + v.recommendation.recommendedRearBar, 0) / values.length;
                const avgFrontPsi = values.reduce((s, v) => s + v.recommendation.recommendedFrontPsi, 0) / values.length;
                const avgRearPsi  = values.reduce((s, v) => s + v.recommendation.recommendedRearPsi, 0) / values.length;
                const firstWeather = values[0]?.weather;

                return (
                <div className="mt-6 space-y-6">
                  {/* ─── PROMEDIO GENERAL ─── */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-orange-500/20 rounded-2xl p-6 shadow-lg shadow-orange-500/5">
                    <div className="flex items-center gap-2 mb-4">
                      <TrendingDown className="w-5 h-5 text-orange-500" />
                      <h2 className="text-sm font-bold text-white">Presión media recomendada</h2>
                    </div>

                    {firstWeather && (
                      <div className="flex items-center gap-3 mb-4 text-[10px] text-slate-400 bg-slate-950/50 rounded-lg px-3 py-2">
                        <span className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-orange-400" /> {firstWeather.temperatureC}°C</span>
                        <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-400" /> {firstWeather.humidityPct}% HR</span>
                        <span className="text-slate-600">{descents.length} descenso{descents.length !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 bg-slate-950/60 border border-white/5 rounded-xl">
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Delantera</p>
                        <p className="text-5xl font-black text-orange-500">{avgFrontBar.toFixed(1)}</p>
                        <p className="text-xs text-slate-400 mt-1">{Math.round(avgFrontPsi)} PSI</p>
                      </div>
                      <div className="text-center p-4 bg-slate-950/60 border border-white/5 rounded-xl">
                        <p className="text-[9px] text-slate-500 uppercase tracking-widest mb-2">Trasera</p>
                        <p className="text-5xl font-black text-orange-500">{avgRearBar.toFixed(1)}</p>
                        <p className="text-xs text-slate-400 mt-1">{Math.round(avgRearPsi)} PSI</p>
                      </div>
                    </div>
                  </div>

                  {/* ─── POR CADA DESCENSO ─── */}
                  {descents.map(descent => {
                    const result = descentResults.get(descent.id);
                    if (!result) return null;
                    const { recommendation, weather } = result;
                    return (
                      <div key={descent.id} className="bg-slate-950/60 border border-white/5 rounded-2xl p-5">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-bold text-white">{descent.name}</h3>
                          <span className="text-[10px] text-slate-500">{descent.distanceKm.toFixed(1)} km · -{descent.elevationLoss}m</span>
                        </div>

                        {/* Weather */}
                        {weather && (
                          <div className="flex items-center gap-3 mb-4 text-[10px] text-slate-400 bg-slate-950/50 rounded-lg px-3 py-2">
                            <span className="flex items-center gap-1"><Thermometer className="w-3 h-3 text-orange-400" /> {weather.temperatureC}°C</span>
                            <span className="flex items-center gap-1"><Droplets className="w-3 h-3 text-blue-400" /> {weather.humidityPct}% HR</span>
                          </div>
                        )}

                        {/* Pressure comparison */}
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-slate-950/40 rounded-xl border border-white/5">
                            <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Delantera</p>
                            <div className="flex items-center justify-center gap-3">
                              <div>
                                <p className="text-[8px] text-slate-600">Actual</p>
                                <p className="text-lg font-black text-slate-500">{recommendation.currentFrontBar.toFixed(1)}</p>
                                <p className="text-[9px] text-slate-600">{recommendation.currentFrontPsi} PSI</p>
                              </div>
                              <span className="text-orange-500 text-lg">→</span>
                              <div>
                                <p className="text-[8px] text-orange-400">Recomendada</p>
                                <p className="text-2xl font-black text-orange-500">{recommendation.recommendedFrontBar.toFixed(1)}</p>
                                <p className="text-[9px] text-slate-400">{recommendation.recommendedFrontPsi} PSI</p>
                              </div>
                            </div>
                          </div>
                          <div className="text-center p-3 bg-slate-950/40 rounded-xl border border-white/5">
                            <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">Trasera</p>
                            <div className="flex items-center justify-center gap-3">
                              <div>
                                <p className="text-[8px] text-slate-600">Actual</p>
                                <p className="text-lg font-black text-slate-500">{recommendation.currentRearBar.toFixed(1)}</p>
                                <p className="text-[9px] text-slate-600">{recommendation.currentRearPsi} PSI</p>
                              </div>
                              <span className="text-orange-500 text-lg">→</span>
                              <div>
                                <p className="text-[8px] text-orange-400">Recomendada</p>
                                <p className="text-2xl font-black text-orange-500">{recommendation.recommendedRearBar.toFixed(1)}</p>
                                <p className="text-[9px] text-slate-400">{recommendation.recommendedRearPsi} PSI</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 text-[9px] text-slate-500 leading-relaxed">{recommendation.reason}</p>
                      </div>
                    );
                  })}
                </div>
              )})()}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
