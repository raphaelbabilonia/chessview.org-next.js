import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eventListHasQueryState } from "../../src/lib/event-list-query.js";
import { metadataForPublicDisplay, organizerNameForPublicDisplay } from "../../src/lib/public-event.js";
import {
  MAX_SITEMAP_URLS,
  coreSitemapEntries,
  eligibleSitemapEvents,
  renderUrlSitemap,
  sitemapDescriptors,
  sitemapEntriesForId,
} from "../../src/lib/sitemaps.js";

const sitemapEvent = (index, overrides = {}) => ({
  _id: `event-${index}`,
  title: `Event ${index}`,
  slug: `event-${index}`,
  city: "Torino",
  country: "Italy",
  startDate: "2026-09-01T09:00:00.000Z",
  endDate: "2026-09-02T18:00:00.000Z",
  updatedAt: "2026-08-26T08:00:00.000Z",
  indexable: true,
  websiteUrl: `https://organizer.example/events/${index}`,
  source: { name: "Fixture Federation", url: `https://organizer.example/events/${index}` },
  ...overrides,
});

describe("growth release-zero SEO controls", () => {
  it("marks any filtered or paginated event-list state for noindex handling", () => {
    assert.equal(eventListHasQueryState({}), false);
    assert.equal(eventListHasQueryState({ country: "" }), false);
    assert.equal(eventListHasQueryState({ country: "Italy" }), true);
    assert.equal(eventListHasQueryState({ page: "2" }), true);
    assert.equal(eventListHasQueryState({ sort: ["updated"] }), true);
  });

  it("requires the backend indexability decision plus dates, location, and attribution", () => {
    const valid = sitemapEvent(1);
    const events = [
      valid,
      sitemapEvent(2, { indexable: false }),
      sitemapEvent(3, { city: "", country: "" }),
      sitemapEvent(4, { indexable: false, websiteUrl: "", source: { name: "Unknown", url: "" } }),
      sitemapEvent(5, { startDate: "not-a-date" }),
    ];
    assert.deepEqual(eligibleSitemapEvents(events), [valid]);
  });

  it("partitions locale event sitemaps at 5,000 URLs and uses stable record timestamps", () => {
    const events = Array.from({ length: MAX_SITEMAP_URLS + 1 }, (_, index) => sitemapEvent(index));
    const descriptors = sitemapDescriptors(events);
    const english = descriptors.filter((descriptor) => descriptor.id.startsWith("events-en-"));
    assert.equal(english.length, 2);
    assert.equal(english[0].lastModified, "2026-08-26T08:00:00.000Z");

    const first = sitemapEntriesForId(events, "events-en-0.xml");
    const second = sitemapEntriesForId(events, "events-en-1.xml");
    assert.equal(first.length, MAX_SITEMAP_URLS);
    assert.equal(second.length, 1);
    assert.equal((renderUrlSitemap(first).match(/<url>/g) || []).length, MAX_SITEMAP_URLS);
  });

  it("includes aggregate utility routes only when at least five eligible events support them", () => {
    const four = Array.from({ length: 4 }, (_, index) => sitemapEvent(index));
    const five = [...four, sitemapEvent(4)];
    assert.equal(coreSitemapEntries(four).some((entry) => entry.url.includes("/countries/italy")), false);
    assert.equal(coreSitemapEntries(five).some((entry) => entry.url.includes("/countries/italy")), true);
    assert.equal(coreSitemapEntries(five).some((entry) => entry.url.includes("/sources/fixture-federation")), true);
  });
});

describe("growth release-zero public rendering", () => {
  it("removes operational evidence recursively from metadata", () => {
    assert.deepEqual(
      metadataForPublicDisplay({
        format: { timeControl: "classical", internal: "private" },
        logistics: { city: "Torino", raw: "private" },
        sourceAudit: { sourcesVisited: ["private"] },
        reviewEvidence: { reviewer: "private" },
        extraFacts: [{ label: "Rounds", value: 9, debug: "private" }],
      }),
      {
        format: { timeControl: "classical" },
        logistics: { city: "Torino" },
        extraFacts: [{ label: "Rounds", value: 9 }],
      }
    );
  });

  it("prefers the source organizer and never presents an agent publisher as the organizer", () => {
    assert.equal(
      organizerNameForPublicDisplay({
        sourceOrganizerName: "Torino Chess Club",
        organizer: { name: "ChessView Agent Publisher" },
      }),
      "Torino Chess Club"
    );
    assert.equal(organizerNameForPublicDisplay({ organizer: { name: "ChessView Agent Publisher" } }), "");
    assert.equal(organizerNameForPublicDisplay({ organizer: { name: "Human Organizer" } }), "Human Organizer");
  });
});
