export default function ContactoPage() {
  return (
    <div className="py-12 px-6 max-w-3xl mx-auto">
      <div className="mb-12 text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Contacto</h1>
        <p className="text-lg text-slate-600">
          ¿Tienes dudas, sugerencias o quieres reportar un problema en una ruta? ¡Escríbenos!
        </p>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-sm font-medium text-slate-700">Nombre</label>
              <input 
                type="text" 
                id="name" 
                className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-orange-500 focus:border-orange-500 outline-none" 
                placeholder="Tu nombre"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
              <input 
                type="email" 
                id="email" 
                className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-orange-500 focus:border-orange-500 outline-none" 
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="subject" className="text-sm font-medium text-slate-700">Asunto</label>
            <select 
              id="subject" 
              className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-orange-500 focus:border-orange-500 outline-none"
            >
              <option>Duda general</option>
              <option>Reportar incidencia en ruta</option>
              <option>Sugerencia de contenido</option>
              <option>Colaboración</option>
              <option>Otro</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="message" className="text-sm font-medium text-slate-700">Mensaje</label>
            <textarea 
              id="message" 
              rows={5} 
              className="px-4 py-2 rounded-lg border border-slate-300 focus:ring-orange-500 focus:border-orange-500 outline-none" 
              placeholder="Escribe tu mensaje aquí..."
            ></textarea>
          </div>

          <button 
            type="submit" 
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-colors"
          >
            Enviar mensaje
          </button>
        </form>
      </div>

      <div className="mt-12 text-center">
        <p className="text-slate-500 text-sm">
          También puedes contactarnos directamente en: <br />
          <a href="mailto:info@casesdemorella.com" className="text-orange-500 font-medium">info@casesdemorella.com</a>
        </p>
      </div>
    </div>
  );
}
