import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'flagcdn.com',
                pathname: '/w80/**',
            },
            {
                protocol: 'https',
                hostname: 'robohash.org',
            },
        ],
        formats: ['image/webp', 'image/avif'],
    },
}

export default nextConfig