"use client";

import { ArrowLeft, ExternalLink, MapPinned, Maximize2, Minimize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import { formatDateRange } from "@/lib/format";

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const mapZoom = {
  countryMax: 10,
  doubleStep: 0.7,
  min: 1,
  step: 0.45,
  worldMax: 50,
};

const clampOffset = (offset, zoom, mapSize) => {
  const xLimit = mapSize.width * Math.max(zoom - 1, 0) + 120;
  const yLimit = mapSize.height * Math.max(zoom - 1, 0) + 100;

  return {
    x: clamp(offset.x, -xLimit, 120),
    y: clamp(offset.y, -yLimit, 100),
  };
};

const activationKeys = new Set(["Enter", " "]);
const tournamentTypes = ["classical", "rapid", "blitz", "other"];
const datePresets = ["oneMonth", "threeMonths", "year", "nextYear", "custom"];

const dateValue = (date) => date.toISOString().slice(0, 10);

const addMonths = (value, months) => {
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day || 1));
  date.setUTCMonth(date.getUTCMonth() + months);
  return dateValue(date);
};

const endOfYear = (value) => `${String(value).slice(0, 4)}-12-31`;

const nextYearRange = (value) => {
  const year = Number(String(value).slice(0, 4)) + 1;
  return {
    end: `${year}-12-31`,
    start: `${year}-01-01`,
  };
};

const cleanRange = (start, end) => {
  const safeStart = /^\d{4}-\d{2}-\d{2}$/.test(start) ? start : dateValue(new Date());
  const safeEnd = /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : safeStart;

  return safeStart <= safeEnd ? { start: safeStart, end: safeEnd } : { start: safeEnd, end: safeStart };
};

const rangeForPreset = (preset, today, customStart, customEnd) => {
  if (preset === "threeMonths") return cleanRange(today, addMonths(today, 3));
  if (preset === "year") return cleanRange(today, endOfYear(today));
  if (preset === "nextYear") return nextYearRange(today);
  if (preset === "custom") return cleanRange(customStart, customEnd);
  return cleanRange(today, addMonths(today, 1));
};

const eventDateKey = (value) => String(value || "").slice(0, 10);

const eventMatchesRange = (event, range) => {
  const start = eventDateKey(event.startDate || event.endDate);
  const end = eventDateKey(event.endDate || event.startDate || start);
  if (!start || !end) return false;
  return end >= range.start && start <= range.end;
};

const sortEvents = (a, b) =>
  Number(b.liveNow) - Number(a.liveNow) ||
  String(a.startDate || "").localeCompare(String(b.startDate || "")) ||
  String(a.title || "").localeCompare(String(b.title || ""));

const countLive = (events) => events.filter((event) => event.liveNow).length;

const regionRadius = (count) => Number(Math.max(5.5, Math.min(12, 4.6 + Math.sqrt(count) * 1.6)).toFixed(2));

const averageMarker = (events) => {
  const plottedEvents = events.filter((event) => event.marker);
  if (!plottedEvents.length) return null;

  return {
    x: Number((plottedEvents.reduce((sum, event) => sum + event.marker.x, 0) / plottedEvents.length).toFixed(2)),
    y: Number((plottedEvents.reduce((sum, event) => sum + event.marker.y, 0) / plottedEvents.length).toFixed(2)),
    radius: regionRadius(events.length),
  };
};

const worldClusterScreenDistance = (zoom) => {
  if (zoom >= 16) return 8;
  if (zoom >= 8) return 9.5;
  if (zoom >= 4) return 11;
  if (zoom >= 2) return 13;
  return 18;
};

const worldEventPoint = (event) => event.anchor || event.marker || null;

const worldEventDotRadius = (event, zoom) => {
  const baseRadius = event.marker?.radius || 1.6;
  const densityScale = Math.sqrt(Math.max(zoom / 2.15, 1));
  const sourceScale = event.markerSource === "country" ? 0.82 : 1;
  return Number(Math.max(0.42, Math.min(baseRadius, (baseRadius * sourceScale) / densityScale)).toFixed(2));
};

const worldEventTargetRadius = (radius, zoom) => Number(Math.max(radius + 0.5, Math.min(4.2, 5.1 / Math.max(zoom, 1))).toFixed(2));

const worldEventClusterRadius = (count, zoom) => {
  const baseRadius = 1.8 + Math.sqrt(count) * 0.42;
  const densityScale = Math.sqrt(Math.max(zoom / 2.4, 1));
  return Number(Math.max(1.12, Math.min(4.4, baseRadius / densityScale)).toFixed(2));
};

const uniqueCountriesForEvents = (events) => {
  const countries = new Map();

  for (const event of events) {
    const country = event.country || {
      country: event.countryLabel,
      flagCode: event.countryFlagCode,
      label: event.countryLabel,
    };
    const key = country?.countryKey || event.countryKey || event.countryLabel;
    if (key && !countries.has(key)) countries.set(key, country);
  }

  return [...countries.values()];
};

