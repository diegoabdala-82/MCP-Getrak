/**
 * Epic 3 — Localização (US-013 a US-019). Ponto único de registro das 7
 * tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetOfflineTreatmentHistoryTool } from "./get-offline-treatment-history.js";
import { createGetOfflineTreatmentsTool } from "./get-offline-treatments.js";
import { createGetVehicleCurrentLocationTool } from "./get-vehicle-current-location.js";
import { createGetVehicleInputsReportTool } from "./get-vehicle-inputs-report.js";
import { createGetVehicleLocationHistoryTool } from "./get-vehicle-location-history.js";
import { createGetVehicleMovementsAndStopsTool } from "./get-vehicle-movements-and-stops.js";
import { createGetVehiclePathsTool } from "./get-vehicle-paths.js";
import type { LocationsToolDeps } from "./shared.js";

export function registerLocationTools(registerDomainTool: RegisterDomainTool, deps: LocationsToolDeps): void {
  registerDomainTool(createGetVehicleCurrentLocationTool(deps));
  registerDomainTool(createGetVehicleLocationHistoryTool(deps));
  registerDomainTool(createGetVehiclePathsTool(deps));
  registerDomainTool(createGetVehicleMovementsAndStopsTool(deps));
  registerDomainTool(createGetVehicleInputsReportTool(deps));
  registerDomainTool(createGetOfflineTreatmentsTool(deps));
  registerDomainTool(createGetOfflineTreatmentHistoryTool(deps));
}
