"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyticsIsConfigured,
  readAnalyticsConsent,
  setAnalyticsConsent,
  trackAnalyticsEvent,
} from "@/lib/tracking";
import {
  ANALYTICS_CONSENT_EVENT,
  ANALYTICS_PAGEVIEW_COUNT_KEY,
  ANALYTICS_PAGEVIEW_EVENT,
  ANALYTICS_SESSION_STARTED_KEY,
  ANALYTICS_SETTINGS_EVENT,
  RESEARCH_SURVEY_STORAGE_KEY,
  RESEARCH_SURVEY_VERSION,
  shouldShowResearchSurvey,
} from "@/lib/tracking-core";

const readSurveyState = () => {
  try {
    const value = JSON.parse(window.localStorage.getItem(RESEARCH_SURVEY_STORAGE_KEY) || "null");
    return value?.version === RESEARCH_SURVEY_VERSION ? value : null;
  } catch {
    return null;
  }
};

const markSurveyShown = () => {
  try {
    window.localStorage.setItem(
      RESEARCH_SURVEY_STORAGE_KEY,
      JSON.stringify({ version: RESEARCH_SURVEY_VERSION, shownAt: new Date().toISOString() })
    );
  } catch {
    // The cooldown is best-effort when browser storage is unavailable.
  }
};

