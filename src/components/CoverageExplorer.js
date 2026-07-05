"use client";

import { ArrowLeft, ExternalLink, MapPinned, Minus, Plus, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatDateRange } from "@/lib/format";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const clampOffset = (offset, zoom, mapSize) => {
  const xLimit = mapSize.width * Math.max(zoom - 1, 0) + 120;
  const yLimit = mapSize.height * Math.max(zoom - 1, 0) + 100;

  return {
    x: clamp(offset.x, -xLimit, 120),
    y: clamp(offset.y, -yLimit, 100),
  };
};

const activationKeys = new Set(["Enter", " "]);

function TypeBadge({ copy, type }) {
  const labels = copy.coverage.types || {};
  return <span className={`coverage-type-badge is-${type || "other"}`}>{labels[type] || labels.other || type}</span>;
}

function CountStats({ copy, item }) {
  if (!item) return null;

  return (
    <div className="coverage-country-stats">
      <span>
        <strong>{item.count}</strong>
        {copy.coverage.tournaments}
      </span>
      <span>
        <strong>{item.liveCount}</strong>
        {copy.coverage.liveNow}
      </span>
      <span>
        <strong>{item.upcomingCount}</strong>
        {copy.coverage.upcoming}
      </span>
    </div>
  );
}

function EventLinkList({ copy, events = [], locale, limit }) {
  const visibleEvents = limit ? events.slice(0, limit) : events;

  if (!visibleEvents.length) {
    return <p className="muted">{copy.coverage.empty}</p>;
  }

  return (
    <div className="coverage-event-list">
      {visibleEvents.map((event) => (
        <Link className="coverage-event-link" href={event.href} key={event._id}>
          <span className="coverage-event-row-main">
            <span className="coverage-event-title">{event.title}</span>
            <TypeBadge copy={copy} type={event.tournamentType} />
          </span>
          <span className="coverage-event-meta">
            {[event.city, event.region, formatDateRange(event.startDate, event.endDate, locale)].filter(Boolean).join(" / ")}
          </span>
        </Link>
      ))}
    </div>
  );
}

