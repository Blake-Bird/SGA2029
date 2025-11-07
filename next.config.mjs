/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    // If you later load remote images, add patterns here.
    remotePatterns: [
      // { protocol: 'https', hostname: 'images.ctfassets.net' }
    ]
  },
  experimental: {
    optimizePackageImports: ['react', 'react-dom']
  }
};

export default nextConfig;
