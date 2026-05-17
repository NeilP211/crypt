/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Location imagery comes from arbitrary external hosts (Wikimedia, OSM
  // `image` tags), so the optimizer is allowed any HTTPS remote source.
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
