/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow the backend URL to be read at build time
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

module.exports = nextConfig;
