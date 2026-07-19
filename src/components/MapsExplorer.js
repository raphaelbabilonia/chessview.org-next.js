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
          data-tracking-placement="maps_context_panel"
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

function MarkerDetails({ copy, locale, onOpenCountry, payload }) {
  if (!payload) return null;
  if (payload.kind === "event") {
    return (
      <section className="maps-marker-card" aria-label={copy.coverage.currentSelection}>
        <p className="eyebrow">{copy.coverage.selectedTournament}</p>
        <h3>{payload.event.title}</h3>
        <TypeBadge copy={copy} type={payload.event.tournamentType} />
        <p>{[payload.event.city, payload.event.region, formatDateRange(payload.event.startDate, payload.event.endDate, locale)].filter(Boolean).join(" / ")}</p>
        <Link className="button button-small" href={payload.event.href}>
          {copy.coverage.openEvent}<ExternalLink size={14} aria-hidden="true" />
        </Link>
      </section>
    );
  }

  if (payload.kind === "eventCluster") {
    return (
      <section className="maps-marker-card" aria-label={copy.coverage.currentSelection}>
        <p className="eyebrow">{copy.coverage.selectedCluster}</p>
        <h3>{payload.cluster.count} {copy.coverage.tournaments}</h3>
        <EventLinkList copy={copy} events={payload.cluster.events} locale={locale} limit={4} />
      </section>
    );
  }

  if (payload.kind === "country") {
    return (
      <section className="maps-marker-card" aria-label={copy.coverage.currentSelection}>
        <div className="maps-context-title"><CountryFlag country={payload.country} /><h3>{payload.country.label}</h3></div>
        <CountStats copy={copy} item={payload.country} />
        <button className="button button-small" type="button" onClick={() => onOpenCountry(payload.country)}>{copy.coverage.focusCountry}</button>
      </section>
    );
  }

  return null;
}

