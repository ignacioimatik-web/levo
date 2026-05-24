import { routes } from '@/data/routes';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { 
  Download, 
  AlertTriangle, 
  Info, 
  Navigation, 
  TrendingUp, 
  Timer, 
  Mountain
} from 'lucide-react';
import { Metadata } from 'next';

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
    title: route.name,
    description: `${route.summary}. Descubre los detalles técnicos, dificultad y descarga el track GPX para tu aventura de MTB en ${route.sector}.`,
    openGraph: {
      title: `${route.name} | Morella Singletracks`,
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

      {/* Hero Image Placeholder */}
      <div className="w-full h-[400px] bg-slate-800 rounded-3xl mb-12 overflow-hidden relative shadow-2xl">
         <div className="absolute inset-0 flex items-center justify-center text-slate-500 italic">
           Imagen de la ruta {route.name}
         </div>
         {route.images.length > 0 && (
           <img src={route.images[0]} alt={route.name} className="w-full h-full object-cover opacity-80" />
         )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block"></span>
              Descripción
            </h2>
            <p className="text-lg text-slate-400 leading-relaxed whitespace-pre-line">
              {route.description || "Descripción pendiente de completar."}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
              <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block"></span>
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
              <span className="w-1.5 h-8 bg-orange-500 rounded-full inline-block"></span>
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
        </div>

        {/* Sidebar: Stats & Downloads */}
        <div className="space-y-8">
          <div className="bg-slate-900 rounded-3xl p-6 shadow-xl border border-white/10">
            <h3 className="text-lg font-bold text-white mb-6">Ficha Técnica</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm">Distancia</span>
                <span className="font-bold text-white">{route.distanceKm ? `${route.distanceKm} km` : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm">Desnivel (+)</span>
                <span className="font-bold text-white">{route.elevationGainM ? `${route.elevationGainM} m` : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm">Desnivel (-)</span>
                <span className="font-bold text-white">{route.elevationLossM ? `${route.elevationLossM} m` : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm">Senda</span>
                <span className="font-bold text-white">{route.trailPercent ? `${route.trailPercent}%` : '--'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 text-sm">Bici recomendada</span>
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
              <button 
                disabled={isClosed || isPending || !route.trackUrl}
                className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar GPX
              </button>
              <button 
                disabled={isClosed || isPending || !route.trackUrl}
                className="w-full bg-slate-800 text-white py-3 rounded-xl font-bold hover:bg-slate-700 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                Descargar KML
              </button>
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
