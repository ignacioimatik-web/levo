import { MetadataRoute } from 'next';
import { routes } from '@/data/routes';
import { realTrails } from '@/data/trails';
import { COMPETITIVE_SEGMENTS } from '@/data/competitive-segments';

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://gpxtour.vercel.app').replace(/\/$/, '');

  const staticRoutes = [
    '', '/rutas', '/sectores', '/top-tracks', '/travesias',
    '/forfait', '/planifica', '/segmentos', '/morella', '/seguridad', '/contacto',
  ].map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: route === '' ? 1 : 0.8,
  }));

  const routePages = routes.map((route) => ({
    url: `${baseUrl}/rutas/${route.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  const trailPages = realTrails.map((trail) => ({
    url: `${baseUrl}/forfait/${trail.slug}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.5,
  }));

  const segmentPages = COMPETITIVE_SEGMENTS.map((segment) => ({
    url: `${baseUrl}/segmentos/${segment.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [...staticRoutes, ...routePages, ...trailPages, ...segmentPages];
}
