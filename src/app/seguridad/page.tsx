import TopoBackground from '@/components/TopoBackground';
import SectionHeading from '@/components/SectionHeading';
import { ShieldCheck, AlertTriangle, AlertCircle, Footprints, Eye, Wind, Droplets, Sun } from 'lucide-react';

export default function SeguridadPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Hero */}
      <section className="relative py-32 px-6 overflow-hidden">
        <TopoBackground />
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-950 z-10"></div>
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center"></div>
        </div>
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8">
            <ShieldCheck className="w-4 h-4" />
            Seguridad y Responsabilidad
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-none">
            Seguridad y <span className="text-orange-500">Responsabilidad</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Tu seguridad es lo más importante. Lee atentamente esta información antes de salir a la montaña.
          </p>
        </div>
      </section>

      {/* Aviso Legal */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          <div className="bg-red-950/30 border border-red-500/30 rounded-3xl p-10">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-white mb-4">Aviso Legal Importante</h2>
                <p className="text-slate-300 leading-relaxed">
                  Todas las rutas publicadas en este sitio son de carácter <strong>autoguiado</strong> y suponen un riesgo para la integridad física de las personas. Es responsabilidad del usuario valorar su preparación técnica, física y mental. El propietario de este sitio web no se hace responsable de cualquier daño o perjuicio que el uso de estas rutas pueda ocasionar.
                </p>
              </div>
            </div>
          </div>

          {/* Peligros */}
          <div>
            <SectionHeading 
              title="Posibles Peligros" 
              subtitle="Conoce los riesgos a los que te enfrentas en la montaña."
            />
            <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                <Footprints className="w-8 h-8 text-orange-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-3">Otros Usuarios</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Puedes encontrarte con vehículos a motor en pistas forestales, y con senderistas, corredores y otros ciclistas en los senderos.
                </p>
              </div>
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                <Eye className="w-8 h-8 text-orange-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-3">Animales Sueltos</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Vacas, caballos, cabras montesas, jabalíes, corzos. Mantén la distancia y no los molestes.
                </p>
              </div>
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-6">
                <AlertCircle className="w-8 h-8 text-orange-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-3">Terreno Complejo</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  Los cortados, acantilados y fuertes pendientes están siempre presentes. La señalización de senderos es escasa y en ocasiones nula. Hay muchos cruces que pueden confundir la navegación.
                </p>
              </div>
            </div>
          </div>

          {/* Equipo */}
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-10">
            <SectionHeading 
              title="Equipo Imprescindible" 
              subtitle="No salgas sin esto."
            />
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {[
                "Casco integral o de mentonera",
                "Protecciones (rodilleras, coderas)",
                "Navaja multiusos",
                "Bomba de hinchar",
                "Cámara de repuesto",
                "Cortador de cadenas",
                "Batería externa / Powerbank",
                "Agua en abundancia",
                "Dinero y teléfono",
              ].map((item) => (
                <div key={item} className="bg-slate-800 border border-white/5 rounded-xl p-4 text-slate-300 text-sm font-medium">
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Meteorología */}
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-10">
            <div className="flex items-center gap-3 text-orange-500 mb-6">
              <Wind className="w-6 h-6" />
              <h2 className="text-2xl font-bold text-white">Meteorología</h2>
            </div>
            <div className="space-y-4 text-slate-400 leading-relaxed">
              <p className="flex items-start gap-3">
                <Droplets className="w-5 h-5 text-orange-500 flex-shrink-0 mt-1" />
                <span>Los valles de los ríos y barrancos son especialmente fríos y húmedos.</span>
              </p>
              <p className="flex items-start gap-3">
                <Wind className="w-5 h-5 text-orange-500 flex-shrink-0 mt-1" />
                <span>La meteorología en la montaña puede variar drásticamente. Prepárate para el cambio.</span>
              </p>
              <p className="flex items-start gap-3">
                <Sun className="w-5 h-5 text-orange-500 flex-shrink-0 mt-1" />
                <span>En días de calor, aumenta las reservas de agua. En días fríos o húmedos, evita la ropa de algodón.</span>
              </p>
            </div>
          </div>

          {/* Recomendaciones */}
          <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-3xl p-10">
            <SectionHeading 
              title="Recomendaciones Finales" 
              subtitle="Puntos clave para una ruta segura."
            />
            <ul className="mt-8 space-y-4 text-slate-300">
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span><strong>No llevar auriculares.</strong> Es necesario escuchar el entorno para evitar accidentes.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span><strong>Recomendamos casco integral o de mentonera</strong> y protecciones.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span><strong>Lleva un dispositivo GPS específico</strong> o una aplicación con mapas descargables.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span><strong>El teléfono móvil no debe ser tu única herramienta de navegación</strong> por falta de cobertura.</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span><strong>Más vale llevar agua de más.</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-orange-500 mt-1">•</span>
                <span>Los tracks se han obtenido con GPS y la <strong>precisión puede no ser perfecta</strong>.</span>
              </li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
