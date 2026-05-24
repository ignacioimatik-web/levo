export default function PlanificaPage() {
  return (
    <div className="py-12 px-6 max-w-4xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Planifica tu Aventura</h1>
        <p className="text-lg text-slate-600">
          Todo lo que necesitas saber para disfrutar de tus rutas de forma segura y eficiente.
        </p>
      </div>

      <div className="space-y-12">
        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Uso de GPS</h2>
          <p className="text-slate-600 mb-6">
            Para disfrutar de la libertad de las rutas autoguiadas, es imprescindible contar con un dispositivo GPS o una aplicación en tu smartphone. 
            No confíes únicamente en la señalización física, ya que en zonas remotas puede no ser suficiente.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {["Garmin", "Wahoo", "Komoot", "Wikiloc", "Trailforks", "GPX Viewer"].map((app) => (
              <div key={app} className="p-3 bg-slate-50 rounded-lg text-center font-medium text-slate-700">
                {app}
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Equipo Esencial</h2>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-600">
            <li className="flex items-center gap-2"><span>✅</span> Casco y protecciones</li>
            <li className="flex items-center gap-2"><span>✅</span> Kit de reparación básica</li>
            <li className="flex items-center gap-2"><span>✅</span> Agua suficiente</li>
            <li className="flex items-center gap-2"><span>✅</span> Batería externa / Powerbank</li>
            <li className="flex items-center gap-2"><span>✅</span> Herramientas multiuso</li>
            <li className="flex items-center gap-2"><span>✅</span> Ropa según meteorología</li>
          </ul>
        </section>

        <section className="bg-orange-50 p-8 rounded-2xl border border-orange-100">
          <h2 className="text-2xl font-bold text-orange-900 mb-4">Respeto al Entorno</h2>
          <p className="text-orange-800 leading-relaxed">
            Morella es un ecosamente privilegiado. Por favor, respeta los senderos, la fauna, el ganado y la propiedad privada. 
             Sigue los principios de &quot;No deje rastro&quot; para preservar este paraíso para el futuro.

          </p>
        </section>
      </div>
    </div>
  );
}
