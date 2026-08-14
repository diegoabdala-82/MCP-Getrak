/**
 * Epic 4 — Equipamentos (US-020, US-021). Ponto único de registro das 2
 * tools do domínio no catálogo/servidor MCP.
 */

import type { RegisterDomainTool } from "../../server.js";
import { createGetEquipmentBenchPositionTool } from "./get-equipment-bench-position.js";
import { createSearchEquipmentsTool } from "./search-equipments.js";
import type { EquipmentsToolDeps } from "./shared.js";

export function registerEquipmentTools(registerDomainTool: RegisterDomainTool, deps: EquipmentsToolDeps): void {
  registerDomainTool(createSearchEquipmentsTool(deps));
  registerDomainTool(createGetEquipmentBenchPositionTool(deps));
}
