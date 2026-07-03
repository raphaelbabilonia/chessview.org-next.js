const siteUrl = process.env.SMOKE_SITE_URL || "http://127.0.0.1:3001";
const apiUrl = process.env.SMOKE_API_URL || "http://127.0.0.1:5000/api";

const checks = [];

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const escapeHtml = (value) =>
  String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

const htmlIncludesText = (html, text) => html.includes(text) || html.includes(escapeHtml(text));

const slugifySegment = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

const todayIsoDate = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
};

const check = async (name, fn) => {
  try {
    await fn();
    checks.push({ name, ok: true });
  } catch (error) {
    checks.push({ name, ok: false, message: error.message });
    throw error;
  }
};

const getText = async (path, options = {}) => {
  const response = await fetch(`${siteUrl}${path}`, options);
  return {
    response,
    text: await response.text(),
  };
};

const getJson = async (url) => {
  const response = await fetch(url);
  assert(response.ok, `${url} returned ${response.status}`);
  return response.json();
};

await check("API health", async () => {
  const health = await getJson(`${apiUrl}/health`);
  assert(health.ok === true, "API health did not return ok=true");
});

const eventsPayload = await getJson(`${apiUrl}/events?activeFrom=${todayIsoDate()}`);
const firstEvent = eventsPayload.data?.[0];
assert(firstEvent, "API returned no public events for smoke tests");

await check("localized home pages render", async () => {
  const expected = {
    en: "Browse events",
    es: "Ver eventos",
    it: "Vedi eventi",
  };

  for (const [locale, text] of Object.entries(expected)) {
    const { response, text: html } = await getText(`/${locale}`);
    assert(response.status === 200, `/${locale} returned ${response.status}`);
    assert(html.includes(text), `/${locale} did not include ${text}`);
    assert(html.includes("<title>ChessView</title>"), `/${locale} did not include absolute home title`);
  }
});

await check("root redirects by Accept-Language", async () => {
  const response = await fetch(`${siteUrl}/`, {
    redirect: "manual",
    headers: {
      "Accept-Language": "es-AR,es;q=0.9,en;q=0.8",
    },
  });
  assert(response.status === 307, `/ returned ${response.status}`);
  assert(response.headers.get("location") === "/es", `expected /es, got ${response.headers.get("location")}`);
  assert(response.headers.get("set-cookie")?.includes("chessview_locale=es"), "missing locale cookie");
});

await check("legacy events route redirects by cookie", async () => {
  const response = await fetch(`${siteUrl}/events`, {
    redirect: "manual",
    headers: {
      Cookie: "chessview_locale=it",
    },
  });
  assert(response.status === 307, `/events returned ${response.status}`);
  assert(response.headers.get("location") === "/it/events", `expected /it/events, got ${response.headers.get("location")}`);
});

await check("legacy news route redirects by cookie", async () => {
  const response = await fetch(`${siteUrl}/news`, {
    redirect: "manual",
    headers: {
      Cookie: "chessview_locale=it",
    },
  });
  assert(response.status === 307, `/news returned ${response.status}`);
  assert(response.headers.get("location") === "/it/news", `expected /it/news, got ${response.headers.get("location")}`);
});

await check("news bridge page renders source-first cards", async () => {
  const { response, text } = await getText("/en/news");
  assert(response.status === 200, `/en/news returned ${response.status}`);
  assert(text.includes("A source-first chess news bridge"), "News page title missing");
  assert(text.includes("ChessBase"), "News page did not include ChessBase source");
  assert(text.includes("Original site"), "News page did not include source CTA");
});

await check("event list pages render translations", async () => {
  const { response, text } = await getText("/es/events");
  assert(response.status === 200, `/es/events returned ${response.status}`);
  assert(text.includes("Encontr"), "Spanish event list title missing");
  assert(htmlIncludesText(text, firstEvent.title), "Event list did not include first event title");
});

