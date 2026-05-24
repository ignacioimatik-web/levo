import Link from 'next/link';
import { Mountain, Instagram, Facebook, Twitter } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="bg-slate-950 border-t border-white/5 pt-16 pb-8 px-6 text-slate-400">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <Mountain className="w-5 h-5 text-orange-500" />
            <span className="text-white font-black tracking-tighter uppercase">
              Morella <span className="text-orange-500">Singletracks</span>
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-500">
            Descubre el paraíso del Enduro y All-Mountain en los paisajes salvajes de Els Ports. Rutas autoguiadas por GPS.
          </p>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6">Explorar</h4>
          <ul className="space-y-4 text-sm">
            <li><Link href="/rutas" className="hover:text-orange-500 transition-colors">Biblioteca de Rutas</Link></li>
            <li><Link href="/sectores" className="hover:text-orange-500 transition-colors">Sectores</Link></li>
            <li><Link href="/top-tracks" className="hover:text-orange-500 transition-colors">Top Tracks</Link></li>
            <li><Link href="/travesias" className="hover:text-orange-500 transition-colors">Travesías</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6">Información</h4>
          <ul className="space-y-4 text-sm">
            <li><Link href="/planifica" className="hover:text-orange-500 transition-colors">Planifica tu viaje</Link></li>
            <li><Link href="/morella" className="hover:text-orange-500 transition-colors">Turismo Morella</Link></li>
            <li><Link href="/seguridad" className="hover:text-orange-500 transition-colors">Seguridad</Link></li>
            <li><Link href="/contacto" className="hover:text-orange-500 transition-colors">Contacto</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6">Síguenos</h4>
          <div className="flex gap-4">
            <a href="#" className="p-2 bg-slate-900 rounded-full hover:text-orange-500 transition-colors"><Facebook className="w-5 h-5" /></a>
            <a href="#" className="p-2 bg-slate-900 rounded-full hover:text-orange-500 transition-colors"><Twitter className="w-5 h-5" /></a>
            <a href="#" className="p-2 bg-slate-900 rounded-full hover:text-orange-500 transition-colors"><Instagram className="w-5 h-5" /></a>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
        <p>© {new Date().getFullYear()} Morella Singletracks. Todos los derechos reservados.</p>
        <div className="flex gap-6">
          <Link href="/seguridad" className="hover:text-white">Aviso Legal</Link>
          <Link href="/contacto" className="hover:text-white">Privacidad</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
