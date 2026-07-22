'use client';

import { useState, useEffect } from 'react';
import { Loader2, Gauge } from 'lucide-react';
import Link from 'next/link';

export default function AlertaPresionPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  if (!ready) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <div className="border-b border-white/5 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Gauge className="text-white w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Alerta Presión</h1>
              <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest">En reparación — pronto volverá</p>
            </div>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-6 py-20 text-center">
        <p className="text-slate-400">Estamos actualizando la calculadora de presión.</p>
        <p className="text-slate-500 text-sm mt-2">Vuelve en unos minutos.</p>
      </div>
    </div>
  );
}
