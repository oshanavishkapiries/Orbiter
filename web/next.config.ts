import type { NextConfig } from "next"

const nextConfig: NextConfig = {
    async rewrites() {
        return [
            {
                source: '/api/:path*',
                destination: 'http://127.0.0.1:4040/api/:path*',
            },
        ]
    },
    allowedDevOrigins: ['6822-35-198-250-122.ngrok-free.app'],
}

export default nextConfig
