const internalOrganizerPattern = /(?:chess\s*view.*agent|agent.*publisher)/i;
const blockedOperationalKeyPattern = /^(?:sourceAudit|reviewEvidence|internal|raw|debug|error|runId)$/i;

const isPlainObject = (value) =>
  value && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

const safeMetadataValue = (value) => {
  if (value === null || value === undefined) return value;
  if (["string", "number", "boolean"].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.slice(0, 100).map(safeMetadataValue);
  if (!isPlainObject(value)) return undefined;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !key.startsWith("_") && !blockedOperationalKeyPattern.test(key))
      .map(([key, entry]) => [key, safeMetadataValue(entry)])
      .filter(([, entry]) => entry !== undefined)
  );
};

export const metadataForPublicDisplay = (metadata = {}) => {
  if (!isPlainObject(metadata)) return {};
  const safe = safeMetadataValue(metadata);
  if (!isPlainObject(safe)) return {};
  delete safe.sourceAudit;
  delete safe.reviewEvidence;
  return safe;
};

export const organizerNameForPublicDisplay = (event = {}) => {
  const sourceName = String(event.sourceOrganizerName || "").trim();
  if (sourceName) return sourceName;
  const organizerName = String(event.organizer?.name || "").trim();
  return organizerName && !internalOrganizerPattern.test(organizerName) ? organizerName : "";
};
