import TopoBackground from '@/components/TopoBackground';
import SectionHeading from '@/components/SectionHeading';
import { Map, Smartphone, Download, Sun, Home, WifiOff, Lock } from 'lucide-react';

export default function PlanificaPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden">
      {/* Hero */}
      <section className="relative py-32 px-6 overflow-hidden">
        <TopoBackground />
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-950 z-10"></div>
          <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1551632811-561732d1e306?auto=format&fit=crop&q=80&w=2070')] bg-cover bg-center"></div>
        </div>
        <div className="relative z-20 max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-500 text-xs font-bold uppercase tracking-widest mb-8">
            <Map className="w-4 h-4" />
            Información de Interés
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white mb-6 leading-none">
            Planifica tu <span className="text-orange-500">Aventura</span>
          </h1>
          <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
            Todo lo que necesitas saber para disfrutar de las rutas de forma segura, eficiente y respetuosa.
          </p>
        </div>
      </section>

      {/* GPS Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto space-y-16">
          <div>
            <SectionHeading 
              title="Navegación GPS" 
              subtitle="El track GPS es la herramienta básica imprescindible para realizar las rutas. Todas son autoguiadas."
            />
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-8">
                <Download className="w-8 h-8 text-orange-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-3">Descarga de Tracks</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  En cada ruta puedes encontrar el track completo de la ruta y los tracks de los Top Tracks que la integran, mapas y perfiles de elevación. Los tracks se suministran en formato <strong>GPX</strong>, estándar utilizable en cualquier dispositivo del mercado.
                </p>
              </div>
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-8">
                <Smartphone className="w-8 h-8 text-orange-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-3">App Recomendada: Wikiloc</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  También puedes usar Garmin, Wahoo, Komoot, Trailforks o cualquier visor de GPX. Los tracks incluyen waypoints con información de puntos de referencia, agua y lugares de interés.
                </p>
              </div>
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-8">
                <WifiOff className="w-8 h-8 text-orange-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-3">Sin Cobertura</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  En muchas zonas no hay cobertura móvil. Descarga los mapas antes de salir. El teléfono móvil no debe ser tu única herramienta de navegación.
                </p>
              </div>
              <div className="bg-slate-900 border border-white/5 rounded-2xl p-8">
                <Lock className="w-8 h-8 text-orange-500 mb-4" />
                <h3 className="text-lg font-bold text-white mb-3">Archivos Comprimidos</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  A veces los tracks se suministrarán comprimidos en archivos RAR. Necesitarás un programa que los descomprima (recomendado: <a href="https://www.winrar.es" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline">winrar.es</a>). También disponibles en KML para Google Earth.
                </p>
              </div>
            </div>
          </div>

          {/* Alojamiento */}
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-10">
            <div className="flex items-center gap-3 text-orange-500 mb-6">
              <Home className="w-6 h-6" />
              <h2 className="text-2xl font-bold text-white">Alojamiento</h2>
            </div>
            <p className="text-slate-400 leading-relaxed mb-6">
              Morella y sus alrededores ofrecen una amplia oferta de alojamiento: casas rurales, hoteles con encanto y camping. 
              Puedes contactar con <strong>Cases de Morella</strong> para reservar tu estancia.
            </p>
            <a 
              href="mailto:info@casesdemorella.com" 
              className="inline-flex items-center gap-2 px-6 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600 transition-all"
            >
              info@casesdemorella.com
            </a>
          </div>

          {/* Climatología */}
          <div className="bg-slate-900 border border-white/5 rounded-3xl p-10">
            <div className="flex items-center gap-3 text-orange-500 mb-6">
              <Sun className="w-6 h-6" />
              <h2 className="text-2xl font-bold text-white">Climatología</h2>
            </div>
            <p className="text-slate-400 leading-relaxed">
              Clima mediterráneo continental. Veranos secos y calurosos, inviernos fríos. 
              <strong> Primavera y otoño</strong> son las mejores épocas para montar en bici. 
              Consulta siempre la previsión meteorológica antes de salir.
            </p>
          </div>

          {/* Respeto */}
          <div className="bg-gradient-to-r from-orange-500/10 to-transparent border border-orange-500/20 rounded-3xl p-10">
            <h2 className="text-2xl font-bold text-white mb-4">Respeto al Entorno</h2>
            <p className="text-slate-400 leading-relaxed">
              El acceso a ciertas fincas privadas está autorizado para paso de ciclistas, pero debemos cumplir las normas: 
              cerrar puertas metálicas, respetar el ganado, no molestar, no salirse de los senderos marcados. 
              Sigamos los principios de &quot;No deje rastro&quot; para preservar este paraíso.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
