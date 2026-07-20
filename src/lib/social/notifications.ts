export type SocialNotificationType = 'follow' | 'kudo' | 'comment';

export function notificationDestination(
  type: SocialNotificationType,
  actorId: string,
  activityId: string | null,
): string {
  return type === 'follow'
    ? `/riders/${actorId}`
    : activityId
      ? `/actividad/${activityId}`
      : '/notificaciones';
}

export function notificationMessage(
  type: SocialNotificationType,
  activityTitle?: string | null,
): string {
  const title = activityTitle?.trim() || 'tu salida';
  if (type === 'follow') return 'ha empezado a seguirte';
  if (type === 'kudo') return `te ha dado kudos en “${title}”`;
  return `ha comentado en “${title}”`;
}

export function notificationRelativeTime(value: string, now = Date.now()): string {
  const elapsedSeconds = Math.max(0, Math.floor((now - new Date(value).getTime()) / 1000));
  if (elapsedSeconds < 60) return 'Ahora';
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'Ayer' : `Hace ${days} días`;
}
