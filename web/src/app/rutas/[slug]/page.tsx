import { routes } from '@/data/routes';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function RouteDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const route = routes.find((r) => r.slug === slug);

  if (!route) {
    notFound();
  }

  return (
    <div className="py-12 px-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/rutas" className="text-orange-500 text-sm font-medium hover:underline mb-4 inline-block">
          &larr; Volver a rutas
        </Link>
        <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-2">{route.name}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          <span className="bg-slate-200 px-2 py-1 rounded">{route.sector}</span>
          <span className="bg-slate-200 px-2 py-1 rounded capitalize">{route.type}</span>
          <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded font-medium">
            Dificultad: {route.physicalDifficulty}
          </span>
        </div>
      </div>

      {/* Hero Image Placeholder */}
      <div className="w-full h-[400px] bg-slate-300 rounded-3xl mb-12 overflow-hidden relative">
         <div className="absolute inset-0 flex items-center justify-center text-slate-500 italic">
           Imagen de la ruta {route.name}
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-12">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Descripción</h2>
            <p className="text-lg text-slate-600 leading-relaxed whitespace-pre-line">
              {route.description || "Descripción pendiente de completar."}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Recomendaciones</h2>
            <ul className="list-disc list-inside text-slate-600 space-y-2">
              {route.warnings.length > 0 ? (
                route.warnings.map((w, i) => <li key={i}>{w}</li>)
              ) : (
                <li>No hay advertencias específicas para esta ruta.</li>
              )}
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Puntos de Interés</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {route.waterPoints.length > 0 ? (
                route.waterPoints.map((wp, i) => (
                  <div key={i} className="flex items-center gap-2 text-slate-600">
                    <span className="text-blue-500">💧</span> {wp}
                  </div>
                ))
              ) : (
                <p className="text-slate-500">Información sobre puntos de agua pendiente.</p>
              )}
            </div>
          </section>
        </div>

        {/* Sidebar: Stats & Downloads */}
        <div className="space-y-8">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-6">Ficha Técnica</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-slate-500">Distancia</span>
                <span className="font-semibold">{route.distanceKm ? `${route.distanceKm} km` : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Desnivel (+)</span>
                <span className="font-semibold">{route.elevationGainM ? `${route.elevationGainM} m` : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Desnivel (-)</span>
                <span className="font-semibold">{route.elevationLossM ? `${route.elevationLossM} m` : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Senda</span>
                <span className="font-semibold">{route.trailPercent ? `${route.trailPercent}%` : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Bici recomendada</span>
                <span className="font-semibold">{route.recommendedBike.join(', ') || '--'}</span>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 rounded-2xl p-6 border border-orange-100">
            <h3 className="text-lg font-bold text-orange-900 mb-4">Descargar Track</h3>
            <p className="text-sm text-orange-800 mb-6">
              Descarga los archivos GPX o KML para usarlos en tu dispositivo GPS o smartphone.
            </p>
            <div className="space-y-3">
              <button 
                disabled={route.status === "pendiente-datos"}
                className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors disabled:opacity-50"
              >
                Descargar GPX
              </button>
              <button 
                disabled={route.status === "pendiente-datos"}
                className="w-full bg-white text-orange-600 border border-orange-200 py-3 rounded-xl font-bold hover:bg-orange-50 transition-colors disabled:opacity-50"
              >
                Descargar KML
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl p-6 text-white">
            <h3 className="text-lg font-bold mb-4">Aviso de Seguridad</h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              El uso de estas rutas es bajo tu propia responsabilidad. Asegúrate de llevar equipo adecuado, agua y conocer tu nivel técnico.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
