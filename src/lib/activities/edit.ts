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
  const visibilityRank: Record<ActivityPrivacy, number> = {
    private: 0,
    followers: 1,
    public: 2,
  };
  const visibilityReduced = visibilityRank[nextPrivacy] < visibilityRank[previousPrivacy];
  const pendingUnpublish = visibilityReduced
    && hadRemoteId
    && result !== 'synced';

  if (pendingUnpublish) {
    return {
      message: result === 'error'
        ? 'El cambio está guardado en este dispositivo, pero la visibilidad anterior sigue activa en la nube. Vuelve a sincronizar cuanto antes.'
        : 'El cambio está guardado en este dispositivo. La visibilidad anterior seguirá activa hasta que recuperes la conexión y sincronices.',
      urgent: true,
    };
  }

  if (result === 'synced') {
    return {
      message: visibilityReduced
        ? nextPrivacy === 'private'
          ? 'Actividad privada. Ya solo puedes verla tú.'
          : 'Actividad visible solo para tus seguidores. El acceso público ya no está disponible.'
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
