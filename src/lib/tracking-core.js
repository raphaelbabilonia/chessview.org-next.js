const supportedLocales = new Set(["en", "es", "it"]);

export const ANALYTICS_CONSENT_VERSION = 1;
export const ANALYTICS_CONSENT_STORAGE_KEY = "chessview_analytics_consent";
export const ANALYTICS_CONSENT_EVENT = "chessview:analytics-consent";
export const ANALYTICS_READY_EVENT = "chessview:analytics-ready";
export const ANALYTICS_PAGEVIEW_EVENT = "chessview:analytics-pageview";
export const ANALYTICS_SETTINGS_EVENT = "chessview:analytics-settings";
export const ANALYTICS_PAGEVIEW_COUNT_KEY = "chessview_analytics_pageviews";
export const ANALYTICS_SESSION_STARTED_KEY = "chessview_analytics_session_started";
export const RESEARCH_SURVEY_STORAGE_KEY = "chessview_research_survey";
export const RESEARCH_SURVEY_VERSION = 1;
export const RESEARCH_SURVEY_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

export const allowedAnalyticsEvents = new Set([
  "event_view_details",
  "event_original_click",
  "event_announcement_open",
  "events_filter_apply",
  "news_original_click",
  "news_filter_apply",
  "language_change",
  "theme_change",
  "github_source_click",
  "agent_resource_click",
  "collaboration_agents_click",
  "collaboration_entry_click",
  "collaboration_overview_click",
  "collaboration_repository_click",
  "collaboration_resource_click",
  "coverage_country_select",
  "coverage_event_open",
  "coverage_filter_apply",
  "coverage_filter_change",
  "coverage_fullscreen_toggle",
  "coverage_map_3d_error",
  "coverage_map_3d_retry",
  "coverage_map_interaction",
  "coverage_map_quality_reduce",
  "coverage_map_renderer_change",
  "coverage_map_renderer_fallback",
  "coverage_map_reset",
  "coverage_map_zoom",
  "coverage_marker_select",
  "coverage_region_select",
  "coverage_view_change",
  "visitor_research_survey_shown",
  "visitor_research_survey_dismissed",
  "visitor_research_survey_submitted",
]);

const allowedFilterKeys = new Set(["search", "city", "country", "source", "status", "from", "to"]);
const allowedMetadataKeys = new Set([
  "degrees",
  "direction",
  "from",
  "input",
  "label",
  "mode",
  "phase",
  "placement",
  "reason",
  "renderer",
  "start_zoom",
  "surface",
  "theme",
  "to",
  "view",
  "visit_purpose",
  "visitor_role",
]);
const blockedPropertyPattern = /(?:email|password|secret|token|contact|query|search_text|entity_title|outbound_url|form_value|input_value|full_name)/i;
const blockedPostHogProperties = new Set([
  "$initial_person_info",
  "$raw_user_agent",
  "$set",
  "$set_once",
  "$title",
  "title",
]);
const allowedUtmPropertyPattern = /(?:^|_)(?:utm_source|utm_medium|utm_campaign)$/;

export const cleanAnalyticsText = (value, max = 220) =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);

export const pathWithoutQuery = (value = "/") => {
  const raw = cleanAnalyticsText(value, 600) || "/";
  try {
    return new URL(raw, "https://chessview.org").pathname || "/";
  } catch {
    return raw.split("?")[0].split("#")[0] || "/";
  }
};

export const trackingRouteTypeFor = (path) => {
  const cleanPath = pathWithoutQuery(path);
  const segments = cleanPath.split("/").filter(Boolean);
  const offset = supportedLocales.has(segments[0]) ? 1 : 0;
  const section = segments[offset] || "";
  const id = segments[offset + 1] || "";

  if (!section) return "home";
  if (section === "events" && id) return "event_detail";
  if (section === "events") return "events";
  if (section === "news") return "news";
  if (section === "coverage" || section === "maps") return "coverage";
  if (section === "countries") return "country";
  if (section === "sources") return "source";
  if (section === "collaborate") return "collaboration";
  if (section === "privacy" || section === "terms") return "legal";
  return "unknown";
};

export const localeFromPath = (path) => {
  const [, first] = pathWithoutQuery(path).split("/");
  return supportedLocales.has(first) ? first : undefined;
};

const safeUtm = (params, key) => {
  const value = cleanAnalyticsText(params.get(key), key === "utm_campaign" ? 180 : 120);
  return /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/.test(value) ? "" : value;
};

export const sanitizeAnalyticsUrl = (value, { keepUtm = true } = {}) => {
  const raw = cleanAnalyticsText(value, 1200);
  if (!raw) return "";

  try {
    const url = new URL(raw, "https://chessview.org");
    const sanitized = new URL(`${url.origin}${url.pathname}`);
    if (keepUtm) {
      for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
        const clean = safeUtm(url.searchParams, key);
        if (clean) sanitized.searchParams.set(key, clean);
      }
    }
    return sanitized.toString();
  } catch {
    return pathWithoutQuery(raw);
  }
};

