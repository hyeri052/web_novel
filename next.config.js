/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'export',
    images:{
      unoptimized: true,
    },
    basePath: '/web_novel',      // ⭐ 레포지토리 이름
    assetPrefix: '/web_novel/',  // ⭐ 슬래시 포함
  };
  

  module.exports = nextConfig;
