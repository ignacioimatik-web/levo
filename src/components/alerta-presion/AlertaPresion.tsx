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
  const [profileName, setProfileName] = useState('Mi perfil');
  const [savedProfiles, setSavedProfiles] = useState<any[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
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
  const [profileExpanded, setProfileExpanded] = useState(true);

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

  // Load ALL profiles for the user
  const loadProfiles = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/alerta-presion/profile');
      const data = await res.json();
      if (data.profiles && data.profiles.length > 0) {
        setSavedProfiles(data.profiles);
        // Auto-select the first one
        selectProfile(data.profiles[0]);
      } else {
        setSavedProfiles([]);
        setProfile({ ...DEFAULT_PROFILE });
        setProfileName('Mi perfil');
        setSelectedProfileId(null);
      }
      setProfileLoaded(true);
    } catch { setProfileLoaded(true); }
  }, [user]);

  const selectProfile = (p: any) => {
    setSelectedProfileId(p.id);
    setProfileName(p.profile_name || 'Mi perfil');
    setProfile({
      riderWeightKg: p.rider_weight_kg,
      bikeWeightKg: p.bike_weight_kg,
      bikeModel: p.bike_model || '',
      wheelFront: p.wheel_front || '27.5',
      wheelRear: p.wheel_rear || '27.5',
      tireModelFront: p.tire_model_front || '',
      tireModelRear: p.tire_model_rear || '',
      tireWidthFrontInch: p.tire_width_front_inch || 2.3,
      tireWidthRearInch: p.tire_width_rear_inch || 2.3,
      initialPressureFrontBar: p.initial_pressure_front_bar || 1.8,
      initialPressureRearBar: p.initial_pressure_rear_bar || 2.0,
      tubeless: p.tubeless ?? true,
    });
  };

  useEffect(() => { if (user) loadProfiles(); else { setProfileLoaded(true); setSavedProfiles([]); } }, [user, loadProfiles]);

  // Load tracks list
  useEffect(() => {
    fetch('/api/forfait/tracks-list').then(r => r.json()).then(data => {
      if (data.tracks) setAllTracks(data.tracks);
    }).catch(() => {});
  }, []);

  // Handle track selection -> extract descents
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

  // Calculate pressure for first descent only (all are representative)
  const handleCalculateAll = async () => {
    if (descents.length === 0) return;
    setCalculating(true);
    setError('');
    setSelectedOnlyCalc(true);
    setProfileExpanded(false); // collapse profile to make room for results

    const results = new Map<string, { recommendation: PressureRecommendation; weather: any }>();
    // Only calculate for the first descent - results are representative of all
    for (let i = 0; i < Math.min(descents.length, 1); i++) {
      const descent = descents[i];
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

  // Save profile (creates new or updates existing)
  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const isUpdate = !!selectedProfileId;
      const res = await fetch(`/api/alerta-presion/profile${isUpdate ? `?id=${selectedProfileId}` : ''}`, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_name: profileName,
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
      if (res.ok) {
        setSaveStatus('saved');
        await loadProfiles(); // Reload the list
      } else {
        setSaveStatus('error');
      }
    } catch { setSaveStatus('error'); }
    setSaving(false);
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  // Delete profile
  const handleDeleteProfile = async (id: string) => {
    if (!confirm('¿Eliminar este perfil?')) return;
    try {
      await fetch(`/api/alerta-presion/profile?id=${id}`, { method: 'DELETE' });
      if (selectedProfileId === id) {
        setProfile({ ...DEFAULT_PROFILE });
        setProfileName('Mi perfil');
        setSelectedProfileId(null);
      }
      await loadProfiles();
    } catch {}
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
            {/* PERFIL (colapsable) */}
            <details open={profileExpanded} className="bg-slate-900/40 border border-white/5 rounded-2xl">
              <summary className="flex items-center gap-2 p-6 cursor-pointer text-slate-400 hover:text-white transition-colors list-none">
                <Bike className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-bold text-white">Perfil del ciclista</h2>
                <span className="ml-auto text-[9px] text-slate-600">
                  {profileExpanded ? 'Contraer' : 'Expandir'}
                </span>
                <svg className={`w-3 h-3 text-slate-600 transition-transform ${profileExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-6 space-y-4">

              {/* Selector de perfil guardado */}
              {savedProfiles.length > 0 && (
                <div className="mb-4">
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Perfiles guardados</label>
                  <div className="flex items-center gap-2">
                    <select value={selectedProfileId || ''} onChange={e => {
                      const p = savedProfiles.find(sp => sp.id === e.target.value);
                      if (p) selectProfile(p);
                    }}
                      className="flex-1 bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
                    >
                      {savedProfiles.map(p => (
                        <option key={p.id} value={p.id}>{p.profile_name || 'Sin nombre'}</option>
                      ))}
                    </select>
                    <button onClick={() => handleDeleteProfile(selectedProfileId!)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-xs"
                      title="Eliminar perfil"
                    >🗑️</button>
                    <button onClick={() => { setProfile({ ...DEFAULT_PROFILE }); setProfileName('Mi perfil'); setSelectedProfileId(null); }}
                      className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-xs"
                      title="Nuevo perfil"
                    >➕</button>
                  </div>
                </div>
              )}

              {/* Nombre del perfil y botón guardar */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Nombre del perfil</label>
                  <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                    placeholder="Ej: Enduro con Turbo Levo"
                    className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40"
                  />
                </div>
                {profileLoaded && (
                  <button onClick={handleSaveProfile} disabled={saving}
                    className={`mt-5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                      saveStatus === 'saved' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : selectedProfileId
                        ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20'
                        : 'bg-orange-500/10 text-orange-400 border border-orange-500/25 hover:bg-orange-500/20'
                    }`}
                  >
                    {saving ? 'Guardando...' : saveStatus === 'saved' ? '✓ Guardado' : selectedProfileId ? 'Actualizar' : 'Guardar nuevo'}
                  </button>
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
            </div>
            </details>

            {/* CALCULADORA COMPACTA (SEGUNDO PLANO) */}
            <section className="bg-slate-900/20 border border-white/5 rounded-2xl p-5">
              <details open={descentResults.size === 0}>
                <summary className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white transition-colors list-none">
                  <AlertTriangle className="w-4 h-4 text-orange-500/70" />
                  <span className="text-xs font-bold uppercase tracking-widest">Calculadora de presión</span>
                  <span className="ml-auto text-[9px] text-slate-600">
                    {selectedTrackId ? 'Ruta seleccionada' : 'Elige una ruta'}
                  </span>
                  <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-4 space-y-3">

                  {/* Selector de ruta */}
                  <div>
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ruta</label>
                    <select value={selectedTrackId || ''} onChange={e => handleTrackSelect(e.target.value)}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
                    >
                      <option value="">Selecciona una ruta...</option>
                      {allTracks.filter(t => t.sector).sort((a, b) => a.sector.localeCompare(b.sector)).map(t => (
                        <option key={t.id} value={t.id}>{t.name} — {t.sector}</option>
                      ))}
                    </select>
                  </div>

                  {error && (
                    <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400">{error}</div>
                  )}

                  {selectedTrackId && descents.length > 0 && (
                    <div className="text-[10px] text-slate-500 bg-slate-950/30 rounded-lg px-3 py-2">
                      {descents.length} descenso{descents.length !== 1 ? 's' : ''} detectado{descents.length !== 1 ? 's' : ''}
                      {' — la presión se calcula para la primera zona representativa'}
                    </div>
                  )}

                  {/* Botón calcular */}
                  {descents.length > 0 && (
                    <button onClick={handleCalculateAll} disabled={calculating}
                      className="w-full py-2.5 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
                    >
                      {calculating ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando AEMET y calculando presión...</>
                      ) : (
                        <><Gauge className="w-3.5 h-3.5" /> Calcular presión recomendada</>
                      )}
                    </button>
                  )}
                </div>
              </details>
            </section>

            {/* RESULTADOS */}
            {selectedOnlyCalc && descentResults.size > 0 && (() => {
              const values = Array.from(descentResults.values());
              const avgFrontBar = values.reduce((s, v) => s + v.recommendation.recommendedFrontBar, 0) / values.length;
              const avgRearBar  = values.reduce((s, v) => s + v.recommendation.recommendedRearBar, 0) / values.length;
              const avgFrontPsi = values.reduce((s, v) => s + v.recommendation.recommendedFrontPsi, 0) / values.length;
              const avgRearPsi  = values.reduce((s, v) => s + v.recommendation.recommendedRearPsi, 0) / values.length;
              const weather = values[0]?.weather;
              const firstRec = values[0]?.recommendation;

              // Weather severity
              const isSevere = weather?.windKmh && weather.windKmh >= 45;
              const hasRain = weather?.precipitationMm && weather.precipitationMm > 0;
              const weatherBadge = isSevere
                ? { label: 'Condiciones adversas', color: 'text-red-400', bg: 'border-red-500/20 bg-red-500/5' }
                : hasRain
                  ? { label: 'Lluvia ligera', color: 'text-yellow-400', bg: 'border-yellow-500/20 bg-yellow-500/5' }
                  : { label: 'Favorable', color: 'text-green-400', bg: 'border-green-500/20 bg-green-500/5' };

              function AnimatedTire({ side }: { side: 'front' | 'rear' }) {
                const pulseSpeed = side === 'front' ? '3s' : '3.4s';
                const delay = side === 'front' ? '0s' : '0.5s';
                return (
                  <>
                    <style>{`
                      @keyframes tire-breathe-${side} {
                        0%, 100% { transform: scale(1) rotate(0deg); }
                        30% { transform: scale(1.06) rotate(3deg); }
                        55% { transform: scale(0.96) rotate(-1deg); }
                        80% { transform: scale(1.03) rotate(1deg); }
                      }
                      @keyframes knob-pop-${side} {
                        0%, 100% { opacity: 0.5; transform: scale(0.7); }
                        50% { opacity: 1; transform: scale(1.3); }
                      }
                      @keyframes rim-spin-${side} {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                      }
                      .tire-breathe-${side} {
                        animation: tire-breathe-${side} ${pulseSpeed} ease-in-out infinite;
                        transform-origin: center;
                        animation-delay: ${delay};
                      }
                      .knob-${side} {
                        animation: knob-pop-${side} 2s ease-in-out infinite;
                        animation-delay: ${delay};
                      }
                      .knob-${side}:nth-child(2n) { animation-delay: ${delay + 0.3}s; }
                      .knob-${side}:nth-child(3n) { animation-delay: ${delay + 0.6}s; }
                      .spoke-${side} {
                        animation: rim-spin-${side} 8s linear infinite;
                        transform-origin: 60px 60px;
                        animation-delay: ${delay};
                      }
                    `}</style>
                    <svg viewBox="0 0 120 120" className="w-20 h-20 md:w-24 md:h-24 mx-auto">
                      <g className={`tire-breathe-${side}`}>
                        {/* Outer tire carcass */}
                        <circle cx="60" cy="60" r="48" fill="none" stroke="#334155" strokeWidth="10" />
                        {/* Inner tire wall highlight */}
                        <circle cx="60" cy="60" r="43" fill="none" stroke="#1e293b" strokeWidth="1.5" />
                        {/* Tire sidewall subtle line */}
                        <circle cx="60" cy="60" r="39" fill="none" stroke="#475569" strokeWidth="0.5" strokeDasharray="3 3" />
                        {/* Tread knobs around perimeter */}
                        {Array.from({ length: 14 }).map((_, i) => {
                          const angle = (i * (360 / 14) * Math.PI) / 180;
                          const x = 60 + 48 * Math.cos(angle);
                          const y = 60 + 48 * Math.sin(angle);
                          return (
                            <circle key={i} cx={x} cy={y} r="4" fill="#475569" className={`knob-${side}`} />
                          );
                        })}
                        {/* Rim */}
                        <circle cx="60" cy="60" r="28" fill="none" stroke="#64748b" strokeWidth="3" />
                        <circle cx="60" cy="60" r="26" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
                        {/* Spokes */}
                        <g className={`spoke-${side}`}>
                          {Array.from({ length: 6 }).map((_, i) => {
                            const angle = (i * 60 * Math.PI) / 180;
                            const x1 = 60 + 8 * Math.cos(angle);
                            const y1 = 60 + 8 * Math.sin(angle);
                            const x2 = 60 + 28 * Math.cos(angle);
                            const y2 = 60 + 28 * Math.sin(angle);
                            return (
                              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#64748b" strokeWidth="1.5" />
                            );
                          })}
                        </g>
                        {/* Hub */}
                        <circle cx="60" cy="60" r="8" fill="#94a3b8" />
                        <circle cx="60" cy="60" r="4" fill="#cbd5e1" />
                        {/* Air pressure indicator dots inside */}
                        <circle cx="60" cy="36" r="1.5" fill="#f97316" className={`knob-${side}`} style={{ animationDelay: delay }} />
                        <circle cx="72" cy="48" r="1" fill="#fb923c" className={`knob-${side}`} style={{ animationDelay: `${delay + 0.4}s` }} />
                        <circle cx="72" cy="68" r="1.2" fill="#f97316" className={`knob-${side}`} style={{ animationDelay: `${delay + 0.8}s` }} />
                        <circle cx="60" cy="80" r="1.5" fill="#fb923c" className={`knob-${side}`} style={{ animationDelay: `${delay + 0.2}s` }} />
                        <circle cx="46" cy="72" r="1" fill="#f97316" className={`knob-${side}`} style={{ animationDelay: `${delay + 0.6}s` }} />
                        <circle cx="46" cy="48" r="1.2" fill="#fb923c" className={`knob-${side}`} style={{ animationDelay: `${delay + 1.0}s` }} />
                      </g>
                    </svg>
                  </>
                );
              }

              return (
                <div className="space-y-6">

                  {/* PRESION RECOMENDADA (HERO) */}
                  <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/30 border border-orange-500/30 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 text-center">
                    <div className="flex items-center justify-center gap-2 text-orange-500 mb-2">
                      <TrendingDown className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Presión recomendada</span>
                    </div>

                    <div className="grid grid-cols-2 gap-8 max-w-lg mx-auto mt-6">
                      {/* Delantera */}
                      <div>
                        <AnimatedTire side="front" />
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold mt-3">Delantera</p>
                        <p className="text-7xl md:text-8xl font-black text-orange-500 leading-none tracking-tighter">
                          {avgFrontBar.toFixed(1)}
                        </p>
                        <p className="text-sm text-slate-400 mt-2">
                          <span className="text-base font-bold text-white">{Math.round(avgFrontPsi)}</span> PSI
                        </p>
                        <p className="text-[10px] text-slate-600 mt-1">
                          ({firstRec.currentFrontBar.toFixed(1)} bar actual)
                        </p>
                      </div>
                      {/* Trasera */}
                      <div>
                        <AnimatedTire side="rear" />
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-2 font-bold mt-3">Trasera</p>
                        <p className="text-7xl md:text-8xl font-black text-orange-500 leading-none tracking-tighter">
                          {avgRearBar.toFixed(1)}
                        </p>
                        <p className="text-sm text-slate-400 mt-2">
                          <span className="text-base font-bold text-white">{Math.round(avgRearPsi)}</span> PSI
                        </p>
                        <p className="text-[10px] text-slate-600 mt-1">
                          ({firstRec.currentRearBar.toFixed(1)} bar actual)
                        </p>
                      </div>
                    </div>

                    {firstRec && (
                      <p className="mt-6 text-[11px] text-slate-500 leading-relaxed max-w-lg mx-auto">
                        {firstRec.reason}
                      </p>
                    )}
                  </div>

                  {/* RUTA SELECCIONADA */}
                  {(() => {
                    const track = allTracks.find(t => t.id === selectedTrackId);
                    if (!track) return null;
                    const totalLoss = descents.reduce((s, d) => s + d.elevationLoss, 0);
                    const totalDist = descents.reduce((s, d) => s + d.distanceKm, 0);
                    return (
                      <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                          <svg className="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                          </svg>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Ruta seleccionada</span>
                        </div>
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h3 className="text-base font-bold text-white">{track.name}</h3>
                            <p className="text-[11px] text-slate-500">{track.sector}</p>
                          </div>
                          <div className="flex items-center gap-4 text-[10px] text-slate-400">
                            <span>{descents.length} descenso{descents.length !== 1 ? 's' : ''}</span>
                            {totalDist > 0 && <span>{totalDist.toFixed(1)} km</span>}
                            {totalLoss > 0 && <span>-{totalLoss} m</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* DATOS METEOROLOGICOS (PROMINENTES) */}
                  {weather && (
                    <div className={`border rounded-2xl p-6 ${weatherBadge.bg}`}>
                      <div className="flex items-center gap-2 mb-5">
                        <Thermometer className={`w-5 h-5 ${weatherBadge.color}`} />
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-300">Meteo en la ruta</span>
                        <span className={`ml-auto text-[10px] font-bold uppercase ${weatherBadge.color}`}>
                          {weatherBadge.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div className="text-center p-4 bg-slate-950/50 rounded-xl border border-white/5">
                          <Thermometer className="w-5 h-5 text-orange-400 mx-auto mb-2" />
                          <p className="text-3xl font-black text-white">{weather.temperatureC}°</p>
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Temperatura</p>
                        </div>
                        <div className="text-center p-4 bg-slate-950/50 rounded-xl border border-white/5">
                          <Droplets className="w-5 h-5 text-blue-400 mx-auto mb-2" />
                          <p className="text-3xl font-black text-white">{weather.humidityPct}%</p>
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Humedad</p>
                        </div>
                        <div className="text-center p-4 bg-slate-950/50 rounded-xl border border-white/5">
                          <svg className="w-5 h-5 text-cyan-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                          </svg>
                          <p className="text-3xl font-black text-white">{weather.precipitationMm ?? 0} mm</p>
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Precipitación</p>
                        </div>
                        <div className="text-center p-4 bg-slate-950/50 rounded-xl border border-white/5">
                          <svg className="w-5 h-5 text-emerald-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                          </svg>
                          <p className="text-3xl font-black text-white">{weather.windKmh ?? '—'}</p>
                          <p className="text-[9px] text-slate-500 uppercase tracking-widest mt-1">Viento km/h</p>
                        </div>
                      </div>

                      {weather.stationName && (
                        <div className="mt-4 text-[10px] text-slate-600 bg-slate-950/30 rounded-lg px-3 py-2 text-center">
                          Datos de estación {weather.stationName}
                          {weather.stationDistanceKm && <> · a {weather.stationDistanceKm} km</>}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Nota informativa */}
                  <div className="text-center">
                    <p className="text-[10px] text-slate-600">
                      Presión calculada para el primer descenso de la ruta — los resultados son representativos
                      para todos los descensos de la misma zona.
                    </p>
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
