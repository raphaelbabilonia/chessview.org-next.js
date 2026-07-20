"use client";

import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe2,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CountryFlag } from "@/components/CountryFlag";
import { getCoverageMapCapability } from "@/lib/coverageMapCapability";
import { densityScalesForPoints } from "@/lib/coverageMarkerSizing";
import { zoomControlStep } from "@/lib/coverageGlobeGesture";
import { formatDateRange } from "@/lib/format";
import { trackAnalyticsEvent } from "@/lib/tracking";

const CoverageThreeGlobe = dynamic(() => import("@/components/CoverageThreeGlobe").then((mod) => mod.CoverageThreeGlobe), {
  loading: () => <div className="coverage-globe-loading" aria-hidden="true" />,
  ssr: false,
});

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const tournamentTypes = ["classical", "rapid", "blitz", "other"];
const datePresets = ["oneMonth", "threeMonths", "year", "nextYear", "custom"];
const mapZoom = { max: 24, min: 1, step: 0.65 };

const normalizeSearch = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

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
  return { end: `${year}-12-31`, start: `${year}-01-01` };
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
  return Boolean(start && end && end >= range.start && start <= range.end);
};

const eventSearchText = (event) =>
  normalizeSearch(
    [event.title, event.city, event.region, event.country, event.countryLabel, event.sourceName, event.timeControl]
      .filter(Boolean)
      .join(" "),
  );

const sortEvents = (a, b) =>
  Number(b.liveNow) - Number(a.liveNow) ||
  String(a.startDate || "").localeCompare(String(b.startDate || "")) ||
  String(a.title || "").localeCompare(String(b.title || ""));

const countLive = (events) => events.filter((event) => event.liveNow).length;

const worldClusterScreenDistance = (zoom) => {
  if (zoom >= 16) return 3.8;
  if (zoom >= 8) return 4.4;
  if (zoom >= 4) return 5;
  if (zoom >= 2) return 5.8;
  return 6.6;
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
    .map((event, index) => ({ event, index, point: event.anchor || event.marker || null }))
    .filter((candidate) => candidate.point)
    .sort((a, b) => a.point.y - b.point.y || a.point.x - b.point.x || String(a.event.startDate).localeCompare(String(b.event.startDate)));
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
      const distance = Math.hypot(
        (candidate.point.x - other.point.x) * normalizedZoom,
        (candidate.point.y - other.point.y) * normalizedZoom,
      );
      if (distance <= screenDistance) {
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
        key: `event-cluster-${groupedEvents.length}-${Math.round(point.x)}-${Math.round(point.y)}-${groupedEvents[0]._id}`,
        kind: "cluster",
        liveCount,
        point,
        upcomingCount: groupedEvents.length - liveCount,
      });
    } else {
      items.push({ event: groupedEvents[0], key: `event-${groupedEvents[0]._id}-${candidate.index}`, kind: "event" });
    }
  }

  const scales = densityScalesForPoints(
    items.map((item) => (item.kind === "cluster" ? item.point : item.event.marker)),
    normalizedZoom,
  );
  return items.map((item, index) => ({ ...item, densityScale: scales[index] }));
};

const coordinateExtent = (coordinates = []) => {
  const clean = coordinates.filter(
    (value) => Array.isArray(value) && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1])),
  );
  if (clean.length < 2) return 0;
  const latitudes = clean.map((value) => Number(value[1]));
  const longitudes = clean.map((value) => ((Number(value[0]) % 360) + 360) % 360).sort((a, b) => a - b);
  let largestGap = 0;
  for (let index = 0; index < longitudes.length; index += 1) {
    const current = longitudes[index];
    const next = index === longitudes.length - 1 ? longitudes[0] + 360 : longitudes[index + 1];
    largestGap = Math.max(largestGap, next - current);
  }
  const longitudeSpan = 360 - largestGap;
  return Math.max(Math.max(...latitudes) - Math.min(...latitudes), longitudeSpan);
};

