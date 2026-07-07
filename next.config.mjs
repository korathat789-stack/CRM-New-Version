import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/(app)/quotations/[id]/pdf": ["./src/lib/pdf/fonts/**"],
  },
};

export default withNextIntl(nextConfig);
