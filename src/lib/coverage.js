import { geoBounds, geoCentroid, geoContains, geoEqualEarth, geoGraticule10, geoMercator, geoPath } from "d3-geo";
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
      "bosnia and herzegovina": "Bosnia & Herzegovina",
      "chinese taipei": "Chinese Taipei",
      "cote d ivoire": "Ivory Coast",
      czechia: "Czech Republic",
      "hong kong china": "Hong Kong, China",
      macedonia: "North Macedonia",
      "north macedonia": "North Macedonia",
      "of macedonia": "North Macedonia",
      "republic of macedonia": "North Macedonia",
      "republic of north macedonia": "North Macedonia",
      usa: "United States",
      us: "United States",
      turkiye: "Turkey",
      turkey: "Turkey",
      "republic of turkiye": "Turkey",
      "united states of america": "United States",
      uk: "United Kingdom",
    }[key] || country
  );
};

const countryAlias = {
  Andorra: { atlasName: "Andorra", coordinates: [1.5218, 42.5063], flagCode: "ad" },
  Argentina: { atlasName: "Argentina", flagCode: "ar" },
  Australia: { atlasName: "Australia", flagCode: "au" },
  Austria: { atlasName: "Austria", flagCode: "at" },
  Bahrain: { atlasName: "Bahrain", coordinates: [50.5577, 26.0667], flagCode: "bh" },
  Belgium: { atlasName: "Belgium", flagCode: "be" },
  "Bosnia & Herzegovina": { atlasName: "Bosnia and Herz.", flagCode: "ba" },
  Brazil: { atlasName: "Brazil", flagCode: "br" },
  Bulgaria: { atlasName: "Bulgaria", flagCode: "bg" },
  Canada: { atlasName: "Canada", flagCode: "ca" },
  China: { atlasName: "China", flagCode: "cn" },
  "Chinese Taipei": { atlasName: "Taiwan", flagCode: "tw" },
  Colombia: { atlasName: "Colombia", flagCode: "co" },
  "Costa Rica": { atlasName: "Costa Rica", flagCode: "cr" },
  Croatia: { atlasName: "Croatia", flagCode: "hr" },
  "Czech Republic": { atlasName: "Czechia", flagCode: "cz" },
  England: {
    atlasName: "United Kingdom",
    coordinates: [-1.9, 52.6],
    flagCode: "gb-eng",
    focusFeatureName: "United Kingdom",
  },
  Estonia: { atlasName: "Estonia", flagCode: "ee" },
  Finland: { atlasName: "Finland", flagCode: "fi" },
  France: { atlasName: "France", flagCode: "fr" },
  Georgia: { atlasName: "Georgia", flagCode: "ge" },
  Germany: { atlasName: "Germany", flagCode: "de" },
  Greece: { atlasName: "Greece", flagCode: "gr" },
  Guernsey: { atlasName: "Guernsey", coordinates: [-2.5853, 49.4657], flagCode: "gg" },
  "Hong Kong, China": { atlasName: "China", coordinates: [114.1694, 22.3193], flagCode: "hk" },
  Hungary: { atlasName: "Hungary", flagCode: "hu" },
  India: { atlasName: "India", flagCode: "in" },
  Italy: { atlasName: "Italy", flagCode: "it" },
  Japan: { atlasName: "Japan", flagCode: "jp" },
  Jordan: { atlasName: "Jordan", flagCode: "jo" },
  Kazakhstan: { atlasName: "Kazakhstan", flagCode: "kz" },
  "Ivory Coast": { atlasName: "Côte d'Ivoire", flagCode: "ci" },
  Latvia: { atlasName: "Latvia", flagCode: "lv" },
  Lebanon: { atlasName: "Lebanon", flagCode: "lb" },
  Lithuania: { atlasName: "Lithuania", flagCode: "lt" },
  Malta: { atlasName: "Malta", coordinates: [14.3754, 35.9375], flagCode: "mt" },
  Mexico: { atlasName: "Mexico", flagCode: "mx" },
  Monaco: { atlasName: "Monaco", coordinates: [7.4246, 43.7384], flagCode: "mc" },
  Montenegro: { atlasName: "Montenegro", flagCode: "me" },
  Morocco: { atlasName: "Morocco", flagCode: "ma" },
  Netherlands: { atlasName: "Netherlands", flagCode: "nl" },
  Nigeria: { atlasName: "Nigeria", flagCode: "ng" },
  "North Macedonia": { atlasName: "Macedonia", flagCode: "mk" },
  Poland: { atlasName: "Poland", flagCode: "pl" },
  Portugal: { atlasName: "Portugal", flagCode: "pt" },
  "Puerto Rico": { atlasName: "Puerto Rico", flagCode: "pr" },
  Romania: { atlasName: "Romania", flagCode: "ro" },
  Russia: { atlasName: "Russia", flagCode: "ru" },
  Serbia: { atlasName: "Serbia", flagCode: "rs" },
  Singapore: { atlasName: "Singapore", coordinates: [103.8198, 1.3521], flagCode: "sg" },
  Slovakia: { atlasName: "Slovakia", flagCode: "sk" },
  Slovenia: { atlasName: "Slovenia", flagCode: "si" },
  "South Africa": { atlasName: "South Africa", flagCode: "za" },
  Spain: { atlasName: "Spain", flagCode: "es" },
  Sweden: { atlasName: "Sweden", flagCode: "se" },
  Switzerland: { atlasName: "Switzerland", flagCode: "ch" },
  Thailand: { atlasName: "Thailand", flagCode: "th" },
  Tunisia: { atlasName: "Tunisia", flagCode: "tn" },
  Turkey: { atlasName: "Turkey", coordinates: [35.2433, 38.9637], flagCode: "tr" },
  "United Arab Emirates": { atlasName: "United Arab Emirates", flagCode: "ae" },
  "United Kingdom": { atlasName: "United Kingdom", flagCode: "gb" },
  "United States": { atlasName: "United States of America", flagCode: "us" },
  Uruguay: { atlasName: "Uruguay", flagCode: "uy" },
  Uzbekistan: { atlasName: "Uzbekistan", flagCode: "uz" },
  Vietnam: { atlasName: "Vietnam", flagCode: "vn" },
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
  ["A Guarda", "Spain", "Galicia", [-8.8744, 41.9013]],
  ["Alacant", "Spain", "Valencian Community", [-0.4907, 38.3452]],
  ["Alicante", "Spain", "Valencian Community", [-0.4907, 38.3452]],
  ["Azkoitia", "Spain", "Basque Country", [-2.311, 43.177]],
  ["Badalona", "Spain", "Catalonia", [2.245, 41.45]],
  ["Bormujos", "Spain", "Andalusia", [-6.0701, 37.3733]],
  ["Bormujos (Sevilla)", "Spain", "Andalusia", [-6.0701, 37.3733]],
  ["Calvia", "Spain", "Balearic Islands", [2.5066, 39.5653]],
  ["Cerceda", "Spain", "Galicia", [-8.4701, 43.1886]],
  ["Chipiona", "Spain", "Andalusia", [-6.432, 36.7366]],
  ["Chipiona, Cadiz", "Spain", "Andalusia", [-6.432, 36.7366]],
  ["Collado Villalba", "Spain", "Community of Madrid", [-4.0067, 40.6266]],
  ["Colunga", "Spain", "Asturias", [-5.2706, 43.4859]],
  ["El Vendrell", "Spain", "Catalonia", [1.5349, 41.2207]],
  ["Ferrol", "Spain", "Galicia", [-8.2333, 43.4832]],
  ["Granada", "Spain", "Andalusia", [-3.5986, 37.1773]],
  ["Ibiza", "Spain", "Balearic Islands", [1.4329, 38.9067]],
  ["Ibiza (Baleares)", "Spain", "Balearic Islands", [1.4329, 38.9067]],
  ["L'Escala", "Spain", "Catalonia", [3.1324, 42.1246]],
  ["La Pobla de Lillet", "Spain", "Catalonia", [1.9748, 42.2444]],
  ["La Pobla de Lillet (Barcelona)", "Spain", "Catalonia", [1.9748, 42.2444]],
  ["La Puerta de Segura", "Spain", "Andalusia", [-2.7396, 38.3522]],
  ["Lanzarote", "Spain", "Canary Islands", [-13.5899, 29.0469]],
  ["Meis", "Spain", "Galicia", [-8.7078, 42.5155]],
  ["O Mosteiro, Meis", "Spain", "Galicia", [-8.7078, 42.5155]],
  ["Padul", "Spain", "Andalusia", [-3.625, 37.0244]],
  ["San Vicente de Raspeig", "Spain", "Valencian Community", [-0.5255, 38.3964]],
  ["Sant Adria de Besos", "Spain", "Catalonia", [2.2232, 41.4306]],
  ["Sant Boi de Llobregat", "Spain", "Catalonia", [2.043, 41.3436]],
  ["Sant Vicent del Raspeig", "Spain", "Valencian Community", [-0.5255, 38.3964]],
  ["Santa Pola", "Spain", "Valencian Community", [-0.5555, 38.1917]],
  ["Sestao", "Spain", "Basque Country", [-2.9896, 43.3098]],
  ["Sestao, Basque Country", "Spain", "Basque Country", [-2.9896, 43.3098]],
  ["Sevilla", "Spain", "Andalusia", [-5.9845, 37.3891]],
  ["Toledo", "Spain", "Castilla-La Mancha", [-4.0273, 39.8628]],
  ["Valencia", "Spain", "Valencian Community", [-0.3763, 39.4699]],
  ["Villanueva de la Reina", "Spain", "Andalusia", [-3.9168, 38.0044]],
  ["Vitoria Gasteiz", "Spain", "Basque Country", [-2.6727, 42.8467]],
  ["Vitoria-Gasteiz", "Spain", "Basque Country", [-2.6727, 42.8467]],
  ["Zaragoza", "Spain", "Aragon", [-0.8891, 41.6488]],
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
  ["Warsaw", "Poland", "Masovian", [21.0067, 52.232]],
  ["Warszawa", "Poland", "Masovian", [21.0067, 52.232]],
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
  const eventCountry = cleanCountry(event.country || event.location?.country || event.metadata?.logistics?.country);
  const city = String(event.city || event.location?.city || event.metadata?.logistics?.city || "").trim();
  const directCoordinates = coordinatesFromEvent(event);
  const exactCityLocation = locationByCityAndCountry.get(`${normalizeText(city)}|${normalizeText(eventCountry)}`);
  const unscopedCityLocation = locationByCity.get(normalizeText(city));
  const cityLocation =
    exactCityLocation ||
    (!eventCountry || cleanCountry(unscopedCityLocation?.country) === eventCountry ? unscopedCityLocation : null);
  const country = eventCountry || cityLocation?.country || "";
  const safeDirectCoordinates = coordinatesFitCountry(country, directCoordinates) ? directCoordinates : null;
  const safeCityCoordinates = coordinatesFitCountry(country, cityLocation?.coordinates) ? cityLocation?.coordinates : null;

  return {
    city: city || cityLocation?.city || "",
    country,
    region:
      String(
        event.region ||
          event.location?.region ||
          event.location?.province ||
          event.metadata?.logistics?.province ||
          event.metadata?.logistics?.region ||
          "",
      ).trim() ||
      cityLocation?.region ||
      "",
    coordinates: safeDirectCoordinates || safeCityCoordinates || null,
  };
};

