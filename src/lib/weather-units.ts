const METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR = 3.6;

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/**
 * AEMET conventional observations expose vv and vmax in metres per second.
 * LEVO's public weather model and UI always use kilometres per hour.
 */
export function aemetWindMpsToKmh(
  value: number | null | undefined,
  digits = 1,
): number | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return round(value * METERS_PER_SECOND_TO_KILOMETERS_PER_HOUR, digits);
}
