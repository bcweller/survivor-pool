/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'a.espncdn.com' },
    ],
  },
};
module.exports = nextConfig;
