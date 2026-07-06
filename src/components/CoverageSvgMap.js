"use client";

export function CoverageSvgMap({
  coverage,
  isCountryMode,
  mapLabel,
  mapPaths,
  mapRef,
  offset,
  renderRegionMarkers,
  renderTournamentDots,
  renderWorldCountrySelectors,
  renderWorldEventDots,
  selectedCountry,
  selectedRegion,
  showWorldCountrySelectors,
  zoom,
  ...pointerHandlers
}) {
  return (
    <svg
      ref={mapRef}
      className="coverage-map"
      viewBox={`0 0 ${coverage.mapSize.width} ${coverage.mapSize.height}`}
      role="img"
      aria-label={mapLabel}
      {...pointerHandlers}
    >
      <defs>
        <linearGradient id="coverageExplorerScan" x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor="#BA9B4A" stopOpacity="0" />
          <stop offset="45%" stopColor="#BA9B4A" stopOpacity="0.72" />
          <stop offset="100%" stopColor="#BA9B4A" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect className="coverage-map-panel" x="1" y="1" width="958" height="478" rx="10" />
      <g transform={`matrix(${zoom} 0 0 ${zoom} ${offset.x} ${offset.y})`}>
        <path className="coverage-map-sphere" d={mapPaths.sphere} />
        <path className="coverage-map-graticule" d={mapPaths.graticule} />
        <path className={isCountryMode ? "coverage-map-country-land" : "coverage-map-land"} d={mapPaths.land} />
        {!isCountryMode ? <path className="coverage-map-scan" d="M104 410H856" /> : null}
        {selectedCountry?.flatMapPaths?.boundary ? <path className="coverage-country-flat-boundary" d={selectedCountry.flatMapPaths.boundary} /> : null}
        {!selectedCountry && !showWorldCountrySelectors ? renderWorldEventDots() : null}
        {showWorldCountrySelectors ? renderWorldCountrySelectors() : null}
        {selectedCountry && !selectedRegion ? renderRegionMarkers() : null}
        {selectedCountry && selectedRegion ? renderTournamentDots() : null}
      </g>
    </svg>
  );
}
