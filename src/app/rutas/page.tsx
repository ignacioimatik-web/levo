import { Suspense } from 'react';
import SectionHeading from '@/components/SectionHeading';
import RouteFilter from '@/components/RouteFilter';
import ForfaitPageClient from '@/components/ForfaitPageClient';

export default function RutasPage() {
  return (
    <div className="py-12 px-6 max-w-7xl mx-auto min-h-screen">
      <SectionHeading 
        title="Biblioteca de Rutas" 
        subtitle="Explora nuestra selección de rutas de MTB y Enduro en Morella. Filtra por sector, dificultad o distancia."
      />

      <Suspense fallback={<div className="py-20 text-center text-slate-500">Cargando rutas...</div>}>
        <RouteFilter />
      </Suspense>

      <section className="mt-20 border-t border-white/5 pt-12">
        <SectionHeading
          title="Mis rutas en el mapa"
          subtitle="Tus rutas privadas guardadas se cargan desde Supabase y se pueden abrir directamente en el grabador."
        />
        <ForfaitPageClient />
      </section>
    </div>
  );
}
