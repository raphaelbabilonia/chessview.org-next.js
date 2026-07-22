import { initAnalytics } from "@/lib/tracking";

try {
  initAnalytics();
} catch {
  // Analytics must never prevent the application from hydrating.
}
