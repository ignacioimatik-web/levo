import Link from 'next/link';
import { routes } from '@/data/routes';
import SectionHeading from '@/components/SectionHeading';
import RouteCard from '@/components/RouteCard';
import { Filter } from 'lucide-react';

export default function RutasPage() {
  return (
    <div className="py-12 px-6 max-w-7xl mx-auto min-h-screen">
      <SectionHeading 
        title="Biblioteca de Rutas" 
        subtitle="Explora nuestra selección de rutas de MTB y Enduro en Morella. Filtra por sector, dificultad o distancia."
      />

      {/* Filters Placeholder */}
      <div className="mb-12 p-6 bg-slate-900/50 backdrop-blur-md rounded-2xl border border-white/10 flex flex-wrap gap-6 items-end shadow-xl">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Sector</label>
          <select className="bg-slate-800 border border-white/10 text-white text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 outline-none">
            <option>Todos los sectores</option>
            <option>Bergantes</option>
            <option>Celumbres</option>
            <option>El Riu de les Corces</option>
            <option>Peter Rules</option>
            <option>Torre Miró - Xiva</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Dificultad</label>
          <select className="bg-slate-800 border border-white/10 text-white text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 outline-none">
            <option>Todas</option>
            <option>Verde</option>
            <option>Azul</option>
            <option>Roja</option>
            <option>Negra</option>
          </select>
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Tipo</label>
          <select className="bg-slate-800 border border-white/10 text-white text-sm rounded-lg focus:ring-orange-500 focus:border-orange-500 block p-2.5 outline-none">
            <option>Todos</option>
            <option>Circular</option>
            <option>Lineal</option>
            <option>Travesía</option>
          </select>
        </div>
        <div className="ml-auto hidden sm:block">
          <button className="flex items-center gap-2 text-sm font-bold text-slate-400 hover:text-white transition-colors">
            <Filter className="w-4 h-4" />
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Routes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {routes.map((route) => (
          <RouteCard key={route.id} route={route} />
        ))}
      </div>
    </div>
  );
}

