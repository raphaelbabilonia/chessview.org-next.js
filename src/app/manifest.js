import { siteConfig } from "@/lib/site";

export default function manifest() {
  return {
    name: siteConfig.name,
    short_name: "ChessView",
    description: siteConfig.description,
    id: "/en",
    start_url: "/en",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    background_color: "#FAF9F5",
    theme_color: "#032044",
    categories: ["sports", "news", "productivity"],
    lang: "en",
    dir: "ltr",
    prefer_related_applications: false,
    icons: [
      {
        src: "/brand/chessview-favicon.svg",
        sizes: "64x64",
        type: "image/svg+xml",
      },
      {
        src: "/brand/chessview-app-icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
      },
    ],
    shortcuts: [
      {
        name: "Find chess tournaments",
        short_name: "Events",
        description: "Search upcoming and active chess tournaments.",
        url: "/en/events",
        icons: [{ src: "/brand/chessview-favicon.svg", sizes: "64x64", type: "image/svg+xml" }],
      },
      {
        name: "Explore coverage",
        short_name: "Coverage",
        description: "Open the country coverage map for chess tournaments.",
        url: "/en/coverage",
        icons: [{ src: "/brand/chessview-favicon.svg", sizes: "64x64", type: "image/svg+xml" }],
      },
      {
        name: "Read chess news",
        short_name: "News",
        description: "Browse source-first chess news previews.",
        url: "/en/news",
        icons: [{ src: "/brand/chessview-favicon.svg", sizes: "64x64", type: "image/svg+xml" }],
      },
    ],
  };
}
