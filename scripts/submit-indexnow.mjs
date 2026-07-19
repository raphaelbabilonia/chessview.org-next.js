const siteUrl = (process.env.INDEXNOW_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || "https://chessview.org").replace(
  /\/+$/,
  ""
);
const key = process.env.INDEXNOW_KEY || "6f4e66a3c77b46a1aa2f508ef4bb191f";
const keyLocation = `${siteUrl}/indexnow-key.txt`;

const urls = [
  "/",
  "/en",
  "/en/events",
  "/en/maps",
  "/en/news",
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
].map((path) => new URL(path, `${siteUrl}/`).toString());

const response = await fetch("https://api.indexnow.org/IndexNow", {
  method: "POST",
  headers: {
    "Content-Type": "application/json; charset=utf-8",
  },
  body: JSON.stringify({
    host: new URL(siteUrl).host,
    key,
    keyLocation,
    urlList: urls,
  }),
});

const body = await response.text();

if (!response.ok) {
  throw new Error(`IndexNow returned ${response.status}: ${body}`);
}

console.log(JSON.stringify({ ok: true, status: response.status, submitted: urls }, null, 2));
