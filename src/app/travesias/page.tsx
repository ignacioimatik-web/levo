import TopoBackground from '@/components/TopoBackground';
import SectionHeading from '@/components/SectionHeading';
import { Calendar, MountainIcon, Clock, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function TravesiasPage() {
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
            Travesías de <span className="text-orange-500">Varios Días</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Itinerarios diseñados para una inmersión total en la naturaleza de Els Ports.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-16 text-center">
            <MountainIcon className="w-16 h-16 text-orange-500 mx-auto mb-6" />
            <h2 className="text-3xl font-bold text-white mb-4">Próximamente</h2>
            <p className="text-slate-400 text-lg max-w-2xl mx-auto leading-relaxed mb-8">
              Estamos preparando rutas de varios días con logística detallada, puntos de avituallamiento y alojamientos recomendados. 
              Itinerarios que abarcan varios sectores para vivir la experiencia completa de Enduro Singletracks.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link 
                href="/rutas" 
                className="inline-flex items-center gap-2 px-8 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all"
              >
                Explorar rutas de un día <ArrowRight className="w-4 h-4" />
              </Link>
              <Link 
                href="/contacto" 
                className="inline-flex items-center gap-2 px-8 py-3 bg-white/5 text-white border border-white/10 rounded-xl font-bold hover:bg-white/10 transition-all"
              >
                Sugerir una travesía
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
