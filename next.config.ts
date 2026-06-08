import type { NextConfig } from "next";

const nextConfig = {
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "flagcdn.com",
                pathname: "/w80/**",
            },
            {
                protocol: "https",
                hostname: "robohash.org",
            },
            {
                protocol: "https",
                hostname: "upload.wikimedia.org",
            },
            {
                protocol: "https",
                hostname: "images.unsplash.com",
            },
        ],
        formats: ["image/webp", "image/avif"],
    },

    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;