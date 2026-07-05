import { absoluteUrl, siteConfig } from "@/lib/site";

export const revalidate = 3600;

export async function GET() {
  const apiRoot = siteConfig.publicApiBaseUrl;
  return Response.json(
    {
      name: "ChessView Agent Collaboration",
      version: "1.0.0",
      website: absoluteUrl("/en/collaborate"),
      agentInstructions: absoluteUrl("/en/collaborate/agents"),
      llms: absoluteUrl("/llms.txt"),
      repositories: siteConfig.repositories,
      api: {
        baseUrl: apiRoot,
        submissions: `${apiRoot}/agent-collaboration/submissions`,
        statusTemplate: `${apiRoot}/agent-collaboration/submissions/{submissionId}`,
        openapi: `${apiRoot}/agent-collaboration/openapi.json`,
        jsonSchema: `${apiRoot}/agent-collaboration/schema.json`,
      },
      acceptedKinds: ["event", "news"],
      reviewPolicy: {
        cadence: "weekly",
        immediatePublication: false,
        eventAutoConfidenceMin: 0.85,
        newsAutoConfidenceMin: 0.82,
        newsMaxAgeDays: 45,
        uncertainStatus: "quarantined",
      },
      safety: [
        "Submit short source-first metadata only.",
        "Do not submit private data, credentials, cookies, copied full articles, proprietary databases, or third-party assets without permission.",
        "Use http(s) public source URLs only; localhost and private-network URLs are rejected.",
      ],
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=3600",
      },
    }
  );
}
