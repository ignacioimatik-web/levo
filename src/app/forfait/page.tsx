import { Map } from 'lucide-react';
import TopoBackground from '@/components/TopoBackground';
import ForfaitBuilder from '@/components/forfait/ForfaitBuilder';
import { routes } from '@/data/routes';
import { loadRealTracks } from '@/lib/forfait/real-tracks';

export default async function ForfaitPage() {
  const allTracks = await loadRealTracks(routes);
  return (
    <div className="relative min-h-screen">
      {/* Hero */}
      <section className="relative py-24 px-6 overflow-hidden contour-line">
        <TopoBackground />
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/80 to-slate-950 z-10"></div>
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center opacity-50"></div>
        </div>
        <div className="absolute inset-0 z-[5] topo-pattern-subtle pointer-events-none" />
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold uppercase tracking-widest mb-6">
            <Map className="w-4 h-4" />
            Constructor de ruta MTB
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 leading-none heading-gradient-strong">
            Forfait <span className="text-orange-500">MTB</span>
          </h1>
          <p className="text-lg text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Constructor interactivo de rutas. Selecciona tracks en el mapa, combínalos y descarga tu ruta personalizada en GPX.
          </p>
        </div>
      </section>

      <ForfaitBuilder tracks={allTracks} />
    </div>
  );
}
