'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Map, Source, Layer, NavigationControl } from 'react-map-gl/mapbox';
import type { MapRef } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { haversineKm } from '@/lib/gpx-utils';
import { MapPin, Play, Square, RotateCcw, Upload, Battery, Zap, Clock, MapIcon, Bike, ChevronDown, ChevronUp, Navigation, Signal, Smartphone, Wifi, Cloud, Settings, Loader2 } from 'lucide-react';

// ── Types ──────────────────────────────────────────
interface TrackPoint {
  lat: number;
  lng: number;
  elevation: number | null;
  timestamp: number;
  speed: number | null;
}

interface BikeConfig {
  type: 'mtb' | 'ebike';
  batteryCapacityWh: number;
  initialBatteryPct: number;
  assistanceMode: 'eco' | 'trail' | 'turbo' | 'smart';
  safetyReserve: number;
}

const DEFAULT_BIKE: BikeConfig = {
  type: 'ebike',
  batteryCapacityWh: 750,
  initialBatteryPct: 100,
  assistanceMode: 'trail',
  safetyReserve: 15,
};

const ASSIST_CONSUMPTION: Record<string, number> = { eco: 6, trail: 10, turbo: 18, smart: 8 };

// Haversine for quick calc
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return haversineKm(lat1, lng1, lat2, lng2);
}

