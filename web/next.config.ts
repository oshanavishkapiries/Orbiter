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
    allowedDevOrigins: ['0ed6-34-126-126-215.ngrok-free.app'],
}

export default nextConfig
