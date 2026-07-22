"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackAnalyticsEvent, trackPageView, trackingIsEnabled } from "@/lib/tracking";
import { ANALYTICS_CONSENT_EVENT, ANALYTICS_READY_EVENT } from "@/lib/tracking-core";

const datasetPayloadFor = (element) => ({
  entityType: element.dataset.trackingEntityType,
  entityId: element.dataset.trackingEntityId,
  entitySlug: element.dataset.trackingEntitySlug,
  entityTitle: element.dataset.trackingEntityTitle,
  outboundUrl: element.dataset.trackingOutboundUrl,
  routeType: element.dataset.trackingRouteType,
  metadata: {
    placement: element.dataset.trackingPlacement,
    label: element.dataset.trackingLabel,
  },
});

export function TrackingProvider() {
  const pathname = usePathname();

  useEffect(() => {
    const captureCurrentPage = () => {
      if (trackingIsEnabled()) trackPageView(pathname || "/");
    };
    captureCurrentPage();
    window.addEventListener(ANALYTICS_CONSENT_EVENT, captureCurrentPage);
    window.addEventListener(ANALYTICS_READY_EVENT, captureCurrentPage);
    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_EVENT, captureCurrentPage);
      window.removeEventListener(ANALYTICS_READY_EVENT, captureCurrentPage);
    };
  }, [pathname]);

  useEffect(() => {
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