const focusZoomFor = (view, coordinates) => {
  if (view === "world") return 1;
  const extent = coordinateExtent(coordinates);
  const defaults = view === "region" ? 10 : 6;
  if (!extent) return defaults;
  const [minimum, maximum] = view === "region" ? [6, 16] : [3, 10];
  return Number(clamp(82 / Math.max(extent, 5), minimum, maximum).toFixed(2));
};

const isFormControlTarget = (target) => ["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"].includes(target?.tagName);

function TypeBadge({ copy, type }) {
  const labels = copy.coverage.types || {};
  return <span className={`coverage-type-badge is-${type || "other"}`}>{labels[type] || labels.other || type}</span>;
}

function CountStats({ copy, item }) {
  if (!item) return null;
  return (
    <div className="coverage-country-stats">
      <span><strong>{item.count}</strong>{copy.coverage.tournaments}</span>
      <span><strong>{item.liveCount}</strong>{copy.coverage.liveNow}</span>
      <span><strong>{item.upcomingCount}</strong>{copy.coverage.upcoming}</span>
    </div>
  );
}

function EventLinkList({ copy, events = [], locale, limit }) {
  const visibleEvents = limit ? events.slice(0, limit) : events;
  if (!visibleEvents.length) return <p className="muted">{copy.coverage.noResults}</p>;

  return (
    <div className="coverage-event-list">
      {visibleEvents.map((event) => (
        <Link
          className="coverage-event-link"
          data-tracking-entity-id={event._id}
          data-tracking-entity-slug={event.slug}
          data-tracking-entity-title={event.title}
          data-tracking-entity-type="event"
          data-tracking-event="coverage_event_open"
          data-tracking-placement="maps_marker_overlay"
          href={event.href}
          key={event._id}
        >
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

function MarkerCardShell({ children, copy, kind, onClose, variant }) {
  return (
    <section
      aria-label={copy.coverage.currentSelection}
      className={`maps-marker-card${variant === "overlay" ? " is-map-overlay" : ""}`}
      data-maps-marker-kind={kind}
    >
      {onClose ? (
        <button
          aria-label={copy.coverage.closePopup}
          className="maps-marker-card-close"
          title={copy.coverage.closePopup}
          type="button"
          onClick={onClose}
        >
          <X aria-hidden="true" size={17} />
        </button>
      ) : null}
      {children}
    </section>
  );
}

function MarkerDetails({ copy, locale, onClose, onOpenCountry, payload, variant = "panel" }) {
  if (!payload) return null;
  if (payload.kind === "event") {
    return (
      <MarkerCardShell copy={copy} kind="event" onClose={onClose} variant={variant}>
        <p className="eyebrow">{copy.coverage.selectedTournament}</p>
        <div className="maps-context-title">
          <CountryFlag country={payload.country} />
          <h3>{payload.event.title}</h3>
        </div>
        <TypeBadge copy={copy} type={payload.event.tournamentType} />
        <p>{[payload.event.city, payload.event.region, formatDateRange(payload.event.startDate, payload.event.endDate, locale)].filter(Boolean).join(" / ")}</p>
        <Link className="button button-small" href={payload.event.href}>
          {copy.coverage.openEvent}<ExternalLink size={14} aria-hidden="true" />
        </Link>
      </MarkerCardShell>
    );
  }

  if (payload.kind === "eventCluster") {
    return (
      <MarkerCardShell copy={copy} kind="event-cluster" onClose={onClose} variant={variant}>
        <p className="eyebrow">{copy.coverage.selectedCluster}</p>
        <h3>{payload.cluster.count} {copy.coverage.tournaments}</h3>
        <EventLinkList copy={copy} events={payload.cluster.events} locale={locale} limit={4} />
      </MarkerCardShell>
    );
  }

  if (payload.kind === "country") {
    return (
      <MarkerCardShell copy={copy} kind="country" onClose={onClose} variant={variant}>
        <div className="maps-context-title"><CountryFlag country={payload.country} /><h3>{payload.country.label}</h3></div>
        <CountStats copy={copy} item={payload.country} />
        <button className="button button-small" type="button" onClick={() => onOpenCountry(payload.country)}>{copy.coverage.focusCountry}</button>
      </MarkerCardShell>
    );
  }

  return null;
}

export function MapsExplorer({ copy, coverage, locale }) {
  const shellRef = useRef(null);
  const mapStageRef = useRef(null);
  const markerOverlayRef = useRef(null);
  const filterTrackingReadyRef = useRef(false);
  const today = useMemo(() => eventDateKey(coverage.today) || "1970-01-01", [coverage.today]);
  const [selectedCountryKey, setSelectedCountryKey] = useState("");
  const [pinned, setPinned] = useState(null);
  const [activeTypes, setActiveTypes] = useState(tournamentTypes);
  const [datePreset, setDatePreset] = useState("oneMonth");
  const [customStart, setCustomStart] = useState(today);
  const [customEnd, setCustomEnd] = useState(addMonths(today, 1));
  const [searchQuery, setSearchQuery] = useState("");
  const [groupByCountry, setGroupByCountry] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [isFullscreenView, setIsFullscreenView] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const [keyboardCommand, setKeyboardCommand] = useState(null);
  const [globeAutoRotate, setGlobeAutoRotate] = useState(true);
  const [globeQuality, setGlobeQuality] = useState("full");
  const [globeStatus, setGlobeStatus] = useState("checking");
  const [globeErrorReason, setGlobeErrorReason] = useState("");
  const [globeInstance, setGlobeInstance] = useState(0);

  const normalizedQuery = useMemo(() => normalizeSearch(searchQuery), [searchQuery]);
  const activeTypeSet = useMemo(() => new Set(activeTypes), [activeTypes]);
  const dateRange = useMemo(() => rangeForPreset(datePreset, today, customStart, customEnd), [customEnd, customStart, datePreset, today]);
  const eventMatchesFilters = useCallback(
    (event) =>
      activeTypeSet.has(event.tournamentType || "other") &&
      eventMatchesRange(event, dateRange) &&
      (!normalizedQuery || eventSearchText(event).includes(normalizedQuery)),
    [activeTypeSet, dateRange, normalizedQuery],
  );

  const filteredCountries = useMemo(
    () =>
      (coverage.allCountries || [])
        .map((country) => {
          const events = country.events.filter(eventMatchesFilters).sort(sortEvents);
          if (!events.length) return null;
          const liveCount = countLive(events);
          return { ...country, count: events.length, events, liveCount, upcomingCount: events.length - liveCount };
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [coverage.allCountries, eventMatchesFilters],
  );

  const filteredCountryByKey = useMemo(() => new Map(filteredCountries.map((country) => [country.countryKey, country])), [filteredCountries]);
  const selectedCountry = filteredCountryByKey.get(selectedCountryKey) || null;
  const filteredWorldEvents = useMemo(
    () =>
      (coverage.worldEvents || [])
        .filter(eventMatchesFilters)
        .map((event) => ({ ...event, country: filteredCountryByKey.get(event.countryKey) }))
        .filter((event) => event.country && event.globeCoordinates),
    [coverage.worldEvents, eventMatchesFilters, filteredCountryByKey],
  );
  const scopedWorldEvents = useMemo(() => {
    if (!selectedCountry) return filteredWorldEvents;
    return filteredWorldEvents.filter((event) => event.countryKey === selectedCountry.countryKey);
  }, [filteredWorldEvents, selectedCountry]);
  const worldMapItems = useMemo(() => buildWorldMapItems(scopedWorldEvents, zoom), [scopedWorldEvents, zoom]);
  const filteredTotals = useMemo(() => {
    const totalTournaments = filteredCountries.reduce((sum, country) => sum + country.count, 0);
    const totalLive = filteredCountries.reduce((sum, country) => sum + country.liveCount, 0);
    return {
      totalCountries: filteredCountries.length,
      totalLive,
      totalTournaments,
      totalUpcoming: totalTournaments - totalLive,
    };
  }, [filteredCountries]);

  const view = selectedCountry ? "country" : "world";
  const focusCoordinates = useMemo(() => {
    if (selectedCountry) {
      const coordinates = scopedWorldEvents.map((event) => event.globeCoordinates).filter(Boolean);
      return coordinates.length ? coordinates : [selectedCountry.globeCoordinates].filter(Boolean);
    }
    return [];
  }, [scopedWorldEvents, selectedCountry]);
  const mapViewLabel = selectedCountry
    ? `${copy.coverage.countryView}: ${selectedCountry.label}`
    : copy.coverage.worldView;
  const focusTarget = useMemo(
    () => ({
      coordinates: selectedCountry?.globeCoordinates || null,
      countryNames: selectedCountry
        ? [selectedCountry.country, selectedCountry.mapFeatureName, selectedCountry.label].filter(Boolean)
        : [],
      request: focusRequest,
      view,
    }),
    [focusRequest, selectedCountry, view],
  );
  const activeFilterCount = Number(datePreset !== "oneMonth") + Number(activeTypes.length !== tournamentTypes.length) + Number(Boolean(normalizedQuery)) + Number(groupByCountry);

  const checkGlobeCapability = useCallback(() => {
    const capability = getCoverageMapCapability();
    if (!capability.canUse3d) {
      setGlobeErrorReason(capability.reason || "webgl-missing");
      setGlobeStatus("error");
      return;
    }
    setGlobeErrorReason("");
    setGlobeQuality(capability.reducedQuality ? "reduced" : "full");
    setGlobeStatus("loading");
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(checkGlobeCapability);
    return () => window.cancelAnimationFrame(frame);
  }, [checkGlobeCapability]);

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
    return () => document.body.classList.remove("coverage-fullscreen-lock");
  }, [isFullscreenView]);

  const showInMapMarkerDetails = Boolean(pinned);

  useEffect(() => {
    if (!showInMapMarkerDetails) return undefined;
    const frame = window.requestAnimationFrame(() => markerOverlayRef.current?.focus({ preventScroll: true }));
    return () => window.cancelAnimationFrame(frame);
  }, [pinned, showInMapMarkerDetails]);

  const trackCoverageInteraction = (eventName, metadata = {}) => {
    trackAnalyticsEvent(eventName, { routeType: "coverage", metadata: { surface: "maps", ...metadata } });
  };

  useEffect(() => {
    if (!filterTrackingReadyRef.current) {
      filterTrackingReadyRef.current = true;
      return undefined;
    }
    const timeout = window.setTimeout(() => {
      trackAnalyticsEvent("coverage_filter_change", {
        routeType: "coverage",
        filters: {
          datePreset,
          groupByCountry,
          hasSearch: Boolean(normalizedQuery),
          typeCount: activeTypes.length,
        },
        metadata: { surface: "maps" },
      });
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [activeTypes, datePreset, groupByCountry, normalizedQuery]);

  const clearMarkerDetails = () => {
    setPinned(null);
  };

  const dismissInMapMarkerDetails = () => {
    clearMarkerDetails();
    window.requestAnimationFrame(() => mapStageRef.current?.focus({ preventScroll: true }));
  };

  const focusView = (nextView, coordinates) => {
    setGlobeAutoRotate(false);
    setZoom(focusZoomFor(nextView, coordinates));
    setFocusRequest((value) => value + 1);
  };

  const selectCountry = (country) => {
    setSelectedCountryKey(country.countryKey);
    clearMarkerDetails();
    const coordinates = (coverage.worldEvents || [])
      .filter((event) => event.countryKey === country.countryKey && eventMatchesFilters(event))
      .map((event) => event.globeCoordinates)
      .filter(Boolean);
    focusView("country", coordinates.length ? coordinates : [country.globeCoordinates].filter(Boolean));
    trackAnalyticsEvent("coverage_country_select", {
      entityId: country.countryKey,
      entityTitle: country.label,
      entityType: "country",
      routeType: "coverage",
      metadata: { placement: "maps_marker_overlay" },
    });
  };

  const backOneLevel = () => {
    clearMarkerDetails();
    setSelectedCountryKey("");
    setZoom(1);
    setGlobeAutoRotate(false);
    setFocusRequest((value) => value + 1);
  };

  const resetFilters = () => {
    setActiveTypes(tournamentTypes);
    setDatePreset("oneMonth");
    setCustomStart(today);
    setCustomEnd(addMonths(today, 1));
    setSearchQuery("");
    setGroupByCountry(false);
    clearMarkerDetails();
  };

  const toggleType = (type) => {
    setActiveTypes((current) => tournamentTypes.filter((entry) => (entry === type ? !current.includes(entry) : current.includes(entry))));
    clearMarkerDetails();
  };

  const applyZoom = (nextZoom) => {
    const cleanZoom = clamp(nextZoom, mapZoom.min, mapZoom.max);
    setZoom(cleanZoom);
    setGlobeAutoRotate(false);
    trackCoverageInteraction("coverage_map_zoom", { direction: cleanZoom > zoom ? "in" : "out", view });
  };

  const resetViewport = () => {
    setZoom(focusZoomFor(view, focusCoordinates));
    setFocusRequest((value) => value + 1);
    setGlobeAutoRotate(false);
    clearMarkerDetails();
    trackCoverageInteraction("coverage_map_reset", { view });
  };

  const handleMapKeyDown = (event) => {
    if (isFormControlTarget(event.target)) return;
    if (event.key === "+" || event.key === "=") applyZoom(zoom + zoomControlStep(zoom, mapZoom.step));
    else if (event.key === "-") applyZoom(zoom - zoomControlStep(zoom, mapZoom.step));
    else if (event.key === "0") resetViewport();
    else if (event.key === "Escape") clearMarkerDetails();
    else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
      setGlobeAutoRotate(false);
      setKeyboardCommand({
        id: Date.now(),
        pitch: event.key === "ArrowUp" ? -0.16 : event.key === "ArrowDown" ? 0.16 : 0,
        yaw: event.key === "ArrowLeft" ? -0.18 : event.key === "ArrowRight" ? 0.18 : 0,
      });
    } else return;
    event.preventDefault();
  };

  const toggleFullscreen = () => {
    const shell = shellRef.current;
    if (!shell) return;
    if (isFullscreenView) {
      const exitFullscreen = document.exitFullscreen || document.webkitExitFullscreen;
      try { exitFullscreen?.call(document)?.catch?.(() => {}); } catch { /* CSS fallback below. */ }
      setIsFullscreenView(false);
    } else {
      const requestFullscreen = shell.requestFullscreen || shell.webkitRequestFullscreen;
      setIsFullscreenView(true);
      try { requestFullscreen?.call(shell)?.catch?.(() => setIsFullscreenView(true)); } catch { setIsFullscreenView(true); }
    }
    trackCoverageInteraction("coverage_fullscreen_toggle", { mode: isFullscreenView ? "exit" : "enter" });
  };

  const handleGlobeUnavailable = (reason) => {
    setGlobeErrorReason(reason || "init-error");
    setGlobeStatus("error");
    setGlobeAutoRotate(false);
    trackCoverageInteraction("coverage_map_3d_error", { reason: reason || "init-error" });
  };

  const handlePerformanceIssue = (reason) => {
    if (globeQuality === "reduced") return;
    setGlobeQuality("reduced");
    setGlobeStatus("degraded");
    setGlobeAutoRotate(false);
    trackCoverageInteraction("coverage_map_quality_reduce", { reason: reason || "low-fps" });
  };

  const retryGlobe = () => {
    setGlobeInstance((value) => value + 1);
    setGlobeStatus("checking");
    setGlobeErrorReason("");
    checkGlobeCapability();
    trackCoverageInteraction("coverage_map_3d_retry", { reason: globeErrorReason || "manual" });
  };

  return (
    <section className="coverage-explorer maps-explorer" aria-label={copy.coverage.mapLabel}>
      <div className="maps-service-bar">
        <label className="maps-search">
          <Search size={18} aria-hidden="true" />
          <span className="sr-only">{copy.coverage.searchLabel}</span>
          <input value={searchQuery} type="search" placeholder={copy.coverage.searchPlaceholder} onChange={(event) => setSearchQuery(event.target.value)} />
        </label>
        <div className="coverage-filter-stats" aria-label={copy.coverage.visibleResults}>
          <span><strong>{filteredTotals.totalCountries}</strong>{copy.coverage.activeCountries}</span>
          <span><strong>{filteredTotals.totalTournaments}</strong>{copy.coverage.tournaments}</span>
          <span><strong>{filteredTotals.totalLive}</strong>{copy.coverage.liveNow}</span>
          <span><strong>{filteredTotals.totalUpcoming}</strong>{copy.coverage.upcoming}</span>
        </div>
        <button className={`coverage-filter-toggle${filtersOpen ? " is-open" : ""}`} aria-controls="maps-filter-panel" aria-expanded={filtersOpen} type="button" onClick={() => setFiltersOpen((value) => !value)}>
          <SlidersHorizontal size={16} aria-hidden="true" />
          {copy.coverage.filters}{activeFilterCount ? ` (${activeFilterCount})` : ""}
          {filtersOpen ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        </button>
      </div>

      {filtersOpen ? (
        <section className="coverage-filter-bar maps-filter-panel" id="maps-filter-panel" aria-label={copy.coverage.filters}>
          <div className="coverage-filter-group">
            <span className="coverage-filter-label">{copy.coverage.dateRange}</span>
            <div className="coverage-date-presets">
              {datePresets.map((preset) => <button className={`coverage-filter-pill${datePreset === preset ? " is-active" : ""}`} aria-pressed={datePreset === preset} key={preset} type="button" onClick={() => { setDatePreset(preset); clearMarkerDetails(); }}>{copy.coverage.datePresets[preset]}</button>)}
            </div>
          </div>
          {datePreset === "custom" ? (
            <div className="coverage-custom-dates">
              <label><span>{copy.coverage.customStart}</span><input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
              <label><span>{copy.coverage.customEnd}</span><input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
            </div>
          ) : null}
          <div className="coverage-filter-group">
            <span className="coverage-filter-label">{copy.coverage.tournamentTypes}</span>
            <div className="coverage-type-legend">
              {tournamentTypes.map((type) => <button className={`coverage-type-badge coverage-type-filter is-${type}${activeTypes.includes(type) ? " is-active" : ""}`} aria-pressed={activeTypes.includes(type)} key={type} type="button" onClick={() => toggleType(type)}>{copy.coverage.types[type]}</button>)}
            </div>
          </div>
          <label className="coverage-marker-toggle"><input type="checkbox" checked={groupByCountry} onChange={(event) => setGroupByCountry(event.target.checked)} /><span>{copy.coverage.groupByCountry}</span></label>
          <button className="button button-small button-ghost" type="button" onClick={resetFilters}>{copy.coverage.resetFilters}</button>
        </section>
      ) : null}

      <div className="maps-explorer-layout">
        <div className={`coverage-map-shell maps-globe-shell${isFullscreenView ? " is-fullscreen" : ""}`} ref={shellRef}>
          <div className="coverage-map-toolbar" aria-label={copy.coverage.mapControls}>
            {selectedCountry ? <button className="icon-button" type="button" onClick={backOneLevel} aria-label={copy.coverage.backToWorld} title={copy.coverage.backToWorld}><ArrowLeft size={18} aria-hidden="true" /></button> : null}
            <button className="icon-button" type="button" onClick={() => applyZoom(zoom + zoomControlStep(zoom, mapZoom.step))} aria-label={copy.coverage.zoomIn} title={copy.coverage.zoomIn}><Plus size={18} aria-hidden="true" /></button>
            <button className="icon-button" type="button" onClick={() => applyZoom(zoom - zoomControlStep(zoom, mapZoom.step))} aria-label={copy.coverage.zoomOut} title={copy.coverage.zoomOut}><Minus size={18} aria-hidden="true" /></button>
            <button className="icon-button" type="button" onClick={resetViewport} aria-label={copy.coverage.resetMap} title={copy.coverage.resetMap}><RotateCcw size={18} aria-hidden="true" /></button>
            <button className="icon-button" type="button" onClick={toggleFullscreen} aria-label={isFullscreenView ? copy.coverage.exitFullscreen : copy.coverage.enterFullscreen} aria-pressed={isFullscreenView} title={isFullscreenView ? copy.coverage.exitFullscreen : copy.coverage.enterFullscreen}>{isFullscreenView ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}</button>
          </div>

          <div className={`coverage-map-stage maps-globe-stage${showInMapMarkerDetails ? " has-marker-overlay" : ""}`} data-coverage-map-renderer={globeStatus === "error" ? "unavailable" : "3d"} data-coverage-map-quality={globeQuality} role="region" tabIndex={0} aria-describedby="maps-keyboard-help" aria-label={copy.coverage.mapLabel} onKeyDown={handleMapKeyDown} ref={mapStageRef}>
            <p className="sr-only" id="maps-keyboard-help">{copy.coverage.keyboardHelp}</p>
            <button className="coverage-view-badge" type="button" onClick={resetViewport} aria-label={`${copy.coverage.currentView}: ${mapViewLabel}`}><Globe2 size={15} aria-hidden="true" />{mapViewLabel}</button>
            {globeStatus === "checking" || globeStatus === "loading" ? <div className="coverage-globe-loading" data-coverage-globe="loading" aria-label={copy.coverage.loadingGlobe} /> : null}
            {globeStatus === "error" ? (
              <div className="maps-globe-error" role="alert">
                <Globe2 size={34} aria-hidden="true" />
                <h2>{copy.coverage.globeUnavailable}</h2>
                <p>{copy.coverage.globeUnavailableBody}</p>
                <div><button className="button button-small" type="button" onClick={retryGlobe}>{copy.coverage.retryGlobe}</button><Link className="button button-small button-ghost" href={`/${locale}/events`}>{copy.coverage.browseTournaments}</Link></div>
                <small data-coverage-globe-error={globeErrorReason}>{globeErrorReason}</small>
              </div>
            ) : null}
            {globeStatus !== "error" && globeStatus !== "checking" ? (
              <CoverageThreeGlobe
                autoRotate={globeAutoRotate}
                copy={copy}
                countries={filteredCountries.filter((country) => country.globeCoordinates)}
                focusTarget={focusTarget}
                items={worldMapItems}
                keyboardCommand={keyboardCommand}
                key={globeInstance}
                mapSize={coverage.mapSize}
                quality={globeQuality}
                showCountryMarkers={view === "world" && groupByCountry}
                zoom={zoom}
                onPin={setPinned}
                onPerformanceIssue={handlePerformanceIssue}
                onReady={() => setGlobeStatus(globeQuality === "reduced" ? "degraded" : "ready")}
                onUnavailable={handleGlobeUnavailable}
                onUserInteraction={() => setGlobeAutoRotate(false)}
                onZoomChange={(nextZoom) => setZoom(clamp(nextZoom, mapZoom.min, mapZoom.max))}
              />
            ) : null}
            {globeStatus === "degraded" ? <div className="maps-quality-badge" role="status">{copy.coverage.reducedQuality}</div> : null}
            {!worldMapItems.length ? (
              <div className="maps-map-empty-state" role="status">
                <p>{filteredTotals.totalTournaments ? copy.coverage.unmappedResults : copy.coverage.noResults}</p>
                {filteredTotals.totalTournaments ? (
                  <Link className="button button-small button-ghost" href={`/${locale}/events`}>{copy.coverage.browseTournaments}</Link>
                ) : (
                  <button className="button button-small" type="button" onClick={resetFilters}>{copy.coverage.resetFilters}</button>
                )}
              </div>
            ) : null}
            {showInMapMarkerDetails ? (
              <div
                aria-label={copy.coverage.currentSelection}
                aria-live="polite"
                className="maps-marker-overlay"
                ref={markerOverlayRef}
                role="dialog"
                tabIndex={-1}
              >
                <MarkerDetails
                  copy={copy}
                  locale={locale}
                  onClose={dismissInMapMarkerDetails}
                  onOpenCountry={selectCountry}
                  payload={pinned}
                  variant="overlay"
                />
              </div>
            ) : null}
            <div className="coverage-zoom-badge" aria-live="polite">{copy.coverage.zoomLevel.replace("{zoom}", zoom.toFixed(2))}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
