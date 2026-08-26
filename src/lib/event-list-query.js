const indexedEventListPath = "/events";

export const eventListHasQueryState = (searchParams = {}) =>
  Object.values(searchParams || {}).some((value) => {
    const first = Array.isArray(value) ? value[0] : value;
    return String(first || "").trim().length > 0;
  });

export const eventListCanonicalPath = () => indexedEventListPath;
