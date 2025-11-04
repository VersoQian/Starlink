/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@branching-chat/ui': new URL('../packages/ui/dist', import.meta.url).pathname
    }
    return config
  }
}

export default nextConfig
