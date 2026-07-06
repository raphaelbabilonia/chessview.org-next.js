const DEFAULT_API_BASE_URL = "http://127.0.0.1:5000/api";

const trimTrailingSlash = (value) => String(value || "").replace(/\/+$/, "");

const apiBaseUrl = trimTrailingSlash(process.env.API_BASE_URL || DEFAULT_API_BASE_URL);
const backendBaseUrl = apiBaseUrl.replace(/\/api$/, "");
const isProduction = process.env.NODE_ENV === "production";

const cleanParams = (params = {}) =>
  Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
      .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
  );

export async function apiFetch(path, { searchParams, revalidate = 120, fallback = null } = {}) {
  const url = new URL(`${apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  Object.entries(cleanParams(searchParams)).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const fetchOptions = {
      headers: {
        Accept: "application/json",
      },
    };

    if (isProduction) {
      fetchOptions.next = { revalidate };
    } else {
      fetchOptions.cache = "no-store";
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      return {
        data: fallback,
        meta: null,
        error: `API request failed with status ${response.status}`,
        status: response.status,
        notFound: response.status === 404,
      };
    }

    const payload = await response.json();
    return {
      data: payload?.data ?? fallback,
      meta: payload?.meta ?? null,
      error: null,
      status: response.status,
      notFound: false,
    };
  } catch (error) {
    return {
      data: fallback,
      meta: null,
      error: error.message,
      status: 0,
      notFound: false,
    };
  }
}

export const getEvents = (filters = {}) =>
  apiFetch("/events", {
    searchParams: filters,
    revalidate: 120,
    fallback: [],
  });

export const todayIsoDate = (date = new Date()) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())).toISOString().slice(0, 10);

export const getUpcomingEvents = (filters = {}) =>
  getEvents({
    activeFrom: todayIsoDate(),
    limit: 100,
    ...filters,
  });

export const getEvent = (id) =>
  apiFetch(`/events/${encodeURIComponent(id)}`, {
    revalidate: 60,
    fallback: null,
  });

export const getTrackingDashboard = (code, days = 30) =>
  apiFetch(`/tracking/dashboard/${encodeURIComponent(code)}`, {
    searchParams: { days, rollup: "true" },
    revalidate: 0,
    fallback: null,
  });

export const backendAssetUrl = (value = "") => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  return `${backendBaseUrl}${value.startsWith("/") ? value : `/${value}`}`;
};
