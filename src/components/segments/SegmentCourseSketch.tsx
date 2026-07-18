import type { CompetitiveSegment } from '@/data/competitive-segments';

export function SegmentCourseSketch({
  segment,
  compact = false,
}: {
  segment: CompetitiveSegment;
  compact?: boolean;
}) {
  const minLat = Math.min(...segment.checkpoints.map((point) => point.latitude));
  const maxLat = Math.max(...segment.checkpoints.map((point) => point.latitude));
  const minLng = Math.min(...segment.checkpoints.map((point) => point.longitude));
  const maxLng = Math.max(...segment.checkpoints.map((point) => point.longitude));
  const latRange = Math.max(maxLat - minLat, 0.0001);
  const lngRange = Math.max(maxLng - minLng, 0.0001);
  const path = segment.checkpoints.map((point, index) => {
    const x = 10 + (point.longitude - minLng) / lngRange * 80;
    const y = 90 - (point.latitude - minLat) / latRange * 80;
    return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className={`relative overflow-hidden bg-slate-950 ${compact ? 'h-24' : 'h-52'}`}>
      <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(#64748b_1px,transparent_1px),linear-gradient(90deg,#64748b_1px,transparent_1px)] [background-size:24px_24px]" />
      <svg viewBox="0 0 100 100" className="relative h-full w-full p-3" role="img" aria-label={`Trazado del segmento ${segment.name}`}>
        <path d={path} fill="none" stroke="#0f172a" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path} fill="none" stroke={segment.type === 'climb' ? '#fb923c' : '#60a5fa'} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {segment.checkpoints.map((point, index) => {
          const x = 10 + (point.longitude - minLng) / lngRange * 80;
          const y = 90 - (point.latitude - minLat) / latRange * 80;
          return <circle key={`${point.latitude}-${point.longitude}`} cx={x} cy={y} r={index === 0 || index === segment.checkpoints.length - 1 ? 3.5 : 2.5} fill="#fff" stroke="#0f172a" strokeWidth="1.5" />;
        })}
      </svg>
    </div>
  );
}
