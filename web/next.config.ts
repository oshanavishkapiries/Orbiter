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
    allowedDevOrigins: ['3000-cs-3614dded-8e27-49d1-a3cd-1ffa508d81f7.cs-asia-southeast1-cash.cloudshell.dev'],
}

export default nextConfig
