const DEFAULT_AUTH_DESTINATION = '/account';
const AUTH_FLOW_PATHS = ['/auth', '/onboarding'] as const;

export function normalizeAuthNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_AUTH_DESTINATION,
): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  try {
    const url = new URL(value, 'https://levo.local');
    if (url.origin !== 'https://levo.local') return fallback;
    if (AUTH_FLOW_PATHS.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function getPostAuthDestination(
  requestedNext: string | null | undefined,
  onboardingCompletedAt: string | null | undefined,
): string {
  const next = normalizeAuthNextPath(requestedNext);
  if (onboardingCompletedAt) return next;
  return `/onboarding?next=${encodeURIComponent(next)}`;
}
