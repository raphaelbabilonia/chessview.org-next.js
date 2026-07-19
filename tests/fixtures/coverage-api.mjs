import http from "node:http";

const port = Number(process.env.TEST_API_PORT || 5017);
const futureDate = (days) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
const events = [
  {
    _id: "fixture-south-primary",
    city: "Puerto Madryn",
    coordinates: [-65.0385, -42.7692],
    country: "Argentina",
    endDate: futureDate(7),
    region: "Chubut",
    slug: "fixture-south-primary",
    source: { name: "Fixture Federation" },
    startDate: futureDate(5),
    status: "published",
    timeControl: "classical",
    title: "Southern Classical Open",
  },
  {
    _id: "fixture-south-rapid",
    city: "Puerto Madryn",
    coordinates: [-65.0385, -42.7692],
    country: "Argentina",
    endDate: futureDate(9),
    region: "Chubut",
    slug: "fixture-south-rapid",
    source: { name: "Fixture Federation" },
    startDate: futureDate(9),
    status: "published",
    timeControl: "rapid",
    title: "Southern Rapid Cup",
  },
  {
    _id: "fixture-europe",
    city: "Lisbon",
    coordinates: [-9.1393, 38.7223],
    country: "Portugal",
    endDate: futureDate(14),
    region: "Lisbon",
    slug: "fixture-europe",
    source: { name: "Fixture Federation" },
    startDate: futureDate(12),
    status: "published",
    timeControl: "classical",
    title: "Lisbon Fixture Masters",
  },
  {
    _id: "fixture-asia",
    city: "Tokyo",
    coordinates: [139.6917, 35.6895],
    country: "Japan",
    endDate: futureDate(19),
    region: "Tokyo",
    slug: "fixture-asia",
    source: { name: "Fixture Federation" },
    startDate: futureDate(18),
    status: "published",
    timeControl: "blitz",
    title: "Tokyo Fixture Blitz",
  },
  {
    _id: "fixture-alias",
    city: "Sarajevo",
    coordinates: [18.4131, 43.8563],
    country: "Bosnia and Herzegovina",
    endDate: futureDate(24),
    region: "Sarajevo",
    slug: "fixture-alias",
    source: { name: "Fixture Federation" },
    startDate: futureDate(22),
    status: "published",
    timeControl: "classical",
    title: "Sarajevo Fixture Open",
  },
  {
    _id: "fixture-unmapped-spain",
    city: "Venue to be confirmed",
    country: "Spain",
    endDate: futureDate(25),
    region: "",
    slug: "fixture-unmapped-spain",
    source: { name: "Fixture Federation" },
    startDate: futureDate(23),
    status: "published",
    timeControl: "classical",
    title: "Unmapped Spain Safety Fixture",
  },
];

const json = (response, status, payload) => {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
};

const server = http.createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || `127.0.0.1:${port}`}`);

  if (url.pathname === "/api/health") {
    json(response, 200, { ok: true });
    return;
  }

  if (url.pathname === "/api/events") {
    json(response, 200, {
      data: events,
      meta: {
        count: events.length,
        hasNext: false,
        page: 1,
        pages: 1,
      },
    });
    return;
  }

  const eventMatch = url.pathname.match(/^\/api\/events\/([^/]+)$/);
  if (eventMatch) {
    const id = decodeURIComponent(eventMatch[1]);
    const event = events.find((item) => item._id === id || item.slug === id);
    json(response, event ? 200 : 404, { data: event || null });
    return;
  }

  json(response, 404, { data: null, error: "Fixture route not found" });
});

const close = () => server.close(() => process.exit(0));
process.on("SIGINT", close);
process.on("SIGTERM", close);

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`Coverage fixture API listening on http://127.0.0.1:${port}\n`);
});
