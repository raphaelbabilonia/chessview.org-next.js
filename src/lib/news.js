import { apiFetch } from "./api";

const NEWS_REVALIDATE_SECONDS = 60;

export const hasRequiredNewsImage = (item) =>
  typeof item?.imageUrl === "string" && /^https?:\/\/\S+/i.test(item.imageUrl.trim());

export const displayAuthor = (author) => {
  const name = String(author || "").trim();
  return /^[\p{Ll}\d]+(?:[._-][\p{Ll}\d]+)*$/u.test(name) ? "" : name;
};

const requireNewsImages = (result) => {
  if (!Array.isArray(result.data)) return result;

  const data = result.data.filter(hasRequiredNewsImage);
  return {
    ...result,
    data,
    meta: result.meta
      ? {
          ...result.meta,
          count: data.length,
          total: Math.max((Number(result.meta.total) || 0) - (result.data.length - data.length), data.length),
        }
      : result.meta,
  };
};

export const getNewsItems = async (filters = {}) =>
  requireNewsImages(await apiFetch("/news", {
    searchParams: filters,
    revalidate: NEWS_REVALIDATE_SECONDS,
    fallback: []
  }));

export const getFeaturedNews = (limit = 6) => getNewsItems({ limit });

export const getNewsSources = () =>
  apiFetch("/news/sources", {
    revalidate: NEWS_REVALIDATE_SECONDS,
    fallback: []
  });
