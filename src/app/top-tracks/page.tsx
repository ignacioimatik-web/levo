import TopoBackground from '@/components/TopoBackground';
import SectionHeading from '@/components/SectionHeading';
import { Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import RouteCard from '@/components/RouteCard';
import { routes } from '@/data/routes';

export default function TopTracksPage() {
  const topRoutes = routes.filter(r => ["coronel-perdido", "garumba-gigante", "big-peter"].includes(r.slug));

  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Hero */}
      <section className="relative py-32 px-6 overflow-hidden">
        <TopoBackground />
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-950 z-10"></div>
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1544198365-f5d60b6d8190?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center"></div>
        </div>
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8">
            <Zap className="w-4 h-4" />
            Lo mejor de Morella
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-none">
            Top <span className="text-orange-500">Tracks</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Los tramos técnicos, las bajadas más emocionantes y los singletracks más emblemáticos de Morella Singletracks.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {topRoutes.map(route => (
              <RouteCard key={route.id} route={route} />
            ))}
          </div>

          <div className="mt-16 text-center">
            <Link 
              href="/rutas" 
              className="inline-flex items-center gap-2 px-8 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all"
            >
              Ver todas las rutas <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