const averagePoint = (items) => ({
  x: Number((items.reduce((sum, item) => sum + item.point.x, 0) / items.length).toFixed(2)),
  y: Number((items.reduce((sum, item) => sum + item.point.y, 0) / items.length).toFixed(2)),
});

const buildWorldMapItems = (events, zoom) => {
  const normalizedZoom = Math.max(zoom, 1);
  const screenDistance = worldClusterScreenDistance(normalizedZoom);
  const candidates = events
    .map((event, index) => ({
      event,
      index,
      point: worldEventPoint(event),
    }))
    .filter((candidate) => candidate.point)
    .sort(
      (a, b) =>
        Number(a.event.markerSource === "country") - Number(b.event.markerSource === "country") ||
        a.point.y - b.point.y ||
        a.point.x - b.point.x ||
        String(a.event.startDate || "").localeCompare(String(b.event.startDate || "")),
    );
  const usedIndexes = new Set();
  const items = [];

  for (let index = 0; index < candidates.length; index += 1) {
    if (usedIndexes.has(index)) continue;

    const candidate = candidates[index];
    const group = [candidate];
    usedIndexes.add(index);

    for (let otherIndex = index + 1; otherIndex < candidates.length; otherIndex += 1) {
      if (usedIndexes.has(otherIndex)) continue;
      const other = candidates[otherIndex];
      const projectedDistance = Math.hypot(
        (candidate.point.x - other.point.x) * normalizedZoom,
        (candidate.point.y - other.point.y) * normalizedZoom,
      );

      if (projectedDistance <= screenDistance) {
        group.push(other);
        usedIndexes.add(otherIndex);
      }
    }

    const groupedEvents = group.map((item) => item.event).sort(sortEvents);

    if (groupedEvents.length > 1) {
      const point = averagePoint(group);
      const liveCount = countLive(groupedEvents);
      const countries = uniqueCountriesForEvents(groupedEvents);

      items.push({
        countries,
        countryLabels: countries.map((country) => country.label || country.country).filter(Boolean),
        count: groupedEvents.length,
        events: groupedEvents,
        key: `event-cluster-${groupedEvents.length}-${Math.round(point.x)}-${Math.round(point.y)}-${group[0].event._id}`,
        kind: "cluster",
        liveCount,
        marker: {
          ...point,
          radius: worldEventClusterRadius(groupedEvents.length, normalizedZoom),
        },
        point,
        upcomingCount: groupedEvents.length - liveCount,
      });
      continue;
    }

    const event = groupedEvents[0];
    const radius = worldEventDotRadius(event, normalizedZoom);

    items.push({
      event,
      key: `event-${event._id}-${group[0].index}`,
      kind: "event",
      radius,
      ringRadius: Number((radius + 0.72).toFixed(2)),
      targetRadius: worldEventTargetRadius(radius, normalizedZoom),
    });
  }

  return items.sort((a, b) => Number(a.kind === "cluster") - Number(b.kind === "cluster"));
};

const pointerPosition = (event) => ({ x: event.clientX, y: event.clientY });

const distanceBetween = (first, second) => Math.hypot(first.x - second.x, first.y - second.y);

const midpointBetween = (first, second) => ({
  x: (first.x + second.x) / 2,
  y: (first.y + second.y) / 2,
});

const isFormControlTarget = (target) => {
  if (!target?.tagName) return false;
  return ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
};

function TypeBadge({ copy, type }) {
  const labels = copy.coverage.types || {};
  return <span className={`coverage-type-badge is-${type || "other"}`}>{labels[type] || labels.other || type}</span>;
}

