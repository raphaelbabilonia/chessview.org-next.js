import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const processStartedAt = new Date().toISOString();

const deploymentSha = () => {
  const configured = String(process.env.CHESSVIEW_DEPLOY_SHA || process.env.GITHUB_SHA || "").trim();
  if (configured) return configured;
  try {
    return fs.readFileSync(path.join(process.cwd(), ".deployment-sha"), "utf8").trim() || "unknown";
  } catch {
    return "unknown";
  }
};

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      service: "chessview-web",
      deploymentSha: deploymentSha(),
      startedAt: processStartedAt,
    },
    {
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
      },
    }
  );
}
