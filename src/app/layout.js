import { ThemeScript } from "@/components/ThemeScript";
import { AnalyticsConsentManager } from "@/components/AnalyticsConsentManager";
import { TrackingProvider } from "@/components/TrackingProvider";
import { defaultLocale, isLocale } from "@/i18n/config";
import { getAnalyticsCopy } from "@/i18n/analytics";
import { crawlerRobots, defaultOpenGraphImage, searchEngineVerification } from "@/lib/seo";
import { siteConfig } from "@/lib/site";
import { headers } from "next/headers";
import { Suspense } from "react";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

export const metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: siteConfig.keywords,
  authors: [{ name: "ChessView.org contributors" }],
  creator: "ChessView.org contributors",
  publisher: "ChessView.org contributors",
  category: "sports",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.title,
    description: siteConfig.description,
    url: "/",
    images: [defaultOpenGraphImage],
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.title,
    description: siteConfig.description,
    images: [defaultOpenGraphImage],
  },
  robots: crawlerRobots,
  verification: searchEngineVerification(),
  other: {
    classification: "sports, chess, tournament calendar, chess news",
    "apple-mobile-web-app-title": siteConfig.name,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/chessview-favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/brand/chessview-app-icon.svg",
  },
};

export default async function RootLayout({ children }) {
  const requestHeaders = await headers();
  const requestLocale = requestHeaders.get("x-chessview-locale");
  const locale = isLocale(requestLocale) ? requestLocale : defaultLocale;
  const analyticsCopy = getAnalyticsCopy(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeScript />
        <Suspense fallback={null}>
          <TrackingProvider />
        </Suspense>
        <AnalyticsConsentManager copy={analyticsCopy} />
        {children}
      </body>
    </html>
  );
}
