"use client";

import posthog from "posthog-js";
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  ANALYTICS_PAGEVIEW_COUNT_KEY,
  ANALYTICS_PAGEVIEW_EVENT,
  ANALYTICS_READY_EVENT,
  ANALYTICS_SESSION_STARTED_KEY,
  allowedAnalyticsEvents,
  analyticsConfigIsValid,
  normalizeAnalyticsPayload,
  pathWithoutQuery,
  sanitizeAnalyticsUrl,
  sanitizePostHogProperties,
  sanitizeReplayNetworkRequest,
  resolveAnalyticsConsent,
  serializeAnalyticsConsent,
  trackingRouteTypeFor,
} from "@/lib/tracking-core";

const analyticsEnabled = process.env.NEXT_PUBLIC_ANALYTICS_ENABLED;
const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const apiHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "/ingest";
const uiHost = "https://eu.posthog.com";

let initialized = false;
let lastTrackedPath = "";

const browserWindow = () => (typeof window === "undefined" ? null : window);

const emit = (name, detail) => {
  const currentWindow = browserWindow();
  if (!currentWindow) return;
  currentWindow.dispatchEvent(new CustomEvent(name, { detail }));
};

export const analyticsIsConfigured = () =>
  analyticsConfigIsValid({ enabled: analyticsEnabled, token: projectToken });

export const readAnalyticsConsent = () => {
  const currentWindow = browserWindow();
  if (!currentWindow) return "unknown";
  try {
    return resolveAnalyticsConsent(currentWindow.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
  } catch {
    return "granted";
  }
};

const storeAnalyticsConsent = (status) => {
  const currentWindow = browserWindow();
  if (!currentWindow) return;
  try {
    currentWindow.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, serializeAnalyticsConsent(status));
  } catch {
    // A storage failure must not block the visitor from using the site.
  }
};

const clearPostHogPersistence = () => {
  const currentWindow = browserWindow();
  if (!currentWindow) return;

  try {
    for (let index = currentWindow.localStorage.length - 1; index >= 0; index -= 1) {
      const key = currentWindow.localStorage.key(index);
      if (key?.startsWith("ph_")) currentWindow.localStorage.removeItem(key);
    }
    for (let index = currentWindow.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = currentWindow.sessionStorage.key(index);
      if (key?.startsWith("ph_")) currentWindow.sessionStorage.removeItem(key);
    }
  } catch {
    // Storage can be unavailable in hardened browser modes.
  }

  const hostname = currentWindow.location.hostname;
  for (const cookie of document.cookie.split(";")) {
    const name = cookie.split("=")[0]?.trim();
    if (!name?.startsWith("ph_")) continue;
    document.cookie = `${name}=; Max-Age=0; path=/; SameSite=Lax`;
    document.cookie = `${name}=; Max-Age=0; path=/; domain=${hostname}; SameSite=Lax`;
  }
};

const dispatchReady = () => emit(ANALYTICS_READY_EVENT, { enabled: trackingIsEnabled() });

