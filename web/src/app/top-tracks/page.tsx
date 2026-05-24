export default function TopTracksPage() {
  return (
    <div className="py-12 px-6 max-w-7xl mx-auto">
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Top Tracks</h1>
        <p className="text-lg text-slate-600">
          Los tramos técnicos y las bajadas más emocionantes de Morella.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Placeholder for Top Tracks */}
        <div className="p-8 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 text-center">
          <p className="text-slate-500">Próximamente: Selección de los mejores segmentos técnicos.</p>
        </div>
        <div className="p-8 bg-slate-100 rounded-2xl border-2 border-dashed border-slate-300 text-center">
          <p className="text-slate-500">Próximamente: Bajadas destacadas de cada sector.</p>
        </div>
      </div>
    </div>
  );
}
