import { geoCentroid, geoEqualEarth, geoGraticule10, geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import { formatCountryName } from "@/lib/format";
import { countryHref, localizedEventHref, slugifySegment } from "@/lib/tournament";

export const coverageMapSize = {
  width: 960,
  height: 480,
};

const todayStartUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const validDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const dayKey = (date) => date.toISOString().slice(0, 10);

const normalizeText = (value) =>
  String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const cleanCountry = (value) => {
  const country = String(value || "").trim();
  if (!country) return "";
  const key = normalizeText(country);

  return (
    {
      america: "United States",
      "cote d ivoire": "Ivory Coast",
      czechia: "Czech Republic",
      "hong kong china": "Hong Kong, China",
      usa: "United States",
      us: "United States",
      "united states of america": "United States",
      uk: "United Kingdom",
    }[key] || country
  );
};

const countryAlias = {
  Andorra: { atlasName: "Andorra", flagCode: "ad" },
  Argentina: { atlasName: "Argentina", flagCode: "ar" },
  Austria: { atlasName: "Austria", flagCode: "at" },
  Belgium: { atlasName: "Belgium", flagCode: "be" },
  Brazil: { atlasName: "Brazil", flagCode: "br" },
  Bulgaria: { atlasName: "Bulgaria", flagCode: "bg" },
  Canada: { atlasName: "Canada", flagCode: "ca" },
  Colombia: { atlasName: "Colombia", flagCode: "co" },
  Croatia: { atlasName: "Croatia", flagCode: "hr" },
  "Czech Republic": { atlasName: "Czechia", flagCode: "cz" },
  England: {
    atlasName: "United Kingdom",
    coordinates: [-1.9, 52.6],
    flagCode: "gb-eng",
    focusFeatureName: "United Kingdom",
  },
  Finland: { atlasName: "Finland", flagCode: "fi" },
  France: { atlasName: "France", flagCode: "fr" },
  Georgia: { atlasName: "Georgia", flagCode: "ge" },
  Germany: { atlasName: "Germany", flagCode: "de" },
  Greece: { atlasName: "Greece", flagCode: "gr" },
  "Hong Kong, China": { atlasName: "China", coordinates: [114.1694, 22.3193], flagCode: "hk" },
  Hungary: { atlasName: "Hungary", flagCode: "hu" },
  India: { atlasName: "India", flagCode: "in" },
  Italy: { atlasName: "Italy", flagCode: "it" },
  "Ivory Coast": { atlasName: "Côte d'Ivoire", flagCode: "ci" },
  Latvia: { atlasName: "Latvia", flagCode: "lv" },
  Mexico: { atlasName: "Mexico", flagCode: "mx" },
  Monaco: { atlasName: "Monaco", flagCode: "mc" },
  Montenegro: { atlasName: "Montenegro", flagCode: "me" },
  Netherlands: { atlasName: "Netherlands", flagCode: "nl" },
  Nigeria: { atlasName: "Nigeria", flagCode: "ng" },
  Poland: { atlasName: "Poland", flagCode: "pl" },
  Portugal: { atlasName: "Portugal", flagCode: "pt" },
  "Puerto Rico": { atlasName: "Puerto Rico", flagCode: "pr" },
  Romania: { atlasName: "Romania", flagCode: "ro" },
  Serbia: { atlasName: "Serbia", flagCode: "rs" },
  Singapore: { atlasName: "Singapore", flagCode: "sg" },
  Slovakia: { atlasName: "Slovakia", flagCode: "sk" },
  Spain: { atlasName: "Spain", flagCode: "es" },
  Sweden: { atlasName: "Sweden", flagCode: "se" },
  Switzerland: { atlasName: "Switzerland", flagCode: "ch" },
  "United Kingdom": { atlasName: "United Kingdom", flagCode: "gb" },
  "United States": { atlasName: "United States of America", flagCode: "us" },
  Uruguay: { atlasName: "Uruguay", flagCode: "uy" },
  Uzbekistan: { atlasName: "Uzbekistan", flagCode: "uz" },
  Wales: {
    atlasName: "United Kingdom",
    coordinates: [-3.8, 52.3],
    flagCode: "gb-wls",
    focusFeatureName: "United Kingdom",
  },
};

const locationRows = [
  ["Toluca", "Mexico", "Estado de Mexico", [-99.6557, 19.2826]],
  ["Amelia", "Italy", "Umbria", [12.415, 42.552]],
  ["Cuneo", "Italy", "Piemonte", [7.551, 44.384]],
  ["Forio", "Italy", "Campania", [13.8616, 40.7355]],
  ["Montesilvano", "Italy", "Abruzzo", [14.149, 42.51]],
  ["Piacenza", "Italy", "Emilia-Romagna", [9.6929, 45.0526]],
  ["Turbigo", "Italy", "Lombardia", [8.7369, 45.5302]],
  ["Bellevue", "United States", "Washington", [-122.2007, 47.6101]],
  ["Camas", "United States", "Washington", [-122.3995, 45.5871]],
  ["Saint Louis", "United States", "Missouri", [-90.1994, 38.627]],
  ["Saint Louis, Missouri", "United States", "Missouri", [-90.1994, 38.627]],
  ["London", "England", "Greater London", [-0.1276, 51.5072]],
  ["Bridgend", "Wales", "South Wales", [-3.5769, 51.5043]],
  ["Amsterdam", "Netherlands", "Noord-Holland", [4.9041, 52.3676]],
  ["Dieren", "Netherlands", "Gelderland", [6.099, 52.052]],
  ["Hillegom", "Netherlands", "Zuid-Holland", [4.5831, 52.2908]],
  ["Rosmalen", "Netherlands", "Noord-Brabant", [5.365, 51.716]],
  ["Weesp", "Netherlands", "Noord-Holland", [5.0415, 52.3075]],
  ["München", "Germany", "Bavaria", [11.582, 48.1351]],
  ["Munich", "Germany", "Bavaria", [11.582, 48.1351]],
  ["Münster", "Germany", "North Rhine-Westphalia", [7.6261, 51.9607]],
  ["Berlin-Spandau", "Germany", "Berlin", [13.1977, 52.5358]],
  ["Gütersloh", "Germany", "North Rhine-Westphalia", [8.3858, 51.9069]],
  ["Oberding", "Germany", "Bavaria", [11.854, 48.316]],
  ["Budapest", "Hungary", "Central Hungary", [19.0402, 47.4979]],
  ["Benidorm", "Spain", "Valencian Community", [-0.1303, 38.5411]],
  ["Binissalem", "Spain", "Balearic Islands", [2.843, 39.687]],
  ["Barcelona", "Spain", "Catalonia", [2.1734, 41.3851]],
  ["LEON", "Spain", "Castile and Leon", [-5.5671, 42.5987]],
  ["Leon", "Spain", "Castile and Leon", [-5.5671, 42.5987]],
  ["Lugo", "Spain", "Galicia", [-7.5559, 43.0097]],
  ["Pontevedra", "Spain", "Galicia", [-8.6444, 42.431]],
  ["Sitges", "Spain", "Catalonia", [1.8113, 41.2372]],
  ["Valdepeñas", "Spain", "Castilla-La Mancha", [-3.3844, 38.7621]],
  ["Paris", "France", "Ile-de-France", [2.3522, 48.8566]],
  ["Aix-En-Provence", "France", "Provence-Alpes-Cote d'Azur", [5.4474, 43.5297]],
  ["Les Menuires", "France", "Auvergne-Rhone-Alpes", [6.5385, 45.324]],
  ["Quenza", "France", "Corsica", [9.168, 41.767]],
  ["Basel", "Switzerland", "Basel-Stadt", [7.5886, 47.5596]],
  ["Grächen", "Switzerland", "Valais", [7.838, 46.195]],
  ["Schaffhausen", "Switzerland", "Schaffhausen", [8.6349, 47.6959]],
  ["Senta", "Serbia", "Vojvodina", [20.0792, 45.9275]],
  ["Belgrade", "Serbia", "Belgrade", [20.4489, 44.7866]],
  ["Beograd", "Serbia", "Belgrade", [20.4489, 44.7866]],
  ["Pozarevac", "Serbia", "Branicevo", [21.1878, 44.6213]],
  ["Apatin", "Serbia", "Vojvodina", [18.9843, 45.6726]],
  ["Banja", "Serbia", "Central Serbia", [20.545, 43.295]],
  ["Pardubice", "Czech Republic", "Pardubice Region", [15.7806, 50.0343]],
  ["Prague", "Czech Republic", "Prague", [14.4378, 50.0755]],
  ["Rhodes", "Greece", "South Aegean", [28.2278, 36.4341]],
  ["Kavala", "Greece", "Eastern Macedonia and Thrace", [24.4129, 40.9376]],
  ["Paleochora Creta Island", "Greece", "Crete", [23.681, 35.2308]],
  ["Aghios Kirykos, Ikaria island", "Greece", "North Aegean", [26.2944, 37.6148]],
  ["Batumi", "Georgia", "Adjara", [41.6367, 41.6168]],
  ["Poti", "Georgia", "Samegrelo-Zemo Svaneti", [41.6718, 42.1462]],
  ["Bhilwara", "India", "Rajasthan", [74.6313, 25.3463]],
  ["Udaipur", "India", "Rajasthan", [73.7125, 24.5854]],
  ["Dubrovnik", "Croatia", "Dubrovnik-Neretva", [18.0944, 42.6507]],
  ["Hvar", "Croatia", "Split-Dalmatia", [16.441, 43.1729]],
  ["Bratislava", "Slovakia", "Bratislava Region", [17.1077, 48.1486]],
  ["Singapore", "Singapore", "Singapore", [103.8198, 1.3521]],
  ["Chess.sg Clubhouse", "Singapore", "Singapore", [103.8198, 1.3521]],
  ["Club Bella Vista", "Uruguay", "Montevideo", [-56.1645, -34.9011]],
  ["Montevideo", "Uruguay", "Montevideo", [-56.1645, -34.9011]],
  ["Libreria Puro Verso / 18 de Julio 1199 / montevideo", "Uruguay", "Montevideo", [-56.1645, -34.9011]],
  ["Imperatriz", "Brazil", "Maranhao", [-47.491, -5.5264]],
  ["Altos Miramar Avenida 37 N 963 (Miramar)", "Argentina", "Buenos Aires Province", [-57.842, -38.2716]],
  ["Liga Santandereana de Ajedrez (Carrera 31 14", "Colombia", "Santander", [-73.1198, 7.1193]],
  ["Hotel Silver Moon Angre 7e tranche", "Ivory Coast", "Abidjan", [-4.0083, 5.36]],
  ["Pavilhao Municipal da Torre da Marinha", "Portugal", "Setubal", [-9.1015, 38.651]],
  ["Famalicão", "Portugal", "Braga", [-8.5198, 41.4076]],
  ["Ottawa", "Canada", "Ontario", [-75.6972, 45.4215]],
  ["Escaldes-Engordany", "Andorra", "Escaldes-Engordany", [1.5341, 42.5085]],
  ["Samarkand", "Uzbekistan", "Samarqand", [66.9749, 39.6542]],
  ["Gent", "Belgium", "Flanders", [3.7174, 51.0543]],
  ["Brasov", "Romania", "Transylvania", [25.5887, 45.6427]],
  ["Budva", "Montenegro", "Budva", [18.8403, 42.2911]],
  ["Rzeszow", "Poland", "Subcarpathian", [22.0047, 50.0413]],
  ["Wroclaw", "Poland", "Lower Silesian", [17.0385, 51.1079]],
  ["Abuja", "Nigeria", "Federal Capital Territory", [7.3986, 9.0765]],
  ["Shumen", "Bulgaria", "Shumen", [26.9294, 43.2712]],
  ["Jönköping", "Sweden", "Jonkoping County", [14.1618, 57.7826]],
  ["Stockholm", "Sweden", "Stockholm County", [18.0686, 59.3293]],
  ["Jyväskylä", "Finland", "Central Finland", [25.7473, 62.2426]],
  ["Mayrhofen / St. Veit/Glan", "Austria", "Carinthia", [14.36, 46.768]],
  ["St. Veit an der Glan", "Austria", "Carinthia", [14.36, 46.768]],
  ["Ruden", "Austria", "Carinthia", [14.77, 46.66]],
  ["Monaco", "Monaco", "Monaco", [7.4246, 43.7384]],
  ["Bayamon", "Puerto Rico", "Bayamon", [-66.1557, 18.3985]],
];

const locationByCityAndCountry = new Map();
const locationByCity = new Map();

for (const [city, country, region, coordinates] of locationRows) {
  const item = {
    city,
    country: cleanCountry(country),
    region,
    coordinates,
  };
  locationByCityAndCountry.set(`${normalizeText(city)}|${normalizeText(country)}`, item);
  if (!locationByCity.has(normalizeText(city))) {
    locationByCity.set(normalizeText(city), item);
  }
}

const landFeature = feature(worldAtlas, worldAtlas.objects.land);
const countryFeatures = feature(worldAtlas, worldAtlas.objects.countries).features;
const featureByName = new Map(countryFeatures.map((country) => [country.properties.name, country]));

const worldProjection = geoEqualEarth().fitExtent(
  [
    [62, 38],
    [898, 438],
  ],
  { type: "Sphere" },
);
const worldPath = geoPath(worldProjection);

export const coverageMapPaths = {
  graticule: worldPath(geoGraticule10()),
  land: worldPath(landFeature),
  sphere: worldPath({ type: "Sphere" }),
};

const statusIsVisible = (event) => {
  const status = String(event.status || "").toLowerCase();
  return !["archived", "cancelled", "canceled", "draft", "rejected"].includes(status);
};

const eventEndDate = (event) => validDate(event.endDate) || validDate(event.startDate);
const eventStartDate = (event) => validDate(event.startDate) || validDate(event.endDate);

const isActiveOrUpcoming = (event, today = todayStartUtc()) => {
  const endDate = eventEndDate(event);
  if (!endDate || !statusIsVisible(event)) return false;
  return dayKey(endDate) >= dayKey(today);
};

const locationFromEvent = (event) => {
  const country = cleanCountry(event.country || event.metadata?.logistics?.country || event.location?.country);
  const city = String(event.city || event.metadata?.logistics?.city || event.location?.city || "").trim();
  const directCoordinates = coordinatesFromEvent(event);
  const cityLocation =
    locationByCityAndCountry.get(`${normalizeText(city)}|${normalizeText(country)}`) ||
    locationByCity.get(normalizeText(city));

  return {
    city: city || cityLocation?.city || "",
    country: country || cityLocation?.country || "",
    region:
      String(
        event.region ||
          event.metadata?.logistics?.province ||
          event.metadata?.logistics?.region ||
          event.location?.region ||
          "",
      ).trim() ||
      cityLocation?.region ||
      "",
    coordinates: directCoordinates || cityLocation?.coordinates || null,
  };
};

function coordinatesFromEvent(event) {
  const candidates = [
    [event.longitude, event.latitude],
    [event.lng, event.lat],
    [event.location?.longitude, event.location?.latitude],
    [event.location?.lng, event.location?.lat],
    event.coordinates,
    event.location?.coordinates,
  ];

  for (const candidate of candidates) {
    if (!Array.isArray(candidate)) continue;
    const [lon, lat] = candidate.map(Number);
    if (Number.isFinite(lon) && Number.isFinite(lat)) return [lon, lat];
  }

  return null;
}

const classifyTournamentType = (event) => {
  const text = normalizeText(
    [
      event.timeControl,
      event.title,
      event.metadata?.format?.timeControl,
      event.metadata?.format?.timeControlCategory,
      event.metadata?.format?.speedLabel,
    ].join(" "),
  );

  if (/\b(blitz|bullet|snelschaak|5 min|5m|5 0|5\+|3 min|3m|3 0|3\+)\b/.test(text)) return "blitz";
  if (/\b(rapid|rapidschaak|rapidplay|rapido|rapida|15 min|15m|15 0|15\+|10 min|10m|10 0|10\+|25 min|25m)\b/.test(text)) {
    return "rapid";
  }
  if (/\b(classic|classical|standard|normaalschaak|long|90|60|fide rated|fide)\b/.test(text)) return "classical";
  return "other";
};

const countryInfo = (country) => countryAlias[country] || { atlasName: country, flagCode: "xx" };

const countryFeatureFor = (country) => {
  const info = countryInfo(country);
  return featureByName.get(info.focusFeatureName || info.atlasName) || featureByName.get(country) || null;
};

const countryMarkerFor = (country, count) => {
  const info = countryInfo(country);
  const atlasFeature = featureByName.get(info.atlasName) || featureByName.get(country);
  const coordinates = info.coordinates || (atlasFeature ? geoCentroid(atlasFeature) : null);
  const projected = coordinates ? worldProjection(coordinates) : null;

  if (!projected) return null;

  return {
    x: Number(projected[0].toFixed(2)),
    y: Number(projected[1].toFixed(2)),
    radius: Number(Math.max(8, Math.min(23, 7 + Math.sqrt(count) * 3.2)).toFixed(2)),
  };
};

const makeFlatMap = (country, events) => {
  const mapFeature = countryFeatureFor(country);
  const coordinateEvents = events.filter((event) => event.coordinates);
  const fitFeature =
    mapFeature ||
    (coordinateEvents.length
      ? {
          type: "MultiPoint",
          coordinates: coordinateEvents.map((event) => event.coordinates),
        }
      : null);

  if (!fitFeature) {
    return {
      paths: null,
      projection: null,
    };
  }

  const projection = geoMercator().fitExtent(
    [
      [62, 42],
      [898, 438],
    ],
    fitFeature,
  );
  const path = geoPath(projection);

  return {
    paths: {
      boundary: mapFeature ? path(mapFeature) : "",
      graticule: path(geoGraticule10()),
      land: mapFeature ? path(mapFeature) : "",
      sphere: path({ type: "Sphere" }),
    },
    projection,
  };
};

const sortEvents = (a, b) =>
  Number(b.liveNow) - Number(a.liveNow) ||
  String(a.startDate || "").localeCompare(String(b.startDate || "")) ||
  a.title.localeCompare(b.title);

const eventId = (event, index) => event._id || event.id || event.slug || `${event.title}-${event.startDate}-${index}`;

const normalizeEvent = (event, index, locale, today) => {
  const startDate = eventStartDate(event);
  const endDate = eventEndDate(event) || startDate;
  const location = locationFromEvent(event);
  const country = cleanCountry(location.country) || "Location TBA";
  const liveNow = Boolean(startDate && endDate && dayKey(startDate) <= dayKey(today) && dayKey(endDate) >= dayKey(today));
  const id = eventId(event, index);
  const hrefEvent = event.slug || event._id ? event : { ...event, slug: slugifySegment(`${event.title}-${event.startDate}`) };

  return {
    _id: id,
    city: location.city,
    coordinates: location.coordinates,
    country,
    href: localizedEventHref(locale, hrefEvent),
    liveNow,
    region: location.region || location.city || "Area TBA",
    sourceName: event.source?.name || event.sourceName || "",
    startDate: startDate?.toISOString() || "",
    endDate: endDate?.toISOString() || startDate?.toISOString() || "",
    timeControl: event.timeControl || event.metadata?.format?.timeControlCategory || event.metadata?.format?.timeControl || "",
    title: event.title || "Untitled tournament",
    tournamentType: classifyTournamentType(event),
  };
};

const markerFromProjected = (projected, index, totalAtPoint) => {
  const angle = (index / Math.max(totalAtPoint, 1)) * Math.PI * 2;
  const distance = totalAtPoint > 1 ? 15 + Math.floor(index / 8) * 6 : 0;

  return {
    x: Number((projected[0] + Math.cos(angle) * distance).toFixed(2)),
    y: Number((projected[1] + Math.sin(angle) * distance).toFixed(2)),
  };
};

const typeCounts = (events) =>
  events.reduce(
    (counts, event) => ({
      ...counts,
      [event.tournamentType]: (counts[event.tournamentType] || 0) + 1,
    }),
    { blitz: 0, classical: 0, other: 0, rapid: 0 },
  );

const buildRegions = (events, projection) => {
  const pointCounts = new Map();
  const pointBuckets = new Map();
  const regions = new Map();

  for (const event of events) {
    if (!event.coordinates) continue;
    const regionName = event.region || "Area TBA";
    const regionKey = slugifySegment(regionName) || "area-tba";
    const locationKey = `${event.coordinates.map((value) => value.toFixed(3)).join(",")}|${regionKey}`;
    pointCounts.set(locationKey, (pointCounts.get(locationKey) || 0) + 1);
  }

  for (const event of events) {
    const regionName = event.region || "Area TBA";
    const regionKey = slugifySegment(regionName) || "area-tba";
    const plotted = projection && event.coordinates ? projection(event.coordinates) : null;
    const locationKey = event.coordinates
      ? `${event.coordinates.map((value) => value.toFixed(3)).join(",")}|${regionKey}`
      : "";
    const currentPointCount = locationKey ? pointBuckets.get(locationKey) || 0 : 0;
    const totalPointCount = locationKey ? pointCounts.get(locationKey) || 1 : 1;

    if (locationKey) pointBuckets.set(locationKey, currentPointCount + 1);

    const marker = plotted ? markerFromProjected(plotted, currentPointCount, totalPointCount) : null;
    const normalizedEvent = {
      ...event,
      marker,
      regionKey,
    };

    if (!regions.has(regionKey)) {
      regions.set(regionKey, {
        count: 0,
        events: [],
        key: regionKey,
        label: regionName,
        liveCount: 0,
        marker: null,
        upcomingCount: 0,
      });
    }

    const region = regions.get(regionKey);
    region.count += 1;
    region.events.push(normalizedEvent);
    region.liveCount += normalizedEvent.liveNow ? 1 : 0;
    region.upcomingCount += normalizedEvent.liveNow ? 0 : 1;
  }

  const allRegions = [...regions.values()].map((region) => {
    const plottedEvents = region.events.filter((event) => event.marker);
    const marker = plottedEvents.length
      ? {
          x: Number((plottedEvents.reduce((sum, event) => sum + event.marker.x, 0) / plottedEvents.length).toFixed(2)),
          y: Number((plottedEvents.reduce((sum, event) => sum + event.marker.y, 0) / plottedEvents.length).toFixed(2)),
          radius: Number(Math.max(7, Math.min(18, 6 + Math.sqrt(region.count) * 2.4)).toFixed(2)),
        }
      : null;

    return {
      ...region,
      events: region.events.sort(sortEvents),
      marker,
      plottedCount: plottedEvents.length,
      typeCounts: typeCounts(region.events),
      unmappedCount: region.events.length - plottedEvents.length,
    };
  });

  return allRegions.sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
};

export function buildCountryCoverage(events = [], locale = "en") {
  const today = todayStartUtc();
  const normalizedEvents = events
    .filter((event) => isActiveOrUpcoming(event, today))
    .map((event, index) => normalizeEvent(event, index, locale, today));
  const countries = new Map();

  for (const event of normalizedEvents) {
    if (!countries.has(event.country)) {
      countries.set(event.country, {
        country: event.country,
        countryKey: slugifySegment(event.country) || "location-tba",
        events: [],
      });
    }

    countries.get(event.country).events.push(event);
  }

  const allCountries = [...countries.values()]
    .map((countryGroup) => {
      const eventsForCountry = countryGroup.events.sort(sortEvents);
      const { paths: flatMapPaths, projection } = makeFlatMap(countryGroup.country, eventsForCountry);
      const regions = buildRegions(eventsForCountry, projection);
      const info = countryInfo(countryGroup.country);
      const marker = countryGroup.country === "Location TBA" ? null : countryMarkerFor(countryGroup.country, eventsForCountry.length);
      const liveCount = eventsForCountry.filter((event) => event.liveNow).length;
      const atlasFeature = featureByName.get(info.atlasName) || featureByName.get(countryGroup.country);

      return {
        ...countryGroup,
        boundaryPath: atlasFeature ? worldPath(atlasFeature) : "",
        count: eventsForCountry.length,
        events: eventsForCountry,
        flagCode: info.flagCode || "xx",
        flatMapPaths,
        href: countryGroup.country === "Location TBA" ? "" : `/${locale}${countryHref(countryGroup.country)}`,
        label: formatCountryName(countryGroup.country, locale),
        liveCount,
        marker,
        plottedEvents: regions.flatMap((region) => region.events.filter((event) => event.marker)),
        regions,
        typeCounts: typeCounts(eventsForCountry),
        unmappedEvents: eventsForCountry.filter((event) => !event.coordinates),
        upcomingCount: eventsForCountry.length - liveCount,
      };
    })
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return {
    allCountries,
    defaultCountryKey: allCountries[0]?.countryKey || "",
    mapPaths: coverageMapPaths,
    mapSize: coverageMapSize,
    today: today.toISOString(),
    topCountries: allCountries.slice(0, 4),
    totalCountries: allCountries.length,
    totalLive: allCountries.reduce((sum, country) => sum + country.liveCount, 0),
    totalTournaments: normalizedEvents.length,
    totalUpcoming: allCountries.reduce((sum, country) => sum + country.upcomingCount, 0),
    unmappedCountries: allCountries.filter((country) => !country.marker),
  };
}
