import TopoBackground from '@/components/TopoBackground';
import SectionHeading from '@/components/SectionHeading';
import Link from 'next/link';
import { ArrowRight, Heart, Users, MountainIcon } from 'lucide-react';

export default function QuienesSomosPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Hero */}
      <section className="relative py-32 px-6 overflow-hidden">
        <TopoBackground />
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-950 z-10"></div>
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1604748954134-457791b2ce9b?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center"></div>
        </div>
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8">
            <Users className="w-4 h-4" />
            Sobre el proyecto
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-none">
            ¿Quiénes <span className="text-orange-500">Somos</span>?
          </h1>
          <p className="text-xl md:text-2xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            E-nduro Ebiketracks surge de la necesidad que tenemos los que vivimos y practicamos mtb en Morella de compartir, gestionar y dar a conocer las rutas que hemos creado a base de pedalear por estos parajes.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 text-orange-500">
                <MountainIcon className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">Nuestra Filosofía</span>
              </div>
              <p className="text-slate-300 text-lg leading-relaxed">
                Hemos ido descubriendo y marcando senderos que permanecían perdidos en el olvido, o abriendo otros nuevos allí donde el paisaje se prestaba; y todo ello animados por el placer de descubrir y el ansia de compartir.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Lejos de cualquier intención de promoción o negocio turístico, recibirás de nuestra parte un trato de tú a tú: otros mountain bikers que te descubrimos los rincones que hemos desgranado a base de rutas.
              </p>
            </div>
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 text-orange-500">
                <Heart className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-widest">Sin Ánimo de Lucro</span>
              </div>
              <p className="text-slate-300 text-lg leading-relaxed">
                Este es un proyecto <strong>absolutamente sin ánimo de lucro</strong>. El mantenimiento corre de nuestra cuenta, al igual que el diseño, la programación y la recogida de datos.
              </p>
              <p className="text-slate-400 leading-relaxed">
                Lo que ofrecemos aquí responde a nuestra experiencia y está descrito desde nuestra subjetividad de endureros. Pretendemos describir la realidad de los senderos y de las rutas con la máxima fidelidad y con el máximo respeto, y siempre desde nuestra perspectiva.
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-white/5 rounded-3xl p-10">
            <h2 className="text-2xl font-bold text-white mb-6">Niveles y Valoraciones</h2>
            <div className="space-y-4 text-slate-400">
              <p>
                Los niveles de las rutas se han establecido en función de nuestro criterio, tratando de ser fieles a la realidad de los senderos, pero no deja de ser una mera referencia.
              </p>
              <p>
                Morella no es un destino turístico mtb al uso. Por supuesto que nuestra intención es que vengas, que te alojes, que disfrutes. Pero también deseamos que vivas la experiencia con honestidad: la dureza del medio, la calidad de las sendas, la intensidad de los paisajes.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-3xl p-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-500/20 rounded-2xl flex items-center justify-center flex-shrink-0">
                <MountainIcon className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white mb-3">Centre BTT de Els Ports - Fábrica de Giner</h2>
                <p className="text-slate-400 leading-relaxed mb-4">
                  Si quieres enviar tracks regularmente al GPS, agradeceremos que te informes de la ayuda del Centre BTT de Els Ports - Fábrica de Giner, un servicio de información turística y apoyo al ciclista con el que hemos establecido un vínculo estrecho por apoyar decididamente la movilidad sobre dos ruedas.
                </p>
                <Link 
                  href="/contacto"
                  className="inline-flex items-center gap-2 text-orange-500 font-bold hover:text-orange-400 transition-colors"
                >
                  Contactar <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
