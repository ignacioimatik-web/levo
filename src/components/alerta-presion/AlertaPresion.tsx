'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { User } from '@supabase/supabase-js';
import type { BikeProfile, PressureRecommendation } from '@/lib/alerta-presion/types';
import { Loader2, Gauge, Thermometer, Droplets, Bike, AlertTriangle, TrendingDown, MapPin, Mountain } from 'lucide-react';
import Link from 'next/link';
import { BIKE_MODELS } from '@/lib/alerta-presion/bike-models';
import type { BikeModelSpec } from '@/lib/alerta-presion/bike-models';

// Sector definitions with representative weather coordinates
const SECTORS: Array<{ id: string; name: string; description: string; image: string; lat: number; lng: number }> = [
  { id: 'bergantes', name: 'Bergantes', description: 'El río Bergantes y sus espectaculares muelas.', image: 'https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=1000', lat: 40.62, lng: -0.10 },
  { id: 'celumbres', name: 'Celumbres', description: 'Un abismo entre Cinctorres y Castellfort.', image: 'https://images.unsplash.com/photo-1575548393466-0df1618ba410?auto=format&fit=crop&q=80&w=1000', lat: 40.56, lng: -0.03 },
  { id: 'el-riu-de-les-corces', name: 'El Riu de les Corces', description: 'El valle de Mundo Perdido.', image: 'https://images.unsplash.com/photo-1568991004407-cdd5d0930945?auto=format&fit=crop&q=80&w=1000', lat: 40.58, lng: 0.05 },
  { id: 'peter-rules', name: 'Peter Rules', description: 'Bosques de gran calidad y orografía quebrada.', image: 'https://images.unsplash.com/photo-1633707167682-9068729bc84c?auto=format&fit=crop&q=80&w=1000', lat: 40.60, lng: -0.07 },
  { id: 'torre-miro-xiva', name: 'Torre Miró - Xiva', description: 'Un valle de orfebrería de roca y bosque.', image: 'https://images.unsplash.com/photo-1604748954134-457791b2ce9b?auto=format&fit=crop&q=80&w=1000', lat: 40.55, lng: -0.08 },
];

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
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [result, setResult] = useState<{ recommendation: PressureRecommendation; weather: any } | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');
  const [profileExpanded, setProfileExpanded] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState('');

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
      setProfileLoadError('');
      const supabase = createClient();
      const { data: { user: freshUser }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !freshUser) {
        setProfileLoadError(userErr?.message || 'No autenticado');
        setSavedProfiles([]);
        setProfileLoaded(true);
        return;
      }
      const { data, error } = await supabase.rpc('get_my_bike_profiles');
      if (error) {
        setProfileLoadError(`${error.message} (code: ${error.code})`);
        setSavedProfiles([]);
      } else if (data && data.length > 0) {
        setSavedProfiles(data);
        selectProfile(data[0]);
      } else {
        setSavedProfiles([]);
        setProfile({ ...DEFAULT_PROFILE });
        setProfileName('Mi perfil');
        setSelectedProfileId(null);
      }
      setProfileLoaded(true);
    } catch (e: any) {
      setProfileLoadError(e?.message || 'Error al cargar perfiles');
      setProfileLoaded(true);
    }
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

  // Calculate pressure for selected sector
  const handleCalculate = async () => {
    if (!selectedSector) return;
    setCalculating(true);
    setError('');
    setResult(null);
    setProfileExpanded(false);
    try {
      const sector = SECTORS.find(s => s.id === selectedSector);
      if (!sector) { setError('Sector no encontrado'); setCalculating(false); return; }
      const res = await fetch('/api/alerta-presion/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile,
          lat: sector.lat,
          lng: sector.lng,
          descent: {
            id: sector.id,
            name: sector.name,
            trackName: sector.name,
            distanceKm: 0,
            elevationLoss: 0,
            elevationGain: 0,
            midpoint: { lat: sector.lat, lng: sector.lng },
          },
        }),
      });
      const data = await res.json();
      if (data.recommendation) {
        setResult({ recommendation: data.recommendation, weather: data.weather });
      } else {
        setError('Error al calcular presión');
      }
    } catch { setError('Error de conexión'); }
    setCalculating(false);
  };

  // Save profile
  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      const supabase = createClient();
      const payload = {
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
      };
      let result;
      if (selectedProfileId) {
        result = await supabase.rpc('update_bike_profile', {
          p_id: selectedProfileId,
          p_profile_name: payload.profile_name,
          p_rider_weight_kg: payload.rider_weight_kg,
          p_bike_weight_kg: payload.bike_weight_kg,
          p_bike_model: payload.bike_model,
          p_wheel_front: payload.wheel_front,
          p_wheel_rear: payload.wheel_rear,
          p_tire_model_front: payload.tire_model_front,
          p_tire_model_rear: payload.tire_model_rear,
          p_tire_width_front_inch: payload.tire_width_front_inch,
          p_tire_width_rear_inch: payload.tire_width_rear_inch,
          p_initial_pressure_front_bar: payload.initial_pressure_front_bar,
          p_initial_pressure_rear_bar: payload.initial_pressure_rear_bar,
          p_tubeless: payload.tubeless,
        });
      } else {
        result = await supabase.rpc('insert_bike_profile', {
          p_profile_name: payload.profile_name,
          p_rider_weight_kg: payload.rider_weight_kg,
          p_bike_weight_kg: payload.bike_weight_kg,
          p_bike_model: payload.bike_model,
          p_wheel_front: payload.wheel_front,
          p_wheel_rear: payload.wheel_rear,
          p_tire_model_front: payload.tire_model_front,
          p_tire_model_rear: payload.tire_model_rear,
          p_tire_width_front_inch: payload.tire_width_front_inch,
          p_tire_width_rear_inch: payload.tire_width_rear_inch,
          p_initial_pressure_front_bar: payload.initial_pressure_front_bar,
          p_initial_pressure_rear_bar: payload.initial_pressure_rear_bar,
          p_tubeless: payload.tubeless,
        });
      }
      if (result.error) {
        setSaveStatus('error');
      } else if (result.data && Array.isArray(result.data) && result.data.length > 0) {
        setSaveStatus('saved');
        setSelectedProfileId(result.data[0].id);
        await loadProfiles();
      } else if (result.data && !Array.isArray(result.data)) {
        setSaveStatus('saved');
        setSelectedProfileId(result.data.id);
        await loadProfiles();
      } else {
        setSaveStatus('saved');
        await loadProfiles();
      }
    } catch { setSaveStatus('error'); }
    setSaving(false);
    setTimeout(() => setSaveStatus('idle'), 3000);
  };

  // Delete profile
  const handleDeleteProfile = async (id: string) => {
    if (!confirm('¿Eliminar este perfil?')) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc('delete_bike_profile', { p_id: id });
      if (error) console.error('Delete profile error:', error);
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

  // Weather severity helper
  const getWeatherBadge = (weather: any) => {
    const isSevere = weather?.windKmh && weather.windKmh >= 45;
    const hasRain = weather?.precipitationMm && weather.precipitationMm > 0;
    if (isSevere) return { label: 'Condiciones adversas', color: 'text-red-400', bg: 'border-red-500/20 bg-red-500/5' };
    if (hasRain) return { label: 'Lluvia ligera', color: 'text-yellow-400', bg: 'border-yellow-500/20 bg-yellow-500/5' };
    return { label: 'Favorable', color: 'text-green-400', bg: 'border-green-500/20 bg-green-500/5' };
  };

  // Animated tire SVG component
  function AnimatedTire({ side, compact }: { side: 'front' | 'rear'; compact?: boolean }) {
    const pulseSpeed = side === 'front' ? '3s' : '3.4s';
    const delay = side === 'front' ? '0s' : '0.5s';
    const size = compact ? 'w-20 h-20 md:w-28 md:h-28' : 'w-20 h-20 md:w-24 md:h-24';
    return (
      <>
        <style>{`
          @keyframes tire-breathe-${side} {
            0%, 100% { transform: scale(1) rotate(0deg); }
            30% { transform: scale(1.06) rotate(3deg); }
            55% { transform: scale(0.96) rotate(-1deg); }
            80% { transform: scale(1.03) rotate(1deg); }
          }
          @keyframes tknob-pop-${side} {
            0%, 100% { opacity: 0.4; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          @keyframes tspoke-spin-${side} {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          .tire-breathe-${side} {
            animation: tire-breathe-${side} ${pulseSpeed} ease-in-out infinite;
            transform-origin: center; animation-delay: ${delay};
          }
          .tknob-${side} {
            animation: tknob-pop-${side} 2s ease-in-out infinite;
            animation-delay: ${delay}; transform-origin: center;
          }
          .tknob-${side}:nth-child(2n) { animation-delay: ${delay + 0.25}s; }
          .tknob-${side}:nth-child(3n) { animation-delay: ${delay + 0.5}s; }
          .tspoke-${side} {
            animation: tspoke-spin-${side} 8s linear infinite;
            transform-origin: 60px 60px; animation-delay: ${delay};
          }
        `}</style>
        <svg viewBox="0 0 120 120" className={`${size} flex-shrink-0`}>
          <g className={`tire-breathe-${side}`}>
            <circle cx="60" cy="60" r="48" fill="none" stroke="#334155" strokeWidth="8" />
            <circle cx="60" cy="60" r="44" fill="none" stroke="#1e293b" strokeWidth="1" />
            <circle cx="60" cy="60" r="40" fill="none" stroke="#475569" strokeWidth="0.5" strokeDasharray="2 4" />
            {Array.from({ length: 18 }).map((_, i) => {
              const angle = (i * (360 / 18) * Math.PI) / 180;
              const rOuter = 48, rInner = 44;
              const midX = 60 + ((rOuter + rInner) / 2) * Math.cos(angle);
              const midY = 60 + ((rOuter + rInner) / 2) * Math.sin(angle);
              const rot = (i * (360 / 18));
              const isBig = i % 2 === 0;
              return (
                <g key={i} className={`tknob-${side}`} style={{ transformOrigin: `${midX}px ${midY}px` }}>
                  <rect x={isBig ? midX - 3.5 : midX - 2.5} y={isBig ? midY - 6 : midY - 4.5}
                    width={isBig ? 7 : 5} height={isBig ? 10 : 7} rx="1"
                    fill={isBig ? '#52525b' : '#3f3f46'}
                    transform={`rotate(${rot}, ${midX}, ${midY})`} />
                </g>
              );
            })}
            <circle cx="60" cy="60" r="28" fill="none" stroke="#64748b" strokeWidth="2.5" />
            <circle cx="60" cy="60" r="27" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
            <g className={`tspoke-${side}`}>
              {Array.from({ length: 12 }).map((_, i) => {
                const angle = (i * 30 * Math.PI) / 180;
                return (
                  <line key={i} x1={60 + 7 * Math.cos(angle)} y1={60 + 7 * Math.sin(angle)}
                    x2={60 + 27.5 * Math.cos(angle)} y2={60 + 27.5 * Math.sin(angle)}
                    stroke="#64748b" strokeWidth="0.8" />
                );
              })}
            </g>
            <circle cx="60" cy="60" r="14" fill="none" stroke="#52525b" strokeWidth="1" strokeDasharray="3 2" />
            <circle cx="60" cy="60" r="12" fill="none" stroke="#52525b" strokeWidth="0.5" />
            <circle cx="60" cy="60" r="7" fill="#71717a" />
            <circle cx="60" cy="60" r="4" fill="#a1a1aa" />
            <circle cx="60" cy="60" r="2" fill="#d4d4d8" />
            <circle cx="60" cy="34" r="1.5" fill="#f97316" className={`tknob-${side}`} style={{ animationDelay: delay }} />
            <circle cx="73" cy="48" r="1" fill="#fb923c" className={`tknob-${side}`} style={{ animationDelay: `${delay + 0.3}s` }} />
            <circle cx="74" cy="66" r="1.2" fill="#f97316" className={`tknob-${side}`} style={{ animationDelay: `${delay + 0.6}s` }} />
            <circle cx="62" cy="80" r="1.5" fill="#fb923c" className={`tknob-${side}`} style={{ animationDelay: `${delay + 0.15}s` }} />
            <circle cx="44" cy="70" r="1" fill="#f97316" className={`tknob-${side}`} style={{ animationDelay: `${delay + 0.45}s` }} />
            <circle cx="46" cy="46" r="1.2" fill="#fb923c" className={`tknob-${side}`} style={{ animationDelay: `${delay + 0.75}s` }} />
          </g>
        </svg>
      </>
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
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Presión óptima para cada sector</p>
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
              Guarda tu perfil de bici y calcula la presión óptima según el tiempo real en cada sector.
            </p>
            <Link href="/auth"
              className="inline-block px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold transition-colors"
            >Iniciar sesión / Registrarse</Link>
          </div>
        ) : (
          <>
            {/* PERFIL */}
            <details open={profileExpanded} className="bg-slate-900/40 border border-white/5 rounded-2xl">
              <summary className="flex items-center gap-2 p-6 cursor-pointer text-slate-400 hover:text-white transition-colors list-none">
                <Bike className="w-5 h-5 text-orange-500" />
                <h2 className="text-base font-bold text-white">Perfil del ciclista</h2>
                <span className="ml-auto text-[9px] text-slate-600">{profileExpanded ? 'Contraer' : 'Expandir'}</span>
                <svg className={`w-3 h-3 text-slate-600 transition-transform ${profileExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-6 pb-6 space-y-4">
                {profileLoadError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400">Error al cargar perfiles: {profileLoadError}</div>
                )}
                {savedProfiles.length > 0 && (
                  <div className="p-4 bg-slate-800/40 border border-orange-500/15 rounded-xl">
                    <label className="text-[10px] text-orange-400 uppercase tracking-widest font-bold block mb-2">Tus perfiles guardados</label>
                    <div className="flex items-center gap-2">
                      <select value={selectedProfileId || ''} onChange={e => {
                        const p = savedProfiles.find(sp => sp.id === e.target.value);
                        if (p) selectProfile(p);
                      }}
                        className="flex-1 bg-slate-950 border border-white/5 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer"
                      >
                        {savedProfiles.map(p => (
                          <option key={p.id} value={p.id}>{p.profile_name || 'Sin nombre'}</option>
                        ))}
                      </select>
                      <button onClick={() => handleDeleteProfile(selectedProfileId!)}
                        className="p-2.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors text-xs" title="Eliminar perfil">🗑️</button>
                      <button onClick={() => { setProfile({ ...DEFAULT_PROFILE }); setProfileName('Mi perfil'); setSelectedProfileId(null); }}
                        className="p-2.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-xs" title="Nuevo perfil">➕</button>
                    </div>
                  </div>
                )}
                {savedProfiles.length === 0 && profileLoaded && !profileLoadError && (
                  <div className="text-[11px] text-slate-500 bg-slate-800/20 rounded-lg px-4 py-3">
                    No tienes perfiles guardados. Configura los datos de tu bici y guárdalos para usarlos después.
                  </div>
                )}
                {/* Nombre del perfil */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Nombre del perfil</label>
                    <input type="text" value={profileName} onChange={e => setProfileName(e.target.value)}
                      placeholder="Ej: Enduro con Turbo Levo"
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40" />
                  </div>
                  {profileLoaded && (
                    <button onClick={handleSaveProfile} disabled={saving}
                      className={`mt-5 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors whitespace-nowrap ${
                        saveStatus === 'saved' ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : selectedProfileId ? 'bg-blue-500/10 text-blue-400 border border-blue-500/25 hover:bg-blue-500/20'
                        : 'bg-orange-500/10 text-orange-400 border border-orange-500/25 hover:bg-orange-500/20'
                      }`}>
                      {saving ? 'Guardando...' : saveStatus === 'saved' ? '✓ Guardado' : selectedProfileId ? 'Actualizar' : 'Guardar nuevo'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Peso ciclista (kg)</label>
                    <Select value={profile.riderWeightKg} onChange={v => setProfile(p => ({ ...p, riderWeightKg: v }))}
                      options={Array.from({ length: 33 }, (_, i) => 68 + i)} /></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Peso bicicleta (kg)</label>
                    <Select value={profile.bikeWeightKg} onChange={v => setProfile(p => ({ ...p, bikeWeightKg: v }))}
                      options={Array.from({ length: 15 }, (_, i) => 11 + i)} /></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Modelo bicicleta</label>
                    <select value={profile.bikeModel} onChange={e => {
                      const model = e.target.value;
                      const spec = BIKE_MODELS.find(m => m.name === model);
                      if (spec) { setProfile({ ...profile, bikeModel: model, bikeWeightKg: spec.weightKg, wheelFront: spec.wheelFront, wheelRear: spec.wheelRear, tireWidthFrontInch: spec.tireWidthFrontInch, tireWidthRearInch: spec.tireWidthRearInch, tireModelFront: spec.tireModelFront, tireModelRear: spec.tireModelRear, tubeless: spec.tubeless }); }
                      else { setProfile(p => ({ ...p, bikeModel: model })); }
                    }}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">
                      {BIKE_MODELS.map(m => (<option key={m.name} value={m.name}>{m.name} ({m.year})</option>))}
                      <option value="">— Personalizado —</option>
                    </select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Rueda delantera</label>
                    <select value={profile.wheelFront} onChange={e => setProfile(p => ({ ...p, wheelFront: e.target.value as any }))}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">
                      <option value="29">29"</option><option value="27.5">27.5"</option>
                    </select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Rueda trasera</label>
                    <select value={profile.wheelRear} onChange={e => setProfile(p => ({ ...p, wheelRear: e.target.value as any }))}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">
                      <option value="29">29"</option><option value="27.5">27.5"</option>
                    </select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ancho neumático del. (")</label>
                    <select value={profile.tireWidthFrontInch} onChange={e => setProfile(p => ({ ...p, tireWidthFrontInch: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">
                      {[2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8].map(v => <option key={v} value={v}>{v.toFixed(1)}"</option>)}
                    </select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Ancho neumático tras. (")</label>
                    <select value={profile.tireWidthRearInch} onChange={e => setProfile(p => ({ ...p, tireWidthRearInch: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40 appearance-none cursor-pointer">
                      {[2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8].map(v => <option key={v} value={v}>{v.toFixed(1)}"</option>)}
                    </select></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Presión inicial del. (bar)</label>
                    <input type="number" step="0.1" min="0.5" max="4" value={profile.initialPressureFrontBar}
                      onChange={e => setProfile(p => ({ ...p, initialPressureFrontBar: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40" /></div>
                  <div><label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Presión inicial tras. (bar)</label>
                    <input type="number" step="0.1" min="0.5" max="4" value={profile.initialPressureRearBar}
                      onChange={e => setProfile(p => ({ ...p, initialPressureRearBar: Number(e.target.value) }))}
                      className="w-full bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/40" /></div>
                  <div className="flex items-center gap-3 pt-6">
                    <label className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Tubeless</label>
                    <button onClick={() => setProfile(p => ({ ...p, tubeless: !p.tubeless }))}
                      className={`w-12 h-6 rounded-full transition-colors ${profile.tubeless ? 'bg-orange-500' : 'bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${profile.tubeless ? 'translate-x-6' : 'translate-x-0.5'}`} />
                    </button>
                  </div>
                </div>
              </div>
            </details>

            {/* CALCULADORA POR SECTOR - TARJETAS GRAFICAS */}
            <section className="bg-slate-900/20 border border-white/5 rounded-2xl p-5">
              <details open={!result}>
                <summary className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white transition-colors list-none">
                  <Mountain className="w-4 h-4 text-orange-500/70" />
                  <span className="text-xs font-bold uppercase tracking-widest">Elige un sector</span>
                  <span className="ml-auto text-[9px] text-slate-600">{selectedSector ? SECTORS.find(s => s.id === selectedSector)?.name : 'Toca para calcular'}</span>
                  <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="mt-4 space-y-4">
                  {/* Grid de tarjetas de sector */}
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {SECTORS.map(s => {
                      const isSelected = selectedSector === s.id;
                      return (
                        <button
                          key={s.id}
                          onClick={() => { setSelectedSector(s.id); setResult(null); setError(''); }}
                          className={`relative group overflow-hidden rounded-2xl border-2 transition-all duration-200 text-left ${
                            isSelected
                              ? 'border-orange-500 ring-2 ring-orange-500/30 shadow-lg shadow-orange-500/20'
                              : 'border-white/10 hover:border-orange-500/50'
                          }`}
                        >
                          {/* Imagen de fondo */}
                          <div className="aspect-[4/3] relative">
                            <img
                              src={s.image}
                              alt={s.name}
                              className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                            {/* Check de seleccion */}
                            {isSelected && (
                              <div className="absolute top-2 right-2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center shadow-lg">
                                <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                          {/* Nombre del sector */}
                          <div className={`p-3 ${isSelected ? 'bg-orange-500/10' : 'bg-slate-900'}`}>
                            <p className={`text-xs font-bold uppercase tracking-wider ${
                              isSelected ? 'text-orange-400' : 'text-white'
                            }`}>
                              {s.name}
                            </p>
                            <p className="text-[9px] text-slate-500 mt-0.5 leading-tight line-clamp-2">{s.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {error && <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400">{error}</div>}

                  {/* Boton calcular */}
                  {selectedSector && (
                    <button onClick={handleCalculate} disabled={calculating}
                      className="w-full py-3 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2">
                      {calculating ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Consultando AEMET...</>
                      ) : (
                        <><Gauge className="w-4 h-4" /> Calcular presión recomendada</>
                      )}
                    </button>
                  )}
                </div>
              </details>
            </section>

            {/* RESULTADOS */}
            {result && (() => {
              const { recommendation, weather } = result;
              const avgFrontBar = recommendation.recommendedFrontBar;
              const avgRearBar = recommendation.recommendedRearBar;
              const avgFrontPsi = recommendation.recommendedFrontPsi;
              const avgRearPsi = recommendation.recommendedRearPsi;
              const weatherBadge = getWeatherBadge(weather);
              const sectorInfo = SECTORS.find(s => s.id === selectedSector);

              return (
                <div className="space-y-6">
                  {/* PRESION RECOMENDADA (HERO) */}
                  <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-orange-950/30 border border-orange-500/30 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 text-center">
                    <div className="flex items-center justify-center gap-2 text-orange-500 mb-2">
                      <TrendingDown className="w-5 h-5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Presión recomendada</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 md:gap-6 mt-6">
                      <AnimatedTire side="front" compact />
                      <div className="text-center min-w-[100px]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Delantera</p>
                        <p className="text-6xl md:text-7xl font-black text-orange-500 leading-none tracking-tighter">{avgFrontBar.toFixed(1)}</p>
                        <p className="text-xs text-slate-400 mt-1"><span className="text-sm font-bold text-white">{Math.round(avgFrontPsi)}</span> PSI</p>
                        <p className="text-[9px] text-slate-600 mt-0.5">({recommendation.currentFrontBar.toFixed(1)} actual)</p>
                      </div>
                      <div className="w-px h-20 bg-white/10 hidden sm:block" />
                      <div className="text-center min-w-[100px]">
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1 font-bold">Trasera</p>
                        <p className="text-6xl md:text-7xl font-black text-orange-500 leading-none tracking-tighter">{avgRearBar.toFixed(1)}</p>
                        <p className="text-xs text-slate-400 mt-1"><span className="text-sm font-bold text-white">{Math.round(avgRearPsi)}</span> PSI</p>
                        <p className="text-[9px] text-slate-600 mt-0.5">({recommendation.currentRearBar.toFixed(1)} actual)</p>
                      </div>
                      <AnimatedTire side="rear" compact />
                    </div>
                    <p className="mt-6 text-[11px] text-slate-500 leading-relaxed max-w-lg mx-auto">{recommendation.reason}</p>
                  </div>

                  {/* SECTOR SELECCIONADO */}
                  {sectorInfo && (
                    <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <MapPin className="w-4 h-4 text-orange-400" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400">Sector</span>
                      </div>
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                          <h3 className="text-base font-bold text-white">{sectorInfo.name}</h3>
                          <p className="text-[11px] text-slate-500">{sectorInfo.description}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DATOS METEOROLOGICOS */}
                  {weather && (
                    <div className="border border-white/5 rounded-2xl overflow-hidden">
                      <div className={`px-6 py-4 flex items-center gap-3 ${weatherBadge.bg.replace('rounded-2xl', '')}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          weatherBadge.label === 'Favorable' ? 'bg-green-500/20' 
                          : weatherBadge.label === 'Lluvia ligera' ? 'bg-yellow-500/20' : 'bg-red-500/20'
                        }`}>
                          <svg className={`w-5 h-5 ${weatherBadge.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            {weatherBadge.label === 'Favorable' ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            )}
                          </svg>
                        </div>
                        <div className="flex-1">
                          <p className={`text-lg font-black uppercase tracking-tight ${weatherBadge.color}`}>{weatherBadge.label}</p>
                          <p className="text-[11px] text-slate-400">{weather.temperatureC}°C · {weather.humidityPct}% HR · {weather.windKmh ?? '—'} km/h viento</p>
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Meteo</span>
                      </div>
                      <div className="p-4 bg-slate-900/30">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <div className="text-center p-3 bg-slate-950/60 rounded-xl border border-white/5">
                            <Thermometer className="w-4 h-4 text-orange-400 mx-auto mb-1.5" />
                            <p className="text-2xl font-black text-white">{weather.temperatureC}°</p>
                            <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">Temperatura</p>
                          </div>
                          <div className="text-center p-3 bg-slate-950/60 rounded-xl border border-white/5">
                            <Droplets className="w-4 h-4 text-blue-400 mx-auto mb-1.5" />
                            <p className="text-2xl font-black text-white">{weather.humidityPct}%</p>
                            <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">Humedad</p>
                          </div>
                          <div className="text-center p-3 bg-slate-950/60 rounded-xl border border-white/5">
                            <svg className="w-4 h-4 text-cyan-400 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            <p className="text-2xl font-black text-white">{weather.precipitationMm ?? 0} mm</p>
                            <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">Precipitación</p>
                          </div>
                          <div className="text-center p-3 bg-slate-950/60 rounded-xl border border-white/5">
                            <svg className="w-4 h-4 text-emerald-400 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                            </svg>
                            <p className="text-2xl font-black text-white">{weather.windKmh ?? '—'}</p>
                            <p className="text-[8px] text-slate-500 uppercase tracking-widest mt-0.5">Viento km/h</p>
                          </div>
                        </div>
                        {weather.stationName && (
                          <div className="mt-3 text-[9px] text-slate-600 bg-slate-950/30 rounded-lg px-3 py-2 text-center">
                            Datos de estación {weather.stationName}{weather.stationDistanceKm && <> · a {weather.stationDistanceKm} km</>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}
