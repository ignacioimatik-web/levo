import TopoBackground from '@/components/TopoBackground';
import SectionHeading from '@/components/SectionHeading';
import TrailStatsPanel from '@/components/TrailStatsPanel';
import ForfaitPageClient from '@/components/ForfaitPageClient';
import { demoTrails } from '@/data/trails';
import { Map, AlertTriangle } from 'lucide-react';

export default function ForfaitPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Hero */}
      <section className="relative py-32 px-6 overflow-hidden contour-line">
        <TopoBackground />
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/80 to-slate-950 z-10"></div>
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center opacity-50"></div>
        </div>
        <div className="absolute inset-0 z-[5] topo-pattern-subtle pointer-events-none" />
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8">
            <Map className="w-4 h-4" />
            Plano de Senderos
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 leading-none heading-gradient-strong">
            Forfait <span className="text-orange-500">MTB</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Todos los senderos de Morella Singletracks organizados como un plano de pistas.
          </p>
        </div>
      </section>

      {/* Description + Disclaimer */}
      <section className="py-16 px-6 topo-pattern-subtle">
        <div className="max-w-4xl mx-auto space-y-10">
          <div>
            <SectionHeading title="¿Qué es el Forfait MTB?" />
            <p className="text-slate-300 text-lg leading-relaxed max-w-3xl">
              El Forfait MTB organiza los senderos, tramos y rutas de Morella Singletracks como si fueran pistas de una estación de esquí: por sectores, niveles, estado y tipo de recorrido. El objetivo es que cada ciclista pueda elegir mejor su ruta, combinar tramos y entender de un vistazo la exigencia técnica y física de cada sendero.
            </p>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-6 flex items-start gap-4">
            <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-amber-400 font-bold text-sm uppercase tracking-widest mb-2">Aviso importante</h3>
              <p className="text-slate-400 text-sm leading-relaxed">
                Esta clasificación es orientativa. La dificultad real puede variar por meteorología, erosión, vegetación, obras, batidas, ganado, fatiga o nivel técnico del ciclista. Antes de salir, revisa el track, el estado de la ruta y tu material.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Panel */}
      <section className="py-16 px-6 bg-slate-950/30 contour-line">
        <div className="max-w-7xl mx-auto">
          <SectionHeading title="Estadísticas" subtitle="Resumen de los senderos catalogados en el Forfait MTB." />
          <TrailStatsPanel trails={demoTrails} />
        </div>
      </section>

      <ForfaitPageClient />
    </div>
  );
}
