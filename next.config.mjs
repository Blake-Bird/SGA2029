/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: { remotePatterns: [] },
  experimental: { optimizePackageImports: ["react", "react-dom"] }
};
export default nextConfig;
