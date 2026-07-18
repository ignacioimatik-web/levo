import type { ActivityPrivacy } from './types';

export type ActivityEditSyncResult = 'synced' | 'local' | 'error';

export interface ActivityEditNotice {
  message: string;
  urgent: boolean;
}

export function normalizeActivityTitle(input: string, fallback: string): string {
  return input.trim() || fallback;
}

export function activityEditNotice({
  previousPrivacy,
  nextPrivacy,
  result,
  hadRemoteId,
}: {
  previousPrivacy: ActivityPrivacy;
  nextPrivacy: ActivityPrivacy;
  result: ActivityEditSyncResult;
  hadRemoteId: boolean;
}): ActivityEditNotice {
  const pendingUnpublish = previousPrivacy === 'public'
    && nextPrivacy === 'private'
    && hadRemoteId
    && result !== 'synced';

  if (pendingUnpublish) {
    return {
      message: result === 'error'
        ? 'El cambio está guardado en este dispositivo, pero no se ha podido retirar la actividad pública. Vuelve a sincronizar cuanto antes.'
        : 'El cambio está guardado en este dispositivo. La actividad seguirá pública hasta que vuelvas a iniciar sesión o recuperes la conexión y la sincronices.',
      urgent: true,
    };
  }

  if (result === 'synced') {
    return {
      message: previousPrivacy === 'public' && nextPrivacy === 'private'
        ? 'Actividad retirada de la Comunidad. El enlace público ya no está disponible.'
        : 'Cambios guardados y sincronizados.',
      urgent: false,
    };
  }

  return {
    message: result === 'error'
      ? 'Cambios guardados en este dispositivo, pero la sincronización ha fallado. Puedes reintentarlo desde el historial.'
      : 'Cambios guardados en este dispositivo. Inicia sesión y sincroniza para aplicarlos en la nube.',
    urgent: result === 'error',
  };
}
