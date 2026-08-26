import { getEventCatalog } from "@/lib/api";
import { renderUrlSitemap, sitemapEntriesForId } from "@/lib/sitemaps";

export const dynamic = "force-dynamic";

const xmlResponse = (body, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "Cache-Control": status === 200 ? "public, max-age=900, stale-while-revalidate=3600" : "no-store",
      "Content-Type": "application/xml; charset=utf-8",
    },
  });

export async function GET(_request, { params }) {
  const { id } = await params;
  const { data: events, error } = await getEventCatalog({ includePast: true, indexableOnly: true });
  if (error) return xmlResponse("<?xml version=\"1.0\"?><error>temporarily unavailable</error>", 503);

  const entries = sitemapEntriesForId(events, id);
  if (!entries.length) return xmlResponse("<?xml version=\"1.0\"?><error>not found</error>", 404);
  return xmlResponse(renderUrlSitemap(entries));
}
