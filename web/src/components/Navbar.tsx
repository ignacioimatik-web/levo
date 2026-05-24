import Link from 'next/link';
import { Mountain, Menu } from 'lucide-react';

const Navbar = () => {
  return (
    <nav className="bg-slate-950/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <Mountain className="w-6 h-6 text-orange-500 group-hover:scale-110 transition-transform" />
          <span className="text-lg font-black tracking-tighter text-white uppercase">
            Morella <span className="text-orange-500">Singletracks</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center space-x-8 text-xs font-bold uppercase tracking-widest">
          <Link href="/rutas" className="text-slate-400 hover:text-orange-500 transition-colors">Rutas</Link>
          <Link href="/sectores" className="text-slate-400 hover:text-orange-500 transition-colors">Sectores</Link>
          <Link href="/top-tracks" className="text-slate-400 hover:text-orange-500 transition-colors">Top Tracks</Link>
          <Link href="/travesias" className="text-slate-400 hover:text-orange-500 transition-colors">Travesías</Link>
          <Link href="/planifica" className="text-slate-400 hover:text-orange-500 transition-colors">Planifica</Link>
          <Link href="/morella" className="text-slate-400 hover:text-orange-500 transition-colors">Morella</Link>
        </div>

        <div className="md:hidden">
          <button className="text-white">
            <Menu className="w-6 h-6" />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
