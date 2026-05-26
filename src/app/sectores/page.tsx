import Link from 'next/link';
import { sectors } from '@/data/routes';
import SectionHeading from '@/components/SectionHeading';

export default function SectoresPage() {
  return (
    <div className="py-12 px-6 max-w-7xl mx-auto min-h-screen">
      <SectionHeading 
        title="Sectores de Ruta" 
        subtitle="Explora las diferentes zonas donde se concentran nuestras rutas de MTB y Enduro."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-8">
        {sectors.map((sector) => (
          <Link key={sector.id} href={`/rutas?sector=${encodeURIComponent(sector.name)}`} className="group">
            <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-sm h-full transition-all group-hover:border-orange-500/50 group-hover:shadow-orange-500/10">
              <div className="h-48 bg-slate-800 group-hover:bg-slate-700 transition-colors flex items-center justify-center text-slate-500 italic">
                {sector.image ? (
                  <img src={sector.image} alt={sector.name} className="w-full h-full object-cover" />
                ) : (
                  `Imagen de ${sector.name}`
                )}
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-500 transition-colors">{sector.name}</h3>
                <p className="text-slate-400 text-sm line-clamp-2 mb-4">{sector.description}</p>
                <div className="grid grid-cols-2 gap-4 text-xs border-t border-white/5 pt-4">
                  <div>
                    <span className="text-slate-500 block uppercase font-semibold">Terreno</span>
                    <span className="text-slate-300">{sector.terrain}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block uppercase font-semibold">Dificultad</span>
                    <span className="text-slate-300 capitalize">{sector.dominantDifficulty}</span>
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
