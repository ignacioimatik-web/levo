import Link from 'next/link';
import { Download, Map, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  return (
    <section className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10">
        <WifiOff className="h-8 w-8 text-orange-400" />
      </div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.25em] text-orange-400">
        Modo montaña
      </p>
      <h1 className="text-3xl font-black tracking-tight text-white">
        Ahora mismo no tienes conexión
      </h1>
      <p className="mt-4 leading-relaxed text-slate-400">
        Las rutas y GPX que ya hayas abierto pueden seguir disponibles. Recupera cobertura para actualizar mapas, meteorología y estado de los senderos.
      </p>
      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        <Link
          href="/rutas"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3 font-bold text-white"
        >
          <Map className="h-4 w-4" />
          Ver rutas
        </Link>
        <Link
          href="/forfait"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold text-white"
        >
          <Download className="h-4 w-4" />
          Mis tracks
        </Link>
      </div>
    </section>
  );
}
