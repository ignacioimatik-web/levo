import { Metadata } from 'next';
import { routes } from '@/data/routes';
import { demoTrails } from '@/data/trails';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import RouteMapWrapper from '@/components/RouteMapWrapper';
import { 
  Download, 
  AlertTriangle, 
  Info, 
  Navigation, 
  TrendingUp, 
  Timer, 
  Mountain,
  Map,
  ChevronRight
} from 'lucide-react';
import TrailDifficultyBadge from '@/components/TrailDifficultyBadge';
import { getTrailStatusLabel } from '@/lib/trail-utils';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const route = routes.find((r) => r.slug === slug);

  if (!route) {
    return {
      title: 'Ruta no encontrada',
    };
  }

  return {
    title: `${route.name} | E-nduro Singletracks`,
    description: `${route.summary}. Descubre los detalles técnicos, dificultad y descarga el track GPX para tu aventura de MTB en ${route.sector}.`,
    openGraph: {
      title: `${route.name} | E-nduro Singletracks`,
      description: route.summary,
      type: 'article',
      images: route.images.length > 0 ? [
        {
          url: route.images[0],
          width: 1200,
          height: 630,
          alt: route.name,
        },
      ] : [],
    },
  };
}

export default async function RouteDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const route = routes.find((r) => r.slug === slug);

  if (!route) {
    notFound();
  }

  const isClosed = route.status === 'cerrada-temporalmente';
  const isPending = route.status === 'pendiente-datos';

  return (
    <div className="py-12 px-6 max-w-5xl mx-auto min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <Link href="/rutas" className="text-orange-500 text-sm font-bold hover:underline mb-4 inline-block uppercase tracking-widest">
          &larr; Volver a rutas
        </Link>
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4">{route.name}</h1>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-white/10">{route.sector}</span>
          <span className="bg-slate-800 text-slate-300 px-3 py-1 rounded-full border border-white/10 capitalize">{route.type}</span>
          <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full border border-orange-500/30 font-bold">
            Dificultad: {route.physicalDifficulty}
          </span>
        </div>
      </div>

      {/* Status Alert */}
      {isClosed && (
        <div className="mb-8 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl flex items-center gap-4 text-red-400">
          <AlertTriangle className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-bold">Esta ruta está cerrada temporalmente.</p>
            <p className="text-sm opacity-80">Por favor, consulta otros sectores o espera a que se restablezca el acceso.</p>
          </div>
        </div>
      )}

      {isPending && (
        <div className="mb-8 p-4 bg-orange-500/10 border border-orange-500/50 rounded-2xl flex items-center gap-4 text-orange-400">
          <Info className="w-6 h-6 flex-shrink-0" />
          <div>
            <p className="font-bold">Información técnica pendiente.</p>
            <p className="text-sm opacity-80">Estamos trabajando para completar todos los detalles de esta ruta.</p>
          </div>
        </div>
      )}

      {/* Hero Image / Map */}
      <div className="w-full h-[400px] relative overflow-hidden rounded-3xl shadow-2xl border border-white/5 mb-12">
        {route.trackUrl ? (
          <RouteMapWrapper 
            gpxUrl={route.trackUrl} 
            title={route.name}
          />
        ) : (
          <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-500 italic">
            Imagen de la ruta {route.name}
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block" />
              Descripción
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed whitespace-pre-line">
              {route.description || "Descripción pendiente de completar."}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block" />
              Recomendaciones
            </h2>
            <ul className="space-y-3">
              {route.warnings.length > 0 ? (
                route.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-3 text-slate-400">
                    <AlertTriangle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                    <span>{w}</span>
                  </li>
                ))
              ) : (
                <li className="text-slate-500 italic">No hay advertencias específicas para esta ruta.</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block" />
              Puntos de Interés
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {route.waterPoints.length > 0 ? (
                route.waterPoints.map((wp, i) => (
                  <div key={i} className="flex items-center gap-3 bg-slate-900/50 p-4 rounded-xl border border-white/5 text-slate-300">
                    <span className="text-blue-500">💧</span> {wp}
                  </div>
                ))
              ) : (
                <p className="text-slate-500 italic">Información sobre puntos de agua pendiente.</p>
              )}
            </div>
          </section>

          {route.trailSlugs && route.trailSlugs.length > 0 && (
            <section>
              <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block" />
                Senderos incluidos en esta ruta
              </h2>
              <div className="space-y-3">
                {route.trailSlugs.map(slug => {
                  const trail = demoTrails.find(t => t.slug === slug);
                  if (!trail) return null;
                  const statusCfg = getTrailStatusLabel(trail.status);
                  return (
                    <div key={trail.id} className="bg-slate-900/50 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-white font-bold text-sm truncate">{trail.name}</h4>
                          {trail.dataStatus === "placeholder" && (
                            <span className="text-[8px] text-amber-400/70 font-bold uppercase tracking-wider bg-amber-500/10 px-1.5 py-0.5 rounded flex-shrink-0">Demo</span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <TrailDifficultyBadge difficulty={trail.difficulty} />
                          <span className="text-[10px] text-slate-500">{trail.sector}</span>
                          <span className="text-[10px] text-slate-600">·</span>
                          <span className={`text-[10px] font-medium ${statusCfg.colorClass}`}>{statusCfg.label}</span>
                        </div>
                      </div>
                      <Link
                        href="/forfait"
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:text-orange-400 hover:border-orange-500/30 text-[11px] font-bold uppercase tracking-wider transition-all flex-shrink-0"
                      >
                        <Map className="w-3.5 h-3.5" />
                        Ver en forfait
                        <ChevronRight className="w-3 h-3" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>

        {/* Sidebar: Stats & Downloads */}
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6">Ficha Técnica</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate.500 text-sm">Distancia</span>
                <span className="font-bold text-white">{route.distanceKm ? `${route.distanceKm} km` : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate.500 text-sm">Desnivel (+)</span>
                <span className="font-bold text-white">{route.elevationGainM ? `${route.elevationGainM} m` : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate.500 text-sm">Desnivel (-)</span>
                <span className="font-bold text-white">{route.elevationLossM ? `${route.elevationLossM} m` : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate.500 text-sm">Senda</span>
                <span className="font-bold text-white">{route.trailPercent ? `${route.trailPercent}%` : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate.500 text-sm">Bici recomendada</span>
                <span className="font-bold text-white text-right text-xs">{route.recommendedBike.join(', ') || '--'}</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Download className="w-5 h-5 text-orange-500" />
              Descargar Track
            </h3>
            <p className="text-xs text-slate-400 mb-6 leading-relaxed">
              Descarga los archivos GPX o KML para usarlos en tu dispositivo GPS o smartphone.
            </p>
            <div className="space-y-3">
              <a
                href={route.trackUrl || '#'}
                download
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 transition-all ${(!route.trackUrl || isClosed || isPending) ? 'pointer-events-none opacity-30' : ''}`}
              >
                <Download className="w-4 h-4" />
                Descargar GPX
              </a>
              <a
                href={route.trackUrl ? route.trackUrl.replace('.gpx', '.kml') : '#'}
                download
                className={`w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-700 transition-all ${(!route.trackUrl || isClosed || isPending) ? 'pointer-events-none opacity-30' : ''}`}
              >
                <Download className="w-4 h-4" />
                Descargar KML
              </a>
            </div>
          </div>

          <div className="bg-slate-900/50 rounded-3xl p-6 border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              Seguridad
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              El uso de estas rutas es bajo tu propia responsabilidad. Asegúrate de llevar equipo adecuado, agua y conocer tu nivel técnico.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
