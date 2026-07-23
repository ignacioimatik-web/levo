'use client';

import { useState, useEffect } from 'react';
import { Map, Marker, NavigationControl } from 'react-map-gl/mapbox';
import type { MapMouseEvent } from 'react-map-gl/mapbox';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Loader2, Sun } from 'lucide-react';

interface ForecastDay {
  date: string;
  dayName: string;
  tempMax: number;
  tempMin: number;
  feelsLikeMax?: number;
  feelsLikeMin?: number;
  humidityMax?: number;
  humidityMin?: number;
  precipitationProb: number;
  stormProb: number;
  windSpeedKmh: number;
  windDirectionDeg?: number;
  windDireccion?: string;
  uvMax?: number;
  skyDesc?: string;
}

interface NowData {
  stationName: string;
  stationDistanceKm: number;
  stationAltitude: number;
  stationProvince: string;
  temperatureC: number;
  humidityPct: number;
  windKmh: number;
  maxWindKmh: number;
  uvMax: number;
  windDirectionDeg: number;
  precipitationMm: number;
  dataAgeMin: number;
  dataIsStale: boolean;
}

export default function Meteo() {
  const [mapPoint, setMapPoint] = useState<{ lat: number; lng: number } | null>(null);
  const [weatherLoaded, setWeatherLoaded] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState<NowData | null>(null);
  const [forecast, setForecast] = useState<ForecastDay[]>([]);
  const [currentMapStyle, setCurrentMapStyle] = useState('mapbox://styles/mapbox/satellite-streets-v12');
  const [showExtra, setShowExtra] = useState(false);
  const [clockTime, setClockTime] = useState('');
  const [mapView, setMapView] = useState({ lat: 40.6406, lng: -0.2727, bearing: 0, pitch: 68 });

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClockTime(now.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  const windDirText = (deg: number | null | undefined): string => {
    if (deg == null) return '—';
    const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];
    return dirs[Math.round(deg / 22.5) % 16];
  };

  const feelsLike = now?.temperatureC != null && now?.windKmh != null && now.windKmh > 0.5
    ? Math.round((13.12 + 0.6215 * now.temperatureC - 11.37 * Math.pow(now.windKmh, 0.16) + 0.3965 * now.temperatureC * Math.pow(now.windKmh, 0.16)) * 10) / 10
    : now?.temperatureC;

  function getRemainingDaylight(lat: number, lng: number): { hours: number; sunset: string; sunriseHour: number; sunsetHour: number; currentHour: number } {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const latRad = lat * Math.PI / 180;
    const declination = 23.44 * Math.PI / 180 * Math.cos((2 * Math.PI / 365) * (dayOfYear - 173));
    const cosHourAngle = -Math.tan(latRad) * Math.tan(declination);
    const hourAngle = Math.acos(Math.max(-1, Math.min(1, cosHourAngle)));
    const sunsetHour = 12 + hourAngle * 180 / Math.PI / 15;
    const sunriseHour = 12 - hourAngle * 180 / Math.PI / 15;
    const currentHour = now.getUTCHours() + now.getUTCMinutes() / 60;
    const remaining = Math.max(0, sunsetHour - currentHour);
    const h = Math.floor(remaining);
    const m = Math.round((remaining - h) * 60);
    return { hours: remaining, sunset: `${h}h ${m}m`, sunriseHour, sunsetHour, currentHour };
  }
  const daylight = mapPoint ? getRemainingDaylight(mapPoint.lat, mapPoint.lng) : null;

  const fetchWeather = async (lat: number, lng: number) => {
    setWeatherLoading(true);
    setError('');
    try {
      const res = await fetch('/api/meteo/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setNow(data.now);
        setForecast(data.forecast || []);
        setMapPoint({ lat, lng });
        setWeatherLoaded(true);
        setShowExtra(!!(data.now?.precipitationMm && data.now.precipitationMm > 0));
      }
    } catch {
      setError('Error de conexión');
    }
    setWeatherLoading(false);
  };

  const skyIcon = (desc?: string) => {
    if (!desc) return '☀️';
    const d = desc.toLowerCase();
    if (d.includes('nuboso') || d.includes('nubes')) return '☁️';
    if (d.includes('lluvia') || d.includes('chubasco')) return '🌧️';
    if (d.includes('niebla') || d.includes('bruma')) return '🌫️';
    if (d.includes('despejado')) return '☀️';
    if (d.includes('poco nuboso')) return '🌤️';
    if (d.includes('tormenta')) return '⛈️';
    return '☀️';
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-[1200px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <Sun className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Meteo</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">Previsión a 3 días + datos actuales AEMET</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-6 py-8">
        <style>{`.fade-in { animation: fi 0.35s ease-out both; } @keyframes fi { 0% { opacity:0; transform:translateY(10px); } 100% { opacity:1; transform:translateY(0); } }`}</style>

        {/* MAPA */}
        <div className="bg-slate-900/20 border border-white/5 rounded-2xl p-5 mb-6">
          <details open>
            <summary className="flex items-center gap-2 cursor-pointer text-slate-400 hover:text-white transition-colors list-none">
              <div className="w-6 h-6 rounded-lg bg-cyan-500/20 flex items-center justify-center"><span className="text-xs">🗺️</span></div>
              <span className="text-xs font-bold uppercase tracking-widest">Seleccionar zona</span>
              <span className="ml-auto text-[9px] text-slate-600">{weatherLoaded ? `${now?.temperatureC ?? '—'}°C · ${now?.humidityPct ?? '—'}% HR` : 'Elige en el mapa'}</span>
              <svg className="w-3 h-3 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </summary>
            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] text-cyan-400 uppercase tracking-widest font-bold flex items-center gap-2">📍 Haz clic — previsión + datos actuales AEMET</p>
                <button onClick={() => setCurrentMapStyle(s => s.includes('satellite') ? 'mapbox://styles/mapbox/outdoors-v12' : 'mapbox://styles/mapbox/satellite-streets-v12')} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-[9px] text-slate-300 font-bold transition-colors flex items-center gap-1.5">{currentMapStyle.includes('satellite') ? '🗺️' : '🛰️'} {currentMapStyle.includes('satellite') ? 'Topo' : 'Satélite'}</button>
              </div>
              <div className="relative w-full h-[350px] lg:h-[400px] rounded-xl overflow-hidden border border-white/5">
                <Map
                  mapStyle={currentMapStyle}
                  mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
                  initialViewState={{ latitude: 40.6406, longitude: -0.2727, zoom: 6, pitch: 0, bearing: 0 }}
                  onMoveEnd={e => setMapView({ lat: e.viewState.latitude, lng: e.viewState.longitude, bearing: e.viewState.bearing ?? 0, pitch: e.viewState.pitch ?? 0 })}
                  onClick={(e: MapMouseEvent) => { fetchWeather(e.lngLat.lat, e.lngLat.lng); }}
                  style={{ width: '100%', height: '100%' }}
                >
                  <NavigationControl position="top-right" />
                  {mapPoint && <Marker latitude={mapPoint.lat} longitude={mapPoint.lng} color="#06b6d4" scale={0.9} />}
                  {weatherLoading && <div className="absolute top-2 right-12 z-10 bg-slate-950/90 border border-white/10 rounded-lg px-3 py-2 flex items-center gap-2 text-[10px] text-slate-300"><Loader2 className="w-3 h-3 animate-spin text-cyan-400" /> Consultando AEMET...</div>}
                </Map>
              </div>
            </div>
          </details>
        </div>

        {error && <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[11px] text-red-400 mb-4">{error}</div>}
        {weatherLoading && <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-slate-800/30 rounded-xl px-4 py-6 mb-4"><Loader2 className="w-4 h-4 animate-spin" /> Consultando AEMET...</div>}
        {!weatherLoaded && !weatherLoading && <div className="text-[11px] text-slate-500 bg-slate-800/30 rounded-xl px-4 py-6 text-center">Haz clic en el mapa para obtener la previsión y datos actuales.</div>}

        {weatherLoaded && (
          <div className="fade-in space-y-6">
            {/* 3-DAY FORECAST */}
            {forecast.length > 0 && (
            <div className="bg-slate-900/20 border border-cyan-500/20 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center"><span className="text-sm">📅</span></div>
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Previsión 3 días</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {forecast.map((day, idx) => (
                  <div key={day.date} className={`bg-slate-900/60 border border-white/5 rounded-xl p-5 ${idx === 0 ? 'ring-1 ring-cyan-500/30' : ''}`}>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-black text-white">{day.dayName}</span>
                      <span className="text-[9px] text-slate-500 font-mono">{day.date.slice(5)}</span>
                    </div>
                    <div className="text-center mb-3">
                      <span className="text-5xl font-black text-cyan-400">{day.tempMax}°</span>
                      <span className="text-xl font-black text-slate-500 ml-1">/ {day.tempMin}°</span>
                    </div>
                    <div className="flex items-center justify-center gap-1 text-lg mb-3">
                      <span>{skyIcon(day.skyDesc)}</span>
                      <span className="text-[10px] text-slate-400 font-medium">{day.skyDesc || '—'}</span>
                    </div>
                    <div className="space-y-2 text-[11px]">
                      <div className="flex items-center justify-between bg-slate-950/50 rounded-lg px-3 py-2">
                        <span className="text-slate-400">🌧️ Precipitación</span>
                        <span className={`font-bold ${day.precipitationProb >= 50 ? 'text-cyan-400' : 'text-slate-300'}`}>{day.precipitationProb}%</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-950/50 rounded-lg px-3 py-2">
                        <span className="text-slate-400">⛈️ Tormentas</span>
                        <span className={`font-bold ${day.stormProb >= 30 ? 'text-yellow-300' : 'text-slate-300'}`}>{day.stormProb}%</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-950/50 rounded-lg px-3 py-2">
                        <span className="text-slate-400">💨 Viento</span>
                        <span className="font-bold text-emerald-400">{day.windSpeedKmh} km/h {day.windDireccion ? `(${day.windDireccion})` : ''}</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-950/50 rounded-lg px-3 py-2">
                        <span className="text-slate-400">💧 Humedad</span>
                        <span className="font-bold text-blue-400">{day.humidityMax ?? '—'}%</span>
                      </div>
                      <div className="flex items-center justify-between bg-slate-950/50 rounded-lg px-3 py-2">
                        <span className="text-slate-400">☀️ UV máx.</span>
                        <span className={`font-bold ${(day.uvMax ?? 0) > 7 ? 'text-red-400' : (day.uvMax ?? 0) > 4 ? 'text-yellow-400' : 'text-slate-300'}`}>{day.uvMax ?? '—'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            {/* CURRENT WEATHER BLOCK */}
            <div className="bg-slate-900/60 border border-white/5 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg bg-orange-500/20 flex items-center justify-center"><span className="text-xs">🕐</span></div>
                <h2 className="text-[11px] font-bold text-white uppercase tracking-widest">Datos actuales</h2>
                <span className="text-[7px] text-slate-600 ml-auto truncate max-w-[200px]">{now?.stationName ?? ''}</span>
                {now?.dataIsStale && <span className="text-[8px] bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded font-bold">Dato antiguo (+{now.dataAgeMin}min)</span>}
              </div>
              <div className="flex items-center gap-3 md:gap-4 overflow-x-auto pb-1">
                <div className="text-center flex-shrink-0 min-w-[90px]">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Temperatura</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl md:text-5xl font-black text-orange-500 leading-none">{now?.temperatureC ?? '—'}</span>
                    <span className="text-sm md:text-base text-orange-500/70 font-black">°C</span>
                    {feelsLike != null && now?.temperatureC != null && feelsLike !== now.temperatureC && (
                      <>
                        <span className="text-slate-500 text-base mx-0.5">/</span>
                        <span className="text-4xl md:text-5xl font-black text-orange-400/80 leading-none">{feelsLike}</span>
                        <span className="text-sm md:text-base text-orange-400/60 font-black">°C</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="w-px h-16 bg-white/5 flex-shrink-0" />
                <div className="text-center flex-shrink-0 min-w-[60px]">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Humedad</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl md:text-5xl font-black text-blue-400 leading-none">{now?.humidityPct ?? '—'}</span>
                    <span className="text-sm md:text-base text-blue-400/70 font-black">%</span>
                  </div>
                </div>
                <div className="w-px h-16 bg-white/5 flex-shrink-0" />
                <button onClick={() => setShowExtra(!showExtra)} className="flex items-center gap-0.5 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity">
                  {showExtra ? <>
                    <div className="text-center min-w-[40px]"><p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Lluvia</p><span className="text-4xl md:text-5xl font-black text-cyan-400 leading-none">{now?.precipitationMm != null ? now.precipitationMm.toFixed(1) : '—'}</span></div>
                    <div className="w-px h-12 bg-white/5 mx-2" />
                    <div className="text-center min-w-[50px]"><p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">UV</p><span className={`text-4xl md:text-5xl font-black leading-none ${(now?.uvMax ?? 0) > 7 ? 'text-red-400' : (now?.uvMax ?? 0) > 4 ? 'text-yellow-400' : 'text-slate-300'}`}>{now?.uvMax ?? '—'}</span></div>
                  </> : <>
                    <div className="text-center min-w-[40px]"><p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1 text-cyan-400/60">💧</p><span className="text-lg font-bold text-cyan-400/60 leading-none">{now?.precipitationMm != null && now.precipitationMm > 0 ? now.precipitationMm.toFixed(1) : '⋯'}</span></div>
                    <div className="text-center min-w-[40px] ml-1"><p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1 text-yellow-300/60">☀️</p><span className="text-lg font-bold text-yellow-300/60 leading-none">{now?.uvMax ?? '⋯'}</span></div>
                  </>}
                </button>
                <div className="w-px h-16 bg-white/5 flex-shrink-0" />
                <div className="text-center flex-shrink-0 min-w-[60px]">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Viento</p>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl md:text-5xl font-black text-emerald-400 leading-none">{now?.windKmh ?? '—'}</span>
                    <span className="text-sm md:text-base text-emerald-400/70 font-black">km/h</span>
                  </div>
                </div>
                <div className="w-px h-16 bg-white/5 flex-shrink-0" />
                <div className="text-center flex-shrink-0 min-w-[90px]">
                  <p className="text-[9px] text-slate-500 uppercase tracking-widest font-bold mb-1">Dirección</p>
                  {now?.windDirectionDeg != null ? <div className="flex items-center justify-center gap-1">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 flex-shrink-0" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: `rotate(${now.windDirectionDeg}deg)` }}>
                      <line x1="12" y1="20" x2="12" y2="4" />
                      <polyline points="12,4 7,9 12,4 17,9" />
                    </svg>
                    <div className="text-left">
                      <span className="text-[10px] font-bold text-emerald-400 block">{windDirText(now.windDirectionDeg)}</span>
                      <span className="text-[7px] text-slate-500">{now.windKmh ?? 0} km/h</span>
                    </div>
                  </div> : <span className="text-4xl md:text-5xl font-black text-slate-600 leading-none">—</span>}
                </div>
              </div>

              {/* SOL */}
              <div className="border-t border-white/5 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold">Sol restante</span>
                  <span className="text-[7px] text-slate-600 truncate max-w-[120px]">{now?.stationName ?? ''}</span>
                </div>
                <div className="relative h-14 rounded-xl overflow-hidden bg-slate-900/80 border border-white/5">
                  <div className="absolute inset-0" style={{
                    background: daylight ? `linear-gradient(to right,
                      #0c0a3e 0%,
                      #1e1b4b ${Math.max(0, (daylight.sunriseHour - 1) / 24 * 100)}%,
                      #f97316 ${Math.max(0, (daylight.sunriseHour) / 24 * 100)}%,
                      #facc15 ${Math.max(0, (daylight.sunriseHour + 1) / 24 * 100)}%,
                      #fff7ed ${Math.max(0, (daylight.sunriseHour + 3) / 24 * 100)}%,
                      #fff7ed ${Math.min(100, (daylight.sunsetHour - 3) / 24 * 100)}%,
                      #facc15 ${Math.min(100, (daylight.sunsetHour - 1) / 24 * 100)}%,
                      #f97316 ${Math.min(100, daylight.sunsetHour / 24 * 100)}%,
                      #1e1b4b ${Math.min(100, (daylight.sunsetHour + 1) / 24 * 100)}%,
                      #0c0a3e 100%)` : '#0c0a3e',
                    opacity: 0.65
                  }} />
                  {daylight && <div className="absolute top-1/2 -translate-y-1/2 transition-all duration-1000" style={{ left: `${Math.max(2, Math.min(96, daylight.currentHour / 24 * 100))}%` }}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${daylight.hours > 0 ? 'bg-yellow-400/20 shadow-lg shadow-yellow-400/30' : 'bg-slate-500/10'}`}>
                      <div className={`w-6 h-6 rounded-full ${daylight.hours > 0 ? 'bg-gradient-to-br from-yellow-300 to-orange-500 shadow-lg shadow-yellow-400/50' : 'bg-slate-600'}`} />
                    </div>
                  </div>}
                  {daylight && daylight.hours <= 0 && <div className="absolute inset-0 flex items-center justify-center"><span className="text-xs text-slate-500 font-bold tracking-widest uppercase">🌙 Noche</span></div>}
                  <div className="absolute top-1/2 left-0 right-0 h-px bg-white/10" />
                </div>
                <div className="flex items-center gap-4 mt-2 pt-2 border-t border-white/5">
                  <div className="flex-shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base md:text-lg font-bold text-white font-mono tracking-wider bg-slate-950/80 px-3 py-1 rounded-lg border border-white/5">{clockTime}</span>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">CEST</span>
                      <span className="ml-1.5 text-[9px] text-slate-500 uppercase tracking-wider">Amanecer</span>
                      <span className="font-bold text-white text-sm">{daylight ? `${Math.floor(daylight.sunriseHour)}:${String(Math.round((daylight.sunriseHour % 1) * 60)).padStart(2,'0')}` : '—'}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-slate-500 uppercase tracking-wider">Luz total</span>
                      <span className="font-bold text-white text-xs">{daylight ? `${Math.round(daylight.sunsetHour - daylight.sunriseHour)}h` : '—'}</span>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    {daylight ? <div className="relative">
                      <div className="relative h-2 rounded-full bg-slate-700/40 overflow-hidden">
                        <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000" style={{
                          width: `${Math.max(0, Math.min(100, ((daylight.currentHour - daylight.sunriseHour) / (daylight.sunsetHour - daylight.sunriseHour)) * 100))}%`,
                          background: 'linear-gradient(to right, #f97316, #facc15, #fff7ed)'
                        }} />
                        <div className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-yellow-400 shadow-lg shadow-yellow-400/50" style={{
                          left: `calc(${Math.max(0, Math.min(100, ((daylight.currentHour - daylight.sunriseHour) / (daylight.sunsetHour - daylight.sunriseHour)) * 100))}% - 7px)`
                        }} />
                      </div>
                      <div className="flex justify-between text-[8px] text-slate-500 mt-0.5">
                        <span className="text-orange-300">{Math.floor(daylight.sunriseHour)}:{String(Math.round((daylight.sunriseHour % 1) * 60)).padStart(2,'0')}</span>
                        <span className="text-orange-300">{Math.floor(daylight.sunsetHour)}:{String(Math.round((daylight.sunsetHour % 1) * 60)).padStart(2,'0')}</span>
                      </div>
                    </div> : <div className="h-8 flex items-center justify-center"><span className="text-[10px] text-slate-500">—</span></div>}
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-[9px] text-slate-500 uppercase tracking-wider">Atardecer</p>
                    <p className="text-lg md:text-xl font-bold text-orange-400">{daylight ? `${Math.floor(daylight.sunsetHour)}:${String(Math.round((daylight.sunsetHour % 1) * 60)).padStart(2,'0')}` : '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