const coordinatesFromValue = (value) => {
  if (Array.isArray(value)) {
    const [lon, lat] = value.map(Number);
    if (Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) return [lon, lat];
  }

  if (value && typeof value === "object") {
    const lon = Number(value.longitude ?? value.lng ?? value.lon);
    const lat = Number(value.latitude ?? value.lat);
    if (Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90) return [lon, lat];
  }

  return null;
};

function coordinatesFromEvent(event) {
  const candidates = [
    event.coordinates,
    event.location?.coordinates,
    event.metadata?.logistics?.coordinates,
    [event.longitude, event.latitude],
    [event.lng, event.lat],
    [event.location?.longitude, event.location?.latitude],
    [event.location?.lng, event.location?.lat],
    [event.metadata?.logistics?.longitude, event.metadata?.logistics?.latitude],
    [event.metadata?.logistics?.lng, event.metadata?.logistics?.lat],
  ];

  for (const candidate of candidates) {
    const coordinates = coordinatesFromValue(candidate);
    if (coordinates) return coordinates;
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

const longitudeWithinBounds = (longitude, minLongitude, maxLongitude, padding) => {
  if (minLongitude <= maxLongitude) return longitude >= minLongitude - padding && longitude <= maxLongitude + padding;
  return longitude >= minLongitude - padding || longitude <= maxLongitude + padding;
};

const coordinatesFitCountry = (country, coordinates) => {
  if (!coordinates) return false;
  const [longitude, latitude] = coordinates;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return false;
  if (!country || country === "Location TBA") return true;

  const countryFeature = countryFeatureFor(country);
  const countryCenter = countryInfo(country).coordinates;

  if (!countryFeature) {
    if (!countryCenter) return true;
    return Math.abs(longitude - countryCenter[0]) <= 3.5 && Math.abs(latitude - countryCenter[1]) <= 3.5;
  }

  if (geoContains(countryFeature, coordinates)) return true;

  const [[minLongitude, minLatitude], [maxLongitude, maxLatitude]] = geoBounds(countryFeature);
  const boundsPadding = countryCenter ? 1.8 : 1.2;
  return (
    latitude >= minLatitude - boundsPadding &&
    latitude <= maxLatitude + boundsPadding &&
    longitudeWithinBounds(longitude, minLongitude, maxLongitude, boundsPadding)
  );
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

const cleanGlobeCoordinates = (coordinates) => {
  const cleanCoordinates = coordinatesFromValue(coordinates);
  if (!cleanCoordinates) return null;

  return cleanCoordinates.map((value) => Number(value.toFixed(4)));
};

const countryGlobeCoordinatesFor = (country) => {
  const info = countryInfo(country);
  const atlasFeature = featureByName.get(info.atlasName) || featureByName.get(country);
  return cleanGlobeCoordinates(info.coordinates || (atlasFeature ? geoCentroid(atlasFeature) : null));
};

const projectedPoint = (projected) => ({
  x: Number(projected[0].toFixed(2)),
  y: Number(projected[1].toFixed(2)),
});

const spreadPoint = (point, index, totalAtPoint, options = {}) => {
  if (totalAtPoint <= 1 || index === 0) return point;

  const angle = index * 2.399963229728653;
  const distance = Math.min(
    options.maxDistance || 11,
    (options.startDistance || 2.2) + Math.sqrt(index) * (options.stepDistance || 1.75),
  );

  return {
    x: Number((point.x + Math.cos(angle) * distance).toFixed(2)),
    y: Number((point.y + Math.sin(angle) * distance).toFixed(2)),
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
  const point = projectedPoint(projected);

  return spreadPoint(point, index, totalAtPoint, {
    maxDistance: 9.5,
    startDistance: 2,
    stepDistance: 1.45,
  });
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
          radius: Number(Math.max(5.5, Math.min(12, 4.6 + Math.sqrt(region.count) * 1.6)).toFixed(2)),
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

const buildWorldEvents = (allCountries) => {
  const candidates = [];
  const buckets = new Map();

  for (const country of allCountries) {
    for (const event of country.events) {
      const projected = event.coordinates ? worldProjection(event.coordinates) : country.marker ? [country.marker.x, country.marker.y] : null;
      if (!projected || !Number.isFinite(projected[0]) || !Number.isFinite(projected[1])) continue;

      const point = projectedPoint(projected);
      const markerSource = event.coordinates ? "city" : "country";
      const globeCoordinates = cleanGlobeCoordinates(event.coordinates || country.globeCoordinates);
      const markerKey =
        markerSource === "city"
          ? `city|${event.coordinates.map((value) => Number(value).toFixed(3)).join(",")}`
          : `country|${country.countryKey}`;

      const candidate = {
        ...event,
        countryFlagCode: country.flagCode,
        countryKey: country.countryKey,
        countryLabel: country.label,
        globeCoordinates,
        markerSource,
        point,
      };

      candidates.push(candidate);
      buckets.set(markerKey, (buckets.get(markerKey) || 0) + 1);
      candidate.markerKey = markerKey;
    }
  }

  const bucketIndexes = new Map();

  return candidates.map((candidate) => {
    const index = bucketIndexes.get(candidate.markerKey) || 0;
    const totalAtPoint = buckets.get(candidate.markerKey) || 1;
    bucketIndexes.set(candidate.markerKey, index + 1);

    const marker = spreadPoint(candidate.point, index, totalAtPoint, {
      maxDistance: candidate.markerSource === "country" ? 18 : 10,
      startDistance: candidate.markerSource === "country" ? 2.6 : 1.8,
      stepDistance: candidate.markerSource === "country" ? 2.15 : 1.45,
    });

    const { markerKey, point, ...event } = candidate;

    return {
      ...event,
      anchor: point,
      marker: {
        ...marker,
        radius: candidate.markerSource === "country" ? 1.55 : 1.85,
      },
    };
  });
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
      const globeCoordinates = countryGroup.country === "Location TBA" ? null : countryGlobeCoordinatesFor(countryGroup.country);
      const liveCount = eventsForCountry.filter((event) => event.liveNow).length;
      const atlasFeature = featureByName.get(info.atlasName) || featureByName.get(countryGroup.country);

      return {
        ...countryGroup,
        boundaryPath: atlasFeature ? worldPath(atlasFeature) : "",
        count: eventsForCountry.length,
        events: eventsForCountry,
        flagCode: info.flagCode || "xx",
        flatMapPaths,
        globeCoordinates,
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
  const worldEvents = buildWorldEvents(allCountries).sort(
    (a, b) => Number(a.markerSource === "country") - Number(b.markerSource === "country") || String(a.startDate).localeCompare(String(b.startDate)),
  );

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
    worldEvents,
  };
}
