import { ThemeScript } from "@/components/ThemeScript";
import { defaultLocale, isLocale } from "@/i18n/config";
import { siteConfig } from "@/lib/site";
import { headers } from "next/headers";
import "flag-icons/css/flag-icons.min.css";
import "./globals.css";

export const metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: siteConfig.name,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  authors: [{ name: "ChessView.org contributors" }],
  creator: "ChessView.org contributors",
  publisher: "ChessView.org contributors",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName: siteConfig.name,
    title: siteConfig.name,
    description: siteConfig.description,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: siteConfig.name,
    description: siteConfig.description,
  },
  robots: {
    index: true,
    follow: true,
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

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <ThemeScript />
        {children}
      </body>
    </html>
  );
}
