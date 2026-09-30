import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  // O output standalone precisa empacotar o engine do Prisma (fora do grafo do app),
  // senão o artefato de produção sobe sem o binário do banco.
  outputFileTracingIncludes: {
    "/**/*": ["./node_modules/.prisma/client/**/*", "./node_modules/@prisma/client/**/*"]
  }
};
export default nextConfig;
