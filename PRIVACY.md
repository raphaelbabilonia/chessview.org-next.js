# ChessView Privacy and Analytics Policy

Last updated: 2026-07-22

This policy is an implementation baseline for the official ChessView hosted service. It must be reviewed by a qualified lawyer before commercial launch, especially where EU/EEA personal data or information about minors is processed.

## Service Information

ChessView may process account, organizer, tournament, registration, public contribution, support, security, and service-operation information when those features are used. Some tournament, player, pairing, standings, and result information may be displayed publicly when submitted by organizers or collected from public sources. Organizers are responsible for the rights and legal basis required to submit personal data, especially information about minors.

## Website Analytics

ChessView activates website analytics by default unless a visitor has enabled Do Not Track or previously disabled analytics. Disabling analytics does not limit access to the site.

While analytics is active, ChessView uses PostHog Cloud EU to process:

- Query-free page paths and safe UTM campaign values.
- Coarse device, browser, referrer, and location information.
- Curated interactions with tournament, news, map, language, theme, and collaboration features.
- Anonymous multiple-choice research survey responses.
- A strongly masked technical reconstruction of selected browsing sessions.

ChessView configures its client not to send names, email addresses, form values, search text, page text, full outbound URLs, arbitrary query parameters, console logs, request bodies, request headers, fonts, or cross-origin frames. IP data must be configured for discard in the PostHog project.

All text and inputs are masked in session replay. Forms, elements marked private, and any future authenticated surfaces are excluded from recording.

## Purpose and Choice

Analytics is used to improve tournament discovery, understand organizer and contributor interest, diagnose usability and performance problems, and evaluate content. Visitors can disable it at any time.

## Provider, Region, and Retention

PostHog acts as an analytics service provider. ChessView uses PostHog's EU cloud region in Frankfurt. Analytics retention is limited to the configured PostHog project retention period, initially one year or less.

## Cookies and Local Storage

A technical local-storage record remembers when analytics is disabled. While analytics is active, PostHog may use first-party cookies or local storage to maintain an anonymous visitor and session identifier. Disabling analytics stops capture and clears PostHog browser persistence.

Visitors can open **Analytics controls** on the Terms page at any time to disable or re-enable analytics. ChessView also respects Do Not Track.

## Anonymous Research Survey

Visitors with analytics active may see an optional survey asking only about their chess role and visit purpose. It requests no name, contact details, or free text and appears at most once every 90 days.

## Rights and Contact

Depending on location, visitors may have rights to access, correct, delete, export, restrict, or object to processing of personal data. Contact the ChessView project owner to exercise these rights or ask a privacy question.

No online service can guarantee perfect security. ChessView applies data minimization, masking, access controls, and reasonable technical and organizational safeguards.
