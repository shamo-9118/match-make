import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      'react-remove-scroll-bar/constants':
        './node_modules/react-remove-scroll-bar/dist/es2015/constants.js',
    },
  },
};

export default nextConfig;
