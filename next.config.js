/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || undefined,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'a.espncdn.com' },
    ],
  },
};
module.exports = nextConfig;
