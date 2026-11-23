/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers(){return [{source:'/bike-push-sw.js',headers:[{key:'Cache-Control',value:'no-store'},{key:'Service-Worker-Allowed',value:'/'}]}];},
};

export default nextConfig;
