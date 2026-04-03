import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@ventre/ui", "@ventre/supabase"],
};

export default nextConfig;
