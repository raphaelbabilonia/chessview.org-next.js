const DEFAULT_SITE_URL = "http://127.0.0.1:3001";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const siteConfig = {
  name: "ChessView",
  title: "ChessView - Global Chess Tournament Search and News",
  description:
    "ChessView is a global chess tournament calendar and news index for upcoming events, country coverage, source-attributed listings, and organizer links.",
  url: trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL),
  domain: "chessview.org",
  repositoryUrl: "https://github.com/raphaelbabilonia/chessview.org-next.js",
  ogImage: {
    path: "/opengraph-image",
    alt: "ChessView global chess tournament search and chess news index",
  },
  keywords: [
    "ChessView",
    "chessview.org",
    "chess view",
    "chess tournaments",
    "chess tournament calendar",
    "chess events",
    "global chess calendar",
    "chess news",
    "FIDE tournaments",
    "chess tournament search",
    "chess organizer links",
  ],
};

export const absoluteUrl = (path = "/") => new URL(path, `${siteConfig.url}/`).toString();
