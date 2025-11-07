/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // add remotePatterns later if you load external images
    remotePatterns: [],
    // leave defaults; Next/Image works locally and on Vercel
  },
  experimental: {
    optimizePackageImports: ["react", "react-dom"], // optional but fine on Next 15
  },
};

export default nextConfig;