await check("event ID redirects to canonical slug", async () => {
  const response = await fetch(`${siteUrl}/en/events/${firstEvent._id}`, { redirect: "manual" });
  assert(response.status === 307, `event ID route returned ${response.status}`);
  assert(
    response.headers.get("location") === `/en/events/${firstEvent.slug}`,
    `expected /en/events/${firstEvent.slug}, got ${response.headers.get("location")}`
  );
});

await check("missing event returns 404", async () => {
  const response = await fetch(`${siteUrl}/en/events/not-a-real-event`, { redirect: "manual" });
  assert(response.status === 404, `missing event returned ${response.status}`);
});

await check("event detail includes SEO data", async () => {
  const { response, text } = await getText(`/it/events/${firstEvent.slug}`);
  assert(response.status === 200, `/it/events/${firstEvent.slug} returned ${response.status}`);
  assert(htmlIncludesText(text, firstEvent.title), "event detail title missing");
  assert(text.includes("application/ld+json"), "JSON-LD missing");
  assert(text.includes("SportsEvent"), "SportsEvent schema missing");
  assert(text.includes(`/es/events/${firstEvent.slug}`), "hreflang alternate for Spanish missing");
});

await check("sitemap includes localized event URLs", async () => {
  const { response, text } = await getText("/sitemap.xml");
  assert(response.status === 200, `/sitemap.xml returned ${response.status}`);
  for (const locale of ["en", "es", "it"]) {
    assert(text.includes(`/${locale}/news`), `sitemap missing ${locale} news URL`);
  }
  for (const locale of ["en", "es", "it"]) {
    assert(text.includes(`/${locale}/events/${firstEvent.slug}`), `sitemap missing ${locale} event URL`);
  }
});

await check("aggregator country and source pages render", async () => {
  if (firstEvent.country) {
    const countryPath = `/en/countries/${slugifySegment(firstEvent.country)}`;
    const { response, text } = await getText(countryPath);
    assert(response.status === 200, `${countryPath} returned ${response.status}`);
    assert(htmlIncludesText(text, firstEvent.title), "country page did not include first event title");
  }

  if (firstEvent.source?.name) {
    const sourcePath = `/en/sources/${slugifySegment(firstEvent.source.name)}`;
    const { response, text } = await getText(sourcePath);
    assert(response.status === 200, `${sourcePath} returned ${response.status}`);
    assert(htmlIncludesText(text, firstEvent.title), "source page did not include first event title");
  }
});

await check("missing aggregator pages return 404", async () => {
  const missingCountry = await fetch(`${siteUrl}/en/countries/not-a-real-country`, { redirect: "manual" });
  assert(missingCountry.status === 404, `missing country returned ${missingCountry.status}`);

  const missingSource = await fetch(`${siteUrl}/en/sources/not-a-real-source`, { redirect: "manual" });
  assert(missingSource.status === 404, `missing source returned ${missingSource.status}`);
});

await check("robots and manifest render", async () => {
  const robots = await getText("/robots.txt");
  assert(robots.response.status === 200, `/robots.txt returned ${robots.response.status}`);
  assert(robots.text.includes("Disallow: /es/dashboard/"), "robots missing localized private path");

  const manifest = await getText("/manifest.webmanifest");
  assert(manifest.response.status === 200, `/manifest.webmanifest returned ${manifest.response.status}`);
  assert(manifest.text.includes("ChessView"), "manifest missing app name");
});

await check("security headers are present", async () => {
  const response = await fetch(`${siteUrl}/en`);
  assert(response.headers.get("x-content-type-options") === "nosniff", "missing nosniff header");
  assert(response.headers.get("x-frame-options") === "DENY", "missing frame options header");
  assert(response.headers.get("referrer-policy") === "strict-origin-when-cross-origin", "missing referrer policy");
  assert(!response.headers.has("x-powered-by"), "x-powered-by should be disabled");
});

console.log(JSON.stringify({ ok: true, checks }, null, 2));
