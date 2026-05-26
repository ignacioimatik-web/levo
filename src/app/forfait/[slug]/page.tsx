import { demoTrails } from '@/data/trails';
import { routes } from '@/data/routes';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import {
  Map, Download, AlertTriangle, Clock, Signal, ChevronLeft, ExternalLink,
} from 'lucide-react';
import TrailDifficultyBadge from '@/components/TrailDifficultyBadge';
import { getTrailStatusLabel, getTrailTypeLabel } from '@/lib/trail-utils';
import TrailDetailMapWrapper from '@/components/TrailDetailMapWrapper';
import TrailNowInsights from '@/components/TrailNowInsights';
import TrailSidebarControls from '@/components/TrailSidebarControls';
import { buildRouteStatus } from '@/lib/route-status';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ segStart?: string; segEnd?: string; pointKm?: string; show?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const trail = demoTrails.find(t => t.slug === slug);
  if (!trail) return { title: 'Sendero no encontrado' };

  return {
    title: `${trail.name} | Forfait MTB | E-nduro Singletracks`,
    description: trail.summary || trail.description,
    openGraph: {
      title: `${trail.name} | Forfait MTB`,
      description: trail.summary || trail.description,
    },
  };
}

function RatingRow({ label, rating }: { label: string; rating?: number | null }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
      <span className="text-sm text-slate-500">{label}</span>
      <div className="flex gap-1">
        {rating ? (
          [1, 2, 3, 4, 5].map(i => (
            <div key={i} className={`w-2 h-2 rounded-full ${i <= rating ? 'bg-orange-500' : 'bg-slate-700'}`} />
          ))
        ) : (
          <span className="text-xs text-slate-600">—</span>
        )}
      </div>
    </div>
  );
}

