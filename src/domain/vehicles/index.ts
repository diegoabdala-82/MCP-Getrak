/**
 * Epic 2 — Veículos (US-008 a US-012). Ponto único de registro das 5 tools
 * do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetSuspendedVehiclesTool } from "./get-suspended-vehicles.js";
import { createGetVehicleCategoryTool } from "./get-vehicle-category.js";
import { createGetVehicleClientLinkTool } from "./get-vehicle-client-link.js";
import { createGetVehicleSubclientLinkTool } from "./get-vehicle-subclient-link.js";
import { createSearchVehiclesTool } from "./search-vehicles.js";
import type { VehiclesToolDeps } from "./shared.js";

export function registerVehicleTools(registerDomainTool: RegisterDomainTool, deps: VehiclesToolDeps): void {
  registerDomainTool(createSearchVehiclesTool(deps));
  registerDomainTool(createGetVehicleCategoryTool(deps));
  registerDomainTool(createGetVehicleClientLinkTool(deps));
  registerDomainTool(createGetVehicleSubclientLinkTool(deps));
  registerDomainTool(createGetSuspendedVehiclesTool(deps));
}
