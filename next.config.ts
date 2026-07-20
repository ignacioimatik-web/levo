import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Redirect removed pages to home
      { source: '/quienes-somos', destination: '/', permanent: false },
      { source: '/morella', destination: '/', permanent: false },
      { source: '/planifica', destination: '/', permanent: false },
      { source: '/travesias', destination: '/', permanent: false },
    ];
  },
};

export default nextConfig;
