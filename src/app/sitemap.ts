import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = 'https://www.litera.my.id/';

  // Ini adalah peta situs statis. Untuk SEO yang optimal, Anda harus membuatnya dinamis
  // dengan mengambil data semua buku dan pengguna dari database Anda.
  const staticRoutes = [
    {
      url: siteUrl,
      lastModified: new Date(),
      changeFrequency: 'daily' as const,
      priority: 1,
    },
    {
      url: `${siteUrl}/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    },
    {
      url: `${siteUrl}/ai`,
      lastModified: new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    },
    {
      url: `${siteUrl}/search`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    },
    {
      url: `${siteUrl}/join-author`,
      lastModified: new Date(),
      changeFrequency: 'yearly' as const,
      priority: 0.6,
    },
  ];

  // Di masa mendatang, Anda akan mengambil rute dinamis (buku, pengguna) di sini
  // const books = await fetchBooksFromDB();
  // const bookUrls = books.map(book => ({ url: `${siteUrl}/books/${book.id}`, lastModified: new Date() }));
  
  // const users = await fetchUsersFromDB();
  // const userUrls = users.map(user => ({ url: `${siteUrl}/profile/${user.username}`, lastModified: new Date() }));

  return [...staticRoutes];
}
