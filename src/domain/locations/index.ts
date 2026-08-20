/**
 * Epic 3 — Localização (US-013 a US-019, e US-106 novo 20/08/2026). Ponto
 * único de registro das 8 tools do domínio no catálogo/servidor MCP.
 *
 * US-106 (`get_vehicle_last_registers`) é a única tool deste domínio que
 * usa o fluxo de token DELEGADO (`oauth2Password`/`GetrakWeb`, US-046 a
 * US-048) — as outras 7 continuam no modelo de credencial técnica anterior
 * (CLAUDE.md Seção 6.2, não migradas). Por isso os deps deste registrador
 * combinam `LocationsToolDeps` (modelo antigo) com `GetrakWebToolDeps`
 * (modelo novo) — cada tool usa só o que precisa.
 */

import type { RegisterDomainTool } from "../../server.js";
import type { GetrakWebToolDeps } from "../getrak-web-shared.js";
import { createGetOfflineTreatmentHistoryTool } from "./get-offline-treatment-history.js";
import { createGetOfflineTreatmentsTool } from "./get-offline-treatments.js";
import { createGetVehicleCurrentLocationTool } from "./get-vehicle-current-location.js";
import { createGetVehicleInputsReportTool } from "./get-vehicle-inputs-report.js";
import { createGetVehicleLastRegistersTool } from "./get-vehicle-last-registers.js";
import { createGetVehicleLocationHistoryTool } from "./get-vehicle-location-history.js";
import { createGetVehicleMovementsAndStopsTool } from "./get-vehicle-movements-and-stops.js";
import { createGetVehiclePathsTool } from "./get-vehicle-paths.js";
import type { LocationsToolDeps } from "./shared.js";

export type RegisterLocationToolsDeps = LocationsToolDeps & GetrakWebToolDeps;

export function registerLocationTools(registerDomainTool: RegisterDomainTool, deps: RegisterLocationToolsDeps): void {
  registerDomainTool(createGetVehicleCurrentLocationTool(deps));
  registerDomainTool(createGetVehicleLocationHistoryTool(deps));
  registerDomainTool(createGetVehiclePathsTool(deps));
  registerDomainTool(createGetVehicleMovementsAndStopsTool(deps));
  registerDomainTool(createGetVehicleInputsReportTool(deps));
  registerDomainTool(createGetOfflineTreatmentsTool(deps));
  registerDomainTool(createGetOfflineTreatmentHistoryTool(deps));
  registerDomainTool(createGetVehicleLastRegistersTool(deps));
}