function TypeFilterButton({ active, copy, onToggle, type }) {
  const labels = copy.coverage.types || {};

  return (
    <button
      aria-pressed={active}
      className={`coverage-type-badge coverage-type-filter is-${type}${active ? " is-active" : ""}`}
      type="button"
      onClick={() => onToggle(type)}
    >
      {labels[type] || type}
    </button>
  );
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

function TooltipShell({ children, closeLabel, onClose, style }) {
  const stopTooltipGesture = (event) => event.stopPropagation();
  const closeTooltip = (event) => {
    event.stopPropagation();
    onClose();
  };

  return (
    <div
      className="coverage-tooltip"
      style={style}
      onClick={stopTooltipGesture}
      onPointerCancel={stopTooltipGesture}
      onPointerDown={stopTooltipGesture}
      onPointerMove={stopTooltipGesture}
      onPointerUp={stopTooltipGesture}
      onWheel={stopTooltipGesture}
    >
      <button className="coverage-tooltip-close" type="button" onClick={closeTooltip} aria-label={closeLabel} title={closeLabel}>
        <X size={16} aria-hidden="true" />
      </button>
      {children}
    </div>
  );
}

function CoverageTooltip({ copy, locale, onClose, onOpenCountry, payload, style }) {
  if (!payload || !style) return null;

  if (payload.kind === "event") {
    const { event, country } = payload;

    return (
      <TooltipShell closeLabel={copy.coverage.closePopup} onClose={onClose} style={style}>
        <div className="coverage-tooltip-heading">
          <CountryFlag country={country} />
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
      </TooltipShell>
    );
  }

  if (payload.kind === "eventCluster") {
    const { cluster } = payload;
    const leadCountry = cluster.countries[0];
    const countryLabel = cluster.countryLabels.slice(0, 3).join(" / ");

    return (
      <TooltipShell closeLabel={copy.coverage.closePopup} onClose={onClose} style={style}>
        <div className="coverage-tooltip-heading">
          {leadCountry ? <CountryFlag country={leadCountry} /> : <MapPinned size={18} aria-hidden="true" />}
          <strong>
            {cluster.count} {copy.coverage.tournaments}
          </strong>
        </div>
        {countryLabel ? <p className="coverage-tooltip-subtitle">{countryLabel}</p> : null}
        <CountStats copy={copy} item={cluster} />
        <EventLinkList copy={copy} events={cluster.events} locale={locale} limit={4} />
      </TooltipShell>
    );
  }

  if (payload.kind === "region") {
    const { country, region } = payload;

    return (
      <TooltipShell closeLabel={copy.coverage.closePopup} onClose={onClose} style={style}>
        <div className="coverage-tooltip-heading">
          <CountryFlag country={country} />
          <strong>{region.label}</strong>
        </div>
        <p className="coverage-tooltip-subtitle">{country.label}</p>
        <CountStats copy={copy} item={region} />
        <EventLinkList copy={copy} events={region.events} locale={locale} limit={3} />
      </TooltipShell>
    );
  }

  const { country } = payload;

  return (
    <TooltipShell closeLabel={copy.coverage.closePopup} onClose={onClose} style={style}>
      <div className="coverage-tooltip-heading">
        <CountryFlag country={country} />
        <strong>{country.label}</strong>
      </div>
      <CountStats copy={copy} item={country} />
      <EventLinkList copy={copy} events={country.events} locale={locale} limit={3} />
      <button className="coverage-tooltip-action" type="button" onClick={() => onOpenCountry(country)}>
        {copy.coverage.openCountryMap}
      </button>
    </TooltipShell>
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
      <CountryFlag country={country} />
      <span>{country.label}</span>
      <strong>{country.count}</strong>
    </button>
  );
}

export function CoverageExplorer({ copy, coverage, locale }) {
  const mapRef = useRef(null);
  const shellRef = useRef(null);
  const dragRef = useRef(null);
  const markerGestureRef = useRef({ blockUntil: 0 });
  const pointersRef = useRef(new Map());
  const today = useMemo(() => eventDateKey(coverage.today) || "1970-01-01", [coverage.today]);

  const [selectedCountryKey, setSelectedCountryKey] = useState("");
  const [selectedRegionKey, setSelectedRegionKey] = useState("");
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [activeTypes, setActiveTypes] = useState(tournamentTypes);
  const [datePreset, setDatePreset] = useState("oneMonth");
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(addMonths(today, 1));
  const [showCountryMarkers, setShowCountryMarkers] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [didDrag, setDidDrag] = useState(false);
  const [isFullscreenView, setIsFullscreenView] = useState(false);
  const [revealMapRequest, setRevealMapRequest] = useState(0);

  const activeTypeSet = useMemo(() => new Set(activeTypes), [activeTypes]);
  const dateRange = useMemo(() => rangeForPreset(datePreset, today, customStart, customEnd), [customEnd, customStart, datePreset, today]);
  const rawCountryByKey = useMemo(
    () => new Map((coverage.allCountries || []).map((country) => [country.countryKey, country])),
    [coverage.allCountries],
  );
  const eventMatchesFilters = useCallback(
    (event) => activeTypeSet.has(event.tournamentType || "other") && eventMatchesRange(event, dateRange),
    [activeTypeSet, dateRange],
  );
  const filteredCountries = useMemo(
    () =>
      (coverage.allCountries || [])
        .map((country) => {
          const events = country.events.filter(eventMatchesFilters).sort(sortEvents);
          if (!events.length) return null;

          const regions = (country.regions || [])
            .map((region) => {
              const regionEvents = region.events.filter(eventMatchesFilters).sort(sortEvents);
              if (!regionEvents.length) return null;
              const liveCount = countLive(regionEvents);
              const plottedEvents = regionEvents.filter((event) => event.marker);

              return {
                ...region,
                count: regionEvents.length,
                events: regionEvents,
                liveCount,
                marker: averageMarker(regionEvents),
                plottedCount: plottedEvents.length,
                unmappedCount: regionEvents.length - plottedEvents.length,
                upcomingCount: regionEvents.length - liveCount,
              };
            })
            .filter(Boolean)
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
          const liveCount = countLive(events);

          return {
            ...country,
            count: events.length,
            events,
            liveCount,
            regions,
            unmappedEvents: country.unmappedEvents.filter(eventMatchesFilters),
            upcomingCount: events.length - liveCount,
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [coverage.allCountries, eventMatchesFilters],
  );
  const filteredCountryByKey = useMemo(() => new Map(filteredCountries.map((country) => [country.countryKey, country])), [filteredCountries]);
  const worldEvents = useMemo(
    () =>
      (coverage.worldEvents || [])
        .filter(eventMatchesFilters)
        .map((event) => ({
          ...event,
          country: filteredCountryByKey.get(event.countryKey) || rawCountryByKey.get(event.countryKey),
        }))
        .filter((event) => event.country && event.marker),
    [coverage.worldEvents, eventMatchesFilters, filteredCountryByKey, rawCountryByKey],
  );
  const worldMapItems = useMemo(() => buildWorldMapItems(worldEvents, zoom), [worldEvents, zoom]);
  const allEvents = useMemo(
    () =>
      filteredCountries
        .flatMap((country) => country.events.map((event) => ({ ...event, country })))
        .sort(sortEvents),
    [filteredCountries],
  );
  const filteredTotals = useMemo(() => {
    const totalTournaments = filteredCountries.reduce((sum, country) => sum + country.count, 0);

    return {
      totalCountries: filteredCountries.length,
      totalLive: filteredCountries.reduce((sum, country) => sum + country.liveCount, 0),
      totalTournaments,
      totalUpcoming: filteredCountries.reduce((sum, country) => sum + country.upcomingCount, 0),
    };
  }, [filteredCountries]);
  const filteredUnmappedCountries = useMemo(() => filteredCountries.filter((country) => !country.marker), [filteredCountries]);

  const selectedCountry = filteredCountryByKey.get(selectedCountryKey) || null;
  const selectedRegion = selectedCountry?.regions?.find((region) => region.key === selectedRegionKey) || null;
  const isCountryMode = Boolean(selectedCountry);
  const isRegionMode = Boolean(selectedCountry && selectedRegion);
  const currentMaxZoom = isCountryMode ? mapZoom.countryMax : mapZoom.worldMax;
  const showWorldCountrySelectors = !selectedCountry && showCountryMarkers;
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

  useEffect(() => {
    const updateFullscreenState = () => {
      const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
      setIsFullscreenView(fullscreenElement === shellRef.current);
    };

    document.addEventListener("fullscreenchange", updateFullscreenState);
    document.addEventListener("webkitfullscreenchange", updateFullscreenState);

    return () => {
      document.removeEventListener("fullscreenchange", updateFullscreenState);
      document.removeEventListener("webkitfullscreenchange", updateFullscreenState);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle("coverage-fullscreen-lock", isFullscreenView);

    return () => {
      document.body.classList.remove("coverage-fullscreen-lock");
    };
  }, [isFullscreenView]);

  const clearPinnedDetails = () => {
    setHovered(null);
    setPinned(null);
  };

  const enterFullscreenView = () => {
    clearPinnedDetails();
    const shell = shellRef.current;
    if (!shell) return;

    const requestFullscreen = shell.requestFullscreen || shell.webkitRequestFullscreen;
    setIsFullscreenView(true);

    try {
      const result = requestFullscreen?.call(shell);
      result?.catch?.(() => setIsFullscreenView(true));
    } catch {
      setIsFullscreenView(true);
    }
  };

  const exitFullscreenView = () => {
    clearPinnedDetails();
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;

    if (fullscreenElement === shellRef.current && exitFullscreen) {
      try {
        exitFullscreen.call(document)?.catch?.(() => {});
      } catch {
        // CSS fullscreen fallback is still cleared below.
      }
    }

    setIsFullscreenView(false);
  };

  const toggleFullscreenView = () => {
    if (isFullscreenView) {
      exitFullscreenView();
      return;
    }

    enterFullscreenView();
  };

  const blockMarkerActivation = (timeStamp, duration = 650) => {
    markerGestureRef.current.blockUntil = Math.max(markerGestureRef.current.blockUntil, timeStamp + duration);
  };

  const canActivateMarker = (timeStamp) => !didDrag && timeStamp > markerGestureRef.current.blockUntil;

  const runMarkerAction = (timeStamp, action) => {
    if (!canActivateMarker(timeStamp)) return;
    action();
  };

  const handleMarkerClick = (event, action) => {
    event.stopPropagation();
    runMarkerAction(event.timeStamp, action);
  };

  const handleMarkerPointerDown = (event) => {
    if (event.pointerType === "mouse") {
      event.stopPropagation();
      return;
    }

    if (pointersRef.current.size >= 1) blockMarkerActivation(event.timeStamp);
  };

  const handleMarkerPointerUp = (event, action) => {
    if (event.pointerType === "mouse") {
      event.stopPropagation();
      return;
    }

    runMarkerAction(event.timeStamp, action);
  };

  const toggleType = (type) => {
    clearPinnedDetails();
    setActiveTypes((currentTypes) => {
      const isActive = currentTypes.includes(type);
      return tournamentTypes.filter((item) => (item === type ? !isActive : currentTypes.includes(item)));
    });
  };

  const selectDatePreset = (preset) => {
    setDatePreset(preset);
    clearPinnedDetails();
  };

  const clientToSvgPoint = (point) => {
    if (!mapRef.current) return null;
    const bounds = mapRef.current.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return null;

    return {
      x: ((point.x - bounds.left) * coverage.mapSize.width) / bounds.width,
      y: ((point.y - bounds.top) * coverage.mapSize.height) / bounds.height,
    };
  };

  const clientDeltaToSvg = (deltaX, deltaY) => {
    if (!mapRef.current) return { x: 0, y: 0 };
    const bounds = mapRef.current.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return { x: 0, y: 0 };

    return {
      x: (deltaX * coverage.mapSize.width) / bounds.width,
      y: (deltaY * coverage.mapSize.height) / bounds.height,
    };
  };

  const applyZoomAtSvgPoint = (point, nextZoom, baseZoom = zoom, baseOffset = offset, panDelta = { x: 0, y: 0 }) => {
    const cleanZoom = clamp(nextZoom, mapZoom.min, currentMaxZoom);
    const ratio = cleanZoom / baseZoom;
    const nextOffset = {
      x: point.x - (point.x - baseOffset.x) * ratio + panDelta.x,
      y: point.y - (point.y - baseOffset.y) * ratio + panDelta.y,
    };

    setZoom(cleanZoom);
    setOffset(clampOffset(nextOffset, cleanZoom, coverage.mapSize));
  };

  const applyZoomAtClientPoint = (point, nextZoom) => {
    const svgPoint = clientToSvgPoint(point);
    if (!svgPoint) {
      applyZoomAtSvgPoint(
        {
          x: coverage.mapSize.width / 2,
          y: coverage.mapSize.height / 2,
        },
        nextZoom,
      );
      return;
    }

    applyZoomAtSvgPoint(svgPoint, nextZoom);
  };

  const applyZoom = (nextZoom) => {
    const center = {
      x: coverage.mapSize.width / 2,
      y: coverage.mapSize.height / 2,
    };

    applyZoomAtSvgPoint(center, nextZoom);
  };

  const focusPoint = (point, targetZoom = 2.65) => {
    const cleanZoom = clamp(targetZoom, mapZoom.min, currentMaxZoom);
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

  const beginPanGesture = (point, currentOffset = offset) => {
    dragRef.current = {
      mode: "pan",
      offset: currentOffset,
      startX: point.x,
      startY: point.y,
    };
  };

  const beginPinchGesture = (points) => {
    const [first, second] = points;
    const startCenter = midpointBetween(first, second);
    const startSvgCenter = clientToSvgPoint(startCenter);
    if (!startSvgCenter) return;

    dragRef.current = {
      mode: "pinch",
      startCenter,
      startDistance: Math.max(distanceBetween(first, second), 1),
      startOffset: offset,
      startSvgCenter,
      startZoom: zoom,
    };
  };

  const startDrag = (event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;

    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is best effort; the map still handles regular pointer events.
    }

    const wasIdle = pointersRef.current.size === 0;
    pointersRef.current.set(event.pointerId, pointerPosition(event));
    const points = Array.from(pointersRef.current.values());

    if (wasIdle) setDidDrag(false);
    if (points.length >= 2) {
      blockMarkerActivation(event.timeStamp);
      setDidDrag(true);
      beginPinchGesture(points);
    } else {
      beginPanGesture(points[0]);
    }

    setIsDragging(true);
  };

  const moveDrag = (event) => {
    if (!dragRef.current || !mapRef.current || !pointersRef.current.has(event.pointerId)) return;

    event.preventDefault();
    pointersRef.current.set(event.pointerId, pointerPosition(event));
    const points = Array.from(pointersRef.current.values());

    if (points.length >= 2) {
      if (dragRef.current.mode !== "pinch") {
        blockMarkerActivation(event.timeStamp);
        setDidDrag(true);
        beginPinchGesture(points);
        return;
      }

      const [first, second] = points;
      const currentCenter = midpointBetween(first, second);
      const currentDistance = Math.max(distanceBetween(first, second), 1);
      const zoomRatio = currentDistance / dragRef.current.startDistance;
      const nextZoom = dragRef.current.startZoom * zoomRatio;
      const centerDelta = clientDeltaToSvg(currentCenter.x - dragRef.current.startCenter.x, currentCenter.y - dragRef.current.startCenter.y);

      if (Math.abs(currentDistance - dragRef.current.startDistance) > 2 || Math.abs(centerDelta.x) + Math.abs(centerDelta.y) > 2) {
        blockMarkerActivation(event.timeStamp);
        setDidDrag(true);
      }
      applyZoomAtSvgPoint(dragRef.current.startSvgCenter, nextZoom, dragRef.current.startZoom, dragRef.current.startOffset, centerDelta);
      return;
    }

    if (dragRef.current.mode !== "pan") {
      beginPanGesture(points[0]);
      return;
    }

    const delta = clientDeltaToSvg(event.clientX - dragRef.current.startX, event.clientY - dragRef.current.startY);

    if (Math.abs(delta.x) + Math.abs(delta.y) > 3) {
      blockMarkerActivation(event.timeStamp);
      setDidDrag(true);
    }
    setOffset(
      clampOffset(
        {
          x: dragRef.current.offset.x + delta.x,
          y: dragRef.current.offset.y + delta.y,
        },
        zoom,
        coverage.mapSize,
      ),
    );
  };

  const stopDrag = (event) => {
    if (event?.pointerId !== undefined) {
      pointersRef.current.delete(event.pointerId);
      try {
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch {
        // Some synthetic/browser paths do not allow releasing capture here.
      }
    } else {
      pointersRef.current.clear();
    }

    const remainingPoints = Array.from(pointersRef.current.values());
    if (remainingPoints.length >= 2) {
      blockMarkerActivation(event.timeStamp);
      setDidDrag(true);
      beginPinchGesture(remainingPoints);
      setIsDragging(true);
      return;
    }
    if (remainingPoints.length === 1) {
      beginPanGesture(remainingPoints[0]);
      setIsDragging(true);
      return;
    }

    dragRef.current = null;
    setIsDragging(false);
  };

  const leaveDrag = (event) => {
    if (event.pointerType === "mouse" && event.buttons === 0) stopDrag(event);
  };

  const zoomFromPointer = (event) => {
    event.preventDefault();
    applyZoomAtClientPoint(pointerPosition(event), zoom + (event.shiftKey ? -mapZoom.doubleStep : mapZoom.doubleStep));
  };

  const handleMapKeyDown = (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey || isFormControlTarget(event.target)) return;

    const panStep = event.shiftKey ? 92 : 44;
    const panKeys = {
      ArrowDown: { x: 0, y: -panStep },
      ArrowLeft: { x: panStep, y: 0 },
      ArrowRight: { x: -panStep, y: 0 },
      ArrowUp: { x: 0, y: panStep },
    };
    const panDelta = panKeys[event.key];

    if (panDelta) {
      event.preventDefault();
      setOffset((currentOffset) =>
        clampOffset(
          {
            x: currentOffset.x + panDelta.x,
            y: currentOffset.y + panDelta.y,
          },
          zoom,
          coverage.mapSize,
        ),
      );
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      applyZoom(zoom + mapZoom.step);
      return;
    }

    if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      applyZoom(zoom - mapZoom.step);
      return;
    }

    if (event.key === "0" || event.key === "Home" || event.key.toLowerCase() === "r") {
      event.preventDefault();
      resetViewport();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (activePayload) {
        clearPinnedDetails();
        return;
      }

      if (isFullscreenView) exitFullscreenView();
    }
  };

  const clearFloatingDetails = () => {
    if (didDrag) return;
    setHovered(null);
    setPinned(null);
  };

  const renderWorldEventDots = () =>
    worldMapItems.map((item) => {
      if (item.kind === "cluster") {
        const title = `${item.count} ${copy.coverage.tournaments}`;
        const payload = {
          cluster: item,
          kind: "eventCluster",
          point: item.marker,
        };

        return (
          <g
            aria-label={`${title}: ${item.countryLabels.slice(0, 4).join(", ")}`}
            className="coverage-interactive-marker coverage-world-event-cluster"
            key={item.key}
            onBlur={() => setHovered(null)}
            onClick={(event) => handleMarkerClick(event, () => setPinned(payload))}
            onFocus={() => setHovered(payload)}
            onKeyDown={(keyEvent) => onMarkerKeyDown(keyEvent, () => setPinned(payload))}
            onMouseEnter={() => setHovered(payload)}
            onMouseLeave={() => setHovered(null)}
            onPointerDown={handleMarkerPointerDown}
            onPointerUp={(event) => handleMarkerPointerUp(event, () => setPinned(payload))}
            role="button"
            tabIndex={0}
            transform={`translate(${item.marker.x} ${item.marker.y})`}
          >
            <title>{title}</title>
            <circle className="coverage-world-cluster-target" r={item.marker.radius} />
            <circle className="coverage-world-cluster-halo" r={Number((item.marker.radius + 1.45).toFixed(2))} />
            <circle className="coverage-world-cluster-core" r={item.marker.radius} />
            <circle className="coverage-world-cluster-dot" r={Number(Math.max(0.38, item.marker.radius * 0.32).toFixed(2))} />
          </g>
        );
      }

      const { event } = item;
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
          key={item.key}
          onBlur={() => setHovered(null)}
          onClick={(pointerEvent) => handleMarkerClick(pointerEvent, () => setPinned(payload))}
          onFocus={() => setHovered(payload)}
          onKeyDown={(keyEvent) => onMarkerKeyDown(keyEvent, () => setPinned(payload))}
          onMouseEnter={() => setHovered(payload)}
          onMouseLeave={() => setHovered(null)}
          onPointerDown={handleMarkerPointerDown}
          onPointerUp={(pointerEvent) => handleMarkerPointerUp(pointerEvent, () => setPinned(payload))}
          role="button"
          tabIndex={0}
          transform={`translate(${event.marker.x} ${event.marker.y})`}
        >
          <title>{event.title}</title>
          <circle className="coverage-world-dot-target" r={item.targetRadius} />
          <circle className="coverage-world-dot-ring" r={item.ringRadius} />
          <circle className="coverage-world-dot-core" r={item.radius} />
        </g>
      );
    });

  const renderWorldCountrySelectors = () =>
    filteredCountries
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
            onClick={(event) => handleMarkerClick(event, () => setPinned(payload))}
            onFocus={() => setHovered(payload)}
            onKeyDown={(event) => onMarkerKeyDown(event, () => setPinned(payload))}
            onMouseEnter={() => setHovered(payload)}
            onMouseLeave={() => setHovered(null)}
            onPointerDown={handleMarkerPointerDown}
            onPointerUp={(event) => handleMarkerPointerUp(event, () => setPinned(payload))}
            role="button"
            tabIndex={0}
            transform={`translate(${country.marker.x} ${country.marker.y})`}
          >
            <title>{`${country.label}: ${country.count} ${copy.coverage.tournaments}`}</title>
            <circle className="coverage-marker-target" r={visualRadius} />
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
              if (didDrag || event.timeStamp <= markerGestureRef.current.blockUntil) return;
              selectRegion(selectedCountry, region);
            }}
            onFocus={() => setHovered(payload)}
            onKeyDown={(event) => onMarkerKeyDown(event, () => selectRegion(selectedCountry, region))}
            onMouseEnter={() => setHovered(payload)}
            onMouseLeave={() => setHovered(null)}
            onPointerDown={handleMarkerPointerDown}
            onPointerUp={(event) => {
              if (event.pointerType === "mouse") {
                event.stopPropagation();
                return;
              }

              if (didDrag || event.timeStamp <= markerGestureRef.current.blockUntil) return;
              selectRegion(selectedCountry, region);
            }}
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
            onClick={(pointerEvent) => handleMarkerClick(pointerEvent, () => setPinned(payload))}
            onFocus={() => setHovered(payload)}
            onKeyDown={(keyEvent) => onMarkerKeyDown(keyEvent, () => setPinned(payload))}
            onMouseEnter={() => setHovered(payload)}
            onMouseLeave={() => setHovered(null)}
            onPointerDown={handleMarkerPointerDown}
            onPointerUp={(pointerEvent) => handleMarkerPointerUp(pointerEvent, () => setPinned(payload))}
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
        <div className="coverage-visible-summary" aria-label={copy.coverage.visibleResults}>
          <span className="coverage-filter-label">{copy.coverage.visibleResults}</span>
          <div className="coverage-filter-stats">
            <span>
              <strong>{filteredTotals.totalCountries}</strong>
              {copy.coverage.activeCountries}
            </span>
            <span>
              <strong>{filteredTotals.totalTournaments}</strong>
              {copy.coverage.tournaments}
            </span>
            <span>
              <strong>{filteredTotals.totalLive}</strong>
              {copy.coverage.liveNow}
            </span>
            <span>
              <strong>{filteredTotals.totalUpcoming}</strong>
              {copy.coverage.upcoming}
            </span>
          </div>
        </div>
      </div>

      <section className="coverage-filter-bar" aria-label={copy.coverage.filters}>
        <div className="coverage-filter-group">
          <span className="coverage-filter-label">{copy.coverage.dateRange}</span>
          <div className="coverage-date-presets">
            {datePresets.map((preset) => (
              <button
                aria-pressed={datePreset === preset}
                className={`coverage-filter-pill${datePreset === preset ? " is-active" : ""}`}
                key={preset}
                type="button"
                onClick={() => selectDatePreset(preset)}
              >
                {copy.coverage.datePresets[preset]}
              </button>
            ))}
          </div>
        </div>

        {datePreset === "custom" ? (
          <div className="coverage-custom-dates">
            <label>
              <span>{copy.coverage.customStart}</span>
              <input
                type="date"
                value={customStart}
                onChange={(event) => {
                  setCustomStart(event.target.value);
                  clearPinnedDetails();
                }}
              />
            </label>
            <label>
              <span>{copy.coverage.customEnd}</span>
              <input
                type="date"
                value={customEnd}
                onChange={(event) => {
                  setCustomEnd(event.target.value);
                  clearPinnedDetails();
                }}
              />
            </label>
          </div>
        ) : null}

        <div className="coverage-filter-group">
          <span className="coverage-filter-label">{copy.coverage.tournamentTypes}</span>
          <div className="coverage-type-legend" aria-label={copy.coverage.tournamentTypes}>
            {tournamentTypes.map((type) => (
              <TypeFilterButton active={activeTypes.includes(type)} copy={copy} key={type} onToggle={toggleType} type={type} />
            ))}
          </div>
        </div>

        <label className="coverage-marker-toggle">
          <input type="checkbox" checked={showCountryMarkers} onChange={(event) => setShowCountryMarkers(event.target.checked)} />
          <span>{copy.coverage.showCountryMarkers}</span>
        </label>
      </section>

      <div className={`coverage-map-shell${isFullscreenView ? " is-fullscreen" : ""}`} ref={shellRef}>
        <div className="coverage-map-toolbar" aria-label={copy.coverage.mapLabel}>
          {selectedCountry ? (
            <button className="icon-button" type="button" onClick={backToWorld} aria-label={copy.coverage.backToWorld} title={copy.coverage.backToWorld}>
              <ArrowLeft size={18} aria-hidden="true" />
            </button>
          ) : null}
          <button className="icon-button" type="button" onClick={() => applyZoom(zoom + mapZoom.step)} aria-label={copy.coverage.zoomIn} title={copy.coverage.zoomIn}>
            <Plus size={18} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={() => applyZoom(zoom - mapZoom.step)} aria-label={copy.coverage.zoomOut} title={copy.coverage.zoomOut}>
            <Minus size={18} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={resetViewport} aria-label={copy.coverage.resetMap} title={copy.coverage.resetMap}>
            <RotateCcw size={18} aria-hidden="true" />
          </button>
          <button
            aria-label={isFullscreenView ? copy.coverage.exitFullscreen : copy.coverage.enterFullscreen}
            aria-pressed={isFullscreenView}
            className="icon-button"
            onClick={toggleFullscreenView}
            title={isFullscreenView ? copy.coverage.exitFullscreen : copy.coverage.enterFullscreen}
            type="button"
          >
            {isFullscreenView ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}
          </button>
        </div>

        <div
          aria-describedby="coverage-map-keyboard-help"
          aria-label={copy.coverage.mapLabel}
          className={`coverage-map-stage${isDragging ? " is-dragging" : ""}${isCountryMode ? " is-country-mode" : ""}${activePayload ? " has-tooltip" : ""}`}
          onKeyDown={handleMapKeyDown}
          role="region"
          tabIndex={0}
        >
          <p className="sr-only" id="coverage-map-keyboard-help">
            {copy.coverage.keyboardHelp}
          </p>
          <svg
            ref={mapRef}
            className="coverage-map"
            viewBox={`0 0 ${coverage.mapSize.width} ${coverage.mapSize.height}`}
            role="img"
            aria-label={copy.coverage.mapLabel}
            onClick={clearFloatingDetails}
            onDoubleClick={zoomFromPointer}
            onLostPointerCapture={stopDrag}
            onPointerCancel={stopDrag}
            onPointerDown={startDrag}
            onPointerLeave={leaveDrag}
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
              {!selectedCountry && !showWorldCountrySelectors ? renderWorldEventDots() : null}
              {showWorldCountrySelectors ? renderWorldCountrySelectors() : null}
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
          <div className="coverage-zoom-badge" aria-live="polite">
            {copy.coverage.zoomLevel.replace("{zoom}", zoom.toFixed(2))}
          </div>
          <CoverageTooltip copy={copy} locale={locale} onClose={clearPinnedDetails} onOpenCountry={selectCountry} payload={activePayload} style={tooltipStyle} />
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
          <strong>{filteredTotals.totalCountries}</strong>
        </div>
        <div className="coverage-country-buttons">
          {filteredCountries.map((country) => (
            <CountryButton country={country} isSelected={selectedCountry?.countryKey === country.countryKey} key={country.countryKey} onSelect={selectCountry} />
          ))}
        </div>
      </aside>

      {filteredUnmappedCountries.length ? (
        <aside className="coverage-unmapped">
          <div>
            <p className="eyebrow">{copy.coverage.unmappedTitle}</p>
            <p>{copy.coverage.unmappedBody}</p>
          </div>
          <div className="coverage-unmapped-list">
            {filteredUnmappedCountries.map((country) => (
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
