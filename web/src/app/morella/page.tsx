export default function MorellaPage() {
  return (
    <div className="py-12 px-6 max-w-5xl mx-auto">
      <div className="mb-16 text-center">
        <h1 className="text-5xl font-bold text-slate-900 mb-6">Descubre Morella</h1>
        <p className="text-xl text-slate-600 leading-relaxed">
          Mucho más que un destino de MTB. Un viaje a través de la historia, la gastronomía y la naturaleza de Els Ports.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Patrimonio Histórico</h2>
            <p className="text-slate-600 leading-relaxed">
              Morella es una ciudad medieval impresionante, rodeada de murallas y con un castillo que domina el paisaje. Sus calles empedradas y su arquitectura te transportarán a otra época.
            </p>
          </section>
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Gastronomía</h2>
            <p className="text-slate-600 leading-relaxed">
              Después de una jornada intensa de pedaleo, nada mejor que disfrutar de la cocina local. Morella ofrece una oferta gastronómica excepcional que combina tradición y calidad.
            </p>
          </section>
        </div>
        <div className="space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Naturaleza y Paisaje</h2>
            <p className="text-slate-600 leading-relaxed">
              La Comarca de Els Ports es un paraíso de biodiversidad. Montañas, bosques y ríos te esperan para una experiencia de conexión total con la naturaleza.
            </p>
          </section>
          <div className="bg-slate-100 h-64 rounded-2xl flex items-center justify-center text-slate-400 italic">
            Imagen de Morella
          </div>
        </div>
      </div>

      <div className="mt-20 p-12 bg-slate-900 rounded-3xl text-center text-white">
        <h2 className="text-3xl font-bold mb-6">¿Quieres quedarte?</h2>
        <p className="text-slate-400 mb-8 text-lg">
          Descubre los mejores alojamientos en Morella y la Comarca para tu estancia deportiva.
        </p>
        <button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-full font-bold transition-colors">
          Ver alojamientos recomendados
        </button>
      </div>
    </div>
  );
}
