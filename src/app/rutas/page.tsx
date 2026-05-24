import SectionHeading from '@/components/SectionHeading';
import RouteFilter from '@/components/RouteFilter';

export default function RutasPage() {
  return (
    <div className="py-12 px-6 max-w-7xl mx-auto min-h-screen">
      <SectionHeading 
        title="Biblioteca de Rutas" 
        subtitle="Explora nuestra selección de rutas de MTB y Enduro en Morella. Filtra por sector, dificultad o distancia."
      />

      <RouteFilter />
    </div>
  );
}

