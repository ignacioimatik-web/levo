'use client';

import { Mail } from 'lucide-react';

export default function ContactoPage() {
  return (
    <div className="py-12 px-6 max-w-3xl mx-auto min-h-screen">
      <div className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Contacto</h1>
        <p className="text-lg text-slate-400">
          ¿Tienes dudas, sugerencias o quieres reportar un problema en una ruta? Escríbenos.
        </p>
      </div>

      <div className="bg-slate-900 p-8 rounded-3xl border border-white/10 shadow-xl">
        <form className="space-y-6" onSubmit={(e) => e.preventDefault()}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nombre</label>
              <input 
                type="text" 
                id="name" 
                className="px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white outline-none focus:ring-2 focus:ring-orange-500/50" 
                placeholder="Tu nombre"
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Email</label>
              <input 
                type="email" 
                id="email" 
                className="px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white outline-none focus:ring-2 focus:ring-orange-500/50" 
                placeholder="tu@email.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="subject" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Asunto</label>
            <select 
              id="subject" 
              className="px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              <option>Duda general</option>
              <option>Reportar incidencia en ruta</option>
              <option>Sugerencia de contenido</option>
              <option>Colaboración</option>
              <option>Otro</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="message" className="text-xs font-bold text-slate-400 uppercase tracking-widest">Mensaje</label>
            <textarea 
              id="message" 
              rows={5} 
              className="px-4 py-2.5 rounded-xl bg-slate-800 border border-white/10 text-white outline-none focus:ring-2 focus:ring-orange-500/50" 
              placeholder="Escribe tu mensaje aquí..."
            ></textarea>
          </div>

          <button 
            type="submit" 
            className="w-full bg-orange-500 text-white py-3 rounded-xl font-bold hover:bg-orange-600 transition-all"
          >
            Enviar mensaje
          </button>
        </form>
      </div>

      <div className="mt-12 text-center p-6 bg-slate-900/50 rounded-2xl border border-white/5">
        <div className="flex items-center justify-center gap-2 text-orange-500 mb-4">
          <Mail className="w-5 h-5" />
          <span className="text-xs font-bold uppercase tracking-widest">Email</span>
        </div>
        <a href="mailto:info@casesdemorella.com" className="text-slate-300 font-medium hover:text-orange-500 transition-colors">
          info@casesdemorella.com
        </a>
      </div>
    </div>
  );
}
