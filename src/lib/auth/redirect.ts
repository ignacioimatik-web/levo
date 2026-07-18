const DEFAULT_AUTH_DESTINATION = '/account';
const DEFAULT_SITE_ORIGIN = 'https://levo-eta.vercel.app';
const AUTH_FLOW_PATHS = ['/auth', '/onboarding'] as const;
const AUTH_PROVIDERS = ['google', 'email'] as const;

export type AuthProvider = (typeof AUTH_PROVIDERS)[number];

function normalizeHttpOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveAuthSiteOrigin(
  configuredSiteUrl: string | null | undefined,
  currentOrigin: string | null | undefined,
): string {
  const browserOrigin = normalizeHttpOrigin(currentOrigin);
  if (browserOrigin) return browserOrigin;

  const configuredOrigin = normalizeHttpOrigin(configuredSiteUrl);
  return configuredOrigin ?? DEFAULT_SITE_ORIGIN;
}

export function buildAuthCallbackUrl(
  next: string | null | undefined,
  configuredSiteUrl: string | null | undefined,
  currentOrigin: string | null | undefined,
): string {
  const url = new URL(
    '/auth/callback',
    resolveAuthSiteOrigin(configuredSiteUrl, currentOrigin),
  );
  if (next) url.searchParams.set('next', normalizeAuthNextPath(next));
  return url.toString();
}

export function normalizeAuthExchangeError(message: string | null | undefined): string {
  const normalized = message?.toLowerCase() ?? '';
  if (normalized.includes('session_not_found')) return 'session_not_found';
  if (
    normalized.includes('code verifier')
    || normalized.includes('pkce')
    || normalized.includes('invalid grant')
    || normalized.includes('expired')
  ) {
    return 'invalid_code';
  }
  return 'auth_exchange_failed';
}

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
  signedInWith?: string | null,
): string {
  const next = normalizeAuthNextPath(requestedNext);
  if (onboardingCompletedAt) return next;
  const searchParams = new URLSearchParams({ next });
  if (normalizeAuthProvider(signedInWith)) {
    searchParams.set('signed_in', signedInWith!);
  }
  return `/onboarding?${searchParams.toString()}`;
}

export function normalizeAuthProvider(value: string | null | undefined): AuthProvider | null {
  return AUTH_PROVIDERS.includes(value as AuthProvider)
    ? value as AuthProvider
    : null;
}
