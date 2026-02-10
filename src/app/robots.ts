import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = 'https://www.litera.my.id/';

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/admin/',
        '/login/',
        '/register/',
        '/verify-email/',
        '/settings/',
        '/upload/',
        '/messages/',
        '/notifications/',
        '*/edit/',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
