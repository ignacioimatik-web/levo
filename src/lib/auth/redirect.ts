export function normalizeAuthNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/account';
  try {
    const url = new URL(value, 'https://levo.local');
    if (url.origin !== 'https://levo.local') return '/account';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/account';
  }
}
