'use client';

export default function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-3 text-sm font-bold text-white transition-all hover:bg-slate-700"
    >
      Exportar informe (PDF)
    </button>
  );
}
