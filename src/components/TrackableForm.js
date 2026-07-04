"use client";

import { trackAnalyticsEvent } from "@/lib/tracking";

const allowedFilters = new Set(["search", "city", "country", "source", "status", "from", "to"]);

const safeFilterValue = (name, value) => {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (name === "search") return "used";
  return clean.slice(0, 120);
};

const filtersFromForm = (form) => {
  const data = new FormData(form);
  const filters = {};

  for (const [name, value] of data.entries()) {
    if (!allowedFilters.has(name)) continue;
    const clean = safeFilterValue(name, value);
    if (clean) filters[name] = clean;
  }

  return filters;
};

export function TrackableForm({ children, eventName, routeType, ...props }) {
  const onSubmit = (event) => {
    trackAnalyticsEvent(eventName, {
      routeType,
      filters: filtersFromForm(event.currentTarget),
    });
  };

  return (
    <form {...props} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