// ── Main Component ─────────────────────────────────
export default function Grabar() {
  const mapRef = useRef<MapRef>(null);

  // State machine: idle | configuring | recording | finished
  const [status, setStatus] = useState<'idle' | 'configuring' | 'requesting' | 'recording' | 'finished'>('idle');
  const [bikeConfig, setBikeConfig] = useState<BikeConfig>(DEFAULT_BIKE);
  const [configOpen, setConfigOpen] = useState(false);

  // Tracking data
  const [track, setTrack] = useState<TrackPoint[]>([]);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsFixed, setGpsFixed] = useState(false);

  // Computed stats
  const [elapsed, setElapsed] = useState(0); // seconds
  const [distanceKm, setDistanceKm] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [batteryPct, setBatteryPct] = useState(DEFAULT_BIKE.initialBatteryPct);
  const [elevationGain, setElevationGain] = useState(0);
  const [elevationLoss, setElevationLoss] = useState(0);

  // Demo mode
  const [demoMode, setDemoMode] = useState(false);
  const demoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Refs for live values (to avoid stale closures)
  const trackRef = useRef<TrackPoint[]>([]);
  const posRef = useRef<{ lat: number; lng: number } | null>(null);
  const elapsedRef = useRef(0);
  const distanceRef = useRef(0);
  const batteryRef = useRef(DEFAULT_BIKE.initialBatteryPct);
  const watcherRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<any>(null);
  const bikeRef = useRef<BikeConfig>(DEFAULT_BIKE);
  const demoPosRef = useRef(0);
  const gpsGainRef = useRef(0);
  const gpsLossRef = useRef(0);
  const lastElevRef = useRef<number | null>(null);

  // ── Save/Load from localStorage ──
  const saveRecording = useCallback((points: TrackPoint[], dist: number, gain: number, loss: number, time: number) => {
    if (points.length < 3) return;
    try {
      const sessions = JSON.parse(localStorage.getItem('grabar_sessions') || '[]');
      sessions.push({
        id: Date.now(),
        date: new Date().toISOString(),
        points: points.slice(0, 5000), // limit to 5000 pts for storage
        distanceKm: Math.round(dist * 100) / 100,
        elevationGain: Math.round(gain),
        elevationLoss: Math.round(loss),
        durationSec: time,
        bikeType: bikeRef.current.type,
      });
      localStorage.setItem('grabar_sessions', JSON.stringify(sessions.slice(-20))); // keep last 20
    } catch { /* storage full */ }
  }, []);

  // ── Auto-save interval ──
  useEffect(() => {
    if (status !== 'recording') return;
    const interval = setInterval(() => {
      saveRecording(trackRef.current, distanceRef.current, gpsGainRef.current, gpsLossRef.current, elapsedRef.current);
    }, 30000); // every 30s
    return () => clearInterval(interval);
  }, [status, saveRecording]);

  // ── Screen Wake Lock ──
  useEffect(() => {
    if (status === 'recording') {
      navigator.wakeLock?.request('screen').then(l => { wakeLockRef.current = l; }).catch(() => {});
    }
    return () => { wakeLockRef.current?.release().catch(() => {}); };
  }, [status]);

  // ── Timer ──
  useEffect(() => {
    if (status === 'recording') {
      timerRef.current = setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        // Update battery
        if (bikeRef.current.type === 'ebike') {
          const consumption = ASSIST_CONSUMPTION[bikeRef.current.assistanceMode] || 10;
          // Wh used per second at current speed
          const whPerSec = consumption * (currentSpeed / 3600);
          const usedWh = whPerSec * bikeRef.current.batteryCapacityWh / 100;
          const remaining = Math.max(0, bikeRef.current.initialBatteryPct - (usedWh / bikeRef.current.batteryCapacityWh * 100));
          batteryRef.current = remaining;
          setBatteryPct(remaining);
        }
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [status, currentSpeed]);

  // ── Add track point ──
  const addPoint = useCallback((lat: number, lng: number, elevation: number | null, speed: number | null) => {
    const now = Date.now();
    const prev = trackRef.current[trackRef.current.length - 1];
    let newDist = distanceRef.current;

    if (prev) {
      const segKm = haversine(prev.lat, prev.lng, lat, lng);
      newDist += segKm;

      // Elevation
      const prevEle = lastElevRef.current;
      if (elevation != null && prevEle != null) {
        const diff = elevation - prevEle;
        if (diff > 1) gpsGainRef.current += diff;
        else if (diff < -1) gpsLossRef.current += Math.abs(diff);
      }
      lastElevRef.current = elevation;
    } else {
      lastElevRef.current = elevation;
    }

    const pt: TrackPoint = { lat, lng, elevation, timestamp: now, speed };
    trackRef.current = [...trackRef.current, pt];
    distanceRef.current = newDist;

    setTrack(trackRef.current);
    setDistanceKm(newDist);
    setElevationGain(Math.round(gpsGainRef.current));
    setElevationLoss(Math.round(gpsLossRef.current));
    setCurrentSpeed(speed ?? 0);

    // Avg speed
    const timeH = elapsedRef.current / 3600;
    setAvgSpeed(timeH > 0 ? newDist / timeH : 0);

    posRef.current = { lat, lng };
    setCurrentPos({ lat, lng });

    // Fly map to current position
    if (mapRef.current) {
      mapRef.current.flyTo({ center: [lng, lat], zoom: 14, duration: 1000 });
    }
  }, []);

  // ── GPS Watcher ──
  const startGps = useCallback(() => {
    if (!navigator.geolocation) return;
    setStatus('requesting');
    setGpsFixed(false);

    watcherRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, altitude, accuracy, speed } = pos.coords;
        setGpsAccuracy(accuracy ?? null);
        if (accuracy != null && accuracy < 100) {
          setGpsFixed(true);
          if (status === 'requesting') setStatus('recording');
        }
        addPoint(
          latitude,
          longitude,
          altitude ?? null,
          speed != null ? speed * 3.6 : null // m/s → km/h
        );
      },
      () => {},
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, [addPoint, status]);

  // ── Demo Mode ──
  const startDemo = useCallback(() => {
    setDemoMode(true);
    setStatus('recording');
    setGpsFixed(true);

    // Simulated track around Collserola (Barcelona)
    const demoBase = { lat: 41.4028, lng: 2.1100 };
    let step = 0;
    const maxSteps = 300;

    demoIntervalRef.current = setInterval(() => {
      if (step >= maxSteps) { stopRecording(); return; }
      step++;
      const angle = step * 0.05;
      const radius = 0.008;
      const lat = demoBase.lat + Math.sin(angle) * radius + step * 0.00008;
      const lng = demoBase.lng + Math.cos(angle * 0.7) * radius + step * 0.0001;
      const ele = 180 + Math.sin(angle * 2) * 40;
      const spd = 12 + Math.sin(angle * 1.5) * 6; // 6-18 km/h

      addPoint(lat, lng, ele, spd);
    }, 1000);
  }, [addPoint]);

  // ── Stop ──
  const stopRecording = useCallback(() => {
    setStatus('finished');
    if (watcherRef.current != null) { navigator.geolocation.clearWatch(watcherRef.current); watcherRef.current = null; }
    if (demoIntervalRef.current) { clearInterval(demoIntervalRef.current); demoIntervalRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    wakeLockRef.current?.release().catch(() => {});

    // Final save
    saveRecording(trackRef.current, distanceRef.current, gpsGainRef.current, gpsLossRef.current, elapsedRef.current);
  }, [saveRecording]);

  // ── Reset ──
  const resetRecording = () => {
    setStatus('idle');
    setTrack([]);
    setCurrentPos(null);
    setDistanceKm(0);
    setElapsed(0);
    setCurrentSpeed(0);
    setAvgSpeed(0);
    setBatteryPct(bikeRef.current.initialBatteryPct);
    setElevationGain(0);
    setElevationLoss(0);
    setGpsFixed(false);
    setGpsAccuracy(null);
    trackRef.current = [];
    distanceRef.current = 0;
    elapsedRef.current = 0;
    gpsGainRef.current = 0;
    gpsLossRef.current = 0;
    lastElevRef.current = null;
    posRef.current = null;
    demoPosRef.current = 0;
    if (watcherRef.current != null) { navigator.geolocation.clearWatch(watcherRef.current); watcherRef.current = null; }
    if (demoIntervalRef.current) { clearInterval(demoIntervalRef.current); demoIntervalRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    wakeLockRef.current?.release().catch(() => {});
  };

  // ── Format helpers ──
  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ── GPX Import ──
  const handleGpxImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const xml = ev.target?.result as string;
      const pts: TrackPoint[] = [];
      const regex = /<trkpt lat="([\-\d\.]+)" lon="([\-\d\.]+)"(?:>[\s\S]*?<ele>([\-\d\.]+))?/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(xml)) !== null) {
        pts.push({
          lat: parseFloat(m[1]),
          lng: parseFloat(m[2]),
          elevation: m[3] ? parseFloat(m[3]) : null,
          timestamp: Date.now(),
          speed: null,
        });
      }
      if (pts.length > 1) {
        trackRef.current = pts;
        setTrack(pts);
        setCurrentPos({ lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lng });
        let dist = 0;
        for (let i = 1; i < pts.length; i++) dist += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
        distanceRef.current = dist;
        setDistanceKm(dist);
        setStatus('finished');
        // Fit map to imported track
        if (mapRef.current && pts.length > 0) {
          const bounds = pts.reduce((b, p) => ({
            minLat: Math.min(b.minLat, p.lat), maxLat: Math.max(b.maxLat, p.lat),
            minLng: Math.min(b.minLng, p.lng), maxLng: Math.max(b.maxLng, p.lng),
          }), { minLat: 90, maxLat: -90, minLng: 180, maxLng: -180 });
          mapRef.current.fitBounds([[bounds.minLng, bounds.minLat], [bounds.maxLng, bounds.maxLat]], { padding: 50, duration: 2000 });
        }
      }
    };
    reader.readAsText(file);
  };

  // ── GeoJSON for map line ──
  const geojson = track.length > 1 ? {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'LineString' as const,
      coordinates: track.map(p => [p.lng, p.lat, p.elevation ?? 0] as [number, number, number]),
    },
  } : null;

  // ── Cleanup on unmount ──
  useEffect(() => {
    return () => {
      if (watcherRef.current != null) navigator.geolocation.clearWatch(watcherRef.current);
      if (demoIntervalRef.current) clearInterval(demoIntervalRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
      wakeLockRef.current?.release().catch(() => {});
    };
  }, []);

  const isIdle = status === 'idle' || status === 'configuring';

  return (
    <div className="min-h-screen bg-slate-950">
      {/* HEADER */}
      <div className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <MapPin className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Raider</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Graba tu salida</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <style>{`.fade-in { animation: fi 0.35s ease-out both; } @keyframes fi { 0% { opacity:0; transform:translateY(10px); } 100% { opacity:1; transform:translateY(0); } }`}</style>

        {/* MAP */}
        <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-4 mb-5">
          <div className="relative w-full h-[250px] lg:h-[300px] rounded-xl overflow-hidden border border-white/5">
            <Map
              ref={mapRef}
              mapStyle={currentPos ? 'mapbox://styles/mapbox/outdoors-v12' : 'mapbox://styles/mapbox/light-v11'}
              mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
              initialViewState={{ latitude: 41.4028, longitude: 2.1100, zoom: 11, pitch: 0, bearing: 0 }}
              style={{ width: '100%', height: '100%' }}
            >
              <NavigationControl position="top-right" />
              {geojson && (
                <Source id="track" type="geojson" data={geojson}>
                  <Layer id="track-line" type="line" paint={{ 'line-color': '#10b981', 'line-width': 4, 'line-opacity': 0.9 }} />
                  <Layer id="track-glow" type="line" paint={{ 'line-color': '#10b981', 'line-width': 8, 'line-opacity': 0.25 }} />
                </Source>
              )}
              {geojson && (
                <Source id="track-points" type="geojson" data={{
                  type: 'FeatureCollection',
                  features: track.filter((_, i) => i % 30 === 0).map(p => ({
                    type: 'Feature' as const,
                    properties: {},
                    geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
                  })),
                }}>
                  <Layer id="track-dots" type="circle" paint={{ 'circle-radius': 2.5, 'circle-color': '#10b981', 'circle-opacity': 0.6 }} />
                </Source>
              )}
            </Map>
            {/* GPS indicator */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-2 bg-slate-950/90 border border-white/10 rounded-lg px-3 py-1.5">
              {status === 'recording' ? (
                gpsFixed ? (
                  <><Signal className="w-3.5 h-3.5 text-emerald-400" /><span className="text-[9px] text-emerald-400 font-bold">GPS fijo{gpsAccuracy ? ` ±${gpsAccuracy}m` : ''}</span></>
                ) : (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin text-yellow-400" /><span className="text-[9px] text-yellow-400 font-bold">Esperando GPS...</span></>
                )
              ) : isIdle ? (
                <><Navigation className="w-3.5 h-3.5 text-slate-500" /><span className="text-[8px] text-slate-500">El trazado aparecerá al moverte</span></>
              ) : null}
            </div>
            {isIdle && !currentPos && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="bg-slate-950/80 backdrop-blur-sm border border-white/10 rounded-xl px-5 py-3 text-center">
                  <MapIcon className="w-8 h-8 text-slate-600 mx-auto mb-1" />
                  <p className="text-[10px] text-slate-500">Esperando una posición GPS fiable</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* STATS */}
        <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 mb-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3">
              <Clock className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
              <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Tiempo</p>
              <p className="text-xl md:text-2xl font-black text-white font-mono">{fmtTime(elapsed)}</p>
            </div>
            <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3">
              <MapPin className="w-4 h-4 text-orange-400 mx-auto mb-1" />
              <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Distancia</p>
              <p className="text-xl md:text-2xl font-black text-white">{distanceKm.toFixed(2)} <span className="text-xs text-slate-500">km</span></p>
            </div>
            <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3">
              <Zap className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
              <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Velocidad</p>
              <p className="text-xl md:text-2xl font-black text-white">{currentSpeed.toFixed(1)} <span className="text-xs text-slate-500">km/h</span></p>
            </div>
            <div className="bg-slate-950/50 border border-white/5 rounded-xl p-3">
              <Battery className={`w-4 h-4 mx-auto mb-1 ${batteryPct > 30 ? 'text-emerald-400' : batteryPct > 15 ? 'text-yellow-400' : 'text-red-400'}`} />
              <p className="text-[8px] text-slate-500 uppercase tracking-widest font-bold">Batería</p>
              <p className="text-xl md:text-2xl font-black text-white">{Math.round(batteryPct)}<span className="text-xs text-slate-500">%</span></p>
            </div>
          </div>
          {track.length > 1 && (
            <div className="flex items-center justify-center gap-4 mt-2 text-[9px] text-slate-600">
              <span>⬆ {elevationGain}m</span>
              <span>⬇ {elevationLoss}m</span>
              <span>∅ {avgSpeed.toFixed(1)} km/h</span>
              <span>{track.length} pts</span>
            </div>
          )}
        </div>

        {/* CONTROLS */}
        <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 mb-5">
          <div className="flex flex-wrap items-center gap-3">
            {(status === 'idle' || status === 'configuring') && (
              <>
                <button
                  onClick={startGps}
                  className="flex-1 min-w-[140px] px-5 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-bold text-xs transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                >
                  <Navigation className="w-4 h-4" /> Iniciar con GPS
                </button>
                <button
                  onClick={startDemo}
                  className="flex-1 min-w-[140px] px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" /> Probar Demo
                </button>
                <label className="flex-1 min-w-[140px] cursor-pointer">
                  <div className="px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2">
                    <Upload className="w-4 h-4" /> Importar GPX
                  </div>
                  <input type="file" accept=".gpx,.gpx" onChange={handleGpxImport} className="hidden" />
                </label>
              </>
            )}
            {status === 'requesting' && (
              <div className="flex items-center gap-2 text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-4 py-3 w-full">
                <Loader2 className="w-4 h-4 animate-spin" /> Solicitando permiso GPS... Acepta la ubicación en tu navegador.
              </div>
            )}
            {status === 'recording' && (
              <>
                <div className="flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Grabando...
                </div>
                <div className="flex-1" />
                <button
                  onClick={stopRecording}
                  className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-2 shadow-lg shadow-red-500/20"
                >
                  <Square className="w-4 h-4" /> Detener
                </button>
              </>
            )}
            {status === 'finished' && (
              <>
                <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-800/50 border border-white/10 rounded-xl px-3 py-2">
                  ✓ Salida guardada
                </div>
                <div className="flex-1" />
                <button
                  onClick={resetRecording}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 border border-white/10 text-white rounded-xl font-bold text-xs transition-colors flex items-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" /> Nueva salida
                </button>
              </>
            )}
          </div>
        </div>

        {/* BIKE CONFIG */}
        <div className="bg-slate-900/30 border border-white/5 rounded-2xl p-5 mb-5">
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className="flex items-center gap-2 w-full text-left"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-white">Configura la bici</h2>
            <span className="ml-auto text-[8px] text-slate-500">{configOpen ? 'Cerrar' : 'Abrir'}</span>
            {configOpen ? <ChevronUp className="w-3 h-3 text-slate-500" /> : <ChevronDown className="w-3 h-3 text-slate-500" />}
          </button>
          <p className="text-[9px] text-slate-600 mt-1">Podrás cambiar estos datos antes de cada salida.</p>
          {configOpen && (
            <div className="mt-4 space-y-4 fade-in">
              <div className="flex gap-3">
                <button
                  onClick={() => setBikeConfig(c => { const n = { ...c, type: 'mtb' as const }; bikeRef.current = n; return n; })}
                  className={`flex-1 px-4 py-3 rounded-xl border text-xs font-bold transition-all ${bikeConfig.type === 'mtb' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-white/10 text-slate-400 hover:border-emerald-500/50'}`}
                >
                  <Bike className="w-5 h-5 mx-auto mb-1" /> MTB
                </button>
                <button
                  onClick={() => setBikeConfig(c => { const n = { ...c, type: 'ebike' as const }; bikeRef.current = n; return n; })}
                  className={`flex-1 px-4 py-3 rounded-xl border text-xs font-bold transition-all ${bikeConfig.type === 'ebike' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-white/10 text-slate-400 hover:border-emerald-500/50'}`}
                >
                  <Battery className="w-5 h-5 mx-auto mb-1" /> E-bike
                </button>
              </div>

              {bikeConfig.type === 'ebike' && (
                <>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Capacidad batería</label>
                    <div className="flex gap-2">
                      <select
                        value={bikeConfig.batteryCapacityWh}
                        onChange={e => setBikeConfig(c => { const n = { ...c, batteryCapacityWh: Number(e.target.value) }; bikeRef.current = n; return n; })}
                        className="flex-1 bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/40 appearance-none cursor-pointer"
                      >
                        {[400, 500, 625, 630, 700, 720, 750, 800, 900, 1000].map(v => <option key={v} value={v}>{v} Wh</option>)}
                      </select>
                      <select
                        value={bikeConfig.initialBatteryPct}
                        onChange={e => setBikeConfig(c => { const n = { ...c, initialBatteryPct: Number(e.target.value), batteryPct: Number(e.target.value) }; bikeRef.current = n; setBatteryPct(Number(e.target.value)); return n; })}
                        className="w-24 bg-slate-950 border border-white/5 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/40 appearance-none cursor-pointer"
                      >
                        {[100, 95, 90, 85, 80, 75, 70, 60, 50, 30, 10].map(v => <option key={v} value={v}>{v}%</option>)}
                      </select>
                    </div>
                    <p className="text-[7px] text-slate-600 mt-0.5">Wh indicados en tu batería</p>
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Asistencia</label>
                    <div className="flex gap-2">
                      {(['eco', 'trail', 'turbo', 'smart'] as const).map(mode => (
                        <button
                          key={mode}
                          onClick={() => setBikeConfig(c => { const n = { ...c, assistanceMode: mode }; bikeRef.current = n; return n; })}
                          className={`flex-1 py-2 rounded-lg border text-[10px] font-bold uppercase transition-all ${bikeConfig.assistanceMode === mode ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400' : 'bg-slate-950 border-white/10 text-slate-400 hover:border-emerald-500/50'}`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-[9px] text-slate-500 uppercase tracking-widest font-bold block mb-1">Reserva seguridad: {bikeConfig.safetyReserve}%</label>
                    <input
                      type="range"
                      min={5}
                      max={30}
                      step={5}
                      value={bikeConfig.safetyReserve}
                      onChange={e => setBikeConfig(c => { const n = { ...c, safetyReserve: Number(e.target.value) }; bikeRef.current = n; return n; })}
                      className="w-full accent-emerald-500"
                    />
                    <p className="text-[7px] text-slate-600">La app avisará si la ruta puede consumir este margen.</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* FIELD CHECKLIST */}
        {isIdle && (
          <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 fade-in">
            <h2 className="text-xs font-bold uppercase tracking-widest text-white mb-3">Preparación de campo</h2>
            <div className="space-y-2">
              {[
                { icon: <Signal className="w-3.5 h-3.5" />, label: 'GPS', desc: 'El dispositivo pedirá permiso al iniciar la grabación.' },
                { icon: <MapIcon className="w-3.5 h-3.5" />, label: 'Ruta offline', desc: 'Salida libre: podrás grabar sin una ruta cargada.' },
                { icon: <Smartphone className="w-3.5 h-3.5" />, label: 'Autoguardado', desc: 'Almacenamiento persistente concedido.', ok: true },
                { icon: <Wifi className="w-3.5 h-3.5" />, label: 'Cobertura', desc: 'Meteo y seguimiento en vivo disponibles.' },
                { icon: <Bike className="w-3.5 h-3.5" />, label: bikeConfig.type === 'ebike' ? 'E-bike' : 'MTB', desc: bikeConfig.type === 'ebike' ? `Batería inicial: ${bikeConfig.initialBatteryPct}%` : 'Bicicleta de montaña' },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3 bg-slate-950/40 rounded-xl px-4 py-3 border border-white/5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-emerald-400">
                    {item.icon}
                  </div>
                  <div>
                    <p className="text-[11px] font-bold text-white">{item.label}</p>
                    <p className="text-[9px] text-slate-500">{item.desc}</p>
                  </div>
                  {item.ok !== false && <span className="ml-auto text-[9px] text-emerald-400">✓</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FINISHED SUMMARY */}
        {status === 'finished' && track.length > 1 && (
          <div className="bg-slate-900/30 border border-emerald-500/20 rounded-2xl p-5 fade-in">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-400 mb-3">Resumen de la salida</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
              <div className="bg-slate-950/50 rounded-xl p-3"><p className="text-[8px] text-slate-500">Distancia</p><p className="text-lg font-black text-white">{distanceKm.toFixed(2)} km</p></div>
              <div className="bg-slate-950/50 rounded-xl p-3"><p className="text-[8px] text-slate-500">Duración</p><p className="text-lg font-black text-white font-mono">{fmtTime(elapsed)}</p></div>
              <div className="bg-slate-950/50 rounded-xl p-3"><p className="text-[8px] text-slate-500">Vel. media</p><p className="text-lg font-black text-white">{avgSpeed.toFixed(1)} km/h</p></div>
              <div className="bg-slate-950/50 rounded-xl p-3"><p className="text-[8px] text-slate-500">Desnivel</p><p className="text-lg font-black text-white">+{elevationGain}m / -{elevationLoss}m</p></div>
            </div>
            {bikeConfig.type === 'ebike' && (
              <p className="text-[10px] text-slate-500 text-center mt-2">Batería estimada restante: {Math.round(batteryPct)}%</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
