"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackAnalyticsEvent, trackPageView, trackingIsEnabled } from "@/lib/tracking";

const datasetPayloadFor = (element) => ({
  entityType: element.dataset.trackingEntityType,
  entityId: element.dataset.trackingEntityId,
  entitySlug: element.dataset.trackingEntitySlug,
  entityTitle: element.dataset.trackingEntityTitle,
  outboundUrl: element.dataset.trackingOutboundUrl || (element.tagName === "A" ? element.href : ""),
  routeType: element.dataset.trackingRouteType,
  metadata: {
    placement: element.dataset.trackingPlacement,
    label: element.dataset.trackingLabel,
  },
});

export function TrackingProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!trackingIsEnabled()) return;
    trackPageView(pathname || "/");
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!trackingIsEnabled()) return undefined;

    const onClick = (event) => {
      const element = event.target?.closest?.("[data-tracking-event]");
      if (!element) return;
      trackAnalyticsEvent(element.dataset.trackingEvent, datasetPayloadFor(element));
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
