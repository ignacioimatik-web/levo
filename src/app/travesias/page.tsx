import TopoBackground from '@/components/TopoBackground';
import { Calendar, Route as RouteIcon, ArrowRight, MapPinned } from 'lucide-react';
import Link from 'next/link';
import RouteCard from '@/components/RouteCard';
import { routes } from '@/data/routes';

export default function TravesiasPage() {
  const traverses = routes.filter((route) => route.type === 'travesia' && route.status === 'publicada');

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Hero */}
      <section className="relative py-32 px-6 overflow-hidden">
        <TopoBackground />
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-950 z-10"></div>
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1568991004407-cdd5d0930945?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center"></div>
        </div>
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8">
            <Calendar className="w-4 h-4" />
            Expediciones
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-none">
            Travesías y <span className="text-orange-500">Grandes Etapas</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Tracks lineales reales para cruzar Els Ports, con navegación, meteo por tramos y preparación logística.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
            <div>
              <div className="mb-8 flex items-end justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.22em] text-orange-500">Tracks disponibles</p>
                  <h2 className="mt-2 text-3xl font-black text-white">Etapas listas para preparar</h2>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">
                  {traverses.length} {traverses.length === 1 ? 'etapa real' : 'etapas reales'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {traverses.map((route) => <RouteCard key={route.id} route={route} />)}
              </div>
            </div>

            <div className="h-fit rounded-3xl border border-orange-500/20 bg-orange-500/5 p-7 lg:sticky lg:top-24">
              <MapPinned className="h-10 w-10 text-orange-500" />
              <h2 className="mt-5 text-2xl font-black text-white">Convierte cualquier GPX en una salida guiada</h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Importa una etapa propia, analiza viento, temperatura, humedad, autonomía y luz restante; después guarda el mapa para navegar sin cobertura.
              </p>
              <Link
                href="/planifica"
                className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-orange-600"
              >
                <RouteIcon className="h-4 w-4" />
                Crear o importar etapa
              </Link>
              <Link
                href="/rutas"
                className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                Ver todas las rutas <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
