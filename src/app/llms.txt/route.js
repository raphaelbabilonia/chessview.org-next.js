import { absoluteUrl, siteConfig } from "@/lib/site";

export const revalidate = 3600;

const lines = [
  "# ChessView",
  "",
  `> ${siteConfig.description}`,
  "",
  "ChessView is a source-first public discovery layer for chess tournaments and chess news. It helps players, organizers, publishers, and research tools find upcoming chess events, country coverage, public event pages, and original organizer or publisher links.",
  "",
  "## Primary URLs",
  "",
  `- Homepage: ${absoluteUrl("/en")}`,
  `- Tournament search: ${absoluteUrl("/en/events")}`,
  `- Coverage map: ${absoluteUrl("/en/coverage")}`,
  `- Chess news bridge: ${absoluteUrl("/en/news")}`,
  `- Collaborate: ${absoluteUrl("/en/collaborate")}`,
  `- Agent collaboration instructions: ${absoluteUrl("/en/collaborate/agents")}`,
  `- Agent collaboration manifest: ${absoluteUrl("/agent-collaboration.json")}`,
  `- Agent collaboration OpenAPI: ${siteConfig.publicApiBaseUrl}/agent-collaboration/openapi.json`,
  `- Agent submission JSON Schema: ${siteConfig.publicApiBaseUrl}/agent-collaboration/schema.json`,
  `- Sitemap: ${absoluteUrl("/sitemap.xml")}`,
  `- Robots: ${absoluteUrl("/robots.txt")}`,
  "",
  "## What To Index",
  "",
  "- Localized public pages under /en, /es, and /it.",
  "- Tournament detail pages under /:locale/events/:slug.",
  "- Country and source aggregation pages under /:locale/countries/:country and /:locale/sources/:source.",
  "- Source-first news preview pages that link readers back to original publishers.",
  "- Collaboration pages under /:locale/collaborate and /:locale/collaborate/agents.",
  "",
  "## Attribution And Data Notes",
  "",
  "- ChessView links to original organizers, federations, publishers, and public documents wherever possible.",
  "- Tournament dates, registration rules, fees, eligibility, ratings, venues, and schedule changes must be verified with the original source before acting on them.",
  "- Public agent submissions enter a queue and do not publish immediately; weekly rule-based review promotes only high-confidence, source-attributed metadata.",
  "- Agents must not submit copied full articles, credentials, cookies, private user data, proprietary databases, or private-network URLs.",
  "- Do not treat demo credentials, local development settings, or repository examples as production credentials.",
  "",
  "## Project",
  "",
  ...siteConfig.repositories.map((repository) => `- ${repository.name}: ${repository.url}`),
  "- Official domain: https://chessview.org",
  "",
];

export async function GET() {
  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
