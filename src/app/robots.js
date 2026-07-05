import { absoluteUrl, siteConfig } from "@/lib/site";

export default function robots() {
  const privatePaths = [
    "/dashboard/",
    "/login/",
    "/register/",
    "/en/dashboard/",
    "/en/login/",
    "/en/register/",
    "/es/dashboard/",
    "/es/login/",
    "/es/register/",
    "/it/dashboard/",
    "/it/login/",
    "/it/register/",
  ];

  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/llms.txt", "/manifest.webmanifest", "/agent-collaboration.json"],
      disallow: privatePaths,
    },
    sitemap: absoluteUrl("/sitemap.xml"),
    host: new URL(siteConfig.url).host,
  };
}
