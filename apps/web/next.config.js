import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {},
  // react-pdf reads these via fs at runtime (Font.register / <Image src>) using a
  // dynamically built path, so Next's file tracing can't discover them on its own —
  // without this they're missing from the Vercel serverless bundle (ENOENT in prod).
  outputFileTracingIncludes: {
    "/**": ["./public/fonts/**", "./public/images/digital-signature-stamp.png"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "*.googleusercontent.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "osnpmadayhignmkpoevr.supabase.co",
        pathname: "/**",
      },
    ],
  },
};

export default withSerwist(nextConfig);
