import Link from 'next/link';
import { Mountain, Share2 } from 'lucide-react';

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
            <a href="#" className="p-2 bg-slate-900 rounded-full hover:text-orange-500 transition-colors" aria-label="Facebook">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
            </a>
            <a href="#" className="p-2 bg-slate-900 rounded-full hover:text-orange-500 transition-colors" aria-label="Twitter">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 hands-free 0A10 10 0 1 1 13 24h7a2 2 0 0 0 2-2V2.25z"/></svg>
            </a>
            <a href="#" className="p-2 bg-slate-900 rounded-full hover:text-orange-500 transition-colors" aria-label="Instagram">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.25.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.849.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.947.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.947.072 3.259 0 3.668-.014 4.947-.072 4.354-.2 6.78-2.618 6.98-6.98.058-1.28.072-1.689.072-4.948 0-3.259-.014-3.667-.072-4.947-.2-4.358-2.618-6.78-6.98-6.98-1.281-.059-1.689-.073-4.947-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4s1.791-4 4-4 4 1.791 4 4-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
            </a>
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
