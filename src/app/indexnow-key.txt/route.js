const indexNowKey = process.env.INDEXNOW_KEY || "6f4e66a3c77b46a1aa2f508ef4bb191f";

export const revalidate = false;

export async function GET() {
  return new Response(`${indexNowKey}\n`, {
    headers: {
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