export const hostnameFromUrl = (value) => {
  const raw = cleanAnalyticsText(value, 800);
  if (!raw) return "";
  try {
    return new URL(raw, "https://chessview.org").hostname.replace(/^www\./, "").slice(0, 180);
  } catch {
    return "";
  }
};

const snakeCase = (value) =>
  cleanAnalyticsText(value, 60)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const safePrimitive = (value) => {
  if (typeof value === "boolean" || typeof value === "number") return value;
  return cleanAnalyticsText(value, 220);
};

const flattenSafeRecord = (target, prefix, record = {}, { allowedKeys } = {}) => {
  for (const [rawKey, rawValue] of Object.entries(record || {}).slice(0, 20)) {
    const key = snakeCase(rawKey);
    if (!key || blockedPropertyPattern.test(key) || (allowedKeys && !allowedKeys.has(key))) continue;
    const value = prefix === "filter_" && key === "search" ? "used" : safePrimitive(rawValue);
    if (value === "" || value === undefined || value === null) continue;
    target[`${prefix}${key}`] = value;
  }
};

export const normalizeAnalyticsPayload = (data = {}, locationLike) => {
  const path = pathWithoutQuery(data.path || locationLike?.pathname || "/");
  const outboundHost = hostnameFromUrl(data.outboundUrl);
  const payload = {
    route_type: cleanAnalyticsText(data.routeType || trackingRouteTypeFor(path), 40),
    locale: cleanAnalyticsText(data.locale || localeFromPath(path), 8),
    entity_type: cleanAnalyticsText(data.entityType, 40),
    entity_id: cleanAnalyticsText(data.entityId, 120),
    entity_slug: cleanAnalyticsText(data.entitySlug, 160),
    outbound_host: outboundHost,
  };

  flattenSafeRecord(payload, "filter_", data.filters, { allowedKeys: allowedFilterKeys });
  flattenSafeRecord(payload, "meta_", data.metadata, { allowedKeys: allowedMetadataKeys });

  const params = new URLSearchParams(locationLike?.search || "");
  for (const key of ["utm_source", "utm_medium", "utm_campaign"]) {
    const value = safeUtm(params, key);
    if (value) payload[key] = value;
  }

  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== "" && value !== undefined));
};

export const sanitizePostHogProperties = (properties = {}) => {
  const safe = {};

  for (const [key, value] of Object.entries(properties || {})) {
    // PostHog's public project token is required to route every event. Custom
    // application payloads are normalized separately and can never add it.
    if (key === "token" || key === "$token") {
      safe[key] = value;
      continue;
    }
    if (blockedPostHogProperties.has(key) || blockedPropertyPattern.test(key)) continue;
    if (key.includes("utm_") && !allowedUtmPropertyPattern.test(key)) continue;

    if (key === "$current_url" || key.endsWith("_url")) {
      safe[key] = sanitizeAnalyticsUrl(value, { keepUtm: true });
      continue;
    }
    if (key === "$referrer" || key.endsWith("_referrer")) {
      if (typeof value === "string" && value.startsWith("$")) {
        safe[key] = value;
        continue;
      }
      safe[key] = sanitizeAnalyticsUrl(value, { keepUtm: false });
      continue;
    }
    if (key === "$pathname" || key.endsWith("_pathname")) {
      safe[key] = pathWithoutQuery(value);
      continue;
    }
    if (key === "$heatmap_data" && value && typeof value === "object") {
      safe[key] = Object.fromEntries(
        Object.entries(value).map(([url, points]) => [sanitizeAnalyticsUrl(url, { keepUtm: true }), points])
      );
      continue;
    }

    safe[key] = value;
  }

  return safe;
};

export const sanitizeReplayNetworkRequest = (request = {}) => {
  const sanitized = { ...request };
  const rawUrl = cleanAnalyticsText(request.name || request.url, 1200);
  try {
    sanitized.name = rawUrl ? new URL(rawUrl, "https://chessview.org").origin : "";
  } catch {
    sanitized.name = "";
  }

  delete sanitized.url;
  delete sanitized.requestHeaders;
  delete sanitized.requestBody;
  delete sanitized.responseHeaders;
  delete sanitized.responseBody;
  return sanitized;
};

export const analyticsConfigIsValid = ({ enabled, token }) => enabled === "true" && Boolean(cleanAnalyticsText(token, 300));

export const parseAnalyticsConsent = (raw) => {
  if (!raw) return "unknown";
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (value?.version !== ANALYTICS_CONSENT_VERSION) return "unknown";
    return value.status === "granted" || value.status === "denied" ? value.status : "unknown";
  } catch {
    return "unknown";
  }
};

export const serializeAnalyticsConsent = (status, updatedAt = new Date().toISOString()) =>
  JSON.stringify({ version: ANALYTICS_CONSENT_VERSION, status, updatedAt });

export const shouldShowResearchSurvey = ({ consent, elapsedMs, lastShownAt, now = Date.now(), pageviews }) => {
  if (consent !== "granted" || Number(pageviews) < 2 || Number(elapsedMs) < 30_000) return false;
  if (!lastShownAt) return true;
  const shownAt = new Date(lastShownAt).getTime();
  return !Number.isFinite(shownAt) || now - shownAt >= RESEARCH_SURVEY_COOLDOWN_MS;
};
