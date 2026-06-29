/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pozwala ładować okładki gier z dowolnych adresów URL (wklejasz link do obrazka).
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
