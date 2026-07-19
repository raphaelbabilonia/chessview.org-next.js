/** @type {import('next').NextConfig} */
const securityHeaders = [
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  async redirects() {
    return [
      {
        source: "/:locale(en|es|it)/coverage",
        destination: "/:locale/maps",
        permanent: true,
      },
      {
        source: "/:locale(en|es|it)/coverpage",
        destination: "/:locale/maps",
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "en.chessbase.com",
      },
      {
        protocol: "https",
        hostname: "images.chesscomfiles.com",
      },
      {
        protocol: "https",
        hostname: "image.lichess1.org",
      },
      {
        protocol: "https",
        hostname: "www.fide.com",
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