export const initAnalytics = () => {
  if (!analyticsIsConfigured() || initialized || !browserWindow()) return false;

  try {
    posthog.init(projectToken, {
      api_host: apiHost,
      ui_host: uiHost,
      defaults: "2026-05-30",
      capture_pageview: false,
      capture_pageleave: true,
      capture_dead_clicks: true,
      capture_heatmaps: true,
      capture_performance: true,
      capture_exceptions: false,
      autocapture: {
        dom_event_allowlist: ["click"],
        element_allowlist: ["a", "button"],
        css_selector_ignorelist: [
          "form",
          "input",
          "textarea",
          "select",
          "[contenteditable='true']",
          ".ph-no-autocapture",
          "[data-ph-no-autocapture]",
          "[data-analytics-private]",
        ],
        element_attribute_ignorelist: [
          "action",
          "formaction",
          "href",
          "src",
          "value",
          "data-tracking-entity-title",
          "data-tracking-outbound-url",
        ],
        capture_copied_text: false,
      },
      mask_all_text: true,
      mask_all_element_attributes: true,
      mask_personal_data_properties: true,
      custom_personal_data_properties: ["email", "name", "search", "query", "token", "auth", "password"],
      // The public website never identifies people in v1. The PostHog project
      // remains configured as identified_only for any future authenticated app.
      person_profiles: "never",
      respect_dnt: true,
      cross_subdomain_cookie: false,
      persistence: "localStorage+cookie",
      opt_out_capturing_by_default: false,
      opt_out_persistence_by_default: true,
      disable_surveys: true,
      enable_recording_console_log: false,
      session_recording: {
        blockSelector: "form, [data-analytics-private], .ph-no-capture, [data-ph-no-capture]",
        maskAllInputs: true,
        maskTextSelector: "*",
        collectFonts: false,
        recordCrossOriginIframes: false,
        recordHeaders: false,
        recordBody: false,
        streamNetworkBody: false,
        maskCapturedNetworkRequestFn: sanitizeReplayNetworkRequest,
      },
      before_send(event) {
        if (!event) return null;
        return { ...event, properties: sanitizePostHogProperties(event.properties) };
      },
      loaded(client) {
        initialized = true;
        if (readAnalyticsConsent() === "denied") client.opt_out_capturing();
        else {
          client.opt_in_capturing({ captureEventName: false });
          client.startSessionRecording();
        }
        dispatchReady();
      },
    });
    return true;
  } catch {
    initialized = false;
    return false;
  }
};

export const trackingIsEnabled = () => {
  if (!analyticsIsConfigured() || !initialized || readAnalyticsConsent() !== "granted") return false;
  return !posthog.has_opted_out_capturing();
};

export const setAnalyticsConsent = (status) => {
  if (status !== "granted" && status !== "denied") return;
  storeAnalyticsConsent(status);

  if (initialized) {
    if (status === "granted") {
      posthog.opt_in_capturing({ captureEventName: false });
      posthog.startSessionRecording();
    } else {
      posthog.stopSessionRecording();
      posthog.reset(true);
      posthog.opt_out_capturing();
      clearPostHogPersistence();
      lastTrackedPath = "";
    }
  }

  emit(ANALYTICS_CONSENT_EVENT, { status });
  dispatchReady();
};

export const trackAnalyticsEvent = (eventName, data = {}) => {
  const name = String(eventName || "").trim();
  if (!allowedAnalyticsEvents.has(name) || !trackingIsEnabled()) return false;

  const currentWindow = browserWindow();
  posthog.capture(name, normalizeAnalyticsPayload(data, currentWindow?.location));
  return true;
};

const recordSessionPageView = (path) => {
  const currentWindow = browserWindow();
  if (!currentWindow) return;
  try {
    const current = Number(currentWindow.sessionStorage.getItem(ANALYTICS_PAGEVIEW_COUNT_KEY) || 0);
    const next = current + 1;
    currentWindow.sessionStorage.setItem(ANALYTICS_PAGEVIEW_COUNT_KEY, String(next));
    if (!currentWindow.sessionStorage.getItem(ANALYTICS_SESSION_STARTED_KEY)) {
      currentWindow.sessionStorage.setItem(ANALYTICS_SESSION_STARTED_KEY, new Date().toISOString());
    }
    emit(ANALYTICS_PAGEVIEW_EVENT, { pageviews: next, path });
  } catch {
    emit(ANALYTICS_PAGEVIEW_EVENT, { pageviews: 1, path });
  }
};

export const trackPageView = (path) => {
  if (!trackingIsEnabled()) return false;
  const currentWindow = browserWindow();
  const cleanPath = pathWithoutQuery(path || currentWindow?.location.pathname || "/");
  if (cleanPath === lastTrackedPath) return false;

  lastTrackedPath = cleanPath;
  posthog.capture("$pageview", {
    $current_url: sanitizeAnalyticsUrl(currentWindow?.location.href || cleanPath, { keepUtm: true }),
    $pathname: cleanPath,
    route_type: trackingRouteTypeFor(cleanPath),
    locale: normalizeAnalyticsPayload({ path: cleanPath }, currentWindow?.location).locale,
  });
  recordSessionPageView(cleanPath);
  return true;
};
