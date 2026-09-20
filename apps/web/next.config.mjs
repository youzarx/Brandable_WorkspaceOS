/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    '@platform/ui',
    '@platform/config',
    '@platform/types',
    '@platform/validation',
  ],
  reactStrictMode: true,
};

export default nextConfig;
