import { notFound } from "next/navigation";
import { getTrackingDashboard } from "@/lib/api";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tracking Dashboard | ChessView.org",
  robots: {
    index: false,
    follow: false,
  },
};

const numberFormatter = new Intl.NumberFormat("en-US");
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

const formatNumber = (value) => numberFormatter.format(Number(value || 0));

const parseDays = (value) => {
  const days = Number(Array.isArray(value) ? value[0] : value);
  if (![7, 30, 90].includes(days)) return 30;
  return days;
};

function Stat({ label, value }) {
  return (
    <article className="tracking-stat">
      <span>{label}</span>
      <strong>{formatNumber(value)}</strong>
    </article>
  );
}

function RankedList({ empty = "No data yet", items = [], title }) {
  const max = Math.max(...items.map((item) => Number(item.count || 0)), 1);

  return (
    <section className="tracking-panel">
      <h2>{title}</h2>
      {items.length ? (
        <ol className="tracking-ranked-list">
          {items.map((item) => (
            <li key={`${title}-${item.name}`}>
              <div>
                <span>{item.name}</span>
                <strong>{formatNumber(item.count)}</strong>
              </div>
              <span className="tracking-bar" style={{ "--tracking-bar-width": `${(Number(item.count || 0) / max) * 100}%` }} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="tracking-empty">{empty}</p>
      )}
    </section>
  );
}

function DailyTrend({ days, items = [] }) {
  const max = Math.max(...items.map((item) => Number(item.pageviews || 0)), 1);

  return (
    <section className="tracking-panel tracking-panel-wide">
      <div className="tracking-panel-heading">
        <h2>Daily Trend</h2>
        <span>{days} days</span>
      </div>
      {items.length ? (
        <div className="tracking-trend" aria-label="Daily pageviews">
          {items.map((item) => (
            <div className="tracking-trend-day" key={item.date}>
              <span
                aria-label={`${item.date}: ${formatNumber(item.pageviews)} pageviews`}
                style={{ "--tracking-trend-height": `${Math.max(8, (Number(item.pageviews || 0) / max) * 100)}%` }}
              />
              <small>{dateFormatter.format(new Date(`${item.date}T00:00:00Z`))}</small>
            </div>
          ))}
        </div>
      ) : (
        <p className="tracking-empty">No daily rollups yet</p>
      )}
    </section>
  );
}

function RecentEvents({ items = [] }) {
  return (
    <section className="tracking-panel tracking-panel-wide">
      <h2>Recent Events</h2>
      {items.length ? (
        <div className="tracking-table-wrap">
          <table className="tracking-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Event</th>
                <th>Path</th>
                <th>Entity</th>
                <th>Context</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={`${item.occurredAt}-${item.eventName}-${index}`}>
                  <td>{new Date(item.occurredAt).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td>{item.eventName}</td>
                  <td>{item.path}</td>
                  <td>{item.entityTitle || item.outboundHost || "-"}</td>
                  <td>{[item.routeType, item.locale, item.deviceType, item.country].filter(Boolean).join(" / ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="tracking-empty">No recent events yet</p>
      )}
    </section>
  );
}

export default async function TrackingDashboardPage({ params, searchParams }) {
  const { code } = await params;
  const query = await searchParams;
  const days = parseDays(query?.days);
  const { data, notFound: dashboardNotFound, status } = await getTrackingDashboard(code, days);

  if (dashboardNotFound || status === 404 || !data) {
    notFound();
  }

  return (
    <main className="page tracking-dashboard">
      <section className="page-header tracking-header">
        <p className="eyebrow">ChessView Internal Tracking</p>
        <h1>Website Activity</h1>
        <nav className="tracking-range" aria-label="Dashboard range">
          {[7, 30, 90].map((option) => (
            <a className={option === days ? "is-active" : ""} href={`/tracking/${code}?days=${option}`} key={option}>
              {option} days
            </a>
          ))}
        </nav>
      </section>

      <section className="tracking-stat-grid" aria-label="Tracking totals">
        <Stat label="Pageviews" value={data.totals?.pageviews} />
        <Stat label="Events" value={data.totals?.events} />
        <Stat label="Visitors" value={data.totals?.uniqueVisitors} />
        <Stat label="Sessions" value={data.totals?.sessions} />
      </section>

      <div className="tracking-grid">
        <DailyTrend days={days} items={data.daily} />
        <RankedList title="Top Pages" items={data.topPages} />
        <RankedList title="Top Events" items={data.topEvents} />
        <RankedList title="Routes" items={data.topRoutes} />
        <RankedList title="Filters" items={data.filters} />
        <RankedList title="Outbound Sites" items={data.outboundHosts} />
        <RankedList title="Referrers" items={data.referrers} />
        <RankedList title="Countries" items={data.countries} />
        <RankedList title="Devices" items={data.devices} />
        <RankedList title="Browsers" items={data.browsers} />
        <RankedList title="Entities" items={data.entities} />
        <RankedList title="Locales" items={data.locales} />
        <RecentEvents items={data.recent} />
      </div>
    </main>
  );
}
