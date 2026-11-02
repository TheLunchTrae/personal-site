import type { NextConfig } from 'next';

// Static export for GitHub Pages. No basePath: the site is served from a
// custom domain at the root. cacheComponents and partialPrefetching are left
// at their defaults for now; revisit once there is real content.
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    // The default image optimizer needs a server.
    unoptimized: true,
  },
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
};

export default nextConfig;
