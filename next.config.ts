import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* Gabungkan semua config di sini */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    // Ini untuk mengatasi warning Cross-origin yang tadi
    allowedDevOrigins: [
      '9000-firebase-studio-1769150625444.cluster-ancjwrkgr5dvux4qug5rbzyc2y.cloudworkstations.dev'
    ],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.gunturpadilah.web.id',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'files.catbox.moe',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.catbox.moe',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'svgl.app',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'raw.githubusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      }
    ],
  },
};

export default nextConfig;