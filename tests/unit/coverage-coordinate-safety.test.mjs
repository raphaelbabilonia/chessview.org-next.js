import assert from "node:assert/strict";
import test from "node:test";
import {
  tournamentMarkerCoordinates,
  validMapCoordinatePair,
} from "../../src/lib/coverageCoordinateSafety.js";

test("tournament markers require real event coordinates", () => {
  assert.equal(
    tournamentMarkerCoordinates({
      coordinates: null,
      countryCoordinates: [-3.7492, 40.4637],
      title: "XXVI Obert Internacional Sant Martí 2026 Grup B",
    }),
    null,
  );
});

test("valid tournament coordinates are preserved", () => {
  assert.deepEqual(tournamentMarkerCoordinates({ coordinates: [2.177073, 41.3825802] }), [2.177073, 41.3825802]);
});

test("invalid coordinate ranges cannot create tournament markers", () => {
  assert.equal(validMapCoordinatePair([181, 41]), null);
  assert.equal(validMapCoordinatePair([2, 91]), null);
  assert.equal(validMapCoordinatePair(["unknown", 41]), null);
});
