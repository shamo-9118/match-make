import type { NextConfig } from "next";
import { readFileSync, writeFileSync } from "fs";

const BUILD_TIME = new Date().toISOString();
const BUILD_ID = Date.now().toString();

// sw.template.js → public/sw.js をビルド時に生成（キャッシュ名にビルドIDを埋め込む）
try {
  const template = readFileSync("sw.template.js", "utf8");
  writeFileSync("public/sw.js", template.replace(/__BUILD_ID__/g, BUILD_ID));
} catch (e) {
  console.warn("sw.js generation skipped:", e);
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_BUILD_TIME: BUILD_TIME,
  },
  turbopack: {
    resolveAlias: {
      'react-remove-scroll-bar/constants':
        './node_modules/react-remove-scroll-bar/dist/es2015/constants.js',
    },
  },
};

export default nextConfig;
