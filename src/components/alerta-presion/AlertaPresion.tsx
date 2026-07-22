'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/browser';
import type { User } from '@supabase/supabase-js';
import type { BikeProfile, PressureRecommendation } from '@/lib/alerta-presion/types';
import { calculatePressure } from '@/lib/alerta-presion/calculate';
import { Loader2, Gauge, Thermometer, Droplets, Bike, AlertTriangle, TrendingDown, MapPin, Crosshair, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { BIKE_MODELS } from '@/lib/alerta-presion/bike-models';
import type { BikeModelSpec } from '@/lib/alerta-presion/bike-models';
import dynamic from 'next/dynamic';

// Mapbox loaded dynamically to avoid SSR/crash issues
const Map = dynamic(() => import('react-map-gl/mapbox').then(m => m.Map), { ssr: false });
const Marker = dynamic(() => import('react-map-gl/mapbox').then(m => m.Marker), { ssr: false });
const Popup = dynamic(() => import('react-map-gl/mapbox').then(m => m.Popup), { ssr: false });
const NavigationControl = dynamic(() => import('react-map-gl/mapbox').then(m => m.NavigationControl), { ssr: false });
import type { MapMouseEvent } from 'react-map-gl/mapbox';

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
  hasInsert: false,
  rimWidthMm: 30,
  ridingStyle: 'moderado' as const,
  riderExperience: 'intermedio' as const,
  terrainTypes: [] as string[],
  groundCondition: 'mixto' as const,
  casingType: 'estandar' as const,
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
  const [profileExpanded, setProfileExpanded] = useState(true);
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
  const resultsRef = useRef<HTMLDivElement>(null);

  const effectiveTemp = baseTemp != null ? baseTemp + adjustTemp : 20;
  const effectiveHumidity = baseHumidity != null ? Math.max(10, Math.min(100, baseHumidity + adjustHumidity)) : 60;

  const getRecommendation = useCallback(() => {
    if (baseTemp == null || baseHumidity == null) return null;
    return calculatePressure({
      profile,
      temperatureC: effectiveTemp,
      humidityPct: effectiveHumidity,
      descent: { id: 'calc', name: '', trackName: '', distanceKm: 0, elevationLoss: 0, elevationGain: 0, midpoint: { lat: 0, lng: 0 } },
    });
  }, [profile, effectiveTemp, effectiveHumidity, baseTemp, baseHumidity]);

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

  const loadProfiles = useCallback(async () => {
    if (!user) return;
    try {
      setProfileLoadError('');
      const supabase = createClient();
      const { data: { user: freshUser }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !freshUser) {
        setProfileLoadError(userErr?.message || 'No autenticado');
        setSavedProfiles([]); setProfileLoaded(true); return;
      }
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
    setWeatherLoading(true); setError('');
    setAltitudeAdjusted(false);
    setProfileExpanded(false);
    setStationsLoading(true);
    fetch(`/api/alerta-presion/stations?lat=${lat}&lng=${lng}`).then(r => r.json()).then(d => {
      if (d.stations) setStationMarkers(d.stations);
      setStationsLoading(false);
    }).catch(() => setStationsLoading(false));

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
            if (Math.abs(temp - (data.weather.temperatureC ?? 20)) >= 0.5) {
              setAltitudeAdjusted(true);
              source += ` (ajustado: ${data.weather.stationAltitude}m → ${Math.round(altitude)}m)`;
            }
          }
        }
        setBaseTemp(temp);
        setBaseHumidity(data.weather.humidityPct ?? 60);
        setWeatherSource(source);
        setWeatherLoaded(true);
        setMapPoint({ lat, lng });
        setClickAltitude(altitude || null);
        setAdjustTemp(0); setAdjustHumidity(0); setSelectedPreset(null);
      } else { setError('No se pudieron obtener datos meteorológicos'); }
    } catch { setError('Error de conexión con AEMET'); }
    setWeatherLoading(false);
  };

  const applyPreset = (presetLabel: string) => {
    if (selectedPreset === presetLabel) {
      setSelectedPreset(null); setAdjustTemp(0); setAdjustHumidity(0);
    } else {
      const preset = ELEVATION_PRESETS.find(p => p.label === presetLabel);
      if (preset) { setSelectedPreset(presetLabel); setAdjustTemp(preset.deltaTemp); setAdjustHumidity(preset.deltaHumidity); }
    }
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

  return (
    <div className="min-h-screen bg-slate-950">
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
        <p className="text-slate-400">Versión en reparación — Mapbox se cargará dinámicamente</p>
      </div>
    </div>
  );
}
