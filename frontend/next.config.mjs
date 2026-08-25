/** @type {import('next').NextConfig} */
const nextConfig = {
  // Direct API calls to backend at port 3001 — no proxy needed
  // Frontend calls http://localhost:3001 directly via the api.ts client
};

export default nextConfig;
