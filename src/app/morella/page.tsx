import TopoBackground from '@/components/TopoBackground';
import SectionHeading from '@/components/SectionHeading';
import { MapPin, Castle, Utensils, TreePine, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function MorellaPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Hero */}
      <section className="relative py-32 px-6 overflow-hidden">
        <TopoBackground />
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-950 z-10"></div>
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1575548393466-0df1618ba410?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center"></div>
        </div>
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8">
            <MapPin className="w-4 h-4" />
            Destino
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-none">
            Descubre <span className="text-orange-500">Morella</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Mucho más que un destino de MTB. Un viaje a través de la historia, la gastronomía y la naturaleza de Els Ports.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 text-orange-500 mb-4">
                  <Castle className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Patrimonio</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Patrimonio Histórico</h2>
                <p className="text-slate-400 leading-relaxed">
                  Morella es una ciudad medieval impresionante, rodeada de murallas y con un castillo que domina el paisaje. Sus calles empedradas y su arquitectura te transportarán a otra época. Declarada Conjunto Histórico-Artístico, su casco antiguo es un laberinto de callejuelas que invita a perderse.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 text-orange-500 mb-4">
                  <Utensils className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Gastronomía</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Gastronomía Local</h2>
                <p className="text-slate-400 leading-relaxed">
                  Después de una jornada intensa de pedaleo, nada mejor que disfrutar de la cocina local. Morella ofrece una oferta gastronómica excepcional que combina tradición y calidad. No te pierdas sus embutidos, trufa negra y los vinos de la comarca.
                </p>
              </div>
            </div>
            <div className="space-y-8">
              <div>
                <div className="flex items-center gap-2 text-orange-500 mb-4">
                  <TreePine className="w-5 h-5" />
                  <span className="text-xs font-bold uppercase tracking-widest">Naturaleza</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-4">Naturaleza y Paisaje</h2>
                <p className="text-slate-400 leading-relaxed">
                  La Comarca de Els Ports es un paraíso de biodiversidad. Montañas, bosques y ríos te esperan para una experiencia de conexión total con la naturaleza. Espacios protegidos como el Paraje Natural de Celumbres albergan una riqueza natural única.
                </p>
              </div>
              <div className="h-64 rounded-2xl overflow-hidden border border-white/5">
                <img 
                  src="https://images.unsplash.com/photo-1548013146-72479768bbaa?auto=format&fit=crop&q=80&w=1000" 
                  alt="Morella" 
                  className="w-full h-full object-cover opacity-80"
                />
              </div>
            </div>
          </div>

          {/* Alojamiento CTA */}
          <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-3xl p-12 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">¿Quieres quedarte?</h2>
            <p className="text-slate-400 mb-8 text-lg max-w-2xl mx-auto">
              Descubre los mejores alojamientos en Morella y la Comarca para tu estancia deportiva.
            </p>
            <a 
              href="mailto:info@casesdemorella.com" 
              className="inline-flex items-center gap-2 px-8 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all"
            >
              info@casesdemorella.com <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Link to routes */}
          <div className="text-center">
            <Link 
              href="/rutas" 
              className="inline-flex items-center gap-2 text-orange-500 font-bold border-b border-orange-500/30 pb-1 hover:text-orange-400 transition-colors"
            >
              Explorar rutas en Morella
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
