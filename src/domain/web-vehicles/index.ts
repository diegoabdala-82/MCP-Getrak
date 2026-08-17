/**
 * Epic 17 — Web Vehicles (US-070 a US-075; US-076 fora desta rodada, ver
 * `epicsuserstoriesimplementados.md`). Ponto único de registro das 6 tools
 * do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetVehicleByEquipmentTool } from "./get-vehicle-by-equipment.js";
import { createGetVehicleByPlateTool } from "./get-vehicle-by-plate.js";
import { createGetVehicleEquipmentHistoryTool } from "./get-vehicle-equipment-history.js";
import { createGetVehicleStatusTool } from "./get-vehicle-status.js";
import { createSearchVehiclesStatusTool } from "./search-vehicles-status.js";
import { createSearchWebVehiclesTool } from "./search-web-vehicles.js";
import type { WebVehiclesToolDeps } from "./shared.js";

export function registerWebVehicleTools(registerDomainTool: RegisterDomainTool, deps: WebVehiclesToolDeps): void {
  registerDomainTool(createSearchWebVehiclesTool(deps));
  registerDomainTool(createGetVehicleByEquipmentTool(deps));
  registerDomainTool(createGetVehicleEquipmentHistoryTool(deps));
  registerDomainTool(createGetVehicleByPlateTool(deps));
  registerDomainTool(createGetVehicleStatusTool(deps));
  registerDomainTool(createSearchVehiclesStatusTool(deps));
}