export function MapsExplorer({ copy, coverage, locale }) {
  const shellRef = useRef(null);
  const today = useMemo(() => eventDateKey(coverage.today) || "1970-01-01", [coverage.today]);
  const [selectedCountryKey, setSelectedCountryKey] = useState("");
  const [selectedRegionKey, setSelectedRegionKey] = useState("");
  const [hovered, setHovered] = useState(null);
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
          const regions = (country.regions || [])
            .map((region) => {
              const regionEvents = region.events.filter(eventMatchesFilters).sort(sortEvents);
              if (!regionEvents.length) return null;
              const liveCount = countLive(regionEvents);
              return {
                ...region,
                count: regionEvents.length,
                events: regionEvents,
                liveCount,
                plottedCount: regionEvents.filter((event) => event.globeCoordinates).length,
                upcomingCount: regionEvents.length - liveCount,
              };
            })
            .filter(Boolean)
            .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
          const liveCount = countLive(events);
          return { ...country, count: events.length, events, liveCount, regions, upcomingCount: events.length - liveCount };
        })
        .filter(Boolean)
        .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    [coverage.allCountries, eventMatchesFilters],
  );

  const filteredCountryByKey = useMemo(() => new Map(filteredCountries.map((country) => [country.countryKey, country])), [filteredCountries]);
  const selectedCountry = filteredCountryByKey.get(selectedCountryKey) || null;
  const selectedRegion = selectedCountry?.regions.find((region) => region.key === selectedRegionKey) || null;
  const allEvents = useMemo(() => filteredCountries.flatMap((country) => country.events).sort(sortEvents), [filteredCountries]);
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
    return filteredWorldEvents.filter(
      (event) =>
        event.countryKey === selectedCountry.countryKey &&
        (!selectedRegion || normalizeSearch(event.region) === normalizeSearch(selectedRegion.label)),
    );
  }, [filteredWorldEvents, selectedCountry, selectedRegion]);
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

  const view = selectedRegion ? "region" : selectedCountry ? "country" : "world";
  const focusCoordinates = useMemo(() => {
    if (selectedRegion) return selectedRegion.events.map((event) => event.globeCoordinates).filter(Boolean);
    if (selectedCountry) {
      const coordinates = scopedWorldEvents.map((event) => event.globeCoordinates).filter(Boolean);
      return coordinates.length ? coordinates : [selectedCountry.globeCoordinates].filter(Boolean);
    }
    return [];
  }, [scopedWorldEvents, selectedCountry, selectedRegion]);
  const mapViewLabel = selectedRegion
    ? `${copy.coverage.regionView}: ${selectedRegion.label}`
    : selectedCountry
      ? `${copy.coverage.countryView}: ${selectedCountry.label}`
      : copy.coverage.worldView;
  const focusTarget = useMemo(
    () => ({
      coordinates: selectedRegion?.globeCoordinates || selectedCountry?.globeCoordinates || null,
      countryNames: selectedCountry
        ? [selectedCountry.country, selectedCountry.mapFeatureName, selectedCountry.label].filter(Boolean)
        : [],
      request: focusRequest,
      view,
    }),
    [focusRequest, selectedCountry, selectedRegion, view],
  );
  const activePayload = pinned || hovered;
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

  const trackCoverageInteraction = (eventName, metadata = {}) => {
    trackAnalyticsEvent(eventName, { routeType: "coverage", metadata: { surface: "maps", ...metadata } });
  };

  const clearMarkerDetails = () => {
    setHovered(null);
    setPinned(null);
  };

  const focusView = (nextView, coordinates) => {
    setGlobeAutoRotate(false);
    setZoom(focusZoomFor(nextView, coordinates));
    setFocusRequest((value) => value + 1);
  };

  const selectCountry = (country) => {
    setSelectedCountryKey(country.countryKey);
    setSelectedRegionKey("");
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
      metadata: { placement: "maps_context_panel" },
    });
  };

  const selectRegion = (region) => {
    setSelectedRegionKey(region.key);
    clearMarkerDetails();
    focusView("region", region.events.map((event) => event.globeCoordinates).filter(Boolean));
    trackAnalyticsEvent("coverage_region_select", {
      entityId: region.key,
      entityTitle: region.label,
      entityType: "coverage_region",
      routeType: "coverage",
      metadata: { country: selectedCountry?.countryKey, placement: "maps_context_panel" },
    });
  };

  const backOneLevel = () => {
    clearMarkerDetails();
    if (selectedRegion) {
      setSelectedRegionKey("");
      focusView("country", scopedWorldEvents.map((event) => event.globeCoordinates).filter(Boolean));
      return;
    }
    setSelectedCountryKey("");
    setSelectedRegionKey("");
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

  const renderContextPanel = () => (
    <aside className="maps-context-panel" aria-label={copy.coverage.currentSelection} aria-live="polite">
      <MarkerDetails copy={copy} locale={locale} onOpenCountry={selectCountry} payload={activePayload} />

      <nav className="maps-breadcrumbs" aria-label={copy.coverage.currentView}>
        <button className={view === "world" ? "is-current" : ""} type="button" onClick={() => {
          setSelectedCountryKey(""); setSelectedRegionKey(""); setZoom(1); setFocusRequest((value) => value + 1);
        }}>{copy.coverage.worldView}</button>
        {selectedCountry ? <button className={view === "country" ? "is-current" : ""} type="button" onClick={() => {
          setSelectedRegionKey(""); focusView("country", scopedWorldEvents.map((event) => event.globeCoordinates).filter(Boolean));
        }}>{selectedCountry.label}</button> : null}
        {selectedRegion ? <span>{selectedRegion.label}</span> : null}
      </nav>

      {!selectedCountry ? (
        <>
          <div className="maps-context-heading">
            <div><p className="eyebrow">{copy.coverage.countryList}</p><h2>{copy.coverage.chooseCountry}</h2></div>
            <strong>{filteredCountries.length}</strong>
          </div>
          <div className="maps-country-list">
            {filteredCountries.map((country) => (
              <button className="maps-country-row" key={country.countryKey} type="button" onClick={() => selectCountry(country)}>
                <span><CountryFlag country={country} />{country.label}</span>
                <strong>{country.count}</strong>
                {!country.globeCoordinates ? <small>{copy.coverage.listOnly}</small> : null}
              </button>
            ))}
          </div>
          <div className="maps-context-events">
            <p className="eyebrow">{copy.coverage.nextEvents}</p>
            <EventLinkList copy={copy} events={allEvents} locale={locale} limit={6} />
          </div>
        </>
      ) : null}

      {selectedCountry && !selectedRegion ? (
        <>
          <div className="maps-context-heading">
            <div className="maps-context-title"><CountryFlag country={selectedCountry} /><div><p className="eyebrow">{copy.coverage.countryView}</p><h2>{selectedCountry.label}</h2></div></div>
            {selectedCountry.href ? <Link className="button button-small button-ghost" href={selectedCountry.href}>{copy.coverage.exploreCountry}</Link> : null}
          </div>
          <CountStats copy={copy} item={selectedCountry} />
          {!selectedCountry.globeCoordinates ? <p className="maps-coordinate-note">{copy.coverage.countryNeedsCoordinates}</p> : null}
          <div className="maps-region-list">
            {selectedCountry.regions.map((region) => (
              <button className="coverage-region-card" key={region.key} type="button" onClick={() => selectRegion(region)}>
                <span className="coverage-region-card-main"><strong>{region.label}</strong><span>{region.plottedCount ? copy.coverage.mappedEvents.replace("{count}", region.plottedCount) : copy.coverage.noMappedEvents}</span></span>
                <span className="coverage-region-card-count">{region.count}</span>
              </button>
            ))}
          </div>
          <EventLinkList copy={copy} events={selectedCountry.events} locale={locale} limit={8} />
        </>
      ) : null}

      {selectedCountry && selectedRegion ? (
        <>
          <div className="maps-context-heading"><div><p className="eyebrow">{copy.coverage.regionView}</p><h2>{selectedRegion.label}</h2></div></div>
          <CountStats copy={copy} item={selectedRegion} />
          {!selectedRegion.globeCoordinates ? <p className="maps-coordinate-note">{copy.coverage.regionNeedsCoordinates}</p> : null}
          <EventLinkList copy={copy} events={selectedRegion.events} locale={locale} />
        </>
      ) : null}

      {!filteredTotals.totalTournaments ? (
        <div className="maps-empty-state"><p>{copy.coverage.noResults}</p><button className="button button-small" type="button" onClick={resetFilters}>{copy.coverage.resetFilters}</button></div>
      ) : null}
    </aside>
  );

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
            {selectedCountry ? <button className="icon-button" type="button" onClick={backOneLevel} aria-label={selectedRegion ? copy.coverage.backToCountry : copy.coverage.backToWorld} title={selectedRegion ? copy.coverage.backToCountry : copy.coverage.backToWorld}><ArrowLeft size={18} aria-hidden="true" /></button> : null}
            <button className="icon-button" type="button" onClick={() => applyZoom(zoom + zoomControlStep(zoom, mapZoom.step))} aria-label={copy.coverage.zoomIn} title={copy.coverage.zoomIn}><Plus size={18} aria-hidden="true" /></button>
            <button className="icon-button" type="button" onClick={() => applyZoom(zoom - zoomControlStep(zoom, mapZoom.step))} aria-label={copy.coverage.zoomOut} title={copy.coverage.zoomOut}><Minus size={18} aria-hidden="true" /></button>
            <button className="icon-button" type="button" onClick={resetViewport} aria-label={copy.coverage.resetMap} title={copy.coverage.resetMap}><RotateCcw size={18} aria-hidden="true" /></button>
            <button className="icon-button" type="button" onClick={toggleFullscreen} aria-label={isFullscreenView ? copy.coverage.exitFullscreen : copy.coverage.enterFullscreen} aria-pressed={isFullscreenView} title={isFullscreenView ? copy.coverage.exitFullscreen : copy.coverage.enterFullscreen}>{isFullscreenView ? <Minimize2 size={18} aria-hidden="true" /> : <Maximize2 size={18} aria-hidden="true" />}</button>
          </div>

          <div className="coverage-map-stage maps-globe-stage" data-coverage-map-renderer={globeStatus === "error" ? "unavailable" : "3d"} data-coverage-map-quality={globeQuality} role="region" tabIndex={0} aria-describedby="maps-keyboard-help" aria-label={copy.coverage.mapLabel} onKeyDown={handleMapKeyDown}>
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
                onHover={setHovered}
                onLeave={() => setHovered(null)}
                onPin={setPinned}
                onPerformanceIssue={handlePerformanceIssue}
                onReady={() => setGlobeStatus(globeQuality === "reduced" ? "degraded" : "ready")}
                onUnavailable={handleGlobeUnavailable}
                onUserInteraction={() => setGlobeAutoRotate(false)}
                onZoomChange={(nextZoom) => setZoom(clamp(nextZoom, mapZoom.min, mapZoom.max))}
              />
            ) : null}
            {globeStatus === "degraded" ? <div className="maps-quality-badge" role="status">{copy.coverage.reducedQuality}</div> : null}
            <div className="coverage-zoom-badge" aria-live="polite">{copy.coverage.zoomLevel.replace("{zoom}", zoom.toFixed(2))}</div>
          </div>
        </div>
        {renderContextPanel()}
      </div>
    </section>
  );
}
