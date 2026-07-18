import Link from 'next/link';

const Footer = () => {
  return (
    <footer className="bg-slate-950 border-t border-white/5 pt-16 pb-24 md:pb-8 px-6 text-slate-400">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
        <div className="col-span-1 md:col-span-1">
          <div className="flex items-center gap-2 mb-6">
            <img
              src="/images/logo-enduro-ebiketracks.png"
              alt="E-nduro Ebiketracks"
              className="h-6 w-auto"
            />
            <span className="text-white font-black tracking-tighter uppercase">
              E-nduro <span className="text-orange-500">Ebiketracks</span>
            </span>
          </div>
          <p className="text-sm leading-relaxed text-slate-500">
            Descubre el paraíso del Enduro y All-Mountain en los paisajes salvajes de Els Ports. Rutas autoguiadas por GPS.
          </p>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6">Explorar</h4>
          <ul className="text-sm">
            <li><Link href="/rutas" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Biblioteca de Rutas</Link></li>
            <li><Link href="/sectores" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Sectores</Link></li>
            <li><Link href="/top-tracks" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Top Tracks</Link></li>
            <li><Link href="/travesias" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Travesías</Link></li>
            <li><Link href="/forfait" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Forfait MTB</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="text-white font-bold text-sm uppercase tracking-widest mb-6">Información</h4>
          <ul className="text-sm">
            <li><Link href="/quienes-somos" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Quiénes Somos</Link></li>
            <li><Link href="/planifica" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Planifica tu viaje</Link></li>
            <li><Link href="/morella" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Turismo Morella</Link></li>
            <li><Link href="/seguridad" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Seguridad</Link></li>
            <li><Link href="/contacto" className="inline-flex min-h-11 items-center hover:text-orange-500 transition-colors">Contacto</Link></li>
          </ul>
        </div>

        <div className="rounded-2xl border border-orange-500/15 bg-orange-500/5 p-5">
          <h4 className="text-white font-bold text-sm uppercase tracking-widest">Beta privada</h4>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Estamos centrados en rutas, navegación, meteo y datos e-bike para un grupo reducido de riders.
            La comunidad y las clasificaciones públicas están pausadas.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-xs">
        <p>© {new Date().getFullYear()} E-nduro Ebiketracks. Todos los derechos reservados.</p>
        <div className="flex gap-6">
          <Link href="/seguridad" className="inline-flex min-h-11 items-center hover:text-white">Aviso Legal</Link>
          <Link href="/contacto" className="inline-flex min-h-11 items-center hover:text-white">Privacidad</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