function CoverageTooltip({ copy, locale, payload, style }) {
  if (!payload || !style) return null;

  if (payload.kind === "event") {
    const { event, country } = payload;

    return (
      <div className="coverage-tooltip" style={style}>
        <div className="coverage-tooltip-heading">
          <span className={`country-coverage-flag fi fi-${country.flagCode}`} aria-hidden="true" />
          <strong>{event.title}</strong>
        </div>
        <div className="coverage-tooltip-meta">
          <TypeBadge copy={copy} type={event.tournamentType} />
          <span>{[event.city, event.region].filter(Boolean).join(" / ")}</span>
          <span>{formatDateRange(event.startDate, event.endDate, locale)}</span>
        </div>
        <Link className="coverage-tooltip-link" href={event.href}>
          {copy.coverage.openEvent}
          <ExternalLink size={14} aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (payload.kind === "region") {
    const { country, region } = payload;

    return (
      <div className="coverage-tooltip" style={style}>
        <div className="coverage-tooltip-heading">
          <span className={`country-coverage-flag fi fi-${country.flagCode}`} aria-hidden="true" />
          <strong>{region.label}</strong>
        </div>
        <p className="coverage-tooltip-subtitle">{country.label}</p>
        <CountStats copy={copy} item={region} />
        <EventLinkList copy={copy} events={region.events} locale={locale} limit={3} />
      </div>
    );
  }

  const { country } = payload;

  return (
    <div className="coverage-tooltip" style={style}>
      <div className="coverage-tooltip-heading">
        <span className={`country-coverage-flag fi fi-${country.flagCode}`} aria-hidden="true" />
        <strong>{country.label}</strong>
      </div>
      <CountStats copy={copy} item={country} />
      <EventLinkList copy={copy} events={country.events} locale={locale} limit={3} />
    </div>
  );
}

function RegionCard({ copy, country, isSelected, onSelect, region }) {
  return (
    <button className={`coverage-region-card${isSelected ? " is-selected" : ""}`} type="button" onClick={() => onSelect(country, region)}>
      <span className="coverage-region-card-main">
        <strong>{region.label}</strong>
        <span>
          {region.plottedCount ? copy.coverage.mappedEvents.replace("{count}", region.plottedCount) : copy.coverage.noMappedEvents}
        </span>
      </span>
      <span className="coverage-region-card-count">{region.count}</span>
    </button>
  );
}

function CountryButton({ country, isSelected, onSelect }) {
  return (
    <button className={`coverage-country-button${isSelected ? " is-selected" : ""}`} type="button" onClick={() => onSelect(country)}>
      <span className={`country-coverage-flag fi fi-${country.flagCode}`} aria-hidden="true" />
      <span>{country.label}</span>
      <strong>{country.count}</strong>
    </button>
  );
}

export function CoverageExplorer({ copy, coverage, locale }) {
  const mapRef = useRef(null);
  const shellRef = useRef(null);
  const dragRef = useRef(null);
  const countryByKey = useMemo(
    () => new Map((coverage.allCountries || []).map((country) => [country.countryKey, country])),
    [coverage.allCountries],
  );
  const worldEvents = useMemo(
    () =>
      (coverage.worldEvents || [])
        .map((event) => ({
          ...event,
          country: countryByKey.get(event.countryKey),
        }))
        .filter((event) => event.country && event.marker),
    [coverage.worldEvents, countryByKey],
  );
  const allEvents = useMemo(
    () =>
      (coverage.allCountries || [])
        .flatMap((country) => country.events.map((event) => ({ ...event, country })))
        .sort((a, b) => Number(b.liveNow) - Number(a.liveNow) || String(a.startDate).localeCompare(String(b.startDate))),
    [coverage.allCountries],
  );

  const [selectedCountryKey, setSelectedCountryKey] = useState("");
  const [selectedRegionKey, setSelectedRegionKey] = useState("");
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [didDrag, setDidDrag] = useState(false);
  const [revealMapRequest, setRevealMapRequest] = useState(0);

  const selectedCountry = countryByKey.get(selectedCountryKey) || null;
  const selectedRegion = selectedCountry?.regions?.find((region) => region.key === selectedRegionKey) || null;
  const isCountryMode = Boolean(selectedCountry);
  const isRegionMode = Boolean(selectedCountry && selectedRegion);
  const mapPaths = selectedCountry?.flatMapPaths || coverage.mapPaths;
  const activePayload = hovered || pinned;
  const activePoint = activePayload?.point;
  const tooltipStyle = activePoint
    ? {
        left: `${clamp(((activePoint.x * zoom + offset.x) / coverage.mapSize.width) * 100, 3, 88)}%`,
        top: `${clamp(((activePoint.y * zoom + offset.y) / coverage.mapSize.height) * 100, 9, 82)}%`,
      }
    : null;

  const resetViewport = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!revealMapRequest) return;
    shellRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [revealMapRequest]);

  const applyZoom = (nextZoom) => {
    const cleanZoom = clamp(nextZoom, 1, 5);
    const center = {
      x: coverage.mapSize.width / 2,
      y: coverage.mapSize.height / 2,
    };
    const ratio = cleanZoom / zoom;
    const nextOffset = {
      x: center.x - (center.x - offset.x) * ratio,
      y: center.y - (center.y - offset.y) * ratio,
    };

    setZoom(cleanZoom);
    setOffset(clampOffset(nextOffset, cleanZoom, coverage.mapSize));
  };

  const focusPoint = (point, targetZoom = 2.65) => {
    const cleanZoom = clamp(targetZoom, 1, 5);
    const nextOffset = {
      x: coverage.mapSize.width / 2 - point.x * cleanZoom,
      y: coverage.mapSize.height / 2 - point.y * cleanZoom,
    };

    setZoom(cleanZoom);
    setOffset(clampOffset(nextOffset, cleanZoom, coverage.mapSize));
  };

  const backToWorld = () => {
    setSelectedCountryKey("");
    setSelectedRegionKey("");
    setHovered(null);
    setPinned(null);
    resetViewport();
  };

  const selectCountry = (country) => {
    setSelectedCountryKey(country.countryKey);
    setSelectedRegionKey("");
    setHovered(null);
    setPinned(null);
    resetViewport();
    setRevealMapRequest((request) => request + 1);
  };

  const selectRegion = (country, region) => {
    setSelectedCountryKey(country.countryKey);
    setSelectedRegionKey(region.key);
    setHovered(null);
    setPinned(null);
    if (region.marker) focusPoint(region.marker, 2.85);
    setRevealMapRequest((request) => request + 1);
  };

  const onMarkerKeyDown = (event, callback) => {
    if (!activationKeys.has(event.key)) return;
    event.preventDefault();
    callback();
  };

  const startDrag = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      offset,
      startX: event.clientX,
      startY: event.clientY,
    };
    setDidDrag(false);
    setIsDragging(true);
  };

  const moveDrag = (event) => {
    if (!dragRef.current || !mapRef.current) return;
    const bounds = mapRef.current.getBoundingClientRect();
    const dx = ((event.clientX - dragRef.current.startX) * coverage.mapSize.width) / bounds.width;
    const dy = ((event.clientY - dragRef.current.startY) * coverage.mapSize.height) / bounds.height;

    if (Math.abs(dx) + Math.abs(dy) > 3) setDidDrag(true);
    setOffset(
      clampOffset(
        {
          x: dragRef.current.offset.x + dx,
          y: dragRef.current.offset.y + dy,
        },
        zoom,
        coverage.mapSize,
      ),
    );
  };

  const stopDrag = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const clearFloatingDetails = () => {
    if (didDrag) return;
    setHovered(null);
    setPinned(null);
  };

  const renderWorldEventDots = () =>
    worldEvents.map((event, index) => {
      const payload = {
        country: event.country,
        event,
        kind: "event",
        point: event.marker,
      };

      return (
        <g
          aria-label={`${event.title}: ${[event.city, event.region, event.countryLabel].filter(Boolean).join(", ")}`}
          className={`coverage-interactive-marker coverage-world-event-dot is-${event.tournamentType}${event.markerSource === "country" ? " is-country-level" : ""}`}
          key={`${event._id}-${index}`}
          onBlur={() => setHovered(null)}
          onClick={(pointerEvent) => {
            pointerEvent.stopPropagation();
            setPinned(payload);
          }}
          onFocus={() => setHovered(payload)}
          onKeyDown={(keyEvent) => onMarkerKeyDown(keyEvent, () => setPinned(payload))}
          onMouseEnter={() => setHovered(payload)}
          onMouseLeave={() => setHovered(null)}
          onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
          role="button"
          tabIndex={0}
          transform={`translate(${event.marker.x} ${event.marker.y})`}
        >
          <title>{event.title}</title>
          <circle className="coverage-world-dot-target" r="7" />
          <circle className="coverage-world-dot-ring" r={event.marker.radius + 1.25} />
          <circle className="coverage-world-dot-core" r={event.marker.radius} />
        </g>
      );
    });

  const renderWorldCountrySelectors = () =>
    coverage.allCountries
      .filter((country) => country.marker)
      .map((country) => {
        const visualRadius = Number(Math.max(2.4, Math.min(5.2, 2 + Math.sqrt(country.count) * 0.32)).toFixed(2));
        const payload = {
          country,
          kind: "country",
          point: country.marker,
        };

        return (
          <g
            aria-label={`${country.label}: ${country.count} ${copy.coverage.tournaments}`}
            className="coverage-interactive-marker coverage-country-cluster"
            key={country.countryKey}
            onBlur={() => setHovered(null)}
            onClick={(event) => {
              event.stopPropagation();
              selectCountry(country);
            }}
            onFocus={() => setHovered(payload)}
            onKeyDown={(event) => onMarkerKeyDown(event, () => selectCountry(country))}
            onMouseEnter={() => setHovered(payload)}
            onMouseLeave={() => setHovered(null)}
            onPointerDown={(event) => event.stopPropagation()}
            role="button"
            tabIndex={0}
            transform={`translate(${country.marker.x} ${country.marker.y})`}
          >
            <title>{`${country.label}: ${country.count} ${copy.coverage.tournaments}`}</title>
            <circle className="coverage-marker-target" r={Math.max(visualRadius + 11, 16)} />
            <circle className="coverage-marker-halo" r={visualRadius + 2.3} />
            <circle className="coverage-marker-core" r={visualRadius} />
            <circle className="coverage-marker-dot" r="1.25" />
          </g>
        );
      });

  const renderRegionMarkers = () =>
    (selectedCountry?.regions || [])
      .filter((region) => region.marker)
      .map((region) => {
        const payload = {
          country: selectedCountry,
          kind: "region",
          point: region.marker,
          region,
        };

        return (
          <g
            aria-label={`${region.label}: ${region.count} ${copy.coverage.tournaments}`}
            className={`coverage-interactive-marker coverage-region-marker${selectedRegionKey === region.key ? " is-selected" : ""}`}
            key={region.key}
            onBlur={() => setHovered(null)}
            onClick={(event) => {
              event.stopPropagation();
              selectRegion(selectedCountry, region);
            }}
            onFocus={() => setHovered(payload)}
            onKeyDown={(event) => onMarkerKeyDown(event, () => selectRegion(selectedCountry, region))}
            onMouseEnter={() => setHovered(payload)}
            onMouseLeave={() => setHovered(null)}
            onPointerDown={(event) => event.stopPropagation()}
            role="button"
            tabIndex={0}
            transform={`translate(${region.marker.x} ${region.marker.y})`}
          >
            <title>{`${region.label}: ${region.count} ${copy.coverage.tournaments}`}</title>
            <circle className="coverage-marker-target" r={Math.max(region.marker.radius + 9, 18)} />
            <circle className="coverage-region-halo" r={region.marker.radius + 4.5} />
            <circle className="coverage-region-core" r={region.marker.radius} />
            <text className="coverage-region-count" dy="4" textAnchor="middle">
              {region.count}
            </text>
          </g>
        );
      });

  const renderTournamentDots = () =>
    (selectedRegion?.events || [])
      .filter((event) => event.marker)
      .map((event) => {
        const payload = {
          country: selectedCountry,
          event,
          kind: "event",
          point: event.marker,
          region: selectedRegion,
        };

        return (
          <g
            aria-label={`${event.title}: ${[event.city, event.region].filter(Boolean).join(", ")}`}
            className={`coverage-interactive-marker coverage-tournament-dot is-${event.tournamentType}`}
            key={event._id}
            onBlur={() => setHovered(null)}
            onClick={(pointerEvent) => {
              pointerEvent.stopPropagation();
              setPinned(payload);
            }}
            onFocus={() => setHovered(payload)}
            onKeyDown={(keyEvent) => onMarkerKeyDown(keyEvent, () => setPinned(payload))}
            onMouseEnter={() => setHovered(payload)}
            onMouseLeave={() => setHovered(null)}
            onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()}
            role="button"
            tabIndex={0}
            transform={`translate(${event.marker.x} ${event.marker.y})`}
          >
            <title>{event.title}</title>
            <circle className="coverage-dot-target" r="9" />
            <circle className="coverage-dot-ring" r="5.4" />
            <circle className="coverage-dot-core" r="3.2" />
          </g>
        );
      });

  return (
    <section className="coverage-explorer" aria-label={copy.coverage.mapLabel}>
      <div className="coverage-mode-bar">
        <div className="coverage-breadcrumbs" aria-label={copy.coverage.currentView}>
          <button className={!selectedCountry ? "is-current" : ""} type="button" onClick={backToWorld}>
            {copy.coverage.worldView}
          </button>
          {selectedCountry ? (
            <button className={selectedCountry && !selectedRegion ? "is-current" : ""} type="button" onClick={() => selectCountry(selectedCountry)}>
              {selectedCountry.label}
            </button>
          ) : null}
          {selectedRegion ? (
            <button className="is-current" type="button" onClick={() => selectedRegion.marker && focusPoint(selectedRegion.marker, 2.85)}>
              {selectedRegion.label}
            </button>
          ) : null}
        </div>
        <div className="coverage-type-legend" aria-label={copy.coverage.tournamentTypes}>
          {["classical", "rapid", "blitz", "other"].map((type) => (
            <TypeBadge copy={copy} key={type} type={type} />
          ))}
        </div>
      </div>

      <div className="coverage-map-shell" ref={shellRef}>
        <div className="coverage-map-toolbar" aria-label={copy.coverage.mapLabel}>
          {selectedCountry ? (
            <button className="icon-button" type="button" onClick={backToWorld} aria-label={copy.coverage.backToWorld} title={copy.coverage.backToWorld}>
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          ) : null}
          <button className="icon-button" type="button" onClick={() => applyZoom(zoom + 0.45)} aria-label={copy.coverage.zoomIn} title={copy.coverage.zoomIn}>
            <Plus size={18} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => applyZoom(zoom - 0.45)} aria-label={copy.coverage.zoomOut} title={copy.coverage.zoomOut}>
            <Minus size={18} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={resetViewport} aria-label={copy.coverage.resetMap} title={copy.coverage.resetMap}>
            <RotateCcw size={18} aria-hidden="true" />
          </button>
        </div>

        <div className={`coverage-map-stage${isDragging ? " is-dragging" : ""}${isCountryMode ? " is-country-mode" : ""}`}>
          <svg
            ref={mapRef}
            className="coverage-map"
            viewBox={`0 0 ${coverage.mapSize.width} ${coverage.mapSize.height}`}
            role="img"
            aria-label={copy.coverage.mapLabel}
            onClick={clearFloatingDetails}
            onPointerCancel={stopDrag}
            onPointerDown={startDrag}
            onPointerLeave={stopDrag}
            onPointerMove={moveDrag}
            onPointerUp={stopDrag}
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
              {!selectedCountry ? renderWorldEventDots() : null}
              {!selectedCountry ? renderWorldCountrySelectors() : null}
              {selectedCountry && !selectedRegion ? renderRegionMarkers() : null}
              {selectedCountry && selectedRegion ? renderTournamentDots() : null}
            </g>
          </svg>
          {selectedCountry && !selectedCountry.flatMapPaths ? (
            <div className="coverage-map-note">
              <MapPinned size={18} aria-hidden="true" />
              {copy.coverage.countryNeedsCoordinates}
            </div>
          ) : null}
          <CoverageTooltip copy={copy} locale={locale} payload={activePayload} style={tooltipStyle} />
        </div>
      </div>

      <section className="coverage-panel" aria-label={copy.coverage.currentSelection}>
        {!selectedCountry ? (
          <>
            <div className="coverage-panel-heading">
              <div>
                <p className="eyebrow">{copy.coverage.worldView}</p>
                <h2>{copy.coverage.chooseCountry}</h2>
              </div>
            </div>
            <EventLinkList copy={copy} events={allEvents.map((item) => item)} locale={locale} limit={6} />
          </>
        ) : null}

        {selectedCountry && !selectedRegion ? (
          <>
            <div className="coverage-panel-heading">
              <div>
                <p className="eyebrow">{copy.coverage.countryView}</p>
                <h2>{selectedCountry.label}</h2>
              </div>
              {selectedCountry.href ? (
                <Link className="button button-small button-ghost" href={selectedCountry.href}>
                  {copy.coverage.exploreCountry}
                </Link>
              ) : null}
            </div>
            <CountStats copy={copy} item={selectedCountry} />
            <div className="coverage-region-grid">
              {selectedCountry.regions.map((region) => (
                <RegionCard copy={copy} country={selectedCountry} isSelected={selectedRegionKey === region.key} key={region.key} onSelect={selectRegion} region={region} />
              ))}
            </div>
            {selectedCountry.unmappedEvents.length ? (
              <p className="coverage-coordinate-note">
                {copy.coverage.eventsWithoutCoordinates.replace("{count}", selectedCountry.unmappedEvents.length)}
              </p>
            ) : null}
          </>
        ) : null}

        {selectedCountry && selectedRegion ? (
          <>
            <div className="coverage-panel-heading">
              <div>
                <p className="eyebrow">{copy.coverage.regionView}</p>
                <h2>{selectedRegion.label}</h2>
              </div>
              <button className="button button-small button-ghost" type="button" onClick={() => selectCountry(selectedCountry)}>
                {copy.coverage.backToCountry}
              </button>
            </div>
            <CountStats copy={copy} item={selectedRegion} />
            <EventLinkList copy={copy} events={selectedRegion.events} locale={locale} />
          </>
        ) : null}
      </section>

      <aside className="coverage-country-browser" aria-label={copy.coverage.countryList}>
        <div className="coverage-browser-heading">
          <p className="eyebrow">{copy.coverage.countryList}</p>
          <strong>{coverage.totalCountries}</strong>
        </div>
        <div className="coverage-country-buttons">
          {coverage.allCountries.map((country) => (
            <CountryButton country={country} isSelected={selectedCountry?.countryKey === country.countryKey} key={country.countryKey} onSelect={selectCountry} />
          ))}
        </div>
      </aside>

      {coverage.unmappedCountries.length ? (
        <aside className="coverage-unmapped">
          <div>
            <p className="eyebrow">{copy.coverage.unmappedTitle}</p>
            <p>{copy.coverage.unmappedBody}</p>
          </div>
          <div className="coverage-unmapped-list">
            {coverage.unmappedCountries.map((country) => (
              <span key={country.countryKey}>
                {country.label} ({country.count})
              </span>
            ))}
          </div>
        </aside>
      ) : null}
    </section>
  );
}
