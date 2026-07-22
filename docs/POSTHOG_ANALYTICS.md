# ChessView PostHog Cloud EU Runbook

Updated: 2026-07-22

Do not place production analytics exports, PostHog personal API keys, account credentials, or visitor data in this public repository.

## Production configuration

- Organization: `ChessView`
- Project: `ChessView.org` (EU Cloud, project ID `230204`)
- Plan: capped Free plan with no payment method
- IP storage: discarded
- Public SDK person profiles: `never` (stricter than `identified_only`; named-user analytics is out of scope)
- Session replay: total privacy masking, console capture off, canvas capture off, network capture off, headers and bodies off
- Replay retention: 30 days
- Ingestion: first-party `/ingest` proxy to PostHog EU
- Capture: opt-out by default and enabled only after explicit consent

The private, aggregate-only legacy snapshot is stored outside the repositories. Raw legacy events, visitor hashes, and session hashes were not migrated.

## Deployment variables

The `chessview.org-next.js` GitHub repository uses:

- `NEXT_PUBLIC_ANALYTICS_ENABLED=true`
- `NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=<public EU project token>`

The ingestion host is fixed to `/ingest` by the deployment workflow.

## Dashboards

- [Acquisition](https://eu.posthog.com/project/230204/dashboard/841169)
- [Tournament discovery](https://eu.posthog.com/project/230204/dashboard/841174)
- [Organizer and contributor interest](https://eu.posthog.com/project/230204/dashboard/841177)
- [Experience quality](https://eu.posthog.com/project/230204/dashboard/841178)

Populate dashboard insights after production events establish the event schema.

### Acquisition

- Unique sessions and anonymous visitors from `$pageview`.
- Breakdowns: `$referring_domain`, whitelisted UTM fields, country, device, landing page, and `locale`.
- Exclude PostHog-detected bots.

### Tournament discovery

- Funnel: `$pageview` with `route_type=home|events|coverage` -> `events_filter_apply` or `coverage_filter_change` -> `event_view_details` or `coverage_event_open` -> `event_original_click`.
- Break down completion by country, device, referrer, locale, and safe `filter_*` properties.
- Add a path insight from events/coverage pages to `event_original_click`.

### Organizer and contributor interest

- Funnel: `$pageview` -> `collaboration_entry_click` -> a collaboration resource/repository event.
- Trend the anonymous survey submission event by whitelisted role and purpose codes.
- Keep organizer cohorts aggregate-only.

### Experience quality

- Track `$rageclick`, `$dead_click`, Web Vitals, `coverage_map_3d_error`, `coverage_map_renderer_fallback`, and `coverage_map_quality_reduce`.
- Review replay masking before relying on production recordings. Stop replay immediately if unmasked content appears.

## First 14 days

- Confirm no events before consent or after rejection/withdrawal.
- Confirm exactly one `$pageview` per navigation and no legacy tracking API requests.
- Check that Live Events and replay contain no names, emails, search terms, full outbound URLs, arbitrary query parameters, form content, console logs, or network payloads.
- Review consent rate, bot rate, event volume, replay volume, duplicate rate, and survey frequency.
- Keep billing disabled until real usage is understood.

Legal review of the published EN/IT/ES disclosures remains an organizational responsibility and should be documented outside this repository.
