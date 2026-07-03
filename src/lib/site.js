const DEFAULT_SITE_URL = "http://127.0.0.1:3001";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

export const siteConfig = {
  name: "ChessView",
  description:
    "Open source chess discovery for future tournaments, chess news, and source-first links back to organizers and publishers.",
  url: trimTrailingSlash(process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL),
};

export const absoluteUrl = (path = "/") => new URL(path, `${siteConfig.url}/`).toString();
