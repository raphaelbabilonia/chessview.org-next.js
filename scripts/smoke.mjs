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

const headerValues = (response, name) =>
  String(response.headers.get(name) || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const hasHeaderValue = (response, name, expected) =>
  headerValues(response, name).some((value) => value.toLowerCase() === expected.toLowerCase());

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

await check("API news", async () => {
  const newsPayload = await getJson(`${apiUrl}/news?limit=3`);
  assert(newsPayload.data?.length === 3, "API news did not return three limited items");
  assert(
    newsPayload.meta?.sources?.some((source) => source.name === "ChessBase"),
    "API news did not include source metadata"
  );
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
  const titles = {
    en: "ChessView - Global Chess Tournament Search and News",
    es: "ChessView - Buscador global de torneos y noticias de ajedrez",
    it: "ChessView - Ricerca globale di tornei e notizie di scacchi",
  };

  for (const [locale, text] of Object.entries(expected)) {
    const { response, text: html } = await getText(`/${locale}`);
    assert(response.status === 200, `/${locale} returned ${response.status}`);
    assert(html.includes(text), `/${locale} did not include ${text}`);
    assert(htmlIncludesText(html, `<title>${titles[locale]}</title>`), `/${locale} did not include SEO home title`);
    assert(html.includes('name="googlebot"'), `/${locale} did not include googlebot crawler directives`);
    assert(html.includes("max-image-preview:large"), `/${locale} did not allow large image previews`);
    assert(html.includes('property="og:image"'), `/${locale} did not include Open Graph image metadata`);
    assert(html.includes("country-coverage-event-dot"), `/${locale} did not include landing coverage event dots`);
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

await check("legacy coverage route redirects by cookie", async () => {
  const response = await fetch(`${siteUrl}/coverage`, {
    redirect: "manual",
    headers: {
      Cookie: "chessview_locale=it",
    },
  });
  assert(response.status === 307, `/coverage returned ${response.status}`);
  assert(
    response.headers.get("location") === "/it/coverage",
    `expected /it/coverage, got ${response.headers.get("location")}`
  );
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
  assert(text.includes(`/es/events/${firstEvent.slug}`), "Event list did not include first event link");
});

await check("coverage map pages render", async () => {
  const expected = {
    en: "Explore tournament coverage",
    es: "Explora la cobertura de torneos",
    it: "Esplora la copertura tornei",
  };

  for (const [locale, title] of Object.entries(expected)) {
    const { response, text } = await getText(`/${locale}/coverage`);
    assert(response.status === 200, `/${locale}/coverage returned ${response.status}`);
    assert(htmlIncludesText(text, title), `/${locale}/coverage did not include title`);
    assert(text.includes(`/${locale}/events/${firstEvent.slug}`), `/${locale}/coverage did not include first event link`);
    assert(text.includes("coverage-country-button"), `/${locale}/coverage did not include country controls`);
    assert(text.includes("coverage-filter-bar"), `/${locale}/coverage did not include map filters`);
    assert(text.includes("coverage-world-event-dot"), `/${locale}/coverage did not include world event dots`);
    assert(text.includes("coverage-type-legend"), `/${locale}/coverage did not include tournament type legend`);
  }
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
  assert(text.includes(`/it/events/${firstEvent.slug}`), "event detail canonical URL missing");
  assert(text.includes("application/ld+json"), "JSON-LD missing");
  assert(text.includes("SportsEvent"), "SportsEvent schema missing");
  assert(text.includes(`/es/events/${firstEvent.slug}`), "hreflang alternate for Spanish missing");
});

await check("sitemap includes localized event URLs", async () => {
  const { response, text } = await getText("/sitemap.xml");
  assert(response.status === 200, `/sitemap.xml returned ${response.status}`);
  assert(text.includes('hreflang="x-default"'), "sitemap missing x-default hreflang alternates");
  for (const locale of ["en", "es", "it"]) {
    assert(text.includes(`/${locale}/news`), `sitemap missing ${locale} news URL`);
    assert(text.includes(`/${locale}/coverage`), `sitemap missing ${locale} coverage URL`);
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
    assert(text.includes(`/en/events/${firstEvent.slug}`), "country page did not include first event link");
  }

  if (firstEvent.source?.name) {
    const sourcePath = `/en/sources/${slugifySegment(firstEvent.source.name)}`;
    const { response, text } = await getText(sourcePath);
    assert(response.status === 200, `${sourcePath} returned ${response.status}`);
    assert(text.includes(`/en/events/${firstEvent.slug}`), "source page did not include first event link");
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
  assert(robots.text.includes("Allow: /llms.txt"), "robots missing llms.txt allow rule");

  const manifest = await getText("/manifest.webmanifest");
  assert(manifest.response.status === 200, `/manifest.webmanifest returned ${manifest.response.status}`);
  assert(manifest.text.includes("ChessView"), "manifest missing app name");
  assert(manifest.text.includes("Find chess tournaments"), "manifest missing SEO app shortcuts");

  const llms = await getText("/llms.txt");
  assert(llms.response.status === 200, `/llms.txt returned ${llms.response.status}`);
  assert(llms.text.includes("ChessView is a source-first public discovery layer"), "llms.txt missing site summary");

  const indexNowKey = await getText("/indexnow-key.txt");
  assert(indexNowKey.response.status === 200, `/indexnow-key.txt returned ${indexNowKey.response.status}`);
  assert(indexNowKey.text.trim().length >= 8, "IndexNow key is too short");
});

await check("security headers are present", async () => {
  const response = await fetch(`${siteUrl}/en`);
  assert(hasHeaderValue(response, "x-content-type-options", "nosniff"), "missing nosniff header");
  assert(hasHeaderValue(response, "x-frame-options", "DENY"), "missing frame options header");
  assert(hasHeaderValue(response, "referrer-policy", "strict-origin-when-cross-origin"), "missing referrer policy");
  assert(!response.headers.has("x-powered-by"), "x-powered-by should be disabled");
});

console.log(JSON.stringify({ ok: true, checks }, null, 2));
