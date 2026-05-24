export default function SeguridadPage() {
  return (
    <div className="py-12 px-6 max-w-4xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Seguridad y Responsabilidad</h1>
        <p className="text-lg text-slate-600">
          Tu seguridad es nuestra prioridad. Por favor, lee atentamente estas recomendaciones.
        </p>
      </div>

      <div className="space-y-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-2xl">
          <h2 className="text-xl font-bold text-red-900 mb-2">Aviso Legal Importante</h2>
          <p className="text-red-800">
            Todas las rutas publicadas en este sitio son de carácter <strong>autoguiado</strong>. El uso de las rutas es bajo tu propia responsabilidad. Morella Singletracks no se hace responsable de accidentes, lesiones o daños que puedan ocurrir durante la práctica de actividades deportivas.
          </p>
        </div>

        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-6">Recomendaciones para una ruta segura</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800">Antes de salir</h3>
              <ul className="space-y-2 text-slate-600 text-sm">
                <li>• Consulta la previsión meteorológica.</li>
                <li>• Asegúrate de tener batería suficiente en tu dispositivo GPS.</li>
                <li>• Lleva siempre un kit de reparación y herramientas básicas.</li>
                <li>• Avisa a alguien de tu itinerario.</li>
              </ul>
            </div>
            <div className="space-y-4">
              <h3 className="font-bold text-slate-800">Durante la ruta</h3>
              <ul className="space-y-2 text-slate-600 text-sm">
                <li>• Lleva suficiente agua y alimentos.</li>
                <li>• Respeta las señalizaciones y los senderos marcados.</li>
                <li>• Valora tu nivel técnico antes de emprender tramos difíciles.</li>
                <li>• Ten precaución en zonas de fauna o ganado.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Uso del GPS</h2>
          <p className="text-slate-600 leading-relaxed">
            Aunque intentamos mantener los tracks lo más actualizados posible, la naturaleza y el terreno pueden cambiar. Te recomendamos encarecidamente el uso de dispositivos GPS profesionales o aplicaciones móviles con mapas descargables para evitar perderte en zonas remotas.
          </p>
        </section>
      </div>
    </div>
  );
}
