import { NextResponse } from "next/server";

const locales = ["en", "es", "it"];
const defaultLocale = "en";
const localeCookie = "chessview_locale";
const oneYear = 60 * 60 * 24 * 365;

const localeFromPath = (pathname) => {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  return locales.includes(firstSegment) ? firstSegment : null;
};

const localeFromAcceptLanguage = (header = "") => {
  const parsed = header
    .split(",")
    .map((item) => {
      const [tag, ...params] = item.trim().split(";");
      const q = params
        .map((param) => param.trim())
        .find((param) => param.startsWith("q="))
        ?.slice(2);
      return {
        locale: tag.toLowerCase().split("-")[0],
        quality: q ? Number(q) : 1,
      };
    })
    .filter((item) => locales.includes(item.locale))
    .sort((a, b) => b.quality - a.quality);

  return parsed[0]?.locale || defaultLocale;
};

const preferredLocale = (request) => {
  const cookieLocale = request.cookies.get(localeCookie)?.value;
  if (locales.includes(cookieLocale)) return cookieLocale;
  return localeFromAcceptLanguage(request.headers.get("accept-language") || "");
};

const rememberLocale = (response, locale) => {
  response.cookies.set(localeCookie, locale, {
    path: "/",
    maxAge: oneYear,
    sameSite: "lax",
  });
  return response;
};

const redirectToLocale = (request, locale, pathname) => {
  const url = request.nextUrl.clone();
  url.pathname = pathname === "/" ? `/${locale}` : `/${locale}${pathname}`;
  return rememberLocale(NextResponse.redirect(url), locale);
};

export function proxy(request) {
  const { pathname } = request.nextUrl;
  const pathLocale = localeFromPath(pathname);

  if (pathLocale) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-chessview-locale", pathLocale);

    return rememberLocale(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
      pathLocale
    );
  }

  if (
    pathname === "/" ||
    pathname === "/coverage" ||
    pathname === "/events" ||
    pathname.startsWith("/events/") ||
    pathname === "/news"
  ) {
    return redirectToLocale(request, preferredLocale(request), pathname);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)"],
};
