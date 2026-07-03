import { apiFetch } from "./api";

const NEWS_REVALIDATE_SECONDS = 900;

export const getNewsItems = (filters = {}) =>
  apiFetch("/news", {
    searchParams: filters,
    revalidate: NEWS_REVALIDATE_SECONDS,
    fallback: []
  });

export const getFeaturedNews = (limit = 6) => getNewsItems({ limit });

export const getNewsSources = () =>
  apiFetch("/news/sources", {
    revalidate: NEWS_REVALIDATE_SECONDS,
    fallback: []
  });
