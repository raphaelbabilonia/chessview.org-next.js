import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  analyticsConfigIsValid,
  normalizeAnalyticsPayload,
  parseAnalyticsConsent,
  sanitizeAnalyticsUrl,
  sanitizePostHogProperties,
  sanitizeReplayNetworkRequest,
  serializeAnalyticsConsent,
  shouldShowResearchSurvey,
  trackingRouteTypeFor,
} from "../../src/lib/tracking-core.js";

describe("analytics consent", () => {
  it("accepts only the current, explicit consent values", () => {
    assert.equal(parseAnalyticsConsent(serializeAnalyticsConsent("granted")), "granted");
    assert.equal(parseAnalyticsConsent(serializeAnalyticsConsent("denied")), "denied");
    assert.equal(parseAnalyticsConsent('{"version":0,"status":"granted"}'), "unknown");
    assert.equal(parseAnalyticsConsent("invalid"), "unknown");
  });

  it("requires both the feature flag and a project token", () => {
    assert.equal(analyticsConfigIsValid({ enabled: "true", token: "phc_test" }), true);
    assert.equal(analyticsConfigIsValid({ enabled: "false", token: "phc_test" }), false);
    assert.equal(analyticsConfigIsValid({ enabled: "true", token: "" }), false);
  });
});

describe("analytics data minimization", () => {
  it("keeps only safe campaign query parameters", () => {
    assert.equal(
      sanitizeAnalyticsUrl("https://chessview.org/en/events?email=person@example.com&utm_source=newsletter&utm_campaign=summer#private"),
      "https://chessview.org/en/events?utm_source=newsletter&utm_campaign=summer"
    );
    assert.equal(
      sanitizeAnalyticsUrl("https://chessview.org/en?utm_campaign=person@example.com"),
      "https://chessview.org/en"
    );
  });

  it("normalizes curated properties and never sends raw searches or outbound URLs", () => {
    const payload = normalizeAnalyticsPayload(
      {
        routeType: "events",
        entityType: "event",
        entityId: "event-123",
        entityTitle: "A person's private title",
        outboundUrl: "https://organizer.example/register?email=person@example.com",
        filters: { search: "Jane Doe", country: "IT", unexpected: "private" },
        metadata: {
          placement: "event_card",
          visitorRole: "organizer",
          visitPurpose: "organize_event",
          unexpected: "private",
          email: "person@example.com",
        },
      },
      { pathname: "/en/events", search: "?utm_medium=email&token=secret" }
    );

    assert.deepEqual(payload, {
      route_type: "events",
      locale: "en",
      entity_type: "event",
      entity_id: "event-123",
      outbound_host: "organizer.example",
      filter_search: "used",
      filter_country: "IT",
      meta_placement: "event_card",
      meta_visitor_role: "organizer",
      meta_visit_purpose: "organize_event",
      utm_medium: "email",
    });
  });

  it("sanitizes automatic PostHog URL properties and removes person properties", () => {
    const properties = sanitizePostHogProperties({
      token: "phc_public_project_token",
      $current_url: "https://chessview.org/it/events?query=name&utm_source=search#fragment",
      $referrer: "https://example.com/path?person=private",
      $pathname: "/it/events?query=private",
      $title: "Private title",
      title: "Another private title",
      $set: { email: "person@example.com" },
      email: "person@example.com",
      $raw_user_agent: "Detailed private user agent",
      $session_entry_referrer: "$direct",
      $session_entry_url: "https://chessview.org/it/events?email=private&utm_campaign=safe&utm_content=drop",
      $session_entry_utm_content: "drop",
      $heatmap_data: {
        "https://chessview.org/it/events?email=private&utm_source=safe": [{ x: 1, y: 2 }],
      },
      $browser: "Firefox",
    });

    assert.deepEqual(properties, {
      token: "phc_public_project_token",
      $current_url: "https://chessview.org/it/events?utm_source=search",
      $referrer: "https://example.com/path",
      $pathname: "/it/events",
      $session_entry_referrer: "$direct",
      $session_entry_url: "https://chessview.org/it/events?utm_campaign=safe",
      $heatmap_data: {
        "https://chessview.org/it/events?utm_source=safe": [{ x: 1, y: 2 }],
      },
      $browser: "Firefox",
    });
  });

  it("classifies current localized routes", () => {
    assert.equal(trackingRouteTypeFor("/it/maps"), "coverage");
    assert.equal(trackingRouteTypeFor("/es/events/abc"), "event_detail");
    assert.equal(trackingRouteTypeFor("/en/privacy"), "legal");
  });

  it("removes replay network queries, paths, headers, and bodies", () => {
    assert.deepEqual(
      sanitizeReplayNetworkRequest({
        duration: 42,
        method: "POST",
        name: "https://api.chessview.org/private/reset/token-value?email=person@example.com",
        requestBody: '{"email":"person@example.com"}',
        requestHeaders: { authorization: "Bearer secret" },
        responseBody: "private response",
        responseHeaders: { "set-cookie": "private" },
        status: 200,
      }),
      {
        duration: 42,
        method: "POST",
        name: "https://api.chessview.org",
        status: 200,
      }
    );
  });
});

describe("anonymous research survey", () => {
  it("requires consent, two pageviews, thirty seconds, and a completed cooldown", () => {
    const now = Date.parse("2026-07-22T12:00:00.000Z");
    assert.equal(shouldShowResearchSurvey({ consent: "granted", elapsedMs: 30_000, pageviews: 2, now }), true);
    assert.equal(shouldShowResearchSurvey({ consent: "denied", elapsedMs: 30_000, pageviews: 2, now }), false);
    assert.equal(shouldShowResearchSurvey({ consent: "granted", elapsedMs: 29_999, pageviews: 2, now }), false);
    assert.equal(shouldShowResearchSurvey({ consent: "granted", elapsedMs: 30_000, pageviews: 1, now }), false);
    assert.equal(
      shouldShowResearchSurvey({ consent: "granted", elapsedMs: 30_000, pageviews: 2, now, lastShownAt: "2026-07-01T12:00:00.000Z" }),
      false
    );
    assert.equal(
      shouldShowResearchSurvey({ consent: "granted", elapsedMs: 30_000, pageviews: 2, now, lastShownAt: "2026-01-01T12:00:00.000Z" }),
      true
    );
  });
});
