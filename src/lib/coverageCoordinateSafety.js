export const validMapCoordinatePair = (value) => {
  if (!Array.isArray(value) || value.length < 2) return null;

  const longitude = Number(value[0]);
  const latitude = Number(value[1]);
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
  if (Math.abs(longitude) > 180 || Math.abs(latitude) > 90) return null;

  return [longitude, latitude];
};

// A tournament pin must represent a known tournament location. Country centers
// are useful for country navigation, but are never a safe tournament fallback.
export const tournamentMarkerCoordinates = (event) => validMapCoordinatePair(event?.coordinates);
