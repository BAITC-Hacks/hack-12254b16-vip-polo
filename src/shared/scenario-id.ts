import { DIRECTIONS } from "./constants";
import type { ScenarioRequest } from "./types";

/** Canonical identity only, not validation or a trust/security token. */
export function makeScenarioId(request: ScenarioRequest): string {
  const decisions = request.decisions
    .map(({ direction, districtId, initiativeId }) => [direction, districtId, initiativeId] as const)
    .sort((a, b) => {
      const directionOrder = DIRECTIONS.indexOf(a[0]) - DIRECTIONS.indexOf(b[0]);
      if (directionOrder) return directionOrder;
      // Deterministic tie-breaks also cover malformed duplicate-direction drafts.
      const left = JSON.stringify(a);
      const right = JSON.stringify(b);
      return left < right ? -1 : left > right ? 1 : 0;
    });
  return JSON.stringify([request.modelVersion, request.datasetVersion, decisions]);
}
