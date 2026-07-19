"use client";

import { geoEqualEarth, geoMercator, geoPath } from "d3-geo";
import { useEffect, useMemo, useState } from "react";
import { feature } from "topojson-client";
import worldAtlas from "world-atlas/countries-110m.json";
import {
  coverageAdminBoundaryOpacity,
  decodedCoverageBoundaryLines,
  loadCoverageAdminBoundaries,
} from "@/lib/coverageAdminBoundaries";

const mapExtent = [
  [62, 38],
  [898, 438],
];
const countryFeatures = feature(worldAtlas, worldAtlas.objects.countries).features;
const countryFeatureByName = new Map(countryFeatures.map((country) => [country.properties.name, country]));

const projectionForView = (countryMode, mapFeatureName) => {
  if (!countryMode) return geoEqualEarth().fitExtent(mapExtent, { type: "Sphere" });
  const mapFeature = countryFeatureByName.get(mapFeatureName);
  return mapFeature ? geoMercator().fitExtent(mapExtent, mapFeature) : null;
};

export function CoverageAdminBoundaryLayer({ countryMode = false, countryName = "", mapFeatureName = "", zoom = 1 }) {
  const [boundaryData, setBoundaryData] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let active = true;
    loadCoverageAdminBoundaries()
      .then((data) => {
        if (active) setBoundaryData(data);
      })
      .catch(() => {
        if (active) setLoadFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const pathData = useMemo(() => {
    if (!boundaryData) return "";
    const projection = projectionForView(countryMode, mapFeatureName);
    if (!projection) return "";
    const lines = decodedCoverageBoundaryLines(boundaryData, countryMode ? [countryName, mapFeatureName] : undefined);
    if (!lines.length) return "";
    return geoPath(projection)({ type: "MultiLineString", coordinates: lines }) || "";
  }, [boundaryData, countryMode, countryName, mapFeatureName]);

  if (loadFailed || !pathData) return null;
  const opacity = coverageAdminBoundaryOpacity(zoom, countryMode);

  return (
    <path
      aria-hidden="true"
      className="coverage-admin-boundaries"
      d={pathData}
      data-coverage-admin-boundaries={opacity >= 1 ? "visible" : "fading"}
      style={{ opacity }}
      vectorEffect="non-scaling-stroke"
    />
  );
}
