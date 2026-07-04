import { MapPinned } from "lucide-react";
import Link from "next/link";

export function CountryCoverageSummary({ copy, coverage, locale }) {
  if (!coverage?.totalTournaments) return null;

  const coverageCopy = copy.home.coverage;
  const stats = coverage.topCountries || [];

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
          {stats
            .filter((stat) => stat.marker)
            .map((stat, index) => {
              const markerClassName = `country-coverage-marker${index === 0 ? " is-leading" : ""}`;
              const pulseRadius = stat.marker.radius + 5;
              const haloRadius = stat.marker.radius + 9;

              return (
                <g
                  className={markerClassName}
                  key={stat.country}
                  style={{ "--marker-order": index }}
                  transform={`translate(${stat.marker.x} ${stat.marker.y})`}
                >
                  <circle className="country-coverage-marker-halo" r={haloRadius} />
                  <circle className="country-coverage-marker-pulse" r={pulseRadius} />
                  <circle className="country-coverage-marker-core" r={stat.marker.radius} />
                  <circle className="country-coverage-marker-dot" r="3" />
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
            <strong>{coverage.totalTournaments}</strong>
            <span>{coverageCopy.total}</span>
          </div>
        </div>
        <div className="country-coverage-list">
          {stats.map((stat, index) => (
            <div
              aria-label={`${stat.label} ${stat.count}`}
              className={`country-coverage-chip${index === 0 ? " is-leading" : ""}`}
              key={stat.country}
            >
              <span className="country-coverage-label">
                <span className={`country-coverage-flag fi fi-${stat.flagCode}`} aria-hidden="true" />
                <span className="country-coverage-country">{stat.label}</span>
              </span>
              <strong>{stat.count}</strong>
            </div>
          ))}
        </div>
        <Link className="button button-small country-coverage-cta" href={`/${locale}/coverage`}>
          <MapPinned size={16} aria-hidden="true" />
          {coverageCopy.cta}
        </Link>
      </div>
    </aside>
  );
}
