export function StatusBadge({ value, labels = {}, tone }) {
  const normalized = String(value || "unknown");
  const badgeTone =
    tone ||
    {
      published: "success",
      open: "success",
      completed: "neutral",
      draft: "warning",
      pending: "warning",
      cancelled: "danger",
      rejected: "danger",
      closed: "neutral",
      full: "danger",
    }[normalized] ||
    "neutral";

  return <span className={`badge badge-${badgeTone}`}>{labels[normalized] || normalized}</span>;
}
