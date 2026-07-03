import { siteConfig } from "@/lib/site";

export default function manifest() {
  return {
    name: siteConfig.name,
    short_name: "ChessView",
    description: siteConfig.description,
    start_url: "/",
    display: "standalone",
    background_color: "#FAF9F5",
    theme_color: "#032044",
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
  };
}
