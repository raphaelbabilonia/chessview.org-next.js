export const byId = (items = []) =>
  items.reduce((map, item) => {
    map[item._id] = item;
    return map;
  }, {});

export const playerName = (player, fallback = "Not paired") => {
  if (!player) return fallback;
  return `${player.firstName || ""} ${player.lastName || ""}`.trim();
};

export const resultLabel = (result, labels = {}) =>
  labels[result] ||
  ({
    pending: "Pending",
    "1-0": "1-0",
    "0-1": "0-1",
    "1/2-1/2": "1/2",
    "bye-white": "White bye",
    "bye-black": "Black bye",
    "half-bye": "Half-point bye",
    "zero-bye": "Zero-point bye",
    "forfeit-white": "White forfeits",
    "forfeit-black": "Black forfeits",
  })[result] || result;

export const eventHref = (event) => `/events/${event.slug || event._id}`;

export const localizedEventHref = (locale, event) => `/${locale}${eventHref(event)}`;

export const slugifySegment = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);

export const countryHref = (country) => `/countries/${slugifySegment(country || "global")}`;

export const sourceHref = (sourceName) => `/sources/${slugifySegment(sourceName || "unknown")}`;
