import React from 'react';
import Link from 'next/link';
import { 
  Map, 
  ArrowRight,
  MountainIcon,
  Bike,
  ChevronRight,
  Calendar,
  ShieldCheck,
  MapPin
} from 'lucide-react';
import TopoBackground from '@/components/TopoBackground';
import SectionHeading from '@/components/SectionHeading';
import RouteCard from '@/components/RouteCard';
import { routes, sectors } from '@/data/routes';

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* --- HERO SECTION --- */}
      <section className="relative h-[90vh] flex items-center justify-center overflow-hidden">
        <TopoBackground />
        {/* Placeholder for Video/Image */}
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-slate-950/60 z-10"></div>
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center"></div>
        </div>

        <div className="relative z-20 text-center px-6 max-w-5xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8">
            <MountainIcon className="w-4 h-4" />
            Morella & Els Ports
          </div>
          <h1 className="text-5xl md:text-8xl font-black tracking-tighter text-white mb-6 leading-none">
            MORELLA <br />
            <span className="text-orange-500">SINGLETRACKS</span>
          </h1>
          <p className="text-xl md:text-3xl font-light text-slate-300 mb-12 max-w-3xl mx-auto leading-relaxed">
            Enduro, all-mountain y sendas históricas en Els Ports.
          </p>
          <p className="text-lg text-slate-400 mb-12 max-w-2xl mx-auto">
            Rutas autoguiadas por GPS para descubrir la esencia de Morella sobre dos ruedas.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-5 justify-center items-center">
            <Link 
              href="/rutas" 
              className="w-full sm:w-auto px-10 py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold text-lg transition-all shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2"
            >
              Explorar rutas <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              href="/planifica" 
              className="w-full sm:w-auto px-10 py-4 bg-white/5 hover:bg-white/10 backdrop-blur-md text-white border border-white/10 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2"
            >
              Planificar viaje
            </Link>
          </div>
        </div>
      </section>

      {/* --- SECTORES SECTION --- */}
      <section className="py-24 px-6 relative">
        <div className="max-w-7xl mx-auto">
          <SectionHeading 
            title="Rutas por Sectores" 
            subtitle="Explora las diferentes zonas que hacen de Morella un destino único."
          />
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {sectors.map((sector) => (
              <Link key={sector.id} href={`/rutas?sector=${encodeURIComponent(sector.name)}`} className="group">
                <div className="bg-slate-900 border border-white/5 p-6 rounded-2xl hover:border-orange-500/50 transition-all h-full">
                  <h3 className="text-lg font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">{sector.name}</h3>
                  <p className="text-slate-500 text-xs leading-relaxed mb-4">{sector.description}</p>
                  <div className="flex items-center text-[10px] font-bold text-orange-500 uppercase tracking-widest">
                    Explorar <ChevronRight className="w-3 h-3 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* --- TOP TRACKS SECTION --- */}
      <section className="py-24 px-6 bg-slate-950/50 relative">
        <TopoBackground />
        <div className="max-w-7xl mx-auto relative z-10">
          <SectionHeading 
            title="Top Tracks" 
            subtitle="Nuestros tramos más técnicos y emblemáticos. El corazón del enduro."
            align="center"
          />
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {routes.slice(0, 3).map(route => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>
        </div>
      </section>

      {/* --- TRAVESÍAS SECTION --- */}
      <section className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/10 rounded-3xl overflow-hidden flex flex-col md:flex-row">
            <div className="md:w-1/2 h-64 md:h-auto relative">
              <div className="absolute inset-0 bg-slate-800">
                <img src="https://images.unsplash.com/photo-1551632432-0a7a845599d1?auto=format&fit=crop&q=80&w=1000" alt="Travesías" className="w-full h-full object-cover opacity-60" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 to-transparent"></div>
            </div>
            <div className="md:w-1/2 p-12 flex flex-col justify-center">
              <div className="flex items-center gap-2 text-orange-500 mb-4">
                <Calendar className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">Expediciones</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Travesías de varios días</h2>
              <p className="text-slate-400 text-lg mb-8">
                Para quienes buscan una inmersión total. Itinerarios diseñados para vivir la montaña durante varios días.
              </p>
              <Link href="/travesias" className="text-white font-bold flex items-center gap-2 hover:text-orange-500 transition-colors">
                Ver itinerarios <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- PLANIFICA & SEGURIDAD SECTION --- */}
      <section className="py-24 px-6 bg-slate-950">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="space-y-8">
            <SectionHeading title="Planifica tu estancia" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-900 border border-white/5 rounded-2xl">
                <Map className="w-8 h-8 text-orange-500 mb-4" />
                <h4 className="text-white font-bold mb-2">GPS & Mapas</h4>
                <p className="text-slate-400 text-sm">Descarga tracks GPX listos para usar en Garmin o móvil.</p>
              </div>
              <div className="p-6 bg-slate-900 border border-white/5 rounded-2xl">
                <Bike className="w-8 h-8 text-orange-500 mb-4" />
                <h4 className="text-white font-bold mb-2">E-Bike Ready</h4>
                <p className="text-slate-400 text-sm">Rutas adaptadas para disfrutar al máximo con asistencia.</p>
              </div>
            </div>
            <Link href="/planifica" className="inline-block text-orange-500 font-bold border-b border-orange-500/30 pb-1 hover:text-orange-400 transition-colors">
              Ver guía completa de planificación
            </Link>
          </div>

          <div className="space-y-8">
            <SectionHeading title="Seguridad" />
            <div className="p-8 bg-orange-500/5 border border-orange-500/20 rounded-3xl">
              <div className="flex items-start gap-4">
                <ShieldCheck className="w-10 h-10 text-orange-500 flex-shrink-0" />
                <div>
                  <h4 className="text-white font-bold text-xl mb-3">Tu seguridad es primero</h4>
                  <p className="text-slate-400 text-sm leading-relaxed">
                    Las rutas son autoguiadas. Es fundamental conocer tu nivel, llevar equipo adecuado y consultar la meteorología.
                  </p>
                </div>
              </div>
              <Link href="/seguridad" className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-orange-500 hover:text-orange-400 transition-colors">
                Leer consejos de seguridad <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* --- MORELLA SECTION --- */}
      <section className="py-24 px-6 relative overflow-hidden">
        <TopoBackground />
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center gap-16">
          <div className="md:w-1/2 relative">
            <div className="absolute -top-4 -left-4 w-24 h-24 bg-orange-500/20 rounded-full blur-3xl"></div>
            <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
            <img 
              src="https://images.unsplash.com/photo-1548013146-72479768bbaa?auto=format&fit=crop&q=80&w=1000" 
              alt="Morella" 
              className="rounded-3xl shadow-2xl relative z-10"
            />
          </div>
          <div className="md:w-1/2">
            <div className="flex items-center gap-2 text-orange-500 mb-4">
              <MapPin className="w-5 h-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Destino</span>
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Morella: El corazón de la aventura</h2>
            <p className="text-slate-400 text-lg leading-relaxed mb-8">
              Más que un destino de MTB, Morella es un viaje al pasado. Sus murallas medievales, su castillo imponente y la naturaleza indómita de Els Ports te esperan para una experiencia inolvidable.
            </p>
            <Link href="/morella" className="inline-flex items-center gap-2 px-8 py-3 bg-white text-slate-950 rounded-xl font-bold hover:bg-orange-500 hover:text-white transition-all">
              Descubrir Morella <ArrowRight className="w-5 h-5" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}