export default async function TrailDetailPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const focusStartKm = sp.segStart ? Number(sp.segStart) : undefined;
  const focusEndKm = sp.segEnd ? Number(sp.segEnd) : undefined;
  const focusPointKm = sp.pointKm ? Number(sp.pointKm) : undefined;
  const showSet = new Set((sp.show ?? 'climb,descent,flat').split(',').filter(Boolean));
  const currentShow = ['climb', 'descent', 'flat'].filter((k) => showSet.has(k));
  const toggleHref = (key: 'climb' | 'descent' | 'flat') => {
    const next = new Set(currentShow);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const arr = Array.from(next);
    const params = new URLSearchParams();
    params.set('show', arr.length ? arr.join(',') : key);
    if (focusStartKm !== undefined) params.set('segStart', String(focusStartKm));
    if (focusEndKm !== undefined) params.set('segEnd', String(focusEndKm));
    return `/forfait/${slug}?${params.toString()}#trail-map`;
  };
  const trail = demoTrails.find(t => t.slug === slug);
  if (!trail) notFound();
  const statusData = await buildRouteStatus(slug);
  const segmentOverlays = statusData.ok && statusData.profile
    ? statusData.profile.segments
        .filter((s) => showSet.has(s.type))
        .map((s) => ({ startKm: s.startKm, endKm: s.endKm, type: s.type }))
    : undefined;

  const isPlaceholder = trail.dataStatus === "placeholder";
  const hasGpx = !!trail.gpxFile;
  const hasKml = !!trail.kmlFile;
  const statusCfg = getTrailStatusLabel(trail.status);
  const relatedRoutes = trail.relatedRouteSlugs
    .map(s => routes.find(r => r.slug === s))
    .filter(Boolean);

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative py-24 px-6 overflow-hidden contour-line">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-950 z-10" />
        <div className="absolute inset-0 topo-pattern-subtle pointer-events-none z-[5]" />
        <div className="relative z-20 max-w-5xl mx-auto">
          <Link
            href="/forfait"
            className="inline-flex items-center gap-1.5 text-orange-500 text-sm font-bold hover:underline mb-6 uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Volver al forfait
          </Link>

          {isPlaceholder && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold uppercase tracking-wider mb-4">
              <AlertTriangle className="w-4 h-4" />
              Este sendero utiliza datos demo. Pendiente de cargar track real.
            </div>
          )}

          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white mb-4 leading-none">
            {trail.name}
          </h1>

          <div className="flex flex-wrap items-center gap-3 mt-6">
            <TrailDifficultyBadge difficulty={trail.difficulty} size="md" />
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider ${statusCfg.bgClass} ${statusCfg.colorClass}`}>
              {statusCfg.label}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider border border-white/5">
              {getTrailTypeLabel(trail.type)}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold uppercase tracking-wider border border-white/5">
              <Map className="w-3.5 h-3.5 text-slate-500" />
              {trail.sector}
            </span>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main column */}
          <div className="lg:col-span-9 space-y-12">
            {/* Description */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block" />
                Descripción
              </h2>
              <p className="text-slate-400 text-lg leading-relaxed">
                {trail.description}
              </p>
            </div>

            {/* Stats */}
            {statusData.ok && statusData.profile && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
                    <p className="text-[11px] text-slate-500">Distancia real</p>
                    <p className="text-white font-bold">{statusData.profile.distanceKm} km</p>
                  </div>
                  <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
                    <p className="text-[11px] text-slate-500">Desnivel +</p>
                    <p className="text-green-400 font-bold">+{statusData.profile.gainM} m</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{((statusData.profile.gainM / (statusData.profile.distanceKm * 1000)) * 100).toFixed(1)}% medio</p>
                  </div>
                  <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
                    <p className="text-[11px] text-slate-500">Altitud max</p>
                    <p className="text-white font-bold">{statusData.profile.maxAltitudeM} m</p>
                  </div>
                  <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
                    <p className="text-[11px] text-slate-500">Desnivel -</p>
                    <p className="text-red-400 font-bold">-{statusData.profile.lossM} m</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{((statusData.profile.lossM / (statusData.profile.distanceKm * 1000)) * 100).toFixed(1)}% medio</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3">
                  <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
                    <p className="text-[11px] text-slate-500">Pendiente pico subida</p>
                    <p className="text-orange-400 font-bold">+{statusData.profile.steepestClimbPct}%</p>
                  </div>
                  <div className="bg-slate-900/70 border border-white/5 rounded-xl p-3">
                    <p className="text-[11px] text-slate-500">Pendiente pico bajada</p>
                    <p className="text-orange-400 font-bold">{statusData.profile.steepestDescentPct}%</p>
                  </div>
                </div>
              </div>
            )}

            {/* Map */}
            <div id="trail-map" className="relative">
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block" />
                Plano del sendero
              </h2>
              <div className="absolute right-3 top-16 z-[500] bg-slate-950/85 backdrop-blur-sm border border-white/10 rounded-lg p-2 flex gap-1.5">
                <Link href={toggleHref('climb')} className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${showSet.has('climb') ? 'bg-green-500/20 border-green-400/40 text-green-300' : 'bg-slate-800 border-white/10 text-slate-500'}`}>
                  Subidas
                </Link>
                <Link href={toggleHref('descent')} className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${showSet.has('descent') ? 'bg-red-500/20 border-red-400/40 text-red-300' : 'bg-slate-800 border-white/10 text-slate-500'}`}>
                  Bajadas
                </Link>
                <Link href={toggleHref('flat')} className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border ${showSet.has('flat') ? 'bg-amber-500/20 border-amber-400/40 text-amber-300' : 'bg-slate-800 border-white/10 text-slate-500'}`}>
                  Tramos
                </Link>
              </div>
              <TrailDetailMapWrapper
                trail={trail}
                focusStartKm={focusStartKm}
                focusEndKm={focusEndKm}
                focusPointKm={focusPointKm}
                segmentOverlays={segmentOverlays}
              />
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block" />
                Perfil y estado ahora
              </h2>
              <TrailNowInsights
                slug={trail.slug}
                activeOverlayTypes={{
                  climb: showSet.has('climb'),
                  descent: showSet.has('descent'),
                  flat: showSet.has('flat'),
                }}
              />
            </div>

            {/* Related routes */}
            {relatedRoutes.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                  <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block" />
                  Rutas relacionadas
                </h2>
                <div className="space-y-3">
                  {relatedRoutes.map(r => r && (
                    <Link
                      key={r.slug}
                      href={`/rutas/${r.slug}`}
                      className="flex items-center justify-between bg-slate-900/50 border border-white/5 rounded-xl p-4 hover:border-orange-500/30 transition-all group"
                    >
                      <div>
                        <p className="text-white font-bold text-sm group-hover:text-orange-500 transition-colors">{r.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{r.sector} · {r.distanceKm} km</p>
                      </div>
                      <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-orange-500 transition-colors flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-8">
            {/* Ratings */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Signal className="w-5 h-5 text-orange-500" />
                Niveles
              </h3>
              <RatingRow label="Técnica" rating={trail.technicalRating} />
              <RatingRow label="Física" rating={trail.physicalRating} />
            </div>

            {/* Warnings sidebar */}
            {trail.warnings.length > 0 && (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Advertencias
                </h3>
                <ul className="space-y-3">
                  {trail.warnings.map((w, i) => (
                    <li key={i} className="flex items-start gap-3 text-amber-400/80">
                      <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                      <span className="text-slate-400 text-sm">{w}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Franjas recomendadas */}
            {statusData.ok && statusData.recommendedWindows && statusData.recommendedWindows.length > 0 && (
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-5">
                <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-orange-500" />
                  Salida recomendada hoy
                </h3>
                <div className="space-y-3">
                  {statusData.recommendedWindows.map((w) => {
                    const slotIcon = w.slot === 'manana' ? '\u{1F305}' : w.slot === 'tarde' ? '\u{2600}\u{FE0F}' : '\u{1F319}';
                    const borderColor = w.riskLevel === 'red' ? 'border-red-500/30' : w.riskLevel === 'yellow' ? 'border-amber-500/30' : 'border-green-500/30';
                    const bgAccent = w.riskLevel === 'red' ? 'bg-red-500/5' : w.riskLevel === 'yellow' ? 'bg-amber-500/5' : 'bg-green-500/5';
                    return (
                      <div key={w.slot} className={`flex flex-col bg-slate-950/40 border ${borderColor} rounded-xl p-3 ${bgAccent}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{slotIcon}</span>
                            <div>
                              <p className="text-sm text-white font-bold capitalize leading-tight">{w.slot}</p>
                              <p className="text-[10px] text-slate-500 font-mono">{w.timeRange}</p>
                            </div>
                          </div>
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            w.riskLevel === 'red' ? 'bg-red-500/15 text-red-300' : w.riskLevel === 'yellow' ? 'bg-amber-500/15 text-amber-300' : 'bg-green-500/15 text-green-300'
                          }`}>{w.label}</span>
                        </div>
                        {'data' in w && w.data && (
                          <div className="grid grid-cols-2 gap-1 mb-1.5 text-[10px]">
                            <div className="bg-slate-900/60 rounded px-1.5 py-1"><span className="text-slate-500">Temp </span><span className="text-slate-200 font-medium">{w.data.temperatureC?.toFixed(0) ?? '--'} C</span></div>
                            <div className="bg-slate-900/60 rounded px-1.5 py-1"><span className="text-slate-500">Viento </span><span className="text-slate-200 font-medium">{w.data.windKmh?.toFixed(0) ?? '--'} km/h</span></div>
                            <div className="bg-slate-900/60 rounded px-1.5 py-1"><span className="text-slate-500">Lluvia </span><span className="text-slate-200 font-medium">{w.data.precipitationMm?.toFixed(1) ?? '--'} mm</span></div>
                            <div className="bg-slate-900/60 rounded px-1.5 py-1"><span className="text-slate-500">Humedad </span><span className="text-slate-200 font-medium">{w.data.humidityPct?.toFixed(0) ?? '--'}%</span></div>
                          </div>
                        )}
                        <p className="text-[11px] text-slate-400 leading-relaxed">{w.reason}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <TrailSidebarControls />

            {/* Downloads */}
            <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-orange-500" />
                Descargas
              </h3>
              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Descarga los archivos GPX o KML para usarlos en tu dispositivo GPS o smartphone.
              </p>
              <div className="space-y-3">
                {hasGpx ? (
                  <a href={trail.gpxFile} download className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all mb-2">
                    <Download className="w-4 h-4" />
                    Descargar GPX
                  </a>
                ) : (
                  <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-slate.500 rounded-xl text-sm font-medium mb-2">
                    <Download className="w-4 h-4" />
                    GPX pendiente
                  </div>
                )}
                {hasKml ? (
                  <a href={trail.kmlFile} download className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all">
                    <Download className="w-4 h-4" />
                    Descargar KML
                  </a>
                ) : hasGpx ? (
                  <div className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800/50 text-slate.500 rounded-xl text-sm font-medium">
                    <Download className="w-4 h-4" />
                    KML pendiente
                  </div>
                ) : null}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-slate-400 leading-relaxed">
                  Esta clasificación es orientativa. La dificultad real puede variar por meteorología, erosión, vegetación, obras, batidas, ganado, fatiga o nivel técnico del ciclista. Antes de salir, revisa el track, el estado de la ruta y tu material.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
