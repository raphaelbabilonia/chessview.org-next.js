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
  publicApiBaseUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || "https://api.chessview.org/api"
  ),
  repositories: [
    {
      name: "Public website",
      description: "Next.js public pages, SEO routes, maps, news, and agent-facing documentation.",
      url: "https://github.com/raphaelbabilonia/chessview.org-next.js",
    },
    {
      name: "Express API",
      description: "Tournament, news, tracking, private ingest, and public agent collaboration API.",
      url: "https://github.com/raphaelbabilonia/chessview.org-backend",
    },
    {
      name: "Organizer frontend",
      description: "React/Vite organizer and tournament management interface.",
      url: "https://github.com/raphaelbabilonia/chessview.org-frontend",
    },
  ],
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
