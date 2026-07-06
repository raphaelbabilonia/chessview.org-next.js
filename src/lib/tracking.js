"use client";

const visitorStorageKey = "chessview_tracking_visitor";
const sessionStorageKey = "chessview_tracking_session";
const supportedLocales = new Set(["en", "es", "it"]);

const enabled = process.env.NEXT_PUBLIC_TRACKING_ENABLED === "true";
const endpoint = process.env.NEXT_PUBLIC_TRACKING_API_URL || "";

const cleanText = (value, max = 220) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

const safeLocation = () => {
  if (typeof window === "undefined") return null;
  return window.location;
};

const newId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `cv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
};

const getStoredId = (storage, key) => {
  try {
    const current = storage.getItem(key);
    if (current) return current;
    const next = newId();
    storage.setItem(key, next);
    return next;
  } catch {
    return newId();
  }
};

const getVisitorId = () => {
  if (typeof window === "undefined") return "";
  return getStoredId(window.localStorage, visitorStorageKey);
};

const getSessionId = () => {
  if (typeof window === "undefined") return "";
  return getStoredId(window.sessionStorage, sessionStorageKey);
};

const pathWithoutQuery = (path) => {
  const value = cleanText(path || safeLocation()?.pathname || "/", 500);
  return value.split("?")[0].split("#")[0] || "/";
};

const localeFromPath = (path) => {
  const [, first] = pathWithoutQuery(path).split("/");
  return supportedLocales.has(first) ? first : undefined;
};

export const trackingRouteTypeFor = (path) => {
  const cleanPath = pathWithoutQuery(path);
  const segments = cleanPath.split("/").filter(Boolean);
  const offset = supportedLocales.has(segments[0]) ? 1 : 0;
  const section = segments[offset] || "";
  const id = segments[offset + 1] || "";

  if (!section) return "home";
  if (section === "tracking") return "tracking";
  if (section === "events" && id) return "event_detail";
  if (section === "events") return "events";
  if (section === "news") return "news";
  if (section === "coverage") return "coverage";
  if (section === "countries") return "country";
  if (section === "sources") return "source";
  if (section === "collaborate") return "collaboration";
  return "unknown";
};

const pageViewEventNameFor = (routeType) =>
  ({
    country: "country_page_view",
    event_detail: "event_detail_view",
    source: "source_page_view",
  })[routeType] || "page_view";

const deviceType = () => {
  if (typeof navigator === "undefined") return "unknown";
  const ua = navigator.userAgent.toLowerCase();
  if (/bot|crawler|spider|preview|facebookexternalhit|slurp|bingpreview/.test(ua)) return "bot";
  if (/ipad|tablet|android(?!.*mobile)/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android.*mobile/.test(ua)) return "mobile";
  return "desktop";
};

const domainFromUrl = (value) => {
  try {
    return new URL(value).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const currentUtm = () => {
  const location = safeLocation();
  if (!location) return {};
  const params = new URLSearchParams(location.search);
  return {
    utmSource: cleanText(params.get("utm_source"), 120),
    utmMedium: cleanText(params.get("utm_medium"), 120),
    utmCampaign: cleanText(params.get("utm_campaign"), 180),
  };
};

const compactRecord = (record = {}) =>
  Object.fromEntries(
    Object.entries(record || {})
      .slice(0, 20)
      .map(([key, value]) => [cleanText(key, 60), cleanText(value, 220)])
      .filter(([key, value]) => key && value)
  );

const enrichedEvent = (eventName, data = {}) => {
  const location = safeLocation();
  const path = pathWithoutQuery(data.path || location?.pathname || "/");
  const routeType = data.routeType || trackingRouteTypeFor(path);
  const referrer = typeof document !== "undefined" ? document.referrer : "";

  return {
    eventName,
    occurredAt: new Date().toISOString(),
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    path,
    routeType,
    locale: data.locale || localeFromPath(path),
    pageTitle: cleanText(data.pageTitle || (typeof document !== "undefined" ? document.title : ""), 220),
    entityType: cleanText(data.entityType, 40),
    entityId: cleanText(data.entityId, 120),
    entitySlug: cleanText(data.entitySlug, 160),
    entityTitle: cleanText(data.entityTitle, 220),
    outboundUrl: cleanText(data.outboundUrl, 600),
    referrer,
    referrerDomain: domainFromUrl(referrer),
    deviceType: data.deviceType || deviceType(),
    filters: compactRecord(data.filters),
    metadata: compactRecord(data.metadata),
    ...currentUtm(),
  };
};

const sendBatch = (events) => {
  if (!enabled || !endpoint || typeof window === "undefined" || !events.length) return;
  const body = JSON.stringify({ events });
  const blob = new Blob([body], { type: "application/json" });

  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    if (navigator.sendBeacon(endpoint, blob)) return;
  }

  fetch(endpoint, {
    method: "POST",
    body,
    headers: { "Content-Type": "application/json" },
    keepalive: true,
  }).catch(() => {});
};

export const trackAnalyticsEvent = (eventName, data = {}) => {
  const name = cleanText(eventName, 80);
  if (!name) return;
  sendBatch([enrichedEvent(name, data)]);
};

export const trackPageView = (path) => {
  const cleanPath = pathWithoutQuery(path);
  const routeType = trackingRouteTypeFor(cleanPath);
  trackAnalyticsEvent(pageViewEventNameFor(routeType), {
    path: cleanPath,
    routeType,
  });
};

export const trackingIsEnabled = () => enabled && Boolean(endpoint);
