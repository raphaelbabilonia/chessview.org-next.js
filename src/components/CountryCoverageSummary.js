import { MapPinned } from "lucide-react";
import Link from "next/link";
import { CountryFlag } from "@/components/CountryFlag";

export function CountryCoverageSummary({ copy, coverage, locale }) {
  const coverageCopy = copy.home.coverage;
  const stats = coverage?.topCountries || [];
  const markers = coverage?.worldEvents || [];
  const totalTournaments = coverage?.totalTournaments ?? 0;

  if (!coverage?.mapSize || !coverage?.mapPaths) return null;

  return (
    <aside className="country-coverage" aria-label={coverageCopy.label}>
      <div className="country-coverage-map" aria-hidden="true">
        <svg viewBox={`0 0 ${coverage.mapSize.width} ${coverage.mapSize.height}`} focusable="false">
          <defs>
            <linearGradient id="coverageScan" x1="0%" x2="100%" y1="0%" y2="0%">
              <stop offset="0%" stopColor="#BA9B4A" stopOpacity="0" />
              <stop offset="44%" stopColor="#BA9B4A" stopOpacity="0.85" />
              <stop offset="100%" stopColor="#BA9B4A" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect className="country-coverage-panel" x="1" y="1" width="958" height="478" rx="12" />
          <path className="country-coverage-sphere" d={coverage.mapPaths.sphere} />
          <path className="country-coverage-graticule" d={coverage.mapPaths.graticule} />
          <path className="country-coverage-land" d={coverage.mapPaths.land} />
          <path className="country-coverage-shimmer" d="M104 410H856" />
          {markers.map((event, index) => {
            const radius = Math.max(event.marker.radius, 2.25);

            return (
              <g
                className={`country-coverage-event-dot is-${event.tournamentType}${event.markerSource === "country" ? " is-country-level" : ""}`}
                key={`${event._id}-${index}`}
                style={{ "--marker-order": index % 48 }}
                transform={`translate(${event.marker.x} ${event.marker.y})`}
              >
                <circle className="country-coverage-event-halo" r={radius + 1.65} />
                <circle className="country-coverage-event-core" r={radius} />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="country-coverage-data">
        <div className="country-coverage-summary">
          <div>
            <p className="eyebrow">{coverageCopy.eyebrow}</p>
            <h2>{coverageCopy.title}</h2>
          </div>
          <div className="country-coverage-total">
            <strong>{totalTournaments}</strong>
            <span>{coverageCopy.total}</span>
          </div>
        </div>
        <div className="country-coverage-list">
          {stats.length ? (
            stats.map((stat, index) => (
              <div
                aria-label={`${stat.label} ${stat.count}`}
                className={`country-coverage-chip${index === 0 ? " is-leading" : ""}`}
                key={stat.country}
              >
                <span className="country-coverage-label">
                  <CountryFlag country={stat} />
                  <span className="country-coverage-country">{stat.label}</span>
                </span>
                <strong>{stat.count}</strong>
              </div>
            ))
          ) : (
            <div className="country-coverage-empty">{coverageCopy.empty}</div>
          )}
        </div>
        <Link className="button button-small country-coverage-cta" href={`/${locale}/coverage`}>
          <MapPinned size={16} aria-hidden="true" />
          {coverageCopy.cta}
        </Link>
      </div>
    </aside>
  );
}
