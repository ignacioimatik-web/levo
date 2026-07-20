import type { AssistMode, SportType } from './types';

export interface BatteryLaunchSettings {
  sportType: SportType;
  batteryStart: number;
  batteryCapacityWh: number;
  assistMode: AssistMode;
  batteryReservePercent: number;
}

export const DEFAULT_BATTERY_LAUNCH_SETTINGS: BatteryLaunchSettings = {
  sportType: 'ebike',
  batteryStart: 100,
  batteryCapacityWh: 700,
  assistMode: 'trail',
  batteryReservePercent: 15,
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function finiteNumber(value: string | string[] | undefined, fallback: number): number {
  const parsed = Number(first(value));
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeBatteryLaunchSettings(
  settings: Partial<BatteryLaunchSettings> | null | undefined,
): BatteryLaunchSettings {
  const requestedAssistMode = settings?.assistMode;
  const assistMode: AssistMode = requestedAssistMode
    && ['eco', 'trail', 'turbo', 'smart'].includes(requestedAssistMode)
    ? requestedAssistMode
    : DEFAULT_BATTERY_LAUNCH_SETTINGS.assistMode;
  return {
    sportType: settings?.sportType === 'mtb' ? 'mtb' : 'ebike',
    batteryStart: Math.round(Math.min(100, Math.max(
      1,
      settings?.batteryStart ?? DEFAULT_BATTERY_LAUNCH_SETTINGS.batteryStart,
    ))),
    batteryCapacityWh: Math.round(Math.min(2_000, Math.max(
      200,
      settings?.batteryCapacityWh ?? DEFAULT_BATTERY_LAUNCH_SETTINGS.batteryCapacityWh,
    ))),
    assistMode,
    batteryReservePercent: Math.round(Math.min(30, Math.max(
      5,
      settings?.batteryReservePercent
        ?? DEFAULT_BATTERY_LAUNCH_SETTINGS.batteryReservePercent,
    ))),
  };
}

export function batteryLaunchSettingsFromSearchParams(
  params: Record<string, string | string[] | undefined>,
): BatteryLaunchSettings | undefined {
  const hasLaunchSettings = ['tipo', 'bateria', 'capacidad', 'asistencia', 'reserva']
    .some((key) => params[key] != null);
  if (!hasLaunchSettings) return undefined;
  return normalizeBatteryLaunchSettings({
    sportType: first(params.tipo) === 'mtb' ? 'mtb' : 'ebike',
    batteryStart: finiteNumber(
      params.bateria,
      DEFAULT_BATTERY_LAUNCH_SETTINGS.batteryStart,
    ),
    batteryCapacityWh: finiteNumber(
      params.capacidad,
      DEFAULT_BATTERY_LAUNCH_SETTINGS.batteryCapacityWh,
    ),
    assistMode: first(params.asistencia) as AssistMode | undefined,
    batteryReservePercent: finiteNumber(
      params.reserva,
      DEFAULT_BATTERY_LAUNCH_SETTINGS.batteryReservePercent,
    ),
  });
}

export function batteryLaunchSearchParams(settings: BatteryLaunchSettings): URLSearchParams {
  const normalized = normalizeBatteryLaunchSettings(settings);
  return new URLSearchParams({
    tipo: normalized.sportType,
    bateria: String(normalized.batteryStart),
    capacidad: String(normalized.batteryCapacityWh),
    asistencia: normalized.assistMode,
    reserva: String(normalized.batteryReservePercent),
  });
}