function ResearchSurvey({ consent, copy }) {
  const [visible, setVisible] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [role, setRole] = useState("");
  const [purpose, setPurpose] = useState("");

  const evaluate = useCallback(() => {
    if (consent !== "granted" || visible) return undefined;

    let pageviews = 0;
    let elapsedMs = 0;
    let lastShownAt;
    try {
      pageviews = Number(window.sessionStorage.getItem(ANALYTICS_PAGEVIEW_COUNT_KEY) || 0);
      const started = new Date(window.sessionStorage.getItem(ANALYTICS_SESSION_STARTED_KEY) || "").getTime();
      elapsedMs = Number.isFinite(started) ? Date.now() - started : 0;
      lastShownAt = readSurveyState()?.shownAt;
    } catch {
      return undefined;
    }

    if (shouldShowResearchSurvey({ consent, elapsedMs, lastShownAt, pageviews })) {
      markSurveyShown();
      setVisible(true);
      trackAnalyticsEvent("visitor_research_survey_shown");
      return undefined;
    }

    if (pageviews >= 2 && !lastShownAt && elapsedMs < 30_000) {
      return 30_000 - elapsedMs + 50;
    }
    return undefined;
  }, [consent, visible]);

  useEffect(() => {
    let timeout;
    const scheduleEvaluation = (delay = 0) => {
      if (timeout) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => {
        const nextDelay = evaluate();
        if (nextDelay) scheduleEvaluation(nextDelay);
      }, delay);
    };
    const onPageView = () => scheduleEvaluation();
    scheduleEvaluation();
    window.addEventListener(ANALYTICS_PAGEVIEW_EVENT, onPageView);
    return () => {
      if (timeout) window.clearTimeout(timeout);
      window.removeEventListener(ANALYTICS_PAGEVIEW_EVENT, onPageView);
    };
  }, [evaluate]);

  if (!visible) return null;

  const dismiss = () => {
    trackAnalyticsEvent("visitor_research_survey_dismissed");
    setVisible(false);
  };

  const submit = (event) => {
    event.preventDefault();
    if (!role || !purpose) return;
    trackAnalyticsEvent("visitor_research_survey_submitted", {
      metadata: { visitorRole: role, visitPurpose: purpose },
    });
    setSubmitted(true);
  };

  return (
    <aside className="analytics-survey ph-no-capture" role="dialog" aria-label={copy.title}>
      <button className="analytics-dialog-close" type="button" onClick={dismiss} aria-label={copy.close}>
        ×
      </button>
      {submitted ? (
        <p className="analytics-survey-thanks" role="status">{copy.thankYou}</p>
      ) : (
        <form onSubmit={submit} data-analytics-private>
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2>{copy.title}</h2>
          <p>{copy.body}</p>
          <fieldset>
            <legend>{copy.role}</legend>
            <div className="analytics-choice-grid">
              {Object.entries(copy.roles).map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="visitor-role" value={value} checked={role === value} onChange={() => setRole(value)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{copy.purpose}</legend>
            <div className="analytics-choice-grid">
              {Object.entries(copy.purposes).map(([value, label]) => (
                <label key={value}>
                  <input type="radio" name="visit-purpose" value={value} checked={purpose === value} onChange={() => setPurpose(value)} />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="analytics-actions">
            <button className="button" type="submit" disabled={!role || !purpose}>{copy.submit}</button>
            <button className="button" type="button" onClick={dismiss}>{copy.dismiss}</button>
          </div>
        </form>
      )}
    </aside>
  );
}

export function AnalyticsConsentManager({ copy, locale }) {
  const [status, setStatus] = useState("loading");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsDialogRef = useRef(null);
  const settingsTriggerRef = useRef(null);

  useEffect(() => {
    if (!analyticsIsConfigured()) return;
    const hydrationTimeout = window.setTimeout(() => setStatus(readAnalyticsConsent()), 0);

    const onConsent = (event) => setStatus(event.detail?.status || readAnalyticsConsent());
    const openSettings = (event) => {
      settingsTriggerRef.current = event.detail?.trigger || null;
      setSettingsOpen(true);
    };
    window.addEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
    window.addEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
    return () => {
      window.clearTimeout(hydrationTimeout);
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, onConsent);
      window.removeEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
    };
  }, []);

  if (!analyticsIsConfigured() || status === "loading") return null;

  const closeSettings = () => {
    setSettingsOpen(false);
    window.setTimeout(() => settingsTriggerRef.current?.focus?.(), 0);
  };

  const handleSettingsKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettings();
      return;
    }
    if (event.key !== "Tab") return;

    const controls = settingsDialogRef.current?.querySelectorAll("button:not([disabled]), a[href]");
    if (!controls?.length) return;
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const choose = (nextStatus) => {
    setAnalyticsConsent(nextStatus);
    setStatus(nextStatus);
    closeSettings();
  };

  const statusLabel = copy.settings[status] || copy.settings.unknown;

  return (
    <>
      {status === "unknown" && (
        <section className="analytics-consent ph-no-capture" role="dialog" aria-labelledby="analytics-consent-title">
          <div>
            <p className="eyebrow">{copy.consent.eyebrow}</p>
            <h2 id="analytics-consent-title">{copy.consent.title}</h2>
            <p>{copy.consent.body}</p>
            <Link href={`/${locale}/privacy`}>{copy.consent.privacy}</Link>
          </div>
          <div className="analytics-actions">
            <button className="button analytics-choice" type="button" onClick={() => choose("granted")}>
              {copy.consent.accept}
            </button>
            <button className="button analytics-choice" type="button" onClick={() => choose("denied")}>
              {copy.consent.reject}
            </button>
          </div>
        </section>
      )}

      {settingsOpen && (
        <div className="analytics-settings-backdrop ph-no-capture" role="presentation">
          <section
            className="analytics-settings"
            role="dialog"
            aria-modal="true"
            aria-labelledby="analytics-settings-title"
            onKeyDown={handleSettingsKeyDown}
            ref={settingsDialogRef}
          >
            <h2 id="analytics-settings-title">{copy.settings.title}</h2>
            <p>{copy.settings.body}</p>
            <p><strong>{copy.settings.current}:</strong> {statusLabel}</p>
            <div className="analytics-actions">
              <button autoFocus className="button analytics-choice" type="button" onClick={() => choose("granted")}>
                {copy.consent.accept}
              </button>
              <button className="button analytics-choice" type="button" onClick={() => choose("denied")}>
                {copy.consent.reject}
              </button>
              <button className="button" type="button" onClick={closeSettings}>{copy.settings.close}</button>
            </div>
          </section>
        </div>
      )}

      <ResearchSurvey consent={status} copy={copy.survey} />
    </>
  );
}

export function CookieSettingsButton({ children }) {
  if (!analyticsIsConfigured()) return null;
  return (
    <button
      className="footer-link-button"
      type="button"
      onClick={(event) => window.dispatchEvent(new CustomEvent(ANALYTICS_SETTINGS_EVENT, { detail: { trigger: event.currentTarget } }))}
    >
      {children}
    </button>
  );
}
